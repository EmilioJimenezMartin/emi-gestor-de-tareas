import { FastifyInstance } from "fastify";
import { RejectedImage } from "../models/rejected-image.js";
import { Catalog } from "../models/catalog.js";
import { getMongoStatus } from "../lib/mongo.js";
import { getCloudinaryConfig, initCloudinary } from "./cloudinary.js";

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerRejectedImageRoutes(app: FastifyInstance, deps?: { io?: any }) {
    // GET /rejected-images — list vault images
    // Optional: ?status=pending|approved|deleted (default: pending), ?nicheId=, ?catalogId=
    app.get("/rejected-images", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { status = "pending", nicheId, catalogId, limit = "50" } = request.query ?? {};
            const filter: any = {};
            if (status) filter.reviewStatus = status;
            if (catalogId) filter.catalogId = catalogId;
            if (nicheId) filter.nicheIds = nicheId;

            const images = await RejectedImage.find(filter)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit) || 50)
                .lean();

            return reply.send({ images });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /rejected-images/:id/approve — include image in a catalog
    app.post("/rejected-images/:id/approve", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const { catalogId } = (request.body ?? {}) as { catalogId?: string };

            const rejected = await RejectedImage.findById(id);
            if (!rejected) return reply.status(404).send({ error: "Imagen no encontrada" });
            if (rejected.reviewStatus !== "pending") {
                return reply.status(409).send({ error: "Esta imagen ya fue procesada" });
            }

            // Find the target catalog — use provided catalogId or the original catalog
            const targetCatalogId = catalogId ?? rejected.catalogId;
            const catalog = await Catalog.findById(targetCatalogId);
            if (!catalog) return reply.status(404).send({ error: "Catálogo no encontrado" });

            catalog.images.push({
                publicId: rejected.publicId,
                url: rejected.imageUrl,
                width: 1024,
                height: 1024,
                bytes: 0,
                createdAt: new Date().toISOString(),
            } as any);
            await catalog.save();

            rejected.reviewStatus = "approved";
            rejected.approvedToCatalogId = targetCatalogId;
            await rejected.save();

            deps?.io?.emit("catalogs:updated");
            deps?.io?.emit("vault:updated", { id, reviewStatus: "approved" });

            return reply.send({ ok: true, catalogId: targetCatalogId });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // DELETE /rejected-images/:id — permanently delete from vault + Cloudinary
    app.delete("/rejected-images/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };

            const rejected = await RejectedImage.findById(id);
            if (!rejected) return reply.status(404).send({ error: "Imagen no encontrada" });

            // Delete from Cloudinary
            try {
                const config = await getCloudinaryConfig();
                if (config && rejected.publicId) {
                    const cld = await initCloudinary(config);
                    await cld.uploader.destroy(rejected.publicId);
                }
            } catch (cldErr: any) {
                app.log.warn(`Failed to delete from Cloudinary: ${cldErr?.message}`);
            }

            rejected.reviewStatus = "deleted";
            await rejected.save();

            deps?.io?.emit("vault:updated", { id, reviewStatus: "deleted" });

            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // GET /rejected-images/count — quick count for badge display
    app.get("/rejected-images/count", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const count = await RejectedImage.countDocuments({ reviewStatus: "pending" });
            return reply.send({ count });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
