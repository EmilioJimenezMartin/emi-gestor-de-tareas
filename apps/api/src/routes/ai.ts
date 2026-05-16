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
        const { type, niche, productType, extras, language = "es" } = request.body as {
            type: "titles" | "description" | "keywords" | "full-listing" | "back-cover" | "series";
            niche: string;
            productType: string;
            extras?: string;
            language?: string;
        };

        if (!niche?.trim()) return reply.status(400).send({ error: "niche required" });

        const { varyTextWithLLM: _, ...rest } = await import("../lib/ai.js").then(m => m);
        const config = await (async () => {
            const { Settings: S } = await import("../models/settings.js");
            let provider = "google";
            let model = "gemini-1.5-flash";
            let googleKey = process.env.GOOGLE_API_KEY ?? "";
            try {
                const rows = await S.find({ key: { $in: ["DEFAULT_LLM_PROVIDER", "DEFAULT_LLM_MODEL", "GOOGLE_API_KEY"] } });
                const map = new Map(rows.map((r: any) => [r.key, r.value]));
                if (map.has("DEFAULT_LLM_PROVIDER")) provider = map.get("DEFAULT_LLM_PROVIDER") as string;
                if (map.has("DEFAULT_LLM_MODEL")) model = map.get("DEFAULT_LLM_MODEL") as string;
                if (map.has("GOOGLE_API_KEY") && map.get("GOOGLE_API_KEY")) googleKey = map.get("GOOGLE_API_KEY") as string;
            } catch {}
            return { provider, model, googleKey };
        })();

        const langInstruction = language === "en" ? "Respond in English." : "Responde en español.";

        const prompts: Record<string, string> = {
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

        try {
            if (config.googleKey) {
                const { GoogleGenerativeAI } = await import("@google/generative-ai");
                const genAI = new GoogleGenerativeAI(config.googleKey);
                const geminiModel = genAI.getGenerativeModel({ model: config.model || "gemini-1.5-flash" });
                const result = await geminiModel.generateContent(prompt);
                const text = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
                try {
                    const parsed = JSON.parse(text);
                    return reply.send({ result: parsed });
                } catch {
                    return reply.send({ result: text });
                }
            }
            return reply.status(503).send({ error: "No LLM API key configured. Add GOOGLE_API_KEY in Settings." });
        } catch (e: any) {
            app.log.error({ err: e }, "AI text generation failed");
            return reply.status(500).send({ error: e?.message ?? "LLM error" });
        }
    });

    // ── TRENDS ───────────────────────────────────────────────────────────────
    app.post("/ai/trends", async (request: any, reply) => {
        const { platform = "all", category = "all", refresh = false } = request.body as {
            platform?: "all" | "kdp" | "etsy" | "printify";
            category?: string;
            refresh?: boolean;
        };

        const config = await (async () => {
            const { Settings: S } = await import("../models/settings.js");
            let model = "gemini-1.5-flash";
            let googleKey = process.env.GOOGLE_API_KEY ?? "";
            try {
                const rows = await S.find({ key: { $in: ["DEFAULT_LLM_MODEL", "GOOGLE_API_KEY"] } });
                const map = new Map(rows.map((r: any) => [r.key, r.value]));
                if (map.has("DEFAULT_LLM_MODEL")) model = map.get("DEFAULT_LLM_MODEL") as string;
                if (map.has("GOOGLE_API_KEY") && map.get("GOOGLE_API_KEY")) googleKey = map.get("GOOGLE_API_KEY") as string;
            } catch {}
            return { model, googleKey };
        })();

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
            if (config.googleKey) {
                const { GoogleGenerativeAI } = await import("@google/generative-ai");
                const genAI = new GoogleGenerativeAI(config.googleKey);
                const geminiModel = genAI.getGenerativeModel({ model: config.model || "gemini-1.5-flash" });
                const result = await geminiModel.generateContent(prompt);
                const text = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
                try {
                    const parsed = JSON.parse(text);
                    return reply.send(parsed);
                } catch {
                    return reply.status(500).send({ error: "LLM returned invalid JSON", raw: text.slice(0, 500) });
                }
            }
            return reply.status(503).send({ error: "No GOOGLE_API_KEY configured. Add it in Settings." });
        } catch (e: any) {
            app.log.error({ err: e }, "AI trends failed");
            return reply.status(500).send({ error: e?.message ?? "LLM error" });
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
}
