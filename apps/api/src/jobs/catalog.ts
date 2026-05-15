import type { Agenda, Job } from "agenda";
import axios from "axios";
import { Catalog } from "../models/catalog.js";
import { getCloudinaryConfig, initCloudinary } from "../routes/cloudinary.js";

export function defineCatalogJob(agenda: Agenda, io: any) {
    agenda.define("generate-catalog-image", async (job: Job) => {
        const { catalogId, retryCount = 0 } = (job.attrs.data ?? {}) as { catalogId: string; retryCount?: number };

        if (!catalogId) {
            console.error("[catalog-job] No catalogId provided");
            return;
        }

        const catalog = await Catalog.findById(catalogId);
        if (!catalog) {
            console.error(`[catalog-job] Catalog ${catalogId} not found`);
            return;
        }

        if (catalog.status === "cancelled") {
            console.log(`[catalog-job] Catalog ${catalogId} cancelled, skipping`);
            return;
        }

        const imageIndex = catalog.images.length;

        if (imageIndex >= catalog.totalImages) {
            catalog.status = "completed";
            await catalog.save();
            io.emit("catalog:completed", { catalogId });
            return;
        }

        catalog.status = "running";
        await catalog.save();

        io.emit("catalog:progress", {
            catalogId,
            status: "running",
            current: imageIndex,
            total: catalog.totalImages,
        });

        try {
            // Build varied prompt using structured sentence format
            let finalPrompt = catalog.prompt;
            if (catalog.promptParts?.theme) {
                let particulars = catalog.promptParts.particulars ?? "";
                if (particulars) {
                    try {
                        const { varyTextWithLLM } = await import("../lib/ai.js");
                        // 15s timeout so a hanging LLM call never blocks the job
                        const timeout = new Promise<string>((_, reject) =>
                            setTimeout(() => reject(new Error("LLM timeout")), 15000)
                        );
                        particulars = await Promise.race([varyTextWithLLM(particulars), timeout]);
                    } catch {
                        // keep original particulars on LLM failure / timeout
                    }
                }
                finalPrompt = `Genera una imagen con la siguiente temática: ${catalog.promptParts.theme}`;
                if (catalog.promptParts.specs) finalPrompt += `, que tenga las siguientes especificaciones: ${catalog.promptParts.specs}`;
                if (catalog.promptParts.details) finalPrompt += `, con los siguientes detalles: ${catalog.promptParts.details}`;
                if (particulars) finalPrompt += `, y las siguientes particularidades: ${particulars}`;
            }

            let imageBuffer: Buffer;

            if (catalog.aiModel.provider === "Pollinations") {
                const seed = Math.floor(Math.random() * 999999);
                const modelParam = catalog.aiModel.modelId?.trim() || "flux";
                const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${catalog.width}&height=${catalog.height}&seed=${seed}&model=${encodeURIComponent(modelParam)}&nologo=true&enhance=false`;
                const response = await axios.get(pollinationsUrl, { responseType: "arraybuffer", timeout: 120000 });
                imageBuffer = Buffer.from(response.data);
            } else {
                const port = process.env.PORT || 3001;
                const response = await axios.post(
                    `http://localhost:${port}/ai/generate-image`,
                    {
                        prompt: finalPrompt,
                        modelId: catalog.aiModel.modelId,
                        provider: catalog.aiModel.provider,
                        width: catalog.width,
                        height: catalog.height,
                    },
                    { responseType: "arraybuffer", timeout: 120000 }
                );
                imageBuffer = Buffer.from(response.data);
            }

            const base64 = imageBuffer.toString("base64");
            const dataUrl = `data:image/png;base64,${base64}`;

            const config = await getCloudinaryConfig();
            if (!config) throw new Error("Cloudinary no configurado");

            const cld = await initCloudinary(config);
            const uploadResult = await cld.uploader.upload(dataUrl, {
                folder: `emi-kdp-catalogs/${catalogId}`,
                resource_type: "image",
                timeout: 120000,
            });

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
            if (!freshCatalog || freshCatalog.status === "cancelled") return;

            freshCatalog.images.push(newImage);
            const newCount = freshCatalog.images.length;
            const isComplete = newCount >= freshCatalog.totalImages;
            freshCatalog.status = isComplete ? "completed" : "running";
            await freshCatalog.save();

            io.emit("catalog:progress", {
                catalogId,
                status: isComplete ? "completed" : "running",
                current: newCount,
                total: freshCatalog.totalImages,
                image: newImage,
            });

            if (isComplete) {
                io.emit("catalog:completed", { catalogId });
            } else {
                const delaySeconds = 90 + Math.floor(Math.random() * 31);
                try {
                    await agenda.schedule(`in ${delaySeconds} seconds`, "generate-catalog-image", { catalogId, retryCount: 0 });
                } catch (schedErr: any) {
                    console.error(`[catalog-job] Failed to schedule next job for ${catalogId}:`, schedErr.message);
                    // Retry scheduling once after 10s
                    setTimeout(async () => {
                        try {
                            await agenda.schedule("in 10 seconds", "generate-catalog-image", { catalogId, retryCount: 0 });
                        } catch {
                            const fc = await Catalog.findById(catalogId);
                            if (fc && fc.status !== "cancelled") { fc.status = "failed"; await fc.save(); }
                            io.emit("catalog:error", { catalogId, error: "Error al programar siguiente imagen", current: newCount, total: freshCatalog.totalImages });
                        }
                    }, 10000);
                }
            }
        } catch (e: any) {
            console.error(`[catalog-job] Error (retry ${retryCount}) for catalog ${catalogId}:`, e.message);

            const freshCatalog = await Catalog.findById(catalogId);
            if (!freshCatalog || freshCatalog.status === "cancelled") return;

            if (retryCount < 2) {
                // Retry the same image after a short delay instead of failing immediately
                const retryDelay = 30 + retryCount * 30;
                console.log(`[catalog-job] Scheduling retry ${retryCount + 1}/2 in ${retryDelay}s`);
                try {
                    await agenda.schedule(`in ${retryDelay} seconds`, "generate-catalog-image", { catalogId, retryCount: retryCount + 1 });
                    // Keep status as running during retry
                } catch {
                    freshCatalog.status = "failed";
                    await freshCatalog.save();
                    io.emit("catalog:error", {
                        catalogId,
                        error: e.message,
                        current: freshCatalog.images.length,
                        total: freshCatalog.totalImages,
                    });
                }
            } else {
                freshCatalog.status = "failed";
                await freshCatalog.save();
                io.emit("catalog:error", {
                    catalogId,
                    error: e.message,
                    current: freshCatalog.images.length,
                    total: freshCatalog.totalImages,
                });
            }
        }
    });
}
