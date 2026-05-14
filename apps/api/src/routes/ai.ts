import { FastifyInstance } from "fastify";
import axios from "axios";
import { Settings } from "../models/settings.js";
import { getMongoStatus } from "../lib/mongo.js";

const nextAllowedAtByKey = new Map<string, number>();

// 1x1 transparent PNG (so the client always receives a valid image payload)
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6Xc7e0AAAAASUVORK5CYII=",
  "base64"
);

function getCooldownKey(provider: string | undefined, modelId: string | undefined) {
  return `${provider || "unknown"}::${(modelId || "unknown").trim()}`;
}

function getRetryAfterSecondsFromError(err: any, fallbackSeconds: number) {
  const header = err?.response?.headers?.["retry-after"];
  if (typeof header === "string") {
    const n = Number(header);
    if (Number.isFinite(n) && n > 0) return Math.min(Math.max(1, n), 120);
  }
  return fallbackSeconds;
}

export async function registerAIRoutes(app: FastifyInstance) {
    app.post("/ai/generate-image", async (request: any, reply) => {
        const { prompt, modelId, provider, width, height } = request.body;

        app.log.info(`API Proxy: Generating image with ${provider} (${modelId})`);

        try {
            const cooldownKey = getCooldownKey(provider, modelId);
            const now = Date.now();
            const nextAllowedAt = nextAllowedAtByKey.get(cooldownKey);
            if (typeof nextAllowedAt === "number" && nextAllowedAt > now) {
                const retryAfterSeconds = Math.ceil((nextAllowedAt - now) / 1000);
                return reply
                    .status(429)
                    .header("Retry-After", String(retryAfterSeconds))
                    .send({
                        error: "Límite de peticiones alcanzado",
                        details: `Espera ${retryAfterSeconds}s antes de volver a generar con ${provider}`,
                    });
            }

            let apiKey = "";

            if (provider === "Hugging Face") {
                // Evita timeouts intermitentes cuando Mongo está desconectado (Mongoose bufferTimeout).
                apiKey = process.env.HUGGINGFACE_API_KEY || "";
                if (!apiKey && getMongoStatus() === "connected") {
                    const hfSetting = await Settings.findOne({ key: "HUGGINGFACE_API_KEY" });
                    apiKey = hfSetting?.value || "";
                }
            } else if (provider === "Google") {
                apiKey = process.env.GOOGLE_API_KEY || "";
                if (!apiKey && getMongoStatus() === "connected") {
                    const googleSetting = await Settings.findOne({ key: "GOOGLE_API_KEY" });
                    apiKey = googleSetting?.value || "";
                }
            }

            // --- HUGGING FACE ---
            if (provider === "Hugging Face" && apiKey) {
                try {
                    app.log.info({ provider, modelId }, "AI image: trying Hugging Face");
                    // Formato robusto de URL para Inference API
                    const hfUrl = `https://api-inference.huggingface.co/models/${modelId.trim()}`;

                    const attempts = 3;
                    let lastErr: any = null;

                    for (let attempt = 1; attempt <= attempts; attempt++) {
                        try {
                            const response = await axios({
                                url: hfUrl,
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${apiKey.trim()}`,
                                    "Content-Type": "application/json",
                                    Accept: "image/png",
                                    "x-use-cache": "false",
                                },
                                data: {
                                    inputs: prompt,
                                    parameters: { wait_for_model: true },
                                },
                                responseType: "arraybuffer",
                                timeout: 30000, // 30s
                            });

                            const contentType = String(response.headers?.["content-type"] || "");
                            if (!contentType.includes("image/")) {
                                // A veces HF responde JSON de error aunque pidamos arraybuffer.
                                lastErr = new Error(`Hugging Face devolvió content-type no imagen: ${contentType}`);
                                app.log.warn({ contentType }, "AI image: Hugging Face non-image response");
                                break;
                            }
                            return reply.type("image/png").send(Buffer.from(response.data));
                        } catch (e: any) {
                            lastErr = e;
                            const status = e?.response?.status;
                            app.log.warn({ err: e, attempt, status }, "AI image: Hugging Face attempt failed");
                            // 503 suele ser "Loading model" => espera 5s y reintenta
                            if (status === 503) {
                                await new Promise((r) => setTimeout(r, 5000));
                                continue;
                            }
                            if (status === 429) {
                                const retryAfterSeconds = getRetryAfterSecondsFromError(e, 15);
                                nextAllowedAtByKey.set(cooldownKey, Date.now() + retryAfterSeconds * 1000);
                                const backoffMs = attempt === 1 ? 1000 : 3000;
                                await new Promise((r) => setTimeout(r, backoffMs));
                            }
                        }
                    }

                    const lastStatus = lastErr?.response?.status;
                    if (lastStatus === 429) {
                        // No devolvemos aquí: seguimos al fallback (Pollinations) para intentar servir algo.
                        app.log.warn("AI image: Hugging Face rate limited, trying fallback");
                    } else if (lastStatus === 401 || lastStatus === 403) {
                        // Token inválido / sin permisos => fallback silencioso
                        app.log.warn("AI image: Hugging Face auth failed, trying fallback");
                    } else {
                        app.log.warn({ err: lastErr }, "AI image: Hugging Face failed, trying fallback");
                    }
                } catch (hfError: any) {
                    app.log.warn({ err: hfError }, "AI image: Hugging Face failed, using fallback");
                    // Si falla HF, seguimos al fallback de Pollinations abajo
                }
            }

            // --- FALLBACK / GOOGLE / SIMULACION ---
            // Pollinations es el motor de respaldo más fiable para evitar el error 500
            try {
                const attempts = 3;
                let lastErr: any = null;

                for (let attempt = 1; attempt <= attempts; attempt++) {
                    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width || 1024}&height=${height || 1024}&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
                    try {
                        app.log.info({ attempt }, "AI image: trying Pollinations fallback");
                        const response = await axios({
                            url: pollinationsUrl,
                            method: 'GET',
                            responseType: 'arraybuffer',
                            timeout: 20000 // 20s
                        });
                        return reply.type("image/png").send(Buffer.from(response.data));
                    } catch (e: any) {
                        lastErr = e;
                        const status = e?.response?.status;
                        app.log.warn({ err: e, attempt }, "AI image: Pollinations attempt failed");
                        // Si nos rate-limitan, hacemos backoff corto y devolvemos 429 si no se recupera.
                        if (status === 429) {
                            const retryAfterSeconds = getRetryAfterSecondsFromError(e, 20);
                            nextAllowedAtByKey.set(cooldownKey, Date.now() + retryAfterSeconds * 1000);
                            const backoffMs = attempt === 1 ? 1000 : 3000;
                            await new Promise((r) => setTimeout(r, backoffMs));
                        }
                    }
                }

                const lastStatus = lastErr?.response?.status;
                if (lastStatus === 429) {
                    const retryAfter =
                        (typeof lastErr?.response?.headers?.["retry-after"] === "string" && lastErr.response.headers["retry-after"]) ||
                        "10";
                    nextAllowedAtByKey.set(cooldownKey, Date.now() + Number(retryAfter) * 1000);
                    return reply
                        .status(429)
                        .header("Retry-After", retryAfter)
                        .send({
                            error: "Límite de peticiones alcanzado",
                            details: lastErr?.message || "Rate limited",
                        });
                }

                return reply.status(503).send({
                    error: "Servicio de generación de imágenes no disponible",
                    details: lastErr?.message || "Pollinations failed",
                });
            } catch (pollError: any) {
                // Último recurso: devolvemos un PNG válido para que el usuario no vea error
                app.log.error({ err: pollError }, "AI image: fallback failed, returning transparent PNG");
                return reply
                    .header("X-AI-Fallback", "transparent-png")
                    .type("image/png")
                    .send(TRANSPARENT_PNG);
            }

        } catch (error: any) {
            app.log.error({ err: error }, "AI image: critical proxy error");
            // Último recurso: devolvemos un PNG válido para que el usuario no vea error
            return reply
                .header("X-AI-Fallback", "transparent-png")
                .type("image/png")
                .send(TRANSPARENT_PNG);
        }
    });
}
