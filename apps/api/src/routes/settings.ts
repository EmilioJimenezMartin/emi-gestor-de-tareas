import { FastifyInstance } from "fastify";
import { Settings } from "../models/settings.js";
import mongoose from "mongoose";
import { setPollinationsToken } from "../lib/pollinations-circuit.js";
import { setImageHfKey, setImageGoogleKey, setImageFalKey, setImageSegmindKey, setImageLeonardoKey, setSiliconflowKey, setTensorartApiKey, setTensorartAppId, setTensorartPrivateKey } from "../lib/image-gen.js";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env");

// Keys that should be persisted to .env so they survive MongoDB wipes/restarts
const PERSIST_TO_ENV_KEYS = new Set([
    "SILICONFLOW_API_KEY", "HUGGINGFACE_API_KEY", "GOOGLE_API_KEY", "FALAI_API_KEY",
    "SEGMIND_API_KEY", "LEONARDO_API_KEY", "TENSORART_API_KEY", "TENSORART_APP_ID",
    "TENSORART_PRIVATE_KEY", "POLLINATIONS_TOKEN", "TOGETHER_API_KEY", "DEZGO_API_KEY",
    "CF_API_TOKEN", "STABLE_HORDE_API_KEY",
]);

function persistToEnv(key: string, value: string) {
    if (!PERSIST_TO_ENV_KEYS.has(key) || !value) return;
    try {
        let content = "";
        try { content = readFileSync(ENV_PATH, "utf-8"); } catch { /* file may not exist */ }
        const lines = content.split("\n");
        const idx = lines.findIndex(l => l.startsWith(`${key}=`));
        if (idx >= 0) {
            lines[idx] = `${key}=${value}`;
        } else {
            lines.push(`${key}=${value}`);
        }
        writeFileSync(ENV_PATH, lines.join("\n"), "utf-8");
        process.env[key] = value;
    } catch (e) {
        console.warn(`[settings] Could not persist ${key} to .env:`, e);
    }
}

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
            const strVal = String(value ?? "");
            if (key === "POLLINATIONS_TOKEN") setPollinationsToken(strVal);
            if (key === "HUGGINGFACE_API_KEY") setImageHfKey(strVal);
            if (key === "GOOGLE_API_KEY") setImageGoogleKey(strVal);
            if (key === "FALAI_API_KEY") setImageFalKey(strVal);
            if (key === "SEGMIND_API_KEY") setImageSegmindKey(strVal);
            if (key === "LEONARDO_API_KEY") setImageLeonardoKey(strVal);
            if (key === "SILICONFLOW_API_KEY") setSiliconflowKey(strVal);
            if (key === "TENSORART_API_KEY") setTensorartApiKey(strVal);
            if (key === "TENSORART_APP_ID") setTensorartAppId(strVal);
            if (key === "TENSORART_PRIVATE_KEY") setTensorartPrivateKey(strVal);
            persistToEnv(key, strVal);
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
                    const sv = String(update.value ?? "");
                    if (update.key === "POLLINATIONS_TOKEN") setPollinationsToken(sv);
                    if (update.key === "HUGGINGFACE_API_KEY") setImageHfKey(sv);
                    if (update.key === "GOOGLE_API_KEY") setImageGoogleKey(sv);
                    if (update.key === "FALAI_API_KEY") setImageFalKey(sv);
                    if (update.key === "SEGMIND_API_KEY") setImageSegmindKey(sv);
                    if (update.key === "LEONARDO_API_KEY") setImageLeonardoKey(sv);
                    if (update.key === "SILICONFLOW_API_KEY") setSiliconflowKey(sv);
                    if (update.key === "TENSORART_API_KEY") setTensorartApiKey(sv);
                    if (update.key === "TENSORART_APP_ID") setTensorartAppId(sv);
                    if (update.key === "TENSORART_PRIVATE_KEY") setTensorartPrivateKey(sv);
                    persistToEnv(update.key, sv);
                }
            }

            return reply.send({ success: true });
        } catch (error) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to update settings" });
        }
    });
}
