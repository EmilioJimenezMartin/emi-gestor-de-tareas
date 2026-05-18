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
            // Remove catalog from any linked niches' catalogIds
            if (catalog.nicheIds?.length) {
                await Niche.updateMany(
                    { _id: { $in: catalog.nicheIds } },
                    { $pull: { catalogIds: String(request.params.id) } }
                );
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

            catalog.images = catalog.images.filter((img) => img.publicId !== publicId);
            await catalog.save();

            return reply.send({ success: true, catalog });
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
            if (Array.isArray(body.nicheIds)) update.nicheIds = body.nicheIds;
            if (body.name?.trim()) update.name = body.name.trim();
            const catalog = await Catalog.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
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

    // POST /catalogs/from-cloudinary — create a completed catalog from existing Cloudinary images (no generation)
    app.post("/catalogs/from-cloudinary", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { name, images } = request.body || {};
            if (!name?.trim() || !Array.isArray(images) || images.length === 0) {
                return reply.status(400).send({ error: "name e images son requeridos" });
            }
            const catalog = await Catalog.create({
                name: name.trim(),
                prompt: "Catálogo personalizado de Cloudinary",
                aiModel: { id: "cloudinary", name: "Cloudinary", provider: "Cloudinary", modelId: "" },
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
            });
            return reply.status(201).send({ catalog });
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
