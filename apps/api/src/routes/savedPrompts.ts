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
            const { name, category, promptParts, aiModel } = request.body as any;
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
                ...(aiModel ? { aiModel } : {}),
            });
            await prompt.save();
            return reply.status(201).send({ prompt });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.patch("/saved-prompts/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const { name, category, promptParts, aiModel } = request.body as any;
            const update: Record<string, any> = {};
            if (name?.trim()) update.name = name.trim();
            if (category?.trim()) update.category = category.trim();
            if (promptParts) {
                if (promptParts.theme !== undefined) update["promptParts.theme"] = promptParts.theme.trim();
                if (promptParts.specs !== undefined) update["promptParts.specs"] = promptParts.specs.trim();
                if (promptParts.details !== undefined) update["promptParts.details"] = promptParts.details.trim();
                if (promptParts.particulars !== undefined) update["promptParts.particulars"] = promptParts.particulars.trim();
            }
            if (aiModel) update.aiModel = aiModel;
            const prompt = await SavedPrompt.findByIdAndUpdate(id, { $set: update }, { returnDocument: 'after' }).lean();
            if (!prompt) return reply.status(404).send({ error: "not found" });
            return reply.send({ prompt });
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
