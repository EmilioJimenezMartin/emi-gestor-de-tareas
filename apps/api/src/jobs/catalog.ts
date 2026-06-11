import type { Agenda, Job } from "agenda";
import axios from "axios";
import { Catalog } from "../models/catalog.js";

const _SERVER_API_KEY = process.env.SERVER_API_KEY || "";
function authHeaders() {
    return _SERVER_API_KEY ? { Authorization: `Bearer ${_SERVER_API_KEY}` } : {};
}
function internalFetch(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...init, headers: { ...(_SERVER_API_KEY ? { Authorization: `Bearer ${_SERVER_API_KEY}` } : {}), ...(init.headers as Record<string, string> ?? {}) } });
}
import { PromptMetric } from "../models/prompt-metric.js";
import { Settings } from "../models/settings.js";
import { getCloudinaryConfig, initCloudinary } from "../routes/cloudinary.js";
import { activateNextQueued } from "../lib/catalog-queue.js";
import { sendTelegram, shouldNotify, sendTelegramImageWithButtons } from "../lib/telegram.js";
import { withImageSlot } from "../lib/ai-semaphore.js";
import { buildColoringBookPrompt } from "../routes/autopilot.js";
import sharp from "sharp";


async function saveRejectedImageToVault(opts: {
    imageBuffer: Buffer;
    catalog: any;
    catalogId: string;
    reason: string;
    score: number;
    finalPrompt: string;
    io: any;
}): Promise<void> {
    const { imageBuffer, catalog, catalogId, reason, score, finalPrompt, io } = opts;
    try {
        const { RejectedImage } = await import("../models/rejected-image.js");
        const { getCloudinaryConfig: getCldCfg, initCloudinary: initCld } = await import("../routes/cloudinary.js");

        const config = await getCldCfg();
        if (!config) return;

        const base64 = imageBuffer.toString("base64");
        const dataUrl = `data:image/png;base64,${base64}`;
        const cld = await initCld(config);
        const uploadResult = await cld.uploader.upload(dataUrl, {
            folder: `emi-kdp-rejected/${catalogId}`,
            resource_type: "image",
            timeout: 60000,
        });

        const rejected = await RejectedImage.create({
            catalogId,
            catalogName: catalog.name,
            nicheIds: catalog.nicheIds ?? [],
            imageUrl: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            reason,
            score,
            prompt: finalPrompt.slice(0, 500),
            reviewStatus: "pending",
        });

        io.emit("vault:rejected", {
            id: String(rejected._id),
            catalogId,
            catalogName: catalog.name,
            nicheIds: catalog.nicheIds ?? [],
            imageUrl: uploadResult.secure_url,
            reason,
            score,
        });

        if (await shouldNotify("catalog.vault_rejected")) {
            const caption = `🚫 <b>Imagen rechazada</b>\n📁 Catálogo: <b>${catalog.name}</b>\n❌ ${reason} (score ${score})\n<i>Revisa el vault para incluirla o eliminarla</i>`;
            const msgId = await sendTelegramImageWithButtons(
                imageBuffer,
                caption,
                [
                    [
                        { text: "✅ Incluir en catálogo", callback_data: `vault_include:${String(rejected._id)}` },
                        { text: "🗑️ Eliminar", callback_data: `vault_delete:${String(rejected._id)}` },
                    ],
                ]
            );
            if (msgId) {
                rejected.telegramMessageId = msgId;
                await rejected.save();
            }
        }
    } catch (vaultErr: any) {
        console.warn(`[catalog] Vault save failed: ${vaultErr?.message}`);
    }
}

async function isQualityCheckEnabled(): Promise<boolean> {
    try {
        const row = await Settings.findOne({ key: "QUALITY_CHECK_ENABLED" }).lean();
        return (row as any)?.value !== "0" && (row as any)?.value !== "false";
    } catch { return true; }
}

const JOB_NAME = "generate-catalog-image";
const LOCK_LIFETIME_MS = 8 * 60 * 1000;  // 8 min per job execution
const AXIOS_TIMEOUT_MS = 120_000;          // 2 min — per-request axios timeout
const HARD_ABORT_MS = 5 * 60 * 1000;      // 5 min — auto-skip if image hangs this long
const MAX_IMAGE_RETRIES = 2;               // retry failed image up to 2 times before skipping

