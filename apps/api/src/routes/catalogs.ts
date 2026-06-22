import { FastifyInstance } from "fastify";
import { Catalog } from "../models/catalog.js";
import { Niche } from "../models/niche.js";
import { getAgenda } from "../lib/agenda.js";
import { getMongoStatus } from "../lib/mongo.js";
import { getCloudinaryConfig, initCloudinary } from "./cloudinary.js";
import { activateNextQueued } from "../lib/catalog-queue.js";

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerCatalogRoutes(app: FastifyInstance, { io }: { io: any } = { io: null }) {
    // GET /catalogs — list all catalogs
    app.get("/catalogs", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const catalogs = await Catalog.find().sort({ createdAt: -1 }).lean();
            return reply.send({ catalogs });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // GET /catalogs/:id
    app.get("/catalogs/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const catalog = await Catalog.findById(request.params.id).lean();
            if (!catalog) return reply.status(404).send({ error: "Catálogo no encontrado" });
            return reply.send({ catalog });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /catalogs — create catalog; queue if another is already active
    app.post("/catalogs", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { name, prompt, model, aiModel, width, height, totalImages, promptParts, productType, creativity, negativePrompt, nicheIds } = request.body || {};
            const modelData = aiModel ?? model;
            if (!prompt || !modelData || !totalImages) {
                return reply.status(400).send({ error: "prompt, model y totalImages son requeridos" });
            }

            // Check if any catalog is currently occupying the slot
            const hasActive = await Catalog.exists({ status: { $in: ["queued", "pending", "running"] } });
            const initialStatus = hasActive ? "queued" : "pending";

            const catalog = await Catalog.create({
                name: (name?.trim() || `Catálogo ${new Date().toLocaleDateString("es-ES")}`),
                prompt: prompt.trim(),
                promptParts: promptParts ?? undefined,
                productType: productType ?? "coloring-book",
                creativity: creativity != null ? Math.min(100, Math.max(0, Number(creativity))) : 50,
                negativePrompt: negativePrompt?.trim() ?? "",
                aiModel: modelData,
                width: width || 1024,
                height: height || 1024,
                totalImages: Math.min(Math.max(1, Number(totalImages)), 50),
                images: [],
                status: initialStatus,
                queueOrder: Date.now(),
                nicheIds: Array.isArray(nicheIds) ? nicheIds : [],
            });

            if (initialStatus === "pending") {
                const agenda = getAgenda();
                await agenda.now("generate-catalog-image", { catalogId: String(catalog._id) });
            } else {
                // Count position in queue (1-based) for informational purposes
                const queuePos = await Catalog.countDocuments({ status: "queued" });
                app.log.info(`Catalog ${catalog._id} queued at position ${queuePos}`);
            }

            return reply.status(201).send({ catalog });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // DELETE /catalogs/:id — cancel, delete Cloudinary images, delete catalog
    app.delete("/catalogs/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const catalog = await Catalog.findById(request.params.id);
            if (!catalog) return reply.status(404).send({ error: "Catálogo no encontrado" });

            const wasActive = catalog.status === "running" || catalog.status === "pending";
            if (wasActive) {
                catalog.status = "cancelled";
                await catalog.save();
            }

            if (catalog.images.length > 0) {
                try {
                    const config = await getCloudinaryConfig();
                    if (config) {
                        const cld = await initCloudinary(config);
                        const publicIds = catalog.images.map((img) => img.publicId);
                        await cld.api.delete_resources(publicIds, { type: "upload" });
                    }
                } catch (e) {
                    app.log.warn(e, "Could not delete Cloudinary images for catalog");
                }
            }

            await Catalog.findByIdAndDelete(request.params.id);
            // Remove catalog from any linked niches' catalogIds; clear pipelineHasCatalogs if no catalogs remain
            if (catalog.nicheIds?.length) {
                await Niche.updateMany(
                    { _id: { $in: catalog.nicheIds } },
                    { $pull: { catalogIds: String(request.params.id) } }
                );
                // Clear flag for niches that no longer have any catalog
                for (const nicheId of catalog.nicheIds) {
                    const remaining = await Catalog.countDocuments({ nicheIds: nicheId });
                    if (remaining === 0) {
                        await Niche.findByIdAndUpdate(nicheId, { $set: { pipelineHasCatalogs: false } });
                    }
                }
            }
            if (wasActive) {
                try { void activateNextQueued(getAgenda(), io); } catch { /* agenda not ready */ }
            }
            return reply.send({ success: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /catalogs/:id/delete-image — delete single image from catalog
    app.post("/catalogs/:id/delete-image", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { publicId } = request.body || {};
            if (!publicId) return reply.status(400).send({ error: "publicId requerido" });

            const catalog = await Catalog.findById(request.params.id);
            if (!catalog) return reply.status(404).send({ error: "Catálogo no encontrado" });

            try {
                const config = await getCloudinaryConfig();
                if (config) {
                    const cld = await initCloudinary(config);
                    await cld.uploader.destroy(publicId);
                }
            } catch (e) {
                app.log.warn(e, "Could not delete Cloudinary image");
            }

            const updated = await Catalog.findByIdAndUpdate(
                request.params.id,
                { $pull: { images: { publicId } } },
                { returnDocument: 'after' }
            );

            return reply.send({ success: true, catalog: updated });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /catalogs/:id/cancel — cancel a running/pending/queued catalog
    app.post("/catalogs/:id/cancel", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const catalog = await Catalog.findById(request.params.id);
            if (!catalog) return reply.status(404).send({ error: "Catálogo no encontrado" });
            const wasActive = catalog.status === "running" || catalog.status === "pending";
            catalog.status = "cancelled";
            await catalog.save();
            if (wasActive) {
                try { void activateNextQueued(getAgenda(), io); } catch { /* agenda not ready */ }
            }
            return reply.send({ success: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // PATCH /catalogs/:id — update catalog fields (nicheIds, name, etc.)
    app.patch("/catalogs/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const body = request.body as any;
            const update: Record<string, any> = {};
            if (Array.isArray(body.nicheIds)) {
                const oldCatalog = await Catalog.findById(id).lean();
                const oldNicheIds: string[] = oldCatalog?.nicheIds ?? [];
                const newNicheIds: string[] = body.nicheIds;
                const removed = oldNicheIds.filter(n => !newNicheIds.includes(n));
                const added = newNicheIds.filter(n => !oldNicheIds.includes(n));
                if (removed.length > 0) await Niche.updateMany({ _id: { $in: removed } }, { $pull: { catalogIds: id } });
                if (added.length > 0) await Niche.updateMany({ _id: { $in: added } }, { $addToSet: { catalogIds: id } });
                update.nicheIds = newNicheIds;
            }
            if (body.name?.trim()) update.name = body.name.trim();
            const catalog = await Catalog.findByIdAndUpdate(id, { $set: update }, { returnDocument: 'after' }).lean();
            if (!catalog) return reply.status(404).send({ error: "Catálogo no encontrado" });
            return reply.send({ catalog });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // PATCH /catalogs/queue-reorder — set queue priority order
    app.patch("/catalogs/queue-reorder", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { ids } = request.body || {};
            if (!Array.isArray(ids) || ids.length === 0) return reply.status(400).send({ error: "ids requerido" });
            await Promise.all(
                ids.map((id: string, idx: number) =>
                    Catalog.findByIdAndUpdate(id, { $set: { queueOrder: idx } })
                )
            );
            return reply.send({ success: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /catalogs/add-image — add a single image to an existing catalog or create "Muestra" catalog for the niche
    app.post("/catalogs/add-image", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { nicheId, image, modelName } = request.body as {
                nicheId: string;
                image: { publicId: string; url: string; width?: number; height?: number };
                modelName?: string;
            };
            if (!nicheId || !image?.url) return reply.status(400).send({ error: "nicheId e image.url son requeridos" });

            const niche = await Niche.findById(nicheId).lean() as any;
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            const catalogName = `Muestra — ${niche.name}`;

            // Find existing "Muestra" catalog for this niche or create it
            let catalog = await Catalog.findOne({ name: catalogName, nicheIds: nicheId }).lean() as any;
            if (!catalog) {
                catalog = await Catalog.create({
                    name: catalogName,
                    prompt: niche.discoveryImagePrompt || niche.generatedPrompt || niche.name,
                    aiModel: { id: "comparador", name: modelName ?? "Comparador", provider: "Manual", modelId: "" },
                    width: image.width ?? 768,
                    height: image.height ?? 1024,
                    totalImages: 0,
                    images: [],
                    status: "completed",
                    queueOrder: Date.now(),
                    nicheIds: [nicheId],
                });
                await Niche.findByIdAndUpdate(nicheId, {
                    $addToSet: { catalogIds: String(catalog._id) },
                    $set: { pipelineHasCatalogs: true },
                });
            }

            const imgEntry = {
                publicId: image.publicId,
                url: image.url,
                width: image.width ?? 768,
                height: image.height ?? 1024,
                bytes: 0,
                createdAt: new Date().toISOString(),
            };
            const updated = await Catalog.findByIdAndUpdate(
                catalog._id,
                { $push: { images: imgEntry }, $inc: { totalImages: 1 } },
                { new: true }
            ).lean();

            return reply.status(201).send({ catalog: updated });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /catalogs/from-cloudinary — create a completed catalog from existing Cloudinary images (no generation)
    app.post("/catalogs/from-cloudinary", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { name, images, nicheIds } = request.body || {};
            if (!name?.trim() || !Array.isArray(images) || images.length === 0) {
                return reply.status(400).send({ error: "name e images son requeridos" });
            }
            const catalog = await Catalog.create({
                name: name.trim(),
                prompt: "Catálogo manual (subida de imágenes)",
                aiModel: { id: "manual", name: "Manual Upload", provider: "Manual", modelId: "" },
                width: images[0]?.width ?? 1024,
                height: images[0]?.height ?? 1024,
                totalImages: images.length,
                images: images.map((img: any) => ({
                    publicId: img.publicId,
                    url: img.url,
                    width: img.width ?? 1024,
                    height: img.height ?? 1024,
                    bytes: img.bytes ?? 0,
                    createdAt: img.createdAt ?? new Date().toISOString(),
                })),
                status: "completed",
                skippedImages: 0,
                queueOrder: Date.now(),
                ...(Array.isArray(nicheIds) && nicheIds.length > 0 ? { nicheIds } : {}),
            });
            return reply.status(201).send({ catalog });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /catalogs/:id/skip-image — force-skip the current generating slot and immediately schedule the next
    app.post("/catalogs/:id/skip-image", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const catalog = await Catalog.findById(request.params.id);
            if (!catalog) return reply.status(404).send({ error: "Catálogo no encontrado" });
            if (catalog.status === "cancelled" || catalog.status === "completed") {
                return reply.status(400).send({ error: "El catálogo ya está finalizado" });
            }
            catalog.skippedImages = (catalog.skippedImages ?? 0) + 1;
            const attempted = catalog.images.length + catalog.skippedImages;
            const isComplete = attempted >= catalog.totalImages;
            catalog.status = isComplete ? "completed" : "running";
            catalog.lastError = "Slot omitido manualmente";
            await catalog.save();

            io?.emit("catalog:progress", {
                catalogId: String(catalog._id),
                status: catalog.status,
                current: catalog.images.length,
                total: catalog.totalImages,
                skipped: catalog.skippedImages,
                lastError: "Slot omitido manualmente",
            });

            if (isComplete) {
                io?.emit("catalog:completed", { catalogId: String(catalog._id) });
                try { const agenda = getAgenda(); void activateNextQueued(agenda, io); } catch { /* ok */ }
            } else {
                // Schedule next slot immediately
                try {
                    const agenda = getAgenda();
                    await agenda.schedule("in 3 seconds", "generate-catalog-image", { catalogId: String(catalog._id) });
                } catch { /* ok */ }
            }
            return reply.send({ ok: true, skippedImages: catalog.skippedImages, status: catalog.status });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /catalogs/:id/force-complete — mark catalog complete with current images (give up on remaining)
    app.post("/catalogs/:id/force-complete", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const catalog = await Catalog.findById(request.params.id);
            if (!catalog) return reply.status(404).send({ error: "Catálogo no encontrado" });
            if (catalog.status === "cancelled") return reply.status(400).send({ error: "El catálogo está cancelado" });
            const remaining = catalog.totalImages - catalog.images.length - (catalog.skippedImages ?? 0);
            catalog.skippedImages = (catalog.skippedImages ?? 0) + Math.max(0, remaining);
            catalog.totalImages = catalog.images.length + (catalog.skippedImages ?? 0);
            catalog.status = "completed";
            catalog.lastError = remaining > 0 ? `Forzado a completar (${remaining} imgs omitidas)` : "";
            await catalog.save();

            io?.emit("catalog:completed", { catalogId: String(catalog._id) });
            io?.emit("catalog:progress", {
                catalogId: String(catalog._id),
                status: "completed",
                current: catalog.images.length,
                total: catalog.totalImages,
                skipped: catalog.skippedImages,
            });
            try { const agenda = getAgenda(); void activateNextQueued(agenda, io); } catch { /* ok */ }
            return reply.send({ ok: true, images: catalog.images.length, skipped: catalog.skippedImages });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /catalogs/:id/relaunch — resume a failed/cancelled catalog, keeping existing images
    app.post("/catalogs/:id/relaunch", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const catalog = await Catalog.findById(request.params.id);
            if (!catalog) return reply.status(404).send({ error: "Catálogo no encontrado" });
            const relaunchable = ["failed", "cancelled"].includes(catalog.status) ||
                (!["queued","pending","running"].includes(catalog.status) && catalog.images.length < catalog.totalImages);
            if (!relaunchable) return reply.status(400).send({ error: "El catálogo no está en estado relanzable" });

            // Keep existing images — just reset counters and re-queue
            const remaining = catalog.totalImages - catalog.images.length;
            if (remaining <= 0) {
                // All images already generated — just mark completed
                catalog.status = "completed";
                await catalog.save();
                return reply.send({ catalog });
            }

            catalog.skippedImages = 0;
            catalog.lastError = "";
            const hasActive = await Catalog.exists({ _id: { $ne: catalog._id }, status: { $in: ["queued", "pending", "running"] } });
            catalog.status = hasActive ? "queued" : "pending";
            catalog.queueOrder = Date.now();
            await catalog.save();

            if (catalog.status === "pending") {
                try {
                    const agenda = getAgenda();
                    await agenda.now("generate-catalog-image", { catalogId: String(catalog._id) });
                } catch { /* agenda may not be ready */ }
            }

            return reply.send({ catalog, remaining });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /catalogs/:id/retry-failed — reset skipped slots and reschedule
    app.post("/catalogs/:id/retry-failed", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const catalog = await Catalog.findById(request.params.id);
            if (!catalog) return reply.status(404).send({ error: "Catálogo no encontrado" });
            if ((catalog.skippedImages ?? 0) === 0) return reply.status(400).send({ error: "No hay slots fallados" });
            const slotsToRetry = catalog.skippedImages ?? 0;
            catalog.totalImages = catalog.images.length + slotsToRetry;
            catalog.skippedImages = 0;
            catalog.status = "running";
            catalog.lastError = "";
            await catalog.save();
            try {
                const agenda = getAgenda();
                await agenda.schedule("in 5 seconds", "generate-catalog-image", { catalogId: String(catalog._id) });
            } catch { /* agenda not ready yet, job will not auto-start */ }
            return reply.send({ catalog, slotsToRetry });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
