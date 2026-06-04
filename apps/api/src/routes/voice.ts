import { FastifyInstance } from "fastify";
import { getMongoStatus } from "../lib/mongo.js";
import { transcribeAudio } from "../lib/whisper.js";
import { synthesizeSpeech } from "../lib/tts.js";

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerVoiceRoutes(app: FastifyInstance) {
    // POST /voice/transcribe — accepts { audio: base64string, mimeType?: string }
    app.post("/voice/transcribe", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        const { audio, mimeType = "audio/webm" } = request.body as any;
        if (!audio) return reply.status(400).send({ error: "audio field required (base64)" });

        try {
            const buffer = Buffer.from(audio, "base64");
            const text = await transcribeAudio(buffer, mimeType);
            if (!text) return reply.status(503).send({ error: "Transcripción no disponible (verifica HUGGINGFACE_API_KEY)" });
            return reply.send({ text });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /voice/tts — accepts { text: string } → returns audio/mpeg binary
    app.post("/voice/tts", async (request: any, reply) => {
        const { text } = request.body as any;
        if (!text?.trim()) return reply.status(400).send({ error: "text field required" });

        try {
            const result = await synthesizeSpeech(text.trim());
            if (!result) return reply.status(503).send({ error: "TTS no disponible" });
            reply.header("Content-Type", result.mimeType);
            reply.header("Cache-Control", "no-store");
            return reply.send(result.buffer);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
