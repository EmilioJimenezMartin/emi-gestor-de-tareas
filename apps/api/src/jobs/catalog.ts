import type { Agenda, Job } from "agenda";
import axios from "axios";
import { Catalog } from "../models/catalog.js";
import { getCloudinaryConfig, initCloudinary } from "../routes/cloudinary.js";

export function defineCatalogJob(agenda: Agenda, io: any) {
    agenda.define("generate-catalog-image", { concurrency: 1 }, async (job: Job) => {
        const { catalogId } = (job.attrs.data ?? {}) as { catalogId: string };

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
            status: "generating",
            current: imageIndex,
            total: catalog.totalImages,
        });

        try {
            const port = process.env.PORT || 3001;
            const response = await axios.post(
                `http://localhost:${port}/ai/generate-image`,
                {
                    prompt: catalog.prompt,
                    modelId: catalog.model.modelId,
                    provider: catalog.model.provider,
                    width: catalog.width,
                    height: catalog.height,
                },
                { responseType: "arraybuffer", timeout: 90000 }
            );

            const imageBuffer = Buffer.from(response.data);
            const base64 = imageBuffer.toString("base64");
            const dataUrl = `data:image/png;base64,${base64}`;

            const config = await getCloudinaryConfig();
            if (!config) throw new Error("Cloudinary no configurado");

            const cld = await initCloudinary(config);
            const uploadResult = await cld.uploader.upload(dataUrl, {
                folder: `emi-kdp-catalogs/${catalogId}`,
                resource_type: "image",
            });

            const newImage = {
                publicId: uploadResult.public_id,
                url: uploadResult.secure_url,
                width: uploadResult.width,
                height: uploadResult.height,
                bytes: uploadResult.bytes,
                createdAt: uploadResult.created_at,
            };

            // Re-fetch to avoid race conditions on concurrent jobs
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
                // Rate-limit safe: 90 seconds between images (free tier)
                await agenda.schedule("in 90 seconds", "generate-catalog-image", { catalogId });
            }
        } catch (e: any) {
            console.error(`[catalog-job] Error for catalog ${catalogId}:`, e.message);

            const freshCatalog = await Catalog.findById(catalogId);
            if (freshCatalog && freshCatalog.status !== "cancelled") {
                freshCatalog.status = "failed";
                await freshCatalog.save();
            }

            io.emit("catalog:error", {
                catalogId,
                error: e.message,
                current: catalog.images.length,
                total: catalog.totalImages,
            });
        }
    });
}
