import { FastifyInstance } from "fastify";
import { SavedPrompt } from "../models/savedPrompt.js";
import { getMongoStatus } from "../lib/mongo.js";

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerSavedPromptsRoutes(app: FastifyInstance) {
    app.get("/saved-prompts", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const prompts = await SavedPrompt.find().sort({ createdAt: -1 }).lean();
            return reply.send({ prompts });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.post("/saved-prompts", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { name, category, promptParts } = request.body as any;
            if (!name?.trim()) return reply.status(400).send({ error: "name required" });
            if (!promptParts?.theme?.trim()) return reply.status(400).send({ error: "theme required" });
            const prompt = new SavedPrompt({
                name: name.trim(),
                category: (category?.trim() || "General"),
                promptParts: {
                    theme: promptParts.theme?.trim() ?? "",
                    specs: promptParts.specs?.trim() ?? "",
                    details: promptParts.details?.trim() ?? "",
                    particulars: promptParts.particulars?.trim() ?? "",
                },
            });
            await prompt.save();
            return reply.status(201).send({ prompt });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.delete("/saved-prompts/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            await SavedPrompt.findByIdAndDelete(id);
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
