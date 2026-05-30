import type { Agenda, Job } from "agenda";
import axios from "axios";
import { Catalog } from "../models/catalog.js";
import { getCloudinaryConfig, initCloudinary } from "../routes/cloudinary.js";
import { activateNextQueued } from "../lib/catalog-queue.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";
import sharp from "sharp";

const JOB_NAME = "generate-catalog-image";
const LOCK_LIFETIME_MS = 12 * 60 * 1000; // 12 min per job execution
const AXIOS_TIMEOUT_MS = 120_000; // 2 min — per-request axios timeout
const HARD_ABORT_MS = 8 * 60 * 1000; // 8 min — auto-skip if image hangs this long

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
            // Expected: mostly white background with black lines
            // Count pixels by brightness and color saturation
            let whitePixels = 0;   // R,G,B all > 220
            let blackPixels = 0;   // R,G,B all < 60
            let colorPixels = 0;   // high saturation — sign of non-line-art
            let blankSuspect = 0;  // nearly solid white/gray (no lines)

            const step = channels > 3 ? 4 : 3;
            for (let i = 0; i < raw.length; i += step) {
                const r = raw[i], g = raw[i + 1], b = raw[i + 2];
                const brightness = (r + g + b) / 3;
                const maxC = Math.max(r, g, b);
                const minC = Math.min(r, g, b);
                const saturation = maxC > 0 ? (maxC - minC) / maxC : 0;

                if (r > 220 && g > 220 && b > 220) whitePixels++;
                else if (r < 60 && g < 60 && b < 60) blackPixels++;
                else if (saturation > 0.3 && brightness < 220) colorPixels++;

                if (brightness > 240) blankSuspect++;
            }

            const whitePct = whitePixels / pixelCount;
            const blackPct = blackPixels / pixelCount;
            const colorPct = colorPixels / pixelCount;
            const blankPct = blankSuspect / pixelCount;

            // Blank image: >98% near-white → failed generation
            if (blankPct > 0.98) {
                return { ok: false, score: 0, reason: `Imagen en blanco (${(blankPct * 100).toFixed(0)}% píxeles blancos)` };
            }

            // No black lines at all → wrong style
            if (blackPct < 0.005) {
                return { ok: false, score: 10, reason: `Sin líneas negras (${(blackPct * 100).toFixed(2)}%) — no es libro de colorear` };
            }

            // Too many color pixels → full color illustration, not line art
            if (colorPct > 0.25) {
                return { ok: false, score: 20, reason: `Imagen a color (${(colorPct * 100).toFixed(0)}% píxeles coloreados) — se esperaba línea B&W` };
            }

            // Score: higher is better. Ideal: lots of white + enough black + minimal color
            const score = Math.round(
                Math.min(whitePct * 60, 60) +          // up to 60 pts for white background
                Math.min(blackPct * 1000, 30) +         // up to 30 pts for black lines
                Math.max(10 - colorPct * 100, 0)        // up to 10 pts penalized by color
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

            // Schedule autopilot-run to handle SEO + cover (persisted in MongoDB, survives restarts)
            try {
                await agenda.schedule("in 5 seconds", "autopilot-run", {});
            } catch (schedErr) {
                console.error(`${tag} Failed to schedule follow-up autopilot-run:`, schedErr);
            }
            break;
        }
    } catch (e) {
        console.error(`${tag} checkAutoPilotContinue failed:`, e);
    }
}

