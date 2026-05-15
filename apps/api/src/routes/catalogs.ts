import { FastifyInstance } from "fastify";
import { Catalog } from "../models/catalog.js";
import { getAgenda } from "../lib/agenda.js";
import { getMongoStatus } from "../lib/mongo.js";
import { getCloudinaryConfig, initCloudinary } from "./cloudinary.js";

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerCatalogRoutes(app: FastifyInstance) {
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

    // POST /catalogs — create catalog and schedule first job
    app.post("/catalogs", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { name, prompt, model, aiModel, width, height, totalImages } = request.body || {};
            const modelData = aiModel ?? model;
            if (!prompt || !modelData || !totalImages) {
                return reply.status(400).send({ error: "prompt, model y totalImages son requeridos" });
            }

            const catalog = await Catalog.create({
                name: (name?.trim() || `Catálogo ${new Date().toLocaleDateString("es-ES")}`),
                prompt: prompt.trim(),
                aiModel: modelData,
                width: width || 1024,
                height: height || 1024,
                totalImages: Math.min(Math.max(1, Number(totalImages)), 50),
                images: [],
                status: "pending",
            });

            const agenda = getAgenda();
            await agenda.now("generate-catalog-image", { catalogId: String(catalog._id) });

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

            if (catalog.status === "running" || catalog.status === "pending") {
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

    // POST /catalogs/:id/cancel — cancel a running catalog
    app.post("/catalogs/:id/cancel", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const catalog = await Catalog.findById(request.params.id);
            if (!catalog) return reply.status(404).send({ error: "Catálogo no encontrado" });
            catalog.status = "cancelled";
            await catalog.save();
            return reply.send({ success: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
