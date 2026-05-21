import { FastifyInstance } from "fastify";
import { DigitalProduct } from "../models/digitalProduct.js";
import { getMongoStatus } from "../lib/mongo.js";

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerDigitalProductRoutes(app: FastifyInstance) {
    app.get("/digital-products", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const products = await DigitalProduct.find().sort({ createdAt: -1 }).lean();
            return reply.send({ products });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.post("/digital-products", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { type, title, description, status, platforms, nicheId } = request.body as any;
            if (!type?.trim() || !title?.trim()) return reply.status(400).send({ error: "type and title required" });
            const plats = Array.isArray(platforms) ? platforms : [];
            const totalEarnings = plats.reduce((s: number, p: any) => s + (Number(p.earnings) || 0), 0);
            const product = await DigitalProduct.create({
                type: type.trim(),
                title: title.trim(),
                description: description?.trim() ?? "",
                status: status ?? "activo",
                platforms: plats,
                totalEarnings,
                nicheId: nicheId ?? "",
            });
            return reply.status(201).send({ product });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.patch("/digital-products/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const body = request.body as any;
            const update: Record<string, any> = {};
            if (body.type?.trim()) update.type = body.type.trim();
            if (body.title?.trim()) update.title = body.title.trim();
            if (body.description !== undefined) update.description = body.description.trim();
            if (body.status) update.status = body.status;
            if (body.nicheId !== undefined) update.nicheId = body.nicheId;
            if (Array.isArray(body.platforms)) {
                update.platforms = body.platforms;
                update.totalEarnings = body.platforms.reduce((s: number, p: any) => s + (Number(p.earnings) || 0), 0);
            }
            const product = await DigitalProduct.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
            if (!product) return reply.status(404).send({ error: "Producto no encontrado" });
            return reply.send({ product });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.delete("/digital-products/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            await DigitalProduct.findByIdAndDelete(id);
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
