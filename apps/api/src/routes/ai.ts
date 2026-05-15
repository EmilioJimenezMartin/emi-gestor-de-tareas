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

function gcd(a: number, b: number) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function ratioFromDims(width?: number, height?: number) {
  const w = typeof width === "number" && width > 0 ? width : 1024;
  const h = typeof height === "number" && height > 0 ? height : 1024;
  const g = gcd(w, h);
  return `${Math.round(w / g)}:${Math.round(h / g)}`;
}

export async function registerAIRoutes(app: FastifyInstance) {
    app.post("/ai/generate-image", async (request: any, reply) => {
        const { prompt, modelId, provider, width, height, initImage } = request.body;

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
            } else if (provider === "Leonardo") {
                apiKey = process.env.LEONARDO_API_KEY || "";
                if (!apiKey && getMongoStatus() === "connected") {
                    const leonardoSetting = await Settings.findOne({ key: "LEONARDO_API_KEY" });
                    apiKey = leonardoSetting?.value || "";
                }
            } else if (provider === "Ideogram") {
                apiKey = process.env.IDEOGRAM_API_KEY || "";
                if (!apiKey && getMongoStatus() === "connected") {
                    const ideogramSetting = await Settings.findOne({ key: "IDEOGRAM_API_KEY" });
                    apiKey = ideogramSetting?.value || "";
                }
            }

            // --- GOOGLE (GEMINI IMAGE) ---
            if (provider === "Google" && apiKey) {
                try {
                    const geminiModel =
                        typeof modelId === "string" && modelId.trim().startsWith("gemini-")
                            ? modelId.trim()
                            : "gemini-2.5-flash-image";
                    const aspectRatio = ratioFromDims(width, height);

                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
                    let parts: any[] = [{ text: prompt }];

                    if (initImage?.dataUrl && typeof initImage.dataUrl === "string" && initImage.dataUrl.startsWith("data:")) {
                        const match = initImage.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                        if (match) {
                            const mimeType = match[1];
                            const b64 = match[2];
                            parts = [
                                { inlineData: { mimeType, data: b64 } },
                                { text: prompt },
                            ];
                        }
                    }

                    const response = await axios({
                        url,
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": apiKey.trim(),
                        },
                        data: {
                            contents: [
                                {
                                    parts,
                                },
                            ],
                            generationConfig: {
                                responseModalities: ["IMAGE"],
                                responseFormat: {
                                    image: { aspectRatio },
                                },
                            },
                        },
                        timeout: 45000,
                    });

                    const respParts =
                        response.data?.candidates?.[0]?.content?.parts ||
                        response.data?.candidates?.[0]?.content?.Parts ||
                        [];

                    const inline =
                        respParts.find((p: any) => p?.inlineData?.data) ||
                        respParts.find((p: any) => p?.inline_data?.data) ||
                        null;

                    const dataB64 = inline?.inlineData?.data || inline?.inline_data?.data;
                    const mimeType =
                        inline?.inlineData?.mimeType || inline?.inline_data?.mime_type || "image/png";

                    if (typeof dataB64 === "string" && dataB64.length > 0) {
                        const buf = Buffer.from(dataB64, "base64");
                        return reply.type(mimeType).send(buf);
                    }
                    // If no image returned, fall through to fallback
                    app.log.warn({ geminiModel }, "AI image: Gemini returned no image, trying fallback");
                } catch (googleErr: any) {
                    const status = googleErr?.response?.status;
                    app.log.warn({ err: googleErr, status }, "AI image: Google Gemini failed, trying fallback");
                }
            }

            // --- LEONARDO.AI ---
            if (provider === "Leonardo" && apiKey) {
                try {
                    let initImageId: string | null = null;
                    let initStrength: number | undefined = undefined;

                    if (initImage?.dataUrl && typeof initImage.dataUrl === "string" && initImage.dataUrl.startsWith("data:")) {
                        const match = initImage.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                        if (match) {
                            const mimeType = match[1];
                            const b64 = match[2];
                            const buffer = Buffer.from(b64, "base64");
                            const ext =
                                mimeType === "image/png"
                                    ? "png"
                                    : mimeType === "image/webp"
                                        ? "webp"
                                        : mimeType === "image/jpeg" || mimeType === "image/jpg"
                                            ? "jpg"
                                            : "png";

                            initStrength =
                                typeof initImage?.strength === "number"
                                    ? Math.min(0.9, Math.max(0.1, initImage.strength))
                                    : 0.6;

                            // 1) Request presigned upload
                            const prep = await axios({
                                url: "https://cloud.leonardo.ai/api/rest/v1/init-image",
                                method: "POST",
                                headers: {
                                    accept: "application/json",
                                    authorization: `Bearer ${apiKey.trim()}`,
                                    "content-type": "application/json",
                                },
                                data: { extension: ext },
                                timeout: 30000,
                            });

                            const uploadInitImage =
                                prep.data?.uploadInitImage ||
                                prep.data?.data?.uploadInitImage ||
                                prep.data?.initImage ||
                                prep.data;

                            const uploadUrl = uploadInitImage?.url || uploadInitImage?.uploadUrl || uploadInitImage?.fields?.url;
                            const fields = uploadInitImage?.fields || uploadInitImage?.uploadFields;
                            const id = uploadInitImage?.id || uploadInitImage?.imageId;

                            if (typeof uploadUrl === "string" && fields && id) {
                                const form = new FormData();
                                for (const [k, v] of Object.entries(fields)) {
                                    if (typeof v === "string") form.append(k, v);
                                }
                                form.append("file", new Blob([buffer], { type: mimeType }), `init.${ext}`);

                                const upRes = await fetch(uploadUrl, { method: "POST", body: form as any });
                                if (!upRes.ok) throw new Error(`Leonardo init-image upload failed: ${upRes.status}`);

                                initImageId = String(id);
                            }
                        }
                    }

                    const createResp = await axios({
                        url: "https://cloud.leonardo.ai/api/rest/v1/generations",
                        method: "POST",
                        headers: {
                            accept: "application/json",
                            authorization: `Bearer ${apiKey.trim()}`,
                            "content-type": "application/json",
                        },
                        data: {
                            prompt,
                            width: typeof width === "number" ? width : 1024,
                            height: typeof height === "number" ? height : 1024,
                            num_images: 1,
                            ...(typeof modelId === "string" && modelId.trim().length > 0 ? { modelId: modelId.trim() } : {}),
                            ...(initImageId ? { init_image_id: initImageId, init_strength: initStrength } : {}),
                        },
                        timeout: 45000,
                    });

                    const generationId =
                        createResp.data?.sdGenerationJob?.generationId ||
                        createResp.data?.generationId ||
                        createResp.data?.data?.generationId;

                    if (!generationId) throw new Error("Leonardo: no generationId returned");

                    const startedAt = Date.now();
                    const timeoutMs = 90000;
                    let imageUrl: string | null = null;

                    while (Date.now() - startedAt < timeoutMs) {
                        const statusResp = await axios({
                            url: `https://cloud.leonardo.ai/api/rest/v1/generations/${encodeURIComponent(String(generationId))}`,
                            method: "GET",
                            headers: {
                                accept: "application/json",
                                authorization: `Bearer ${apiKey.trim()}`,
                            },
                            timeout: 20000,
                        });

                        const imgs = statusResp.data?.generations_by_pk?.generated_images;
                        const urlCandidate = imgs?.[0]?.url;
                        if (typeof urlCandidate === "string" && urlCandidate.length > 0) {
                            imageUrl = urlCandidate;
                            break;
                        }
                        await new Promise((r) => setTimeout(r, 2000));
                    }

                    if (!imageUrl) throw new Error("Leonardo: generation timed out");

                    const imgResp = await axios({
                        url: imageUrl,
                        method: "GET",
                        responseType: "arraybuffer",
                        timeout: 30000,
                    });

                    return reply.type("image/png").send(Buffer.from(imgResp.data));
                } catch (leoErr: any) {
                    const status = leoErr?.response?.status;
                    app.log.warn({ err: leoErr, status }, "AI image: Leonardo failed, trying fallback");
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

            // --- POLLINATIONS (explicit, passes model param) ---
            if (provider === "Pollinations") {
                try {
                    const modelParam = typeof modelId === "string" && modelId.trim().length > 0 ? modelId.trim() : "flux";
                    const seed = Math.floor(Math.random() * 1000000);
                    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${encodeURIComponent(modelParam)}&width=${width || 1024}&height=${height || 1024}&seed=${seed}&nologo=true`;
                    app.log.info({ modelParam }, "AI image: using Pollinations direct");
                    const response = await axios({
                        url: pollinationsUrl,
                        method: "GET",
                        responseType: "arraybuffer",
                        timeout: 30000,
                    });
                    return reply.type("image/png").send(Buffer.from(response.data));
                } catch (pollErr: any) {
                    const status = pollErr?.response?.status;
                    if (status === 429) {
                        const retryAfterSeconds = getRetryAfterSecondsFromError(pollErr, 20);
                        nextAllowedAtByKey.set(cooldownKey, Date.now() + retryAfterSeconds * 1000);
                        return reply
                            .status(429)
                            .header("Retry-After", String(retryAfterSeconds))
                            .send({ error: "Límite de peticiones alcanzado", details: `Espera ${retryAfterSeconds}s` });
                    }
                    app.log.warn({ err: pollErr, status }, "AI image: Pollinations direct failed, trying fallback");
                }
            }

            // --- IDEOGRAM ---
            if (provider === "Ideogram" && apiKey) {
                try {
                    const aspectRatio = ratioFromDims(width, height);
                    const ideogramAspectMap: Record<string, string> = {
                        "1:1": "ASPECT_1_1",
                        "16:9": "ASPECT_16_9",
                        "9:16": "ASPECT_9_16",
                        "4:3": "ASPECT_4_3",
                        "3:4": "ASPECT_3_4",
                        "3:2": "ASPECT_3_2",
                        "2:3": "ASPECT_2_3",
                        "16:10": "ASPECT_16_10",
                        "10:16": "ASPECT_10_16",
                    };
                    const aspect_ratio = ideogramAspectMap[aspectRatio] || "ASPECT_1_1";
                    const ideogramModelId = typeof modelId === "string" && modelId.trim().length > 0 ? modelId.trim() : "V_2_TURBO";
                    app.log.info({ ideogramModelId, aspect_ratio }, "AI image: using Ideogram");
                    const ideogramResp = await axios({
                        url: "https://api.ideogram.ai/generate",
                        method: "POST",
                        headers: {
                            "Api-Key": apiKey.trim(),
                            "Content-Type": "application/json",
                        },
                        data: {
                            image_request: {
                                prompt,
                                aspect_ratio,
                                model: ideogramModelId,
                                magic_prompt_option: "AUTO",
                            },
                        },
                        timeout: 60000,
                    });
                    const imageUrl = ideogramResp.data?.data?.[0]?.url;
                    if (!imageUrl) throw new Error("Ideogram: no image URL in response");
                    const imgResp = await axios({
                        url: imageUrl,
                        method: "GET",
                        responseType: "arraybuffer",
                        timeout: 30000,
                    });
                    return reply.type("image/jpeg").send(Buffer.from(imgResp.data));
                } catch (ideogramErr: any) {
                    const status = ideogramErr?.response?.status;
                    if (status === 429) {
                        const retryAfterSeconds = getRetryAfterSecondsFromError(ideogramErr, 60);
                        nextAllowedAtByKey.set(cooldownKey, Date.now() + retryAfterSeconds * 1000);
                        return reply
                            .status(429)
                            .header("Retry-After", String(retryAfterSeconds))
                            .send({ error: "Límite de peticiones alcanzado", details: `Ideogram: espera ${retryAfterSeconds}s` });
                    }
                    app.log.warn({ err: ideogramErr, status }, "AI image: Ideogram failed, trying fallback");
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
