import { FastifyInstance } from "fastify";
import { Settings } from "../models/settings.js";
import mongoose from "mongoose";
import { setPollinationsToken } from "../lib/pollinations-circuit.js";
import { setImageHfKey, setImageGoogleKey, setImageFalKey, setImageSegmindKey, setImageLeonardoKey, setTensorartApiKey, setTensorartAppId, setTensorartPrivateKey } from "../lib/image-gen.js";

export async function registerSettingsRoutes(app: FastifyInstance) {
    app.get("/settings", async (request, reply) => {
        if (mongoose.connection.readyState !== 1) {
            return reply.status(503).send({ error: "MongoDB not connected" });
        }
        try {
            const settings = await Settings.find({});
            return reply.send({ settings });
        } catch (error) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to fetch settings" });
        }
    });

    // POST /settings — upsert a single { key, value } pair
    app.post("/settings", async (request: any, reply) => {
        if (mongoose.connection.readyState !== 1) {
            return reply.status(503).send({ error: "MongoDB not connected" });
        }
        try {
            const { key, value } = request.body as { key: string; value: unknown };
            if (!key) return reply.status(400).send({ error: "key required" });
            await Settings.findOneAndUpdate({ key }, { key, value }, { upsert: true, returnDocument: 'after' });
            if (key === "POLLINATIONS_TOKEN") setPollinationsToken(String(value ?? ""));
            if (key === "HUGGINGFACE_API_KEY") setImageHfKey(String(value ?? ""));
            if (key === "GOOGLE_API_KEY") setImageGoogleKey(String(value ?? ""));
            if (key === "FALAI_API_KEY") setImageFalKey(String(value ?? ""));
            if (key === "SEGMIND_API_KEY") setImageSegmindKey(String(value ?? ""));
            if (key === "LEONARDO_API_KEY") setImageLeonardoKey(String(value ?? ""));
            if (key === "TENSORART_API_KEY") setTensorartApiKey(String(value ?? ""));
            if (key === "TENSORART_APP_ID") setTensorartAppId(String(value ?? ""));
            if (key === "TENSORART_PRIVATE_KEY") setTensorartPrivateKey(String(value ?? ""));
            if (key === "TOGETHER_API_KEY") { /* stored in MongoDB, leído en ai.ts por request */ }
            return reply.send({ success: true });
        } catch (error) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to save setting" });
        }
    });

    app.patch("/settings", async (request: any, reply) => {
        if (mongoose.connection.readyState !== 1) {
            return reply.status(503).send({ error: "MongoDB not connected" });
        }
        try {
            const updates = request.body;

            if (!Array.isArray(updates)) {
                return reply.status(400).send({ error: "Body must be an array of { key, value } updates" });
            }

            for (const update of updates) {
                if (update.key) {
                    await Settings.findOneAndUpdate(
                        { key: update.key },
                        { key: update.key, value: update.value },
                        { upsert: true, returnDocument: 'after' }
                    );
                    if (update.key === "POLLINATIONS_TOKEN") setPollinationsToken(String(update.value ?? ""));
                    if (update.key === "HUGGINGFACE_API_KEY") setImageHfKey(String(update.value ?? ""));
                    if (update.key === "GOOGLE_API_KEY") setImageGoogleKey(String(update.value ?? ""));
                    if (update.key === "FALAI_API_KEY") setImageFalKey(String(update.value ?? ""));
                    if (update.key === "SEGMIND_API_KEY") setImageSegmindKey(String(update.value ?? ""));
                    if (update.key === "LEONARDO_API_KEY") setImageLeonardoKey(String(update.value ?? ""));
                    if (update.key === "TENSORART_API_KEY") setTensorartApiKey(String(update.value ?? ""));
                    if (update.key === "TENSORART_APP_ID") setTensorartAppId(String(update.value ?? ""));
                    if (update.key === "TENSORART_PRIVATE_KEY") setTensorartPrivateKey(String(update.value ?? ""));
                }
            }

            return reply.send({ success: true });
        } catch (error) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to update settings" });
        }
    });
}
