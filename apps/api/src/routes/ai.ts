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
        const { prompt, modelId, provider, width, height, initImage, advancedParams } = request.body;
        const negativePrompt: string = advancedParams?.negativePrompt?.trim() || "";
        const steps: number | undefined = typeof advancedParams?.steps === "number" ? advancedParams.steps : undefined;
        const guidanceScale: number | undefined = typeof advancedParams?.guidanceScale === "number" ? advancedParams.guidanceScale : undefined;
        const fixedSeed: number | undefined = typeof advancedParams?.seed === "number" ? advancedParams.seed : undefined;
        const ideogramStyle: string = advancedParams?.style || "AUTO";

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
            } else if (provider === "fal.ai") {
                apiKey = process.env.FALAI_API_KEY || "";
                if (!apiKey && getMongoStatus() === "connected") {
                    const s = await Settings.findOne({ key: "FALAI_API_KEY" });
                    apiKey = s?.value || "";
                }
            } else if (provider === "Segmind") {
                apiKey = process.env.SEGMIND_API_KEY || "";
                if (!apiKey && getMongoStatus() === "connected") {
                    const s = await Settings.findOne({ key: "SEGMIND_API_KEY" });
                    apiKey = s?.value || "";
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
                            ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
                            ...(guidanceScale ? { guidance_scale: guidanceScale } : {}),
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
                                    parameters: {
                                        wait_for_model: true,
                                        ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
                                        ...(steps ? { num_inference_steps: steps } : {}),
                                        ...(guidanceScale ? { guidance_scale: guidanceScale } : {}),
                                    },
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
                    const seed = fixedSeed ?? Math.floor(Math.random() * 1000000);
                    const negParam = negativePrompt ? `&negative=${encodeURIComponent(negativePrompt)}` : "";
                    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${encodeURIComponent(modelParam)}&width=${width || 1024}&height=${height || 1024}&seed=${seed}&nologo=true${negParam}`;
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
                                ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
                                ...(ideogramStyle && ideogramStyle !== "AUTO" ? { style_type: ideogramStyle } : {}),
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

            // --- FAL.AI ---
            if (provider === "fal.ai" && apiKey) {
                try {
                    app.log.info({ modelId }, "AI image: using fal.ai");
                    const falModelPath = typeof modelId === "string" && modelId.trim().length > 0
                        ? modelId.trim()
                        : "fal-ai/flux/schnell";
                    const falResp = await axios({
                        url: `https://fal.run/${falModelPath}`,
                        method: "POST",
                        headers: {
                            "Authorization": `Key ${apiKey.trim()}`,
                            "Content-Type": "application/json",
                        },
                        data: {
                            prompt,
                            image_size: { width: width || 1024, height: height || 1024 },
                            num_inference_steps: steps ?? 4,
                            num_images: 1,
                            enable_safety_checker: false,
                            ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
                        },
                        timeout: 60000,
                    });
                    const imageUrl = falResp.data?.images?.[0]?.url;
                    if (!imageUrl) throw new Error("fal.ai: no image URL in response");
                    const imgResp = await axios({ url: imageUrl, method: "GET", responseType: "arraybuffer", timeout: 30000 });
                    return reply.type("image/jpeg").send(Buffer.from(imgResp.data));
                } catch (falErr: any) {
                    const status = falErr?.response?.status;
                    if (status === 429) {
                        const retryAfterSeconds = getRetryAfterSecondsFromError(falErr, 30);
                        nextAllowedAtByKey.set(cooldownKey, Date.now() + retryAfterSeconds * 1000);
                        return reply.status(429).header("Retry-After", String(retryAfterSeconds))
                            .send({ error: "Límite de peticiones alcanzado", details: `fal.ai: espera ${retryAfterSeconds}s` });
                    }
                    app.log.warn({ err: falErr, status }, "AI image: fal.ai failed, trying fallback");
                }
            }

            // --- SEGMIND ---
            if (provider === "Segmind" && apiKey) {
                try {
                    app.log.info({ modelId }, "AI image: using Segmind");
                    const segModelPath = typeof modelId === "string" && modelId.trim().length > 0
                        ? modelId.trim()
                        : "flux-schnell";
                    const segResp = await axios({
                        url: `https://api.segmind.com/v1/${segModelPath}`,
                        method: "POST",
                        headers: {
                            "x-api-key": apiKey.trim(),
                            "Content-Type": "application/json",
                        },
                        data: {
                            prompt,
                            negative_prompt: negativePrompt || "ugly, blurry, low quality",
                            samples: 1,
                            width: width || 1024,
                            height: height || 1024,
                            steps: steps ?? 4,
                            seed: fixedSeed ?? Math.floor(Math.random() * 1000000),
                            base64: false,
                        },
                        responseType: "arraybuffer",
                        timeout: 60000,
                    });
                    const contentType = String(segResp.headers?.["content-type"] || "image/jpeg");
                    return reply.type(contentType.includes("png") ? "image/png" : "image/jpeg").send(Buffer.from(segResp.data));
                } catch (segErr: any) {
                    const status = segErr?.response?.status;
                    if (status === 429) {
                        const retryAfterSeconds = getRetryAfterSecondsFromError(segErr, 30);
                        nextAllowedAtByKey.set(cooldownKey, Date.now() + retryAfterSeconds * 1000);
                        return reply.status(429).header("Retry-After", String(retryAfterSeconds))
                            .send({ error: "Límite de peticiones alcanzado", details: `Segmind: espera ${retryAfterSeconds}s` });
                    }
                    app.log.warn({ err: segErr, status }, "AI image: Segmind failed, trying fallback");
                }
            }

            // --- FALLBACK / GOOGLE / SIMULACION ---
            // Pollinations es el motor de respaldo más fiable para evitar el error 500
            try {
                const attempts = 3;
                let lastErr: any = null;

                for (let attempt = 1; attempt <= attempts; attempt++) {
                    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width || 1024}&height=${height || 1024}&seed=${Math.floor(Math.random() * 1000000)}&nologo=true&enhance=false`;
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

    // ── TEXT GENERATION ──────────────────────────────────────────────────────
    app.post("/ai/generate-text", async (request: any, reply) => {
        const { type, niche, productType, extras, language = "es", model: modelOverride } = request.body as {
            type: "titles" | "description" | "keywords" | "full-listing" | "back-cover" | "series" | "kdp-physical-book" | "image-prompt" | "niche-particulars" | "printable-particulars";
            niche: string;
            productType?: string;
            extras?: string;
            language?: string;
            model?: string;
        };

        if (!niche?.trim()) return reply.status(400).send({ error: "niche required" });

        const config = await (async () => {
            const { Settings: S } = await import("../models/settings.js");
            let provider = "google";
            let model = "gemini-2.5-flash";
            let googleKey = process.env.GOOGLE_API_KEY ?? "";
            let hfKey = process.env.HUGGINGFACE_API_KEY ?? "";
            try {
                const rows = await S.find({ key: { $in: ["DEFAULT_LLM_PROVIDER", "DEFAULT_LLM_MODEL", "GOOGLE_API_KEY", "HUGGINGFACE_API_KEY"] } });
                const map = new Map(rows.map((r: any) => [r.key, r.value]));
                if (map.has("DEFAULT_LLM_PROVIDER")) provider = map.get("DEFAULT_LLM_PROVIDER") as string;
                if (map.has("DEFAULT_LLM_MODEL")) model = map.get("DEFAULT_LLM_MODEL") as string;
                if (map.has("GOOGLE_API_KEY") && map.get("GOOGLE_API_KEY")) googleKey = map.get("GOOGLE_API_KEY") as string;
                if (map.has("HUGGINGFACE_API_KEY") && map.get("HUGGINGFACE_API_KEY")) hfKey = map.get("HUGGINGFACE_API_KEY") as string;
            } catch {}
            return { provider, model, googleKey, hfKey };
        })();

        const langInstruction = language === "en" ? "Respond in English." : "Responde en español.";

        const KDP_SYSTEM_INSTRUCTION = `[ROL]
Eres un especialista en SEO para Amazon KDP. Generas metadatos de alta conversión para libros de colorear, journals y libros de actividades. Respuesta limpia, sin introducciones ni saludos.

[REGLAS]
1. TITULO: 50-80 chars. Empieza por la keyword de mayor volumen. Debe ser atractivo, evocador y orientado a la conversión — NO una lista de keywords. Formato recomendado: "[Keyword Principal]: [Beneficio Emocional o Ángulo Único] for [Audiencia]". Ejemplo: "Mystical Forest Coloring Book: 50 Enchanting Scenes for Adults Who Love Nature & Mindfulness".
2. SUBTITULO: 60-90 chars. Keywords secundarias no repetidas del título. Menciona cantidad (páginas/diseños) y audiencia objetivo.
3. DESCRIPTION: HTML optimizado para Amazon KDP. Estructura obligatoria: (1) <p> con hook emocional que conecte con el comprador (qué problema resuelve / qué experiencia ofrece), (2) <ul> con 4-5 <li> de beneficios concretos del libro, (3) <p> con llamada a la acción + para quién es ideal (regalo, uso personal, etc). Total 450-650 chars de texto visible. Usa <strong> en 2-3 keywords clave.
4. KEYWORDS: Exactamente 7 frases de cola larga, 2-5 palabras c/u. Sin repetir palabras del título. Mezcla: temática específica + audiencia + ocasión de regalo + formato/uso.

[INPUT DEL USUARIO]
Producto:`;

        const IMAGE_PROMPT_SYSTEM_INSTRUCTION = `You are an expert AI image prompt engineer for coloring book line art (Amazon KDP / Etsy).
Generate a single, ready-to-use prompt string for AI image generators (Gemini, Leonardo AI, Stable Diffusion).
The prompt must always produce: clean black and white line art, coloring book style, thick clean outlines, white background, no shading, no gray fills, no color.
Return a JSON object with ONE key: "prompt" — a concise, descriptive sentence (30-80 words) that captures the theme, style and key visual elements. No intro, no explanation.`;

        const prompts: Record<string, string> = {
            "kdp-physical-book": `Tipo de producto: "${productType || "Libro de colorear KDP"}"
Nicho / tema principal: "${niche}"${extras ? `\nContexto del nicho (tags, estilo, descripción): ${extras}` : ""}

Genera título, subtítulo, descripción y 7 keywords SEO optimizados para Amazon KDP siguiendo las reglas del sistema.`,

            "image-prompt": `${langInstruction} Product type: "${productType || "KDP coloring book"}"
Description: "${niche}"${extras ? `\nAdditional context: ${extras}` : ""}

Generate the 4 optimized prompt fields for creating coloring book pages for this product.`,

            "printable-particulars": `You are an expert at writing richly detailed image generation prompts for printable wall art and digital art prints.
Niche: "${niche}"${extras ? `\nVisual style: ${extras}` : ""}

Write ONLY the "particulars" — 40-70 words describing ONE stunning print concept for this niche and style.
Cover ALL of: main subject, composition/layout, color palette, lighting/mood, distinctive details, and emotional atmosphere.
The result is fed directly to an image generator, so be specific and evocative — not generic.
Examples:
- Botanical: "lush monstera leaves and trailing pothos cascading over a weathered terracotta pot, dappled morning light, muted sage and terracotta palette, delicate watercolor washes with ink outlines, tranquil and airy atmosphere"
- Celestial: "crescent moon cradling a sleeping fox amid swirling constellation maps, deep indigo to dusty rose gradient sky, scattered gold foil stars, fine line art style, dreamy and mystical mood"
- Geometric: "precise Penrose tessellation of triangles and rhombuses, deep navy to warm gold gradient, sharp vector edges, mathematically perfect symmetry, modernist aesthetic with luxurious metallic accent points"
- Retro: "1950s American diner at sunset, chrome counter stools, jukebox glowing in corner, neon signs casting warm pink and turquoise light, stylized illustration with bold outlines, nostalgic and vibrant"
- Affirmation: "ornate oval frame of intertwined roses, eucalyptus, and pampas grass, soft blush and ivory palette, hand-lettering style botanical illustration, elegant and timeless with a feminine editorial feel"

Return ONLY a JSON object: {"particulars": "...40-70 words of vivid visual specifics..."}`,

            "niche-particulars": `You are an expert at writing richly detailed image generation prompts for KDP coloring books.
Niche: "${niche}"${extras ? `\nStyle context: ${extras}` : ""}

Write ONLY the "particulars" — 40-70 words describing ONE visually compelling coloring page scene from this niche.
Cover ALL of: main subject(s), scene composition, key decorative elements, background details, and mood/atmosphere.
The niche may be about characters, animals, places, objects, or abstract themes — adapt creatively and specifically.
Do NOT mention line style, coloring instructions, or output format. Do NOT invent elements unrelated to the niche.
Make it feel like a real, imaginable scene — rich in detail, interesting to color.
Examples:
- Characters/animals: "fierce samurai fox mid-leap between rooftops, sakura petals swirling in the wind, traditional wooden torii gate and lanterns in background, dynamic diagonal composition, epic and dramatic energy"
- Interior/place: "grand Victorian parlor with an ornate carved fireplace, tall arched windows draped in velvet, intricate chandelier overhead, shelves of antique books and curiosities, cozy and atmospheric"
- Object/theme: "oversized vintage teapot overflowing with climbing roses and ivy, surrounded by mismatched teacups, open books, and tiny snails, whimsical and densely detailed, fairy-tale cottage atmosphere"
- Nature/fantasy: "dense enchanted forest floor with giant twisted oak roots, hidden fairy doors carved into trunks, glowing mushrooms, dewdrop-covered spiderwebs, and a tiny lantern-lit path winding into the distance"

Return ONLY a JSON object: {"particulars": "...40-70 words of vivid visual specifics..."}`,

            titles: `${langInstruction} Generate 8 compelling titles for a "${productType}" KDP/Etsy product about "${niche}". ${extras ? `Additional context: ${extras}` : ""}
Return ONLY a JSON array of strings: ["Title 1", "Title 2", ...]`,

            description: `${langInstruction} Write a persuasive Amazon KDP / Etsy product description for a "${productType}" about "${niche}". ${extras ? `Context: ${extras}` : ""}
Include: hook sentence, 3 bullet points of benefits, call to action. Max 400 words.
Return ONLY a JSON object: {"description": "...", "bullets": ["...", "...", "..."]}`,

            keywords: `${langInstruction} Generate the best 30 SEO keywords/tags for a "${productType}" about "${niche}" on Amazon KDP and Etsy. ${extras ? `Context: ${extras}` : ""}
Include long-tail and short-tail. Return ONLY a JSON array of strings.`,

            "full-listing": `${langInstruction} Create a complete Amazon KDP + Etsy listing for a "${productType}" about "${niche}". ${extras ? `Context: ${extras}` : ""}
Return ONLY a JSON object with:
{
  "title": "main title (max 200 chars)",
  "subtitle": "subtitle (max 100 chars)",
  "description": "full description (max 500 words)",
  "bullets": ["benefit 1", "benefit 2", "benefit 3", "benefit 4", "benefit 5"],
  "keywords": ["kw1", "kw2", ...30 keywords],
  "categories": ["category1", "category2"],
  "price_suggestion_usd": 9.99,
  "series_name": "optional series name"
}`,

            "back-cover": `${langInstruction} Write a back cover text for a "${productType}" about "${niche}". ${extras ? `Context: ${extras}` : ""}
Style: engaging, professional, inviting. Max 200 words.
Return ONLY a JSON object: {"back_cover": "..."}`,

            series: `${langInstruction} Suggest a profitable KDP/Etsy product series around the niche "${niche}" for "${productType}" products. ${extras ? `Context: ${extras}` : ""}
Return ONLY a JSON object:
{
  "series_name": "...",
  "concept": "brief description",
  "volumes": [{"title": "Vol 1 - ...", "theme": "...", "angle": "..."}, ...8 volumes]
}`
        };

        const prompt = prompts[type] || prompts["full-listing"];
        const systemInstruction = type === "kdp-physical-book" ? KDP_SYSTEM_INSTRUCTION
            : type === "image-prompt" ? IMAGE_PROMPT_SYSTEM_INSTRUCTION
            : undefined;

        try {
            if (config.provider !== "huggingface" && config.googleKey) {
                const { GoogleGenAI, Type } = await import("@google/genai");
                const ai = new GoogleGenAI({ apiKey: config.googleKey });
                const textModel = modelOverride || config.model || "gemini-2.5-flash";

                const kdpSchema = {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "Título optimizado para KDP SEO, max 200 caracteres" },
                        subtitle: { type: Type.STRING, description: "Subtítulo enfocado en beneficios y estilo, max 200 caracteres" },
                        description: { type: Type.STRING, description: "Descripción completa en formato HTML para Amazon KDP" },
                        keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Exactamente 7 palabras clave de cola larga" },
                    },
                    required: ["title", "subtitle", "description", "keywords"],
                };

                const imagePromptSchema = {
                    type: Type.OBJECT,
                    properties: {
                        prompt: { type: Type.STRING, description: "Ready-to-use image generation prompt, 30-80 words" },
                    },
                    required: ["prompt"],
                };

                const nicheParticularsSchema = {
                    type: Type.OBJECT,
                    properties: {
                        particulars: { type: Type.STRING, description: "15-30 words of specific visual details for the coloring page" },
                    },
                    required: ["particulars"],
                };

                const useSchema = type === "kdp-physical-book" ? kdpSchema
                    : type === "image-prompt" ? imagePromptSchema
                    : (type === "niche-particulars" || type === "printable-particulars") ? nicheParticularsSchema
                    : undefined;

                const response = await ai.models.generateContent({
                    model: textModel,
                    contents: prompt,
                    config: {
                        ...(systemInstruction ? { systemInstruction } : {}),
                        responseMimeType: "application/json",
                        ...(useSchema ? { responseSchema: useSchema } : {}),
                    },
                });

                const raw = (response.text ?? "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
                try {
                    return reply.send({ result: JSON.parse(raw) });
                } catch {
                    return reply.send({ result: raw });
                }
            }

            if (config.provider === "huggingface" && config.hfKey) {
                const { HfInference } = await import("@huggingface/inference");
                const hf = new HfInference(config.hfKey);
                // Force JSON-only output — many open-source models tend to wrap with markdown
                const jsonEnforcement = "\n\nCRITICAL INSTRUCTION: Your entire response must be ONLY a valid JSON object or array. Do NOT include markdown, code fences (```), backticks, explanations, or any text outside the JSON. Start your response with { or [ and end with } or ]. Nothing before, nothing after.";
                const messages: { role: "system" | "user"; content: string }[] = systemInstruction
                    ? [{ role: "system", content: systemInstruction + jsonEnforcement }, { role: "user", content: prompt }]
                    : [{ role: "user", content: prompt + jsonEnforcement }];
                const response = await hf.chatCompletion({
                    model: config.model || "Qwen/Qwen2.5-7B-Instruct",
                    messages,
                    max_tokens: 1200,
                    temperature: 0.4,
                });
                const raw = (response.choices[0].message.content ?? "").trim();
                // Strip markdown code fences (```json ... ``` or ``` ... ```)
                const stripped = raw
                    .replace(/^```(?:json|html|xml|)?\s*/i, "")
                    .replace(/```\s*$/i, "")
                    .trim();
                // Try object first, then array
                const objStart = stripped.indexOf("{"); const objEnd = stripped.lastIndexOf("}");
                const arrStart = stripped.indexOf("["); const arrEnd = stripped.lastIndexOf("]");
                const jsonStr = (objStart !== -1 && objEnd > objStart) ? stripped.substring(objStart, objEnd + 1)
                    : (arrStart !== -1 && arrEnd > arrStart) ? stripped.substring(arrStart, arrEnd + 1)
                    : null;
                if (jsonStr) {
                    try { return reply.send({ result: JSON.parse(jsonStr) }); } catch {}
                }
                return reply.send({ result: stripped });
            }

            return reply.status(503).send({ error: "No hay proveedor de IA configurado. Configura Google API key o HuggingFace en Ajustes → Núcleo de Inteligencia." });
        } catch (e: any) {
            app.log.error({ err: e }, "AI text generation failed");
            return reply.status(500).send({ error: e?.message ?? "LLM error" });
        }
    });

    // ── NICHE SCORING ────────────────────────────────────────────────────────
    app.post("/ai/score-niche", async (request: any, reply) => {
        const { nicheId, name, tags = [], competition = "unknown", demand = "unknown", productType = "coloring-book", styleCategory = "generic", description = "" } = request.body as {
            nicheId?: string; name: string; tags?: string[]; competition?: string; demand?: string; productType?: string; styleCategory?: string; description?: string;
        };
        if (!name?.trim()) return reply.status(400).send({ error: "name required" });

        const config = await (async () => {
            const { Settings: S } = await import("../models/settings.js");
            let provider = "google"; let model = "gemini-2.5-flash"; let googleKey = process.env.GOOGLE_API_KEY ?? "";
            let openrouterKey = process.env.OPENROUTER_API_KEY ?? "";
            try {
                const rows = await S.find({ key: { $in: ["DEFAULT_LLM_PROVIDER", "DEFAULT_LLM_MODEL", "GOOGLE_API_KEY", "OPENROUTER_API_KEY"] } });
                const map = new Map(rows.map((r: any) => [r.key, r.value]));
                if (map.has("DEFAULT_LLM_PROVIDER")) provider = map.get("DEFAULT_LLM_PROVIDER") as string;
                if (map.has("DEFAULT_LLM_MODEL")) model = map.get("DEFAULT_LLM_MODEL") as string;
                if (map.has("GOOGLE_API_KEY") && map.get("GOOGLE_API_KEY")) googleKey = map.get("GOOGLE_API_KEY") as string;
                if (map.has("OPENROUTER_API_KEY") && map.get("OPENROUTER_API_KEY")) openrouterKey = map.get("OPENROUTER_API_KEY") as string;
            } catch {}
            return { provider, model, googleKey, openrouterKey };
        })();

        const prompt = `You are an expert analyst of self-publishing passive income businesses (Amazon KDP, Etsy, print-on-demand).

Score this niche for passive income potential on a scale of 0-100.

Niche: "${name}"
Description: "${description}"
Tags: ${tags.join(", ") || "none"}
Product type: ${productType}
Style: ${styleCategory}
Known demand: ${demand}
Known competition: ${competition}

Return ONLY a JSON object with this exact structure:
{
  "score": <integer 0-100>,
  "breakdown": {
    "demand": <integer 0-25, demand/search volume score>,
    "competition": <integer 0-25, inverse of competition - low competition = high score>,
    "uniqueness": <integer 0-25, how differentiated and specific the niche is>,
    "potential": <integer 0-25, revenue ceiling and scalability>
  },
  "reason": "<2-3 sentence explanation in Spanish of the score and main opportunity or risk>",
  "suggestion": "<1 concrete improvement suggestion in Spanish>"
}`;

        try {
            let result: any = null;

            if ((config.provider === "openrouter" || !config.googleKey) && config.openrouterKey) {
                const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.openrouterKey}`, "HTTP-Referer": "https://emi-gestor-de-tareas.local", "X-Title": "Emi Gestor de Tareas" },
                    body: JSON.stringify({ model: config.model || "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], max_tokens: 512, temperature: 0.3 }),
                });
                const data = await res.json() as any;
                const raw = (data.choices?.[0]?.message?.content ?? "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
                result = JSON.parse(raw);
            } else if (config.googleKey) {
                const { GoogleGenAI } = await import("@google/genai");
                const ai = new GoogleGenAI({ apiKey: config.googleKey });
                const response = await ai.models.generateContent({
                    model: config.model || "gemini-2.5-flash",
                    contents: prompt,
                    config: { responseMimeType: "application/json" },
                });
                const raw = (response.text ?? "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
                result = JSON.parse(raw);
            } else {
                return reply.status(503).send({ error: "No hay proveedor de IA configurado." });
            }

            const score = Math.min(100, Math.max(0, Math.round(result.score ?? 0)));
            const breakdown = { demand: result.breakdown?.demand ?? 0, competition: result.breakdown?.competition ?? 0, uniqueness: result.breakdown?.uniqueness ?? 0, potential: result.breakdown?.potential ?? 0 };
            const reason = result.reason ?? "";
            const suggestion = result.suggestion ?? "";

            if (nicheId) {
                const { Niche } = await import("../models/niche.js");
                await Niche.findByIdAndUpdate(nicheId, { $set: { score, scoreBreakdown: breakdown, scoreReason: reason, scoredAt: new Date() } });
            }

            return reply.send({ score, breakdown, reason, suggestion });
        } catch (e: any) {
            return reply.status(500).send({ error: e?.message ?? "Score error" });
        }
    });

    // ── TRENDS ───────────────────────────────────────────────────────────────
    // In-memory cache: avoids redundant LLM calls and survives rate-limit windows.
    const trendsCache = new Map<string, { data: any; expiresAt: number }>();
    const TRENDS_TTL_MS = 60 * 60 * 1000; // 1 hour

    app.post("/ai/trends", async (request: any, reply) => {
        const { platform = "all", category = "all", refresh = false } = request.body as {
            platform?: "all" | "kdp" | "etsy" | "printify";
            category?: string;
            refresh?: boolean;
        };

        const cacheKey = `${platform}__${category}`;

        // Serve from cache unless the client explicitly requests a refresh
        if (!refresh) {
            const cached = trendsCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                return reply.send({ ...cached.data, _cached: true });
            }
        }

        const config = await (async () => {
            const { Settings: S } = await import("../models/settings.js");
            let model = "gemini-2.5-flash";
            let googleKey = process.env.GOOGLE_API_KEY ?? "";
            try {
                const rows = await S.find({ key: { $in: ["DEFAULT_LLM_MODEL", "GOOGLE_API_KEY"] } });
                const map = new Map(rows.map((r: any) => [r.key, r.value]));
                if (map.has("DEFAULT_LLM_MODEL")) model = map.get("DEFAULT_LLM_MODEL") as string;
                if (map.has("GOOGLE_API_KEY") && map.get("GOOGLE_API_KEY")) googleKey = map.get("GOOGLE_API_KEY") as string;
            } catch {}
            return { model, googleKey };
        })();

        if (!config.googleKey) {
            return reply.status(503).send({ error: "No hay GOOGLE_API_KEY configurada. Añádela en Ajustes." });
        }

        // If rate-limited, try to return stale cache before giving up
        const stale = trendsCache.get(cacheKey);

        const platformFilter = platform === "all" ? "Amazon KDP, Etsy, and Printify" : platform === "kdp" ? "Amazon KDP" : platform === "etsy" ? "Etsy" : "Printify";
        const categoryFilter = category === "all" ? "all niches" : `the "${category}" niche`;
        const currentMonth = new Date().toLocaleString("en", { month: "long", year: "numeric" });

        const prompt = `You are a KDP and Etsy market research expert. It is ${currentMonth}.
Analyze current market trends for ${platformFilter} in ${categoryFilter} for digital printable products (coloring books, activity books, journals, planners, wall art, printable stickers, templates, etc.).

Return ONLY a JSON object with this exact structure:
{
  "updated_at": "${new Date().toISOString()}",
  "platform": "${platform}",
  "trends": [
    {
      "id": "unique-slug",
      "niche": "Niche Name",
      "category": "Category (e.g. Coloring Books, Journals, Planners, Wall Art, Stickers, Activity Books, Templates)",
      "platform": "kdp|etsy|both",
      "trend_score": 85,
      "competition": "low|medium|high",
      "estimated_monthly_sales": "50-200",
      "avg_price_usd": 7.99,
      "demand_trend": "rising|stable|declining",
      "seasonality": "year-round|seasonal: Q4|seasonal: summer",
      "tags": ["tag1", "tag2", "tag3"],
      "angle": "What makes this niche profitable right now",
      "product_ideas": ["Specific product idea 1", "Specific product idea 2", "Specific product idea 3"],
      "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
    }
  ],
  "hot_picks": ["niche-slug-1", "niche-slug-2", "niche-slug-3"],
  "summary": "2-sentence market overview for ${currentMonth}"
}

Generate exactly 15 diverse, actionable trends. Focus on currently profitable and rising niches. Be specific and practical.`;

        try {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey: config.googleKey });
            const response = await ai.models.generateContent({
                model: config.model || "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json" },
            });
            const raw = (response.text ?? "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
            try {
                const parsed = JSON.parse(raw);
                trendsCache.set(cacheKey, { data: parsed, expiresAt: Date.now() + TRENDS_TTL_MS });
                return reply.send(parsed);
            } catch {
                return reply.status(500).send({ error: "LLM devolvió JSON inválido", raw: raw.slice(0, 500) });
            }
        } catch (e: any) {
            const status = e?.response?.status ?? e?.status ?? e?.code;
            app.log.error({ err: e, status }, "AI trends failed");

            // Rate limit — serve stale cache if available, otherwise informative error
            if (status === 429) {
                if (stale) {
                    return reply.send({ ...stale.data, _cached: true, _stale: true });
                }
                return reply.status(429).send({
                    error: "Límite de cuota de Gemini alcanzado. El tier gratuito tiene ~1500 req/día. Espera unos minutos o usa Gemini 1.5 Flash en Ajustes.",
                    retryable: true,
                });
            }

            return reply.status(500).send({ error: e?.message ?? "Error de IA" });
        }
    });

    // ── AI UPSCALE (super-resolution via HuggingFace) ────────────────────────
    app.post("/ai/upscale", { bodyLimit: 30 * 1024 * 1024 }, async (request: any, reply) => {
        const { dataUrl } = request.body || {};
        if (!dataUrl || typeof dataUrl !== "string") {
            return reply.status(400).send({ error: "dataUrl es requerido" });
        }

        const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/s);
        if (!match) {
            return reply.status(400).send({ error: "dataUrl no válido" });
        }
        const [, mimeType, b64] = match;
        const imageBuffer = Buffer.from(b64, "base64");

        let apiKey = process.env.HUGGINGFACE_API_KEY || "";
        if (!apiKey && getMongoStatus() === "connected") {
            try {
                const hfSetting = await Settings.findOne({ key: "HUGGINGFACE_API_KEY" });
                apiKey = hfSetting?.value || "";
            } catch {}
        }

        if (!apiKey) {
            return reply.status(503).send({ error: "HuggingFace API key no configurada" });
        }

        try {
            const response = await axios.post(
                "https://api-inference.huggingface.co/models/caidas/swin2SR-realworld-sr-x4-64",
                imageBuffer,
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": mimeType,
                    },
                    responseType: "arraybuffer",
                    timeout: 90000,
                    maxBodyLength: 30 * 1024 * 1024,
                }
            );

            const contentType = (response.headers["content-type"] as string) || "image/png";
            const outB64 = Buffer.from(response.data as ArrayBuffer).toString("base64");
            return reply.send({ dataUrl: `data:${contentType};base64,${outB64}`, method: "ai" });
        } catch (hfErr: any) {
            const status = hfErr?.response?.status;
            app.log.warn({ err: hfErr, status }, "AI upscale: HuggingFace failed");
            if (status === 503) {
                return reply.status(503).send({ error: "El modelo de super-resolución se está iniciando. Inténtalo en 30 segundos.", loading: true });
            }
            return reply.status(502).send({ error: "Error en HuggingFace SR", details: hfErr?.message });
        }
    });

    // POST /ai/generate-palette — generates a color palette via Gemini
    app.post("/ai/generate-palette", async (request: any, reply) => {
        const { theme } = request.body || {};
        if (!theme?.trim()) return reply.status(400).send({ error: "theme required" });

        let googleKey = process.env.GOOGLE_API_KEY ?? "";
        try {
            const { Settings } = await import("../models/settings.js");
            const row = await Settings.findOne({ key: "GOOGLE_API_KEY" }).lean();
            if ((row as any)?.value) googleKey = (row as any).value as string;
        } catch {}

        if (!googleKey) return reply.status(400).send({ error: "Google API key not configured" });

        try {
            const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
            const { generateObject } = await import("ai");
            const { z } = await import("zod");
            const google = createGoogleGenerativeAI({ apiKey: googleKey });
            const PaletteSchema = z.object({
                name: z.string().describe("Short descriptive palette name in Spanish (2-4 words)"),
                colors: z.array(z.string()).length(5).describe("Exactly 5 hex color codes matching the theme, from lightest to darkest"),
                prompt: z.string().describe("Short English phrase for use as a color prompt in image generation (e.g. 'warm earthy terracotta tones')"),
            });
            const { object } = await generateObject({
                model: google("gemini-2.0-flash"),
                schema: PaletteSchema as any,
                prompt: `Generate a beautiful, harmonious color palette of exactly 5 hex colors for the theme: "${theme}". The palette should work well for seamless pattern design. Return valid hex codes like #FF5A3C. Name it in Spanish.`,
            });
            return reply.send(object);
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message ?? "Error generating palette" });
        }
    });

    // ── SEARCH QUERY SUGGESTION ───────────────────────────────────────────────
    // ── AI niche discovery (no user input needed, fresh each call) ──────────
    app.post("/ai/discover-niche", async (request: any, reply) => {
        const { platform = "etsy" } = request.body as { platform?: "etsy" | "amazon" | "general" };

        let googleKey = process.env.GOOGLE_API_KEY ?? "";
        try {
            const row = await Settings.findOne({ key: "GOOGLE_API_KEY" }).lean();
            if ((row as any)?.value) googleKey = (row as any).value as string;
        } catch {}
        if (!googleKey) return reply.status(503).send({ error: "Google API key no configurada" });

        const platformDescriptions: Record<string, string> = {
            etsy: "Etsy (digital downloads, printables, wall art, coloring pages, journals)",
            amazon: "Amazon KDP (coloring books, activity books, journals, low-content books)",
            general: "Etsy or Amazon KDP",
        };
        const urlFormat = platform === "amazon"
            ? "https://www.amazon.com/s?k=<search+term>"
            : "https://www.etsy.com/search?q=<search+term>";

        // Randomize the creative angle to avoid repetition across calls
        const angles = [
            "an emerging hobby or micro-community (e.g. van life, sourdough baking, cottagecore, dark academia)",
            "an underserved demographic (e.g. neurodivergent adults, senior women, teen boys, non-binary kids)",
            "a crossover niche combining two topics rarely seen together",
            "a seasonal or holiday niche that is specific enough to avoid saturation",
            "a cultural or geographic niche not well represented in English-language products",
            "a therapeutic or wellness niche with growing search demand",
            "a fandom or pop-culture adjacent niche with passionate buyers",
            "a professional or occupational niche (e.g. nurses, teachers, software engineers)",
        ];
        const angle = angles[Math.floor(Math.random() * angles.length)];
        const entropy = Math.random().toString(36).slice(2, 9);

        const promptText = `Today: ${new Date().toISOString().slice(0, 10)} | seed: ${entropy}

You are a product research strategist for passive-income sellers on ${platformDescriptions[platform]}.
Find ONE niche that is currently UNDEREXPLORED — not the obvious ones (no "mandala coloring", no "affirmation journal", no generic animals).

Creative angle to explore today: ${angle}

Requirements:
- Clear buyer intent — people are actually searching for this on ${platform}
- Specific enough to not be oversaturated (avoid huge generic categories)
- Products must be creatable as digital/print-on-demand items
- Think fresh, timely, actionable — something a solo creator can realistically dominate

${platform === "amazon" ? "For Amazon: use URL format " + urlFormat : "For Etsy: use URL format " + urlFormat} (properly URL-encoded)
The search term should be 2-5 words, buyer-focused.

Return ONLY a JSON object:
{
  "niche": "Niche name (3-6 words, catchy and specific)",
  "url": "complete ready-to-use search URL",
  "searchTerm": "the exact search term used",
  "reasoning": "2 sentences in Spanish: why this niche has potential and why it's not yet saturated"
}`;

        try {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey: googleKey });
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: promptText,
                config: {
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingBudget: 0 } as any,
                },
            });
            const raw = (response.text ?? "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
            const parsed = JSON.parse(raw) as { niche: string; url: string; searchTerm: string; reasoning: string };
            return reply.send(parsed);
        } catch (e: any) {
            return reply.status(500).send({ error: e?.message ?? "AI error" });
        }
    });

    app.post("/ai/suggest-search", async (request: any, reply) => {
        const { idea, platform = "etsy" } = request.body as {
            idea: string;
            platform?: "etsy" | "amazon" | "general";
        };
        if (!idea?.trim()) return reply.status(400).send({ error: "idea required" });

        let googleKey = process.env.GOOGLE_API_KEY ?? "";
        try {
            const row = await Settings.findOne({ key: "GOOGLE_API_KEY" }).lean();
            if ((row as any)?.value) googleKey = (row as any).value as string;
        } catch {}
        if (!googleKey) return reply.status(503).send({ error: "Google API key no configurada" });

        const platformDescriptions: Record<string, string> = {
            etsy: "Etsy (handmade marketplace, focus on digital downloads, printables, wall art, coloring pages)",
            amazon: "Amazon KDP / Books (self-published books, coloring books, journals, activity books)",
            general: "any marketplace (Amazon, Etsy, or general web search)",
        };

        const promptText = `You are an expert at finding profitable niches on ${platformDescriptions[platform] ?? "Etsy"}.
The user has this idea: "${idea.trim()}"

Generate the BEST search URL for ${platform === "etsy" ? "Etsy" : platform === "amazon" ? "Amazon" : "the web"} to research this idea as a passive-income product niche.

Rules:
- For Etsy: use https://www.etsy.com/search?q=<search+term> (URL-encode the query)
- For Amazon: use https://www.amazon.com/s?k=<search+term> (URL-encode the query)
- For general: pick the best platform (Amazon or Etsy) for this type of idea
- The search term should be 2-5 words, specific but not overly narrow
- Focus on what BUYERS search for, not sellers

Return ONLY a JSON object:
{
  "url": "complete URL",
  "searchTerm": "the search term used",
  "reasoning": "1 sentence in Spanish explaining why this search term is optimal"
}`;

        try {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey: googleKey });
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: promptText,
                config: { responseMimeType: "application/json" },
            });
            const raw = (response.text ?? "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
            const parsed = JSON.parse(raw) as { url: string; searchTerm: string; reasoning?: string };
            return reply.send(parsed);
        } catch (e: any) {
            return reply.status(500).send({ error: e?.message ?? "AI error" });
        }
    });
}