function simplifyPrompt(prompt: string): string {
    return prompt
        .replace(/[^a-zA-Z0-9\s,.\-éáíóúüñÉÁÍÓÚÜÑ]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(/\s+/)
        .slice(0, 25)
        .join(" ");
}

async function getNicheScore(nicheIds: string[]): Promise<number> {
    if (!nicheIds?.length) return 0;
    try {
        const { Niche } = await import("../models/niche.js");
        const niche = await Niche.findById(nicheIds[0]).select("score").lean();
        return (niche as any)?.score ?? 0;
    } catch { return 0; }
}

async function trackPromptMetric(prompt: string, productType: string, success: boolean, score: number): Promise<void> {
    try {
        const normalized = prompt.slice(0, 200).toLowerCase().replace(/\s+/g, " ").trim();
        const hash = Buffer.from(normalized).toString("base64").slice(0, 40);
        const preview = prompt.slice(0, 120);
        const doc = await PromptMetric.findOneAndUpdate(
            { promptHash: hash, productType },
            {
                $set: { promptPreview: preview, lastUsed: new Date() },
                $inc: { attempts: 1, successes: success ? 1 : 0, skips: success ? 0 : 1, totalScore: score },
            },
            { upsert: true, returnDocument: 'after' }
        );
        if (doc) {
            doc.avgScore = doc.attempts > 0 ? Math.round(doc.totalScore / doc.attempts) : 0;
            doc.successRate = doc.attempts > 0 ? Math.round((doc.successes / doc.attempts) * 100) : 0;
            await doc.save();
        }
    } catch (e: any) {
        console.warn(`[prompt-metrics] track failed: ${e?.message}`);
    }
}

type QualityResult = { ok: boolean; score: number; reason?: string };

async function analyzeImageQuality(buffer: Buffer, productType: string): Promise<QualityResult> {
    try {
        const image = sharp(buffer);
        const { width = 0, height = 0, channels = 3 } = await image.metadata();
        const totalPixels = width * height;
        if (totalPixels === 0) return { ok: false, score: 0, reason: "Imagen sin dimensiones válidas" };

        // Get raw pixel data (RGB, no alpha)
        const raw = await image.removeAlpha().raw().toBuffer();
        const pixelCount = raw.length / (channels > 3 ? 3 : channels);

        if (productType === "coloring-book") {
            // Expected: mostly white background with dark outlines (black OR dark grey)
            let whitePixels = 0;     // R,G,B all > 220
            let darkLinePixels = 0;  // max(R,G,B) < 100 — pure black AND dark-grey outlines
            let colorPixels = 0;     // high saturation non-dark pixel — sign of full-color art
            let blankSuspect = 0;    // near-white (> 240 brightness)

            const step = channels > 3 ? 4 : 3;
            for (let i = 0; i < raw.length; i += step) {
                const r = raw[i], g = raw[i + 1], b = raw[i + 2];
                const brightness = (r + g + b) / 3;
                const maxC = Math.max(r, g, b);
                const minC = Math.min(r, g, b);
                const saturation = maxC > 0 ? (maxC - minC) / maxC : 0;

                if (r > 220 && g > 220 && b > 220) whitePixels++;
                else if (maxC < 100) darkLinePixels++;                      // dark grey or black
                else if (saturation > 0.3 && brightness < 210) colorPixels++;

                if (brightness > 240) blankSuspect++;
            }

            const whitePct = whitePixels / pixelCount;
            const darkLinePct = darkLinePixels / pixelCount;
            const colorPct = colorPixels / pixelCount;
            const blankPct = blankSuspect / pixelCount;

            // Blank image: >98% near-white → failed generation
            if (blankPct > 0.98) {
                return { ok: false, score: 0, reason: `Imagen en blanco (${(blankPct * 100).toFixed(0)}% píxeles blancos)` };
            }

            // Essentially no dark lines → completely wrong style (very permissive to allow light line art)
            if (darkLinePct < 0.003) {
                return { ok: false, score: 10, reason: `Sin líneas (${(darkLinePct * 100).toFixed(2)}%) — no es libro de colorear` };
            }

            // Too many vivid color pixels → full-color illustration, not line art
            if (colorPct > 0.30) {
                return { ok: false, score: 20, reason: `Imagen a color (${(colorPct * 100).toFixed(0)}% píxeles coloreados) — se esperaba línea B&W` };
            }

            const score = Math.round(
                Math.min(whitePct * 60, 60) +
                Math.min(darkLinePct * 1000, 30) +
                Math.max(10 - colorPct * 100, 0)
            );

            return { ok: true, score };
        } else {
            // Printable poster: just check it's not blank
            let blankPixels = 0;
            const step = channels > 3 ? 4 : 3;
            for (let i = 0; i < raw.length; i += step) {
                const r = raw[i], g = raw[i + 1], b = raw[i + 2];
                if (r > 240 && g > 240 && b > 240) blankPixels++;
            }
            const blankPct = blankPixels / pixelCount;
            if (blankPct > 0.97) {
                return { ok: false, score: 0, reason: `Imagen en blanco (${(blankPct * 100).toFixed(0)}%)` };
            }
            return { ok: true, score: 80 };
        }
    } catch (e: any) {
        // Quality check failed — don't block upload, just log
        console.warn(`[quality-check] Error analizando imagen: ${e.message}`);
        return { ok: true, score: 50, reason: "quality-check-skipped" };
    }
}

async function checkAutoPilotContinue(tag: string, catalogId: string, nicheIds: string[], agenda: Agenda, io: any): Promise<void> {
    if (!nicheIds.length) return;
    try {
        const { Niche } = await import("../models/niche.js");
        for (const nicheId of nicheIds) {
            const niche = await Niche.findById(nicheId).lean();
            if (!(niche as any)?.autoPilotEnabled) continue;
            if ((niche as any).phase !== "catalog") continue;
            const allCats = await Catalog.find({ nicheIds: nicheId }).lean();
            if (!allCats.length) continue;
            const allDone = allCats.every(
                (c: any) => c.status === "completed" || c.status === "cancelled" || c.status === "failed"
            );
            if (!allDone) continue;

            // Collect all images across catalogs and shuffle (random book order)
            const allImages: string[] = [];
            for (const cat of allCats) {
                for (const img of (cat as any).images ?? []) {
                    if (img.url) allImages.push(img.url as string);
                }
            }
            for (let i = allImages.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allImages[i], allImages[j]] = [allImages[j], allImages[i]];
            }

            // Directly advance phase — don't depend on autopilot-run executing for this transition
            await Niche.findByIdAndUpdate(nicheId, {
                $set: { phase: "libro", catalogImageOrder: allImages },
            });
            io?.emit("niches:updated");
            io?.emit("autopilot:log", {
                nicheId,
                message: `✅ ${allImages.length} imágenes en orden aleatorio → generando libro PDF`,
            });
            console.log(`${tag} All catalogs done for niche ${nicheId} — advanced to libro, ${allImages.length} images shuffled`);

            // Schedule autopilot-run to handle libro → seo → cover (Agenda + direct HTTP fallback)
            let scheduled = false;
            try {
                await agenda.schedule("in 5 seconds", "autopilot-run", {});
                scheduled = true;
            } catch (schedErr) {
                console.error(`${tag} Failed to schedule follow-up autopilot-run:`, schedErr);
            }
            if (!scheduled) {
                const port = process.env.PORT || 3001;
                void internalFetch(`http://localhost:${port}/autopilot/run`, { method: "POST" }).catch(
                    (e: any) => console.error(`${tag} HTTP fallback trigger failed:`, e)
                );
            }
            break;
        }
    } catch (e) {
        console.error(`${tag} checkAutoPilotContinue failed:`, e);
    }
}

