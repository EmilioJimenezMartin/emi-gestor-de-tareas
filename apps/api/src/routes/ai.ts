import { FastifyInstance } from "fastify";
import axios from "axios";
import { Settings } from "../models/settings.js";

export async function registerAIRoutes(app: FastifyInstance) {
    app.post("/ai/generate-image", async (request: any, reply) => {
        const { prompt, modelId, provider, width, height } = request.body;

        app.log.info(`API Proxy: Generating image with ${provider} (${modelId})`);

        try {
            console.log(`DEBUG: API Proxy -> ${provider} | Model: ${modelId}`);
            let apiKey = "";

            if (provider === "Hugging Face") {
                const hfSetting = await Settings.findOne({ key: "HUGGINGFACE_API_KEY" });
                apiKey = hfSetting?.value || process.env.HUGGINGFACE_API_KEY || "";
            } else if (provider === "Google") {
                const googleSetting = await Settings.findOne({ key: "GOOGLE_API_KEY" });
                apiKey = googleSetting?.value || process.env.GOOGLE_API_KEY || "";
            }

            // --- HUGGING FACE ---
            if (provider === "Hugging Face" && apiKey) {
                try {
                    console.log(`DEBUG: Intentando HF Real -> ${modelId}`);
                    // Formato robusto de URL para Inference API
                    const hfUrl = `https://api-inference.huggingface.co/models/${modelId.trim()}`;

                    const response = await axios({
                        url: hfUrl,
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${apiKey.trim()}`,
                            'Content-Type': 'application/json'
                        },
                        data: {
                            inputs: prompt,
                            parameters: { wait_for_model: true }
                        },
                        responseType: 'arraybuffer',
                        timeout: 30000 // 30s
                    });

                    console.log("DEBUG: HF Éxito!");
                    return reply.type("image/png").send(Buffer.from(response.data));
                } catch (hfError: any) {
                    console.warn("DEBUG: HF Real falló, usando motor de respaldo:", hfError.message);
                    // Si falla HF, seguimos al fallback de Pollinations abajo
                }
            }

            // --- FALLBACK / GOOGLE / SIMULACION ---
            // Pollinations es el motor de respaldo más fiable para evitar el error 500
            console.log("DEBUG: Usando Motor de Respaldo Premium (Pollinations Pro)");
            try {
                const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width || 1024}&height=${height || 1024}&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;

                const response = await axios({
                    url: pollinationsUrl,
                    method: 'GET',
                    responseType: 'arraybuffer',
                    timeout: 20000 // 20s
                });

                return reply.type("image/png").send(Buffer.from(response.data));
            } catch (pollError: any) {
                throw new Error(`Todos los motores de I.A. fallaron: ${pollError.message}`);
            }

        } catch (error: any) {
            console.error("DEBUG: Error crítico en Proxy:", error.message);
            return reply.status(500).send({
                error: "Error en el servidor de I.A.",
                details: error.message
            });
        }
    });
}