export function defineCatalogJob(agenda: Agenda, io: any) {
    const handler = async (job: Job) => {
        const { catalogId } = (job.attrs.data ?? {}) as { catalogId: string };
        const tag = `[catalog-job][${catalogId}]`;

        if (!catalogId) {
            console.error(`${tag} No catalogId provided`);
            return;
        }

        const catalog = await Catalog.findById(catalogId);
        if (!catalog) {
            console.error(`${tag} Catalog not found`);
            return;
        }

        if (catalog.status === "cancelled") {
            console.log(`${tag} Cancelled — skipping`);
            return;
        }

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
            // Build prompt
            const creativity = catalog.creativity ?? 50;
            let finalPrompt = catalog.prompt;
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

            // Apply product-type modifiers and build negative prompt
            const productType = catalog.productType ?? "coloring-book";
            const userNegative = catalog.negativePrompt?.trim() ?? "";

            let finalNegativePrompt = "";
            if (productType === "coloring-book") {
                finalPrompt += ". Style: clean black and white line art, coloring book style, thick clean outlines, white background, no shading, no gray fills, no color, no gradients";
                const coloringNegative = "shading, gray fill, gray tones, shadows, gradients, color, colors, sepia, tones, textures, crosshatching, stippling, watercolor, painterly, blur, glow, soft edges, background pattern, noise, grain, vignette, watermark, signature, logo, frame, border decoration";
                finalNegativePrompt = userNegative ? `${coloringNegative}, ${userNegative}` : coloringNegative;
            } else if (productType === "printable-poster") {
                finalPrompt += ". Style: high quality, high resolution, vibrant colors, print-ready, professional poster design, sharp fine details, suitable for large format printing";
                finalNegativePrompt = userNegative;
            } else {
                finalNegativePrompt = userNegative;
            }

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

            // Generate image
            let imageBuffer: Buffer;

            if (catalog.aiModel.provider === "Pollinations") {
                const seed = Math.floor(Math.random() * 999999);
                const modelParam = catalog.aiModel.modelId?.trim() || "flux";
                const negParam = finalNegativePrompt ? `&negative=${encodeURIComponent(finalNegativePrompt)}` : "";
                const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${catalog.width}&height=${catalog.height}&seed=${seed}&model=${encodeURIComponent(modelParam)}&nologo=true&enhance=false${negParam}`;
                console.log(`${tag} Calling Pollinations model=${modelParam}`);
                const abortCtrl = new AbortController();
                const hardTimeout = setTimeout(() => abortCtrl.abort(), HARD_ABORT_MS);
                try {
                    const response = await axios.get(pollinationsUrl, {
                        responseType: "arraybuffer",
                        timeout: AXIOS_TIMEOUT_MS,
                        signal: abortCtrl.signal,
                        validateStatus: (s) => s < 500,
                    });
                    clearTimeout(hardTimeout);
                    if (response.status !== 200) {
                        throw new Error(`Pollinations HTTP ${response.status}`);
                    }
                    const contentType = (response.headers["content-type"] ?? "") as string;
                    if (!contentType.startsWith("image/")) {
                        const preview = Buffer.from(response.data).toString("utf8").slice(0, 300);
                        throw new Error(`Pollinations devolvió ${contentType} en lugar de imagen: ${preview}`);
                    }
                    imageBuffer = Buffer.from(response.data);
                    console.log(`${tag} Pollinations OK — ${imageBuffer.length} bytes`);
                } catch (e: any) {
                    clearTimeout(hardTimeout);
                    if (e?.code === "ERR_CANCELED" || abortCtrl.signal.aborted) {
                        throw new Error(`Imagen colgada tras ${HARD_ABORT_MS / 60000} min — slot omitido automáticamente`);
                    }
                    throw e;
                }
            } else {
                const port = process.env.PORT || 3001;
                console.log(`${tag} Calling proxy: provider=${catalog.aiModel.provider} model=${catalog.aiModel.modelId}`);
                const abortCtrl = new AbortController();
                const hardTimeout = setTimeout(() => abortCtrl.abort(), HARD_ABORT_MS);
                try {
                    const response = await axios.post(
                        `http://localhost:${port}/ai/generate-image`,
                        {
                            prompt: finalPrompt,
                            modelId: catalog.aiModel.modelId,
                            provider: catalog.aiModel.provider,
                            width: catalog.width,
                            height: catalog.height,
                            advancedParams: {
                                ...(finalNegativePrompt ? { negativePrompt: finalNegativePrompt } : {}),
                                ...(catalog.aiModel.provider === "Ideogram" ? { style: "ILLUSTRATION" } : {}),
                            },
                        },
                        { responseType: "arraybuffer", timeout: AXIOS_TIMEOUT_MS, signal: abortCtrl.signal }
                    );
                    clearTimeout(hardTimeout);
                    if (response.status !== 200) {
                        throw new Error(`Proxy HTTP ${response.status}`);
                    }
                    const contentType = (response.headers["content-type"] ?? "") as string;
                    if (!contentType.startsWith("image/")) {
                        const preview = Buffer.from(response.data).toString("utf8").slice(0, 300);
                        throw new Error(`Proxy devolvió ${contentType} en lugar de imagen: ${preview}`);
                    }
                    imageBuffer = Buffer.from(response.data);
                    console.log(`${tag} Proxy OK — ${imageBuffer.length} bytes`);
                } catch (e: any) {
                    clearTimeout(hardTimeout);
                    if (e?.code === "ERR_CANCELED" || abortCtrl.signal.aborted) {
                        throw new Error(`Imagen colgada tras ${HARD_ABORT_MS / 60000} min — slot omitido automáticamente`);
                    }
                    throw e;
                }
            }

            // Quality gate — analyze pixels before uploading
            const quality = await analyzeImageQuality(imageBuffer, catalog.productType ?? "coloring-book");
            console.log(`${tag} Quality: score=${quality.score} ok=${quality.ok}${quality.reason ? ` reason="${quality.reason}"` : ""}`);
            if (!quality.ok) {
                throw new Error(`Calidad insuficiente (score ${quality.score}): ${quality.reason}`);
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
            console.error(`${tag} Image generation failed — skipping slot: ${errMsg}`);
            if (/quota|rate.?limit|429|too many requests|exhausted/i.test(errMsg)) {
                shouldNotify("api.error.quota").then(ok => {
                    if (ok) sendTelegram(`⚠️ <b>Error de cuota</b>\nCatálogo: ${catalogId}\n${errMsg.slice(0, 120)}`).catch(() => {});
                });
            }

            const freshCatalog = await Catalog.findById(catalogId);
            if (!freshCatalog || freshCatalog.status === "cancelled") return;

            // Skip this image slot: increment skippedImages, do NOT retry
            freshCatalog.skippedImages = (freshCatalog.skippedImages ?? 0) + 1;
            freshCatalog.lastError = errMsg;

            const newAttempted = freshCatalog.images.length + freshCatalog.skippedImages;
            const isComplete = newAttempted >= freshCatalog.totalImages;
            freshCatalog.status = isComplete ? "completed" : "running";
            await freshCatalog.save();

            console.log(`${tag} Skipped slot ${freshCatalog.skippedImages} (attempted ${newAttempted}/${freshCatalog.totalImages}) — complete=${isComplete}`);

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
                // Wait 2 minutes before trying the next image slot
                console.log(`${tag} Scheduling next slot in 2 minutes`);
                try {
                    await agenda.schedule("in 2 minutes", JOB_NAME, { catalogId });
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