export function defineCatalogJob(agenda: Agenda, io: any) {
    const handler = async (job: Job) => {
        const { catalogId, retryCount = 0, overridePrompt, overrideModel } = (job.attrs.data ?? {}) as {
            catalogId: string;
            retryCount?: number;
            overridePrompt?: string;
            overrideModel?: { id: string; modelId: string; name: string; provider: string };
        };
        const tag = `[catalog-job][${catalogId}]${retryCount > 0 ? `[retry${retryCount}]` : ""}`;

        if (!catalogId) {
            console.error(`${tag} No catalogId provided`);
            return;
        }

        const catalog = await Catalog.findById(catalogId);
        if (!catalog) {
            console.error(`${tag} Catalog not found`);
            return;
        }

        if (catalog.status === "cancelled" || catalog.status === "completed" || catalog.status === "failed") {
            console.log(`${tag} Status=${catalog.status} — skipping (terminal state)`);
            return;
        }

        // Priority = niche score so high-value niches jump ahead in the AI queue
        const nicheScore = await getNicheScore(catalog.nicheIds ?? []);

        const attemptedSoFar = catalog.images.length + (catalog.skippedImages ?? 0);

        if (attemptedSoFar >= catalog.totalImages) {
            catalog.status = "completed";
            await catalog.save();
            io.emit("catalog:completed", { catalogId });
            void activateNextQueued(agenda, io);
            shouldNotify("catalog.ready").then(ok => {
                if (ok) sendTelegram(`🖼️ <b>Catálogo listo</b>\n"${catalog.name}" — ${catalog.images.length} imágenes generadas`).catch(() => {});
            });
            return;
        }

        const imageSlot = attemptedSoFar + 1;
        console.log(`${tag} Generating image slot ${imageSlot}/${catalog.totalImages} (${catalog.images.length} ok, ${catalog.skippedImages ?? 0} skipped)`);

        catalog.status = "running";
        await catalog.save();

        io.emit("catalog:progress", {
            catalogId,
            status: "running",
            current: catalog.images.length,
            total: catalog.totalImages,
            skipped: catalog.skippedImages ?? 0,
            imageStartedAt: Date.now(),
        });
        // promptSnippet emitted after prompt is built (below)

        try {
            // Build prompt — use simplified override on retries
            const creativity = catalog.creativity ?? 50;
            let finalPrompt = overridePrompt || catalog.prompt;
            if (catalog.promptParts?.theme) {
                let particulars = catalog.promptParts.particulars ?? "";
                if (particulars && creativity > 10) {
                    try {
                        const { varyTextWithLLM } = await import("../lib/ai.js");
                        const timeout = new Promise<string>((_, reject) =>
                            setTimeout(() => reject(new Error("LLM timeout after 15s")), 15000)
                        );
                        particulars = await Promise.race([varyTextWithLLM(particulars, creativity), timeout]);
                        console.log(`${tag} LLM variation OK (creativity=${creativity})`);
                    } catch (llmErr: any) {
                        console.warn(`${tag} LLM variation failed (kept original): ${llmErr?.message ?? llmErr}`);
                    }
                }
                finalPrompt = `Genera una imagen con la siguiente temática: ${catalog.promptParts.theme}`;
                if (catalog.promptParts.specs) finalPrompt += `, que tenga las siguientes especificaciones: ${catalog.promptParts.specs}`;
                if (catalog.promptParts.details) finalPrompt += `, con los siguientes detalles: ${catalog.promptParts.details}`;
                if (particulars) finalPrompt += `, y las siguientes particularidades: ${particulars}`;
            }

            // ── Micro-variación automática entre catálogos del mismo nicho ──
            // Si el nicho ya tiene otro catálogo, la IA reformula ligeramente el prompt
            // (sinónimos, mismo sujeto) UNA vez por catálogo para que las tiradas no
            // salgan clónicas. Fail-safe total: si el LLM falla o tarda, prompt intacto.
            if (!catalog.promptParts?.theme && !overridePrompt && !catalog.autoVariedPrompt
                && (catalog.nicheIds?.length ?? 0) > 0
                && !finalPrompt.includes("coloring book page")) {
                catalog.autoVariedPrompt = true; // marcar SIEMPRE — un intento por catálogo
                try {
                    const siblings = await Catalog.countDocuments({
                        _id: { $ne: catalog._id },
                        nicheIds: { $in: catalog.nicheIds },
                    });
                    if (siblings > 0) {
                        const { varyTextWithLLM } = await import("../lib/ai.js");
                        const timeout = new Promise<string>((_, reject) =>
                            setTimeout(() => reject(new Error("vary timeout 12s")), 12_000));
                        const varied = await Promise.race([varyTextWithLLM(finalPrompt, 30), timeout]);
                        if (varied && varied !== finalPrompt && varied.length > 10) {
                            finalPrompt = varied;
                            catalog.prompt = varied; // persistir: todos los slots usan la misma variación
                            console.log(`${tag} Variación auto (catálogo nº${siblings + 1} del nicho): "${varied.slice(0, 70)}…"`);
                        }
                    }
                } catch (e: any) {
                    console.warn(`${tag} Variación auto falló (prompt intacto): ${e?.message ?? e}`);
                }
                await catalog.save().catch(() => {});
            }

            // Apply product-type modifiers and build negative prompt
            const productType = catalog.productType ?? "coloring-book";
            const catalogStyle = ((catalog as any).styleCategory ?? (catalog as any).styleCategories?.[0] ?? "generic") as string;
            const userNegative = catalog.negativePrompt?.trim() ?? "";

            let finalNegativePrompt = "";
            if (productType === "coloring-book") {
                // Style-aware formula — only append if technical suffix not already present
                const alreadyHasFormula = finalPrompt.includes("coloring book page") || finalPrompt.includes("black line art on white");
                if (!alreadyHasFormula) {
                    finalPrompt = buildColoringBookPrompt(finalPrompt, catalogStyle);
                }
                const coloringNegative = "gray, grey, gray background, grey background, gray fill, grey fill, gray tones, off-white, cream, beige, shading, shadow, shadows, soft shadow, drop shadow, inner shadow, cast shadow, gradient, gradients, color, colors, sepia, tones, halftone, texture, textures, rough texture, paper texture, canvas texture, crosshatching, stippling, hatching, watercolor, painterly, painting, illustrated, blur, blurry, soft focus, glow, bloom, soft edges, feathered edges, background pattern, noise, film grain, grain, vignette, fog, mist, ambient occlusion, depth of field, bokeh, watermark, signature, logo, frame, border decoration, 3d render, 3d, realistic, photo, photograph";
                finalNegativePrompt = userNegative ? `${coloringNegative}, ${userNegative}` : coloringNegative;
            } else if (productType === "printable-poster") {
                finalPrompt += ". Style: high quality, high resolution, vibrant colors, print-ready, professional poster design, sharp fine details, suitable for large format printing";
                finalNegativePrompt = userNegative;
            } else {
                finalNegativePrompt = userNegative;
            }

            // Variación automática por slot: sin promptParts, todos los slots compartían el
            // mismo prompt → imágenes casi idénticas. Cada slot recibe un hint composicional
            // distinto (rotando por estilo) + seed aleatoria explícita.
            if (!catalog.promptParts?.theme && !overridePrompt) {
                const { injectVariationHint } = await import("../lib/catalog-prompt.js");
                finalPrompt = injectVariationHint(finalPrompt, catalogStyle, imageSlot - 1);
                console.log(`${tag} Variación slot ${imageSlot}: hint inyectado`);
            }
            const slotSeed = Math.floor(Math.random() * 999_999);

            console.log(`${tag} Prompt (${finalPrompt.length} chars): ${finalPrompt.slice(0, 100)}...`);
            if (finalNegativePrompt) console.log(`${tag} Negative prompt: ${finalNegativePrompt.slice(0, 80)}...`);

            // Emit prompt snippet so UI can show what's being generated
            io.emit("catalog:progress", {
                catalogId,
                status: "running",
                current: catalog.images.length,
                total: catalog.totalImages,
                skipped: catalog.skippedImages ?? 0,
                promptSnippet: finalPrompt.slice(0, 80),
            });

            // Generate image — todos los proveedores van por el proxy /ai/generate-image
            let imageBuffer: Buffer;

            const activeModel = overrideModel ?? catalog.aiModel;
            const port = process.env.PORT || 3001;
            const axiosTimeoutMs = (activeModel.provider === "Stable Horde" || activeModel.provider === "Cloudflare") ? 200_000 : AXIOS_TIMEOUT_MS;
            console.log(`${tag} Calling proxy: provider=${activeModel.provider} model=${activeModel.modelId} (waiting for img-lock… priority=${nicheScore})`);
            imageBuffer = await withImageSlot(`catalog-proxy:${catalogId}:${imageSlot}`, async () => {
                const abortCtrl = new AbortController();
                const hardTimeout = setTimeout(() => abortCtrl.abort(), HARD_ABORT_MS);
                try {
                    const response = await axios.post(
                        `http://localhost:${port}/ai/generate-image`,
                        {
                            prompt: finalPrompt,
                            modelId: activeModel.modelId,
                            provider: activeModel.provider,
                            width: catalog.width,
                            height: catalog.height,
                            advancedParams: {
                                seed: slotSeed,
                                ...(finalNegativePrompt ? { negativePrompt: finalNegativePrompt } : {}),
                                ...(activeModel.provider === "Ideogram" ? { style: "ILLUSTRATION" } : {}),
                            },
                        },
                        { responseType: "arraybuffer", timeout: axiosTimeoutMs, signal: abortCtrl.signal, headers: authHeaders() }
                    );
                    clearTimeout(hardTimeout);
                    if (response.status !== 200) throw new Error(`Proxy HTTP ${response.status}`);
                    const contentType = (response.headers["content-type"] ?? "") as string;
                    if (!contentType.startsWith("image/")) {
                        const preview = Buffer.from(response.data).toString("utf8").slice(0, 300);
                        throw new Error(`Proxy devolvió ${contentType}: ${preview}`);
                    }
                    const buf = Buffer.from(response.data);
                    console.log(`${tag} Proxy OK — ${buf.length} bytes`);
                    return buf;
                } catch (e: any) {
                    clearTimeout(hardTimeout);
                    if (e?.code === "ERR_CANCELED" || abortCtrl.signal.aborted) {
                        throw new Error(`Imagen colgada tras ${HARD_ABORT_MS / 60000} min — slot omitido automáticamente`);
                    }
                    throw e;
                }
            });

            // Quality gate — analyze pixels before uploading (skipped when disabled in settings)
            const qualityEnabled = await isQualityCheckEnabled();
            const quality = await analyzeImageQuality(imageBuffer, catalog.productType ?? "coloring-book");
            console.log(`${tag} Quality: score=${quality.score} ok=${quality.ok} enabled=${qualityEnabled}${quality.reason ? ` reason="${quality.reason}"` : ""}`);
            if (qualityEnabled && !quality.ok) {
                // Save to vault on first attempt only (avoid duplicate vault entries per slot across retries)
                if (retryCount === 0) {
                    void saveRejectedImageToVault({
                        imageBuffer,
                        catalog,
                        catalogId,
                        reason: quality.reason ?? "Quality check failed",
                        score: quality.score,
                        finalPrompt,
                        io,
                    });
                }
                throw new Error(`Calidad insuficiente (score ${quality.score}): ${quality.reason}`);
            }

            // Binarize coloring books — eliminate all grey tones, shadows, textures
            // threshold(128): pixels ≥ 128 → pure white (background, grays, soft shadows)
            //                 pixels  < 128 → pure black (outlines and their halos)
            if ((catalog.productType ?? "coloring-book") === "coloring-book") {
                try {
                    imageBuffer = await sharp(imageBuffer)
                        .flatten({ background: { r: 255, g: 255, b: 255 } })
                        .greyscale()
                        .threshold(128)
                        .png()
                        .toBuffer();
                } catch (e: any) {
                    console.warn(`${tag} Coloring book binarization failed (using original): ${e.message}`);
                }
            }

            // Upload to Cloudinary
            console.log(`${tag} Uploading to Cloudinary (quality score=${quality.score})...`);
            const config = await getCloudinaryConfig();
            if (!config) throw new Error("Cloudinary no configurado");

            const base64 = imageBuffer.toString("base64");
            const dataUrl = `data:image/png;base64,${base64}`;
            const cld = await initCloudinary(config);
            const uploadResult = await cld.uploader.upload(dataUrl, {
                folder: `emi-kdp-catalogs/${catalogId}`,
                resource_type: "image",
                timeout: 120000,
            });
            console.log(`${tag} Cloudinary OK: ${uploadResult.public_id}`);

            const newImage = {
                publicId: uploadResult.public_id,
                url: uploadResult.secure_url,
                width: uploadResult.width,
                height: uploadResult.height,
                bytes: uploadResult.bytes,
                createdAt: uploadResult.created_at,
            };

            // Re-fetch to avoid race conditions
            const freshCatalog = await Catalog.findById(catalogId);
            if (!freshCatalog || freshCatalog.status === "cancelled") {
                console.log(`${tag} Cancelled after generation — discarding image`);
                return;
            }

            freshCatalog.images.push(newImage);
            freshCatalog.lastError = "";
            const newCount = freshCatalog.images.length;
            void trackPromptMetric(finalPrompt, catalog.productType ?? "coloring-book", true, quality.score);
            const newAttempted = newCount + (freshCatalog.skippedImages ?? 0);
            const isComplete = newAttempted >= freshCatalog.totalImages;
            freshCatalog.status = isComplete ? "completed" : "running";
            await freshCatalog.save();

            console.log(`${tag} Saved image ${newCount} (attempted ${newAttempted}/${freshCatalog.totalImages}) — complete=${isComplete}`);

            io.emit("catalog:progress", {
                catalogId,
                status: isComplete ? "completed" : "running",
                current: newCount,
                total: freshCatalog.totalImages,
                skipped: freshCatalog.skippedImages ?? 0,
                image: newImage,
            });

            if (isComplete) {
                io.emit("catalog:completed", { catalogId });
                void activateNextQueued(agenda, io);
                // Mark pipeline flag on all associated niches
                if ((freshCatalog.nicheIds ?? []).length > 0) {
                    const { Niche: NicheModel } = await import("../models/niche.js");
                    await NicheModel.updateMany(
                        { _id: { $in: freshCatalog.nicheIds } },
                        { $set: { pipelineHasCatalogs: true } }
                    ).catch(() => {});
                }
                shouldNotify("catalog.ready").then(ok => {
                    if (ok) sendTelegram(`🖼️ <b>Catálogo listo</b>\n"${freshCatalog.name}" — ${freshCatalog.images.length} imágenes generadas`).catch(() => {});
                });
                void checkAutoPilotContinue(tag, catalogId, freshCatalog.nicheIds ?? [], agenda, io);
            } else {
                console.log(`${tag} Scheduling next image in 90s`);
                try {
                    await agenda.schedule("in 90 seconds", JOB_NAME, { catalogId });
                } catch (schedErr: any) {
                    console.error(`${tag} Schedule failed: ${schedErr?.message} — retrying in 10s`);
                    setTimeout(async () => {
                        try {
                            await agenda.schedule("in 10 seconds", JOB_NAME, { catalogId });
                        } catch (schedErr2: any) {
                            const msg = `Error al programar siguiente imagen: ${schedErr2?.message ?? schedErr2}`;
                            console.error(`${tag} ${msg}`);
                            const fc = await Catalog.findById(catalogId);
                            if (fc && fc.status !== "cancelled") {
                                fc.status = "failed";
                                fc.lastError = msg;
                                await fc.save();
                            }
                            io.emit("catalog:error", { catalogId, error: msg, current: newCount, total: freshCatalog.totalImages });
                        }
                    }, 10000);
                }
            }
        } catch (e: any) {
            const errMsg = e?.message ?? String(e);
            console.error(`${tag} Image generation failed (retry ${retryCount}/${MAX_IMAGE_RETRIES}): ${errMsg}`);

            if (/quota|rate.?limit|429|too many requests|exhausted/i.test(errMsg)) {
                shouldNotify("api.error.quota").then(ok => {
                    if (ok) sendTelegram(`⚠️ <b>Error de cuota</b>\nCatálogo: ${catalogId}\n${errMsg.slice(0, 120)}`).catch(() => {});
                });
            }

            const freshCatalog = await Catalog.findById(catalogId);
            if (!freshCatalog || freshCatalog.status === "cancelled") return;

            // Retry up to MAX_IMAGE_RETRIES times before skipping the slot
            if (retryCount < MAX_IMAGE_RETRIES) {
                const nextRetry = retryCount + 1;
                // On 2nd retry use a simplified prompt to avoid model confusion
                const nextOverride = nextRetry >= 2
                    ? simplifyPrompt(overridePrompt || freshCatalog.prompt)
                    : overridePrompt;
                const delay = retryCount === 0 ? "in 60 seconds" : "in 90 seconds";
                console.log(`${tag} Scheduling retry ${nextRetry}/${MAX_IMAGE_RETRIES} ${delay}${nextOverride ? " (simplified prompt)" : ""}`);
                freshCatalog.lastError = `Reintentando (${nextRetry}/${MAX_IMAGE_RETRIES}): ${errMsg}`;
                await freshCatalog.save();
                io.emit("catalog:progress", {
                    catalogId,
                    status: "running",
                    current: freshCatalog.images.length,
                    total: freshCatalog.totalImages,
                    skipped: freshCatalog.skippedImages ?? 0,
                    lastError: freshCatalog.lastError,
                });
                try {
                    await agenda.schedule(delay, JOB_NAME, { catalogId, retryCount: nextRetry, ...(nextOverride ? { overridePrompt: nextOverride } : {}) });
                } catch { /* fallback: skip slot */ }
                return;
            }

            // All retries exhausted — skip this slot
            void trackPromptMetric(overridePrompt || freshCatalog.prompt, freshCatalog.productType ?? "coloring-book", false, 0);
            freshCatalog.skippedImages = (freshCatalog.skippedImages ?? 0) + 1;
            freshCatalog.lastError = errMsg;

            const newAttempted = freshCatalog.images.length + freshCatalog.skippedImages;
            const isComplete = newAttempted >= freshCatalog.totalImages;
            freshCatalog.status = isComplete ? "completed" : "running";
            await freshCatalog.save();

            console.log(`${tag} Skipped slot (${freshCatalog.skippedImages} total, attempted ${newAttempted}/${freshCatalog.totalImages}) — complete=${isComplete}`);

            io.emit("catalog:progress", {
                catalogId,
                status: isComplete ? "completed" : "running",
                current: freshCatalog.images.length,
                total: freshCatalog.totalImages,
                skipped: freshCatalog.skippedImages,
                lastError: errMsg,
            });

            if (isComplete) {
                io.emit("catalog:completed", { catalogId });
                void activateNextQueued(agenda, io);
                shouldNotify("catalog.ready").then(ok => {
                    if (ok) sendTelegram(`🖼️ <b>Catálogo listo</b>\n"${freshCatalog.name}" — ${freshCatalog.images.length} imágenes (${freshCatalog.skippedImages ?? 0} omitidas)`).catch(() => {});
                });
                void checkAutoPilotContinue(tag, catalogId, freshCatalog.nicheIds ?? [], agenda, io);
            } else {
                console.log(`${tag} Scheduling next slot in 30 seconds`);
                try {
                    await agenda.schedule("in 30 seconds", JOB_NAME, { catalogId });
                } catch (schedErr: any) {
                    const msg = `Error al programar siguiente slot: ${schedErr?.message ?? schedErr}`;
                    console.error(`${tag} ${msg}`);
                    freshCatalog.status = "failed";
                    freshCatalog.lastError = msg;
                    await freshCatalog.save();
                    io.emit("catalog:error", { catalogId, error: msg, current: freshCatalog.images.length, total: freshCatalog.totalImages });
                }
            }
        }
    };
    agenda.define(JOB_NAME, handler, { lockLifetime: LOCK_LIFETIME_MS });
}
