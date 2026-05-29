import type { Agenda, Job } from "agenda";
import axios from "axios";
import { Catalog } from "../models/catalog.js";
import { getCloudinaryConfig, initCloudinary } from "../routes/cloudinary.js";
import { activateNextQueued } from "../lib/catalog-queue.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";

const JOB_NAME = "generate-catalog-image";
const LOCK_LIFETIME_MS = 5 * 60 * 1000; // 5 min per job execution

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
                const response = await axios.get(pollinationsUrl, {
                    responseType: "arraybuffer",
                    timeout: 120000,
                    validateStatus: (s) => s < 500,
                });
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
            } else {
                const port = process.env.PORT || 3001;
                console.log(`${tag} Calling proxy: provider=${catalog.aiModel.provider} model=${catalog.aiModel.modelId}`);
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
                    { responseType: "arraybuffer", timeout: 120000 }
                );
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
            }

            // Upload to Cloudinary
            console.log(`${tag} Uploading to Cloudinary...`);
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
