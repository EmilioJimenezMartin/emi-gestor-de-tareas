import { FastifyInstance } from "fastify";
import { Integration } from "../models/integration.js";
import { getMongoStatus } from "../lib/mongo.js";

const DEFAULT_INTEGRATIONS = [
    { name: "Amazon KDP",    icon: "📦", status: "dev",    statusLabel: "En desarrollo", desc: "Subida manual de PDFs + seguimiento de ventas" },
    { name: "Gelato",        icon: "🖨️", status: "dev",    statusLabel: "En desarrollo", desc: "Print on demand conectado vía API" },
    { name: "Etsy",          icon: "🛍️", status: "paused", statusLabel: "Pausado",        desc: "Marketplace de productos digitales y físicos" },
    { name: "Gumroad",       icon: "💚", status: "study",  statusLabel: "En estudio",     desc: "Venta directa de PDFs y productos digitales" },
    { name: "Lemon Squeezy", icon: "🍋", status: "study",  statusLabel: "En estudio",     desc: "Alternativa moderna a Gumroad con API REST" },
    { name: "Printify",      icon: "👕", status: "study",  statusLabel: "En estudio",     desc: "Print on demand, API gratuita" },
    { name: "Ko-fi",         icon: "☕", status: "study",  statusLabel: "En estudio",     desc: "Shop con webhooks gratuitos" },
    { name: "Printful",      icon: "👔", status: "study",  statusLabel: "En estudio",     desc: "Print on demand premium con fulfillment global" },
    { name: "Redbubble",     icon: "🫧", status: "study",  statusLabel: "En estudio",     desc: "Marketplace de arte independiente, sin stock" },
];

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerIntegrationRoutes(app: FastifyInstance) {
    app.get("/integrations", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            let integrations = await Integration.find().sort({ createdAt: 1 }).lean();
            if (integrations.length === 0) {
                integrations = await Integration.insertMany(DEFAULT_INTEGRATIONS) as any;
            }
            return reply.send({ integrations });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.post("/integrations", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { name, icon, status, statusLabel, desc, url } = request.body as any;
            if (!name?.trim()) return reply.status(400).send({ error: "name required" });
            const integration = await Integration.create({
                name: name.trim(),
                icon: icon?.trim() || "🔗",
                status: status || "study",
                statusLabel: statusLabel?.trim() || "En estudio",
                desc: desc?.trim() || "",
                url: url?.trim() || "",
            });
            return reply.status(201).send({ integration });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.patch("/integrations/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const body = request.body as any;
            const update: Record<string, any> = {};
            if (body.name?.trim()) update.name = body.name.trim();
            if (body.icon !== undefined) update.icon = body.icon.trim() || "🔗";
            if (body.status) update.status = body.status;
            if (body.statusLabel !== undefined) update.statusLabel = body.statusLabel.trim();
            if (body.desc !== undefined) update.desc = body.desc.trim();
            if (body.url !== undefined) update.url = body.url.trim();
            const integration = await Integration.findByIdAndUpdate(id, { $set: update }, { returnDocument: 'after' }).lean();
            if (!integration) return reply.status(404).send({ error: "Integración no encontrada" });
            return reply.send({ integration });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.delete("/integrations/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            await Integration.findByIdAndDelete(id);
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
