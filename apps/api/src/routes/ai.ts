import { FastifyInstance } from "fastify";
import axios from "axios";
import { createHash, createSign } from "crypto";
import { Settings } from "../models/settings.js";
import { getMongoStatus } from "../lib/mongo.js";
import { isPollinationsBlocked, pollinationsFetch, pollinationsAuthHeaders } from "../lib/pollinations-circuit.js";
import { getApiKey } from "../lib/keys.js";
import { getImageHfKey, getImageLeonardoKey, getTensorartApiKey, getTensorartAppId, getTensorartPrivateKey } from "../lib/image-gen.js";

/** Generates TAMS-SHA256-RSA Authorization header for Tensor.art API */
function tamsSign(method: string, urlPath: string, appId: string, privateKeyPem: string, bodyStr: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = createHash("md5").update(`${timestamp}${Math.random()}`).digest("hex");
    const toSign = `${method.toUpperCase()}\n${urlPath}\n${timestamp}\n${nonceStr}\n${bodyStr}`;
    const signer = createSign("RSA-SHA256");
    signer.update(toSign, "utf8");
    const signature = signer.sign(privateKeyPem, "base64");
    return `TAMS-SHA256-RSA app_id=${appId},nonce_str=${nonceStr},timestamp=${timestamp},signature=${signature}`;
}
import { generateTextWithLLM } from "../lib/ai.js";

const nextAllowedAtByKey = new Map<string, number>();

// Cloudflare neurons tracker (resets daily, ~300 neurons per image)
const CF_NEURONS_PER_IMAGE = 300;
const CF_NEURONS_DAILY_LIMIT = 10_000;
let cfUsage = { date: "", images: 0, neurons: 0 };

function trackCfNeurons() {
    const today = new Date().toISOString().split("T")[0];
    if (cfUsage.date !== today) cfUsage = { date: today, images: 0, neurons: 0 };
    cfUsage.images += 1;
    cfUsage.neurons += CF_NEURONS_PER_IMAGE;
    Settings.findOneAndUpdate(
        { key: "CF_USAGE" },
        { key: "CF_USAGE", value: cfUsage },
        { upsert: true }
    ).catch(() => {});
}

export function getCfUsage() {
    const today = new Date().toISOString().split("T")[0];
    if (cfUsage.date !== today) return { date: today, images: 0, neurons: 0, remaining: CF_NEURONS_DAILY_LIMIT, limit: CF_NEURONS_DAILY_LIMIT };
    return { ...cfUsage, remaining: Math.max(0, CF_NEURONS_DAILY_LIMIT - cfUsage.neurons), limit: CF_NEURONS_DAILY_LIMIT };
}

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
        console.log('------------------------------------');
        console.log(`[ai/generate-image] START provider=${provider} model=${modelId} prompt="${String(prompt).slice(0, 50)}"`);

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
            console.log(provider, '--- provider ----')

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
                apiKey = process.env.LEONARDO_API_KEY || getImageLeonardoKey();
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
            } else if (provider === "Together AI" || provider === "Pollinations") {
                apiKey = process.env.TOGETHER_API_KEY || "";
                if (!apiKey && getMongoStatus() === "connected") {
                    const s = await Settings.findOne({ key: "TOGETHER_API_KEY" });
                    apiKey = s?.value || "";
                }
            } else if (provider === "Cloudflare") {
                apiKey = process.env.CF_API_TOKEN || "";
                if (!apiKey && getMongoStatus() === "connected") {
                    const s = await Settings.findOne({ key: "CF_API_TOKEN" });
                    apiKey = s?.value || "";
                }
            } else if (provider === "Stable Horde") {
                apiKey = process.env.STABLE_HORDE_API_KEY || "0000000000"; // anonymous
            } else if (provider === "Tensor.art") {
                // Try RSA App ID first, then fall back to simple Bearer token
                apiKey = process.env.TENSORART_APP_ID || getTensorartAppId();
                if (!apiKey && getMongoStatus() === "connected") {
                    const s = await Settings.findOne({ key: "TENSORART_APP_ID" });
                    apiKey = String(s?.value ?? "");
                }
                if (!apiKey) {
                    const bearerKey = process.env.TENSORART_API_KEY || getTensorartApiKey();
                    const bearerFromDb = (!bearerKey && getMongoStatus() === "connected")
                        ? String((await Settings.findOne({ key: "TENSORART_API_KEY" }))?.value ?? "")
                        : bearerKey;
                    if (bearerFromDb) apiKey = `bearer:${bearerFromDb}`;
                }
            }
            console.log(`[ai/generate-image] apiKey=${apiKey ? "SÍ (" + apiKey.slice(0, 12) + "...)" : "NO (vacía)"}`);

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
                    const body = googleErr?.response?.data ? JSON.stringify(googleErr.response.data).slice(0, 500) : googleErr?.message;
                    app.log.warn({ status, body }, "AI image: Google Gemini failed, trying fallback");
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

            // --- TENSOR.ART (TAMS RSA signature auth) ---
            if (provider === "Tensor.art" && apiKey) {
                try {
                    const isBearerKey = apiKey.startsWith("bearer:");
                    const bearerToken = isBearerKey ? apiKey.slice(7) : null;
                    const appId = isBearerKey ? "" : apiKey;

                    let privateKeyPem = "";
                    if (!isBearerKey) {
                        privateKeyPem = getTensorartPrivateKey();
                        if (!privateKeyPem && getMongoStatus() === "connected") {
                            const pkSetting = await Settings.findOne({ key: "TENSORART_PRIVATE_KEY" });
                            privateKeyPem = String(pkSetting?.value ?? "");
                        }
                        if (!privateKeyPem) throw new Error("Tensor.art: TENSORART_PRIVATE_KEY no configurada. Ve a Ajustes → Tensor.art");
                    }

                    const taEndpoint = "https://ap-east-1.tensorart.cloud";
                    const jobPath = "/v1/jobs";

                    const rawModelId = typeof modelId === "string" && modelId.trim() ? modelId.trim() : "619225630271212879";
                    const parts = rawModelId.split(":");
                    const checkpointId = parts[0];
                    const loraId = parts[1] || null;
                    const loraWeight = parts[2] ? parseFloat(parts[2]) : 0.8;

                    const requestId = createHash("md5").update(`${Date.now()}${Math.random()}`).digest("hex");

                    const w = typeof width === "number" ? Math.round(width / 64) * 64 : 1024;
                    const h = typeof height === "number" ? Math.round(height / 64) * 64 : 1024;

                    const diffusion: any = {
                        width: Math.min(Math.max(512, w), 1536),
                        height: Math.min(Math.max(512, h), 1536),
                        prompts: [{ text: prompt }],
                        sdModel: checkpointId,
                        sdVae: "Automatic",
                        sampler: "DPM++ 2M Karras",
                        steps: typeof steps === "number" ? Math.min(steps, 60) : 20,
                        cfgScale: typeof guidanceScale === "number" ? guidanceScale : 7,
                        clipSkip: 2,
                    };
                    if (negativePrompt) diffusion.negativePrompts = [{ text: negativePrompt }];
                    if (loraId) diffusion.loras = [{ modelId: loraId, weight: loraWeight }];

                    const bodyData = {
                        requestId,
                        stages: [
                            { type: "INPUT_INITIALIZE", inputInitialize: { seed: typeof fixedSeed === "number" ? fixedSeed : -1, count: 1 } },
                            { type: "DIFFUSION", diffusion },
                        ],
                    };

                    const buildAuth = (method: string, path: string, body: string) =>
                        isBearerKey
                            ? `Bearer ${bearerToken}`
                            : tamsSign(method, path, appId, privateKeyPem, body);

                    const bodyStr = JSON.stringify(bodyData);
                    const postAuth = buildAuth("POST", jobPath, bodyStr);

                    app.log.info({ appId: appId || "bearer", requestId, checkpointId, loraId }, "Tensor.art: submitting job");

                    const createResp = await axios({
                        url: `${taEndpoint}${jobPath}`,
                        method: "POST",
                        headers: { "Authorization": postAuth, "Content-Type": "application/json", "Accept": "application/json" },
                        data: bodyData,
                        timeout: 30000,
                    });

                    app.log.info({ responseData: JSON.stringify(createResp.data).slice(0, 400) }, "Tensor.art: job create response");

                    const taJobId = createResp.data?.job?.id ?? createResp.data?.jobId ?? createResp.data?.id;
                    if (!taJobId) throw new Error(`Tensor.art: no jobId. Response: ${JSON.stringify(createResp.data).slice(0, 400)}`);

                    const startedAt = Date.now();
                    let imageUrl: string | null = null;

                    while (Date.now() - startedAt < 120_000) {
                        await new Promise(r => setTimeout(r, 4000));
                        const pollPath = `${jobPath}/${taJobId}`;
                        const getAuth = buildAuth("GET", pollPath, "");
                        const statusResp = await axios({
                            url: `${taEndpoint}${pollPath}`,
                            method: "GET",
                            headers: { "Authorization": getAuth, "Accept": "application/json" },
                            timeout: 15000,
                        });
                        const job = statusResp.data?.job;
                        app.log.info({ jobId: taJobId, status: job?.status }, "Tensor.art: job poll");
                        if (job?.status === "SUCCESS" || job?.status === "COMPLETED") {
                            imageUrl = job?.successInfo?.images?.[0]?.url
                                ?? job?.runningInfo?.outputImages?.[0]
                                ?? null;
                            break;
                        }
                        if (job?.status === "FAILED" || job?.status === "CANCELED" || job?.status === "ERROR") {
                            const reason = job?.failedInfo?.reason ?? job?.runningInfo?.errMsg ?? "unknown";
                            throw new Error(`Tensor.art job ${job.status}: ${reason}`);
                        }
                    }

                    if (!imageUrl) throw new Error("Tensor.art: generation timed out (2min)");

                    const imgResp = await axios({ url: imageUrl, method: "GET", responseType: "arraybuffer", timeout: 30000 });
                    return reply.type("image/png").send(Buffer.from(imgResp.data));
                } catch (taErr: any) {
                    const taStatus = taErr?.response?.status;
                    const taBody = taErr?.response?.data ? JSON.stringify(taErr.response.data).slice(0, 400) : taErr?.message;
                    app.log.warn({ status: taStatus, body: taBody }, "AI image: Tensor.art failed");
                }
            }

            // --- HUGGING FACE ---
            if (provider === "Hugging Face" && apiKey) {
                try {
                    const hfModelId = typeof modelId === "string" && modelId.trim().length > 0
                        ? modelId.trim()
                        : "black-forest-labs/FLUX.1-schnell";
                    const hfUrl = `https://router.huggingface.co/hf-inference/models/${hfModelId}`;
                    console.log(hfUrl, 'hfUrl ---');
                    app.log.info({ hfUrl }, "AI image: trying Hugging Face");

                    const attempts = 3;
                    let lastErr: any = null;

                    for (let attempt = 1; attempt <= attempts; attempt++) {
                        try {
                            const hfBody = JSON.stringify({
                                inputs: prompt,
                                parameters: {
                                    ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
                                    ...(steps ? { num_inference_steps: steps } : {}),
                                    ...(guidanceScale ? { guidance_scale: guidanceScale } : {}),
                                },
                            });
                            const hfRes = await fetch(hfUrl, {
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${apiKey.trim()}`,
                                    "Content-Type": "application/json",
                                    "x-use-cache": "false",
                                },
                                body: hfBody,
                                signal: AbortSignal.timeout(45_000),
                            });

                            const ct = hfRes.headers.get("content-type") ?? "";
                            if (hfRes.ok && ct.includes("image/")) {
                                return reply.type(ct).send(Buffer.from(await hfRes.arrayBuffer()));
                            }

                            const status = hfRes.status;
                            lastErr = new Error(`HF status=${status} ct=${ct}`);
                            app.log.warn({ status, ct, attempt }, "AI image: Hugging Face non-image response");

                            if (status === 503) {
                                await new Promise(r => setTimeout(r, 5000));
                                continue;
                            }
                            if (status === 429) {
                                const retryAfter = parseInt(hfRes.headers.get("retry-after") ?? "15", 10) || 15;
                                nextAllowedAtByKey.set(cooldownKey, Date.now() + retryAfter * 1000);
                                await new Promise(r => setTimeout(r, attempt === 1 ? 1000 : 3000));
                                continue;
                            }
                            break; // other error, don't retry
                        } catch (e: any) {
                            lastErr = e;
                            app.log.warn({ err: e, attempt }, "AI image: Hugging Face attempt failed");
                            if (attempt < attempts) await new Promise(r => setTimeout(r, 3000));
                        }
                    }

                    app.log.warn({ err: lastErr }, "AI image: Hugging Face failed, trying fallback");
                } catch (hfError: any) {
                    app.log.warn({ err: hfError }, "AI image: Hugging Face failed, using fallback");
                }
            }

            // --- TOGETHER AI (y fallback de Pollinations cuando 402) ---
            if ((provider === "Together AI" || provider === "Pollinations") && apiKey) {
                try {
                    const togetherModel = "black-forest-labs/FLUX.1-schnell-Free";
                    const w = typeof width === "number" && width > 0 ? width : 1024;
                    const h = typeof height === "number" && height > 0 ? height : 1024;
                    console.log(`[ai/generate-image] Intentando Together AI model=${togetherModel}...`);
                    const togetherResp = await axios({
                        url: "https://api.together.xyz/v1/images/generations",
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${apiKey.trim()}`,
                            "Content-Type": "application/json",
                        },
                        data: {
                            model: togetherModel,
                            prompt,
                            width: w,
                            height: h,
                            steps: 4,
                            n: 1,
                            response_format: "b64_json",
                        },
                        timeout: 60000,
                    });
                    const b64 = togetherResp.data?.data?.[0]?.b64_json;
                    if (typeof b64 === "string" && b64.length > 0) {
                        console.log(`[ai/generate-image] Together AI OK`);
                        return reply.type("image/jpeg").send(Buffer.from(b64, "base64"));
                    }
                    throw new Error("Together AI: no image in response");
                } catch (togetherErr: any) {
                    const status = togetherErr?.response?.status;
                    const detail = togetherErr?.response?.data?.error?.message || togetherErr?.message || "unknown";
                    console.warn(`[ai/generate-image] Together AI FALLÓ — status=${status} ${detail}`);
                }
            }

            // --- POLLINATIONS (explicit, passes model param) ---
            // Bypass circuit breaker when a token is configured — token removes IP-block restriction
            const hasPollinationsToken = !!pollinationsAuthHeaders().Authorization;
            if (provider === "Pollinations" && (hasPollinationsToken || !isPollinationsBlocked())) {
                console.log(`[ai/generate-image] Intentando Pollinations (token=${hasPollinationsToken ? "SÍ" : "NO"})...`);
                try {
                    const modelParam = typeof modelId === "string" && modelId.trim().length > 0 ? modelId.trim() : "flux";
                    const seed = Math.floor(Math.random() * 999999);
                    const w = typeof width === "number" && width > 0 ? width : 1024;
                    const h = typeof height === "number" && height > 0 ? height : 1024;
                    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&model=${encodeURIComponent(modelParam)}&enhance=false`;
                    console.log(pollinationsUrl, '--- pollinationsUrl ---');
                    const res = await pollinationsFetch(pollinationsUrl, { signal: AbortSignal.timeout(60_000) });
                    const ct = res.headers.get("content-type") ?? "";
                    if (res.ok && ct.startsWith("image/")) {
                        console.log(`[ai/generate-image] Pollinations OK`);
                        return reply.type(ct).send(Buffer.from(await res.arrayBuffer()));
                    }
                    await res.body?.cancel();
                    console.warn(`[ai/generate-image] Pollinations FALLÓ — status=${res.status}`);
                } catch (pollErr: any) {
                    console.warn(`[ai/generate-image] Pollinations ERROR — ${pollErr?.message}`);
                }
            } else if (provider === "Pollinations") {
                console.warn(`[ai/generate-image] Pollinations bloqueado — circuit breaker activo`);
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
                console.log(`[ai/generate-image] Intentando fal.ai...`);
                try {
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
                    console.log(`[ai/generate-image] fal.ai OK — descargando imagen...`);
                    const imgResp = await axios({ url: imageUrl, method: "GET", responseType: "arraybuffer", timeout: 30000 });
                    return reply.type("image/jpeg").send(Buffer.from(imgResp.data));
                } catch (falErr: any) {
                    const status = falErr?.response?.status;
                    const errDetail = falErr?.response?.data?.detail || falErr?.message || "unknown";
                    console.warn(`[ai/generate-image] fal.ai FALLÓ — status=${status} detail=${JSON.stringify(errDetail).slice(0, 200)}`);
                    if (status === 429) {
                        const retryAfterSeconds = getRetryAfterSecondsFromError(falErr, 30);
                        nextAllowedAtByKey.set(cooldownKey, Date.now() + retryAfterSeconds * 1000);
                        return reply.status(429).header("Retry-After", String(retryAfterSeconds))
                            .send({ error: "Límite de peticiones alcanzado", details: `fal.ai: espera ${retryAfterSeconds}s` });
                    }
                }
            } else if (provider === "fal.ai") {
                console.warn(`[ai/generate-image] fal.ai — apiKey vacía, saltando`);
            }

            // --- SEGMIND ---
            if (provider === "Segmind" && apiKey) {
                const segModelPath = typeof modelId === "string" && modelId.trim().length > 0
                    ? modelId.trim()
                    : "flux-schnell";
                const segBody = {
                    prompt,
                    ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
                    samples: 1,
                    width: width || 1024,
                    height: height || 1024,
                    steps: steps ?? 4,
                    seed: fixedSeed ?? Math.floor(Math.random() * 1000000),
                    base64: false,
                };
                // Reintentos para cold start (503): espera 20s entre intentos
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        console.log(`[ai/generate-image] Segmind ${segModelPath} intento ${attempt}/3...`);
                        const segResp = await axios({
                            url: `https://api.segmind.com/v1/${segModelPath}`,
                            method: "POST",
                            headers: { "x-api-key": apiKey.trim(), "Content-Type": "application/json" },
                            data: segBody,
                            responseType: "arraybuffer",
                            timeout: 90000,
                        });
                        const contentType = String(segResp.headers?.["content-type"] || "image/jpeg");
                        console.log(`[ai/generate-image] Segmind OK`);
                        return reply.type(contentType.includes("png") ? "image/png" : "image/jpeg").send(Buffer.from(segResp.data));
                    } catch (segErr: any) {
                        const status = segErr?.response?.status;
                        if (status === 429) {
                            const retryAfterSeconds = getRetryAfterSecondsFromError(segErr, 30);
                            nextAllowedAtByKey.set(cooldownKey, Date.now() + retryAfterSeconds * 1000);
                            return reply.status(429).header("Retry-After", String(retryAfterSeconds))
                                .send({ error: "Límite de peticiones alcanzado", details: `Segmind: espera ${retryAfterSeconds}s` });
                        }
                        if (status === 503 && attempt < 3) {
                            console.log(`[ai/generate-image] Segmind cold start — esperando 20s (intento ${attempt}/3)...`);
                            await new Promise(r => setTimeout(r, 20_000));
                            continue;
                        }
                        const errBody = segErr?.response?.data ? Buffer.from(segErr.response.data).toString().slice(0, 200) : segErr?.message;
                        console.warn(`[ai/generate-image] Segmind FALLÓ — status=${status} ${errBody}`);
                        break;
                    }
                }
            }

            // --- CLOUDFLARE WORKERS AI ---
            if (provider === "Cloudflare" && apiKey) {
                try {
                    let cfAccountId = process.env.CF_ACCOUNT_ID || "";
                    if (!cfAccountId && getMongoStatus() === "connected") {
                        const s = await Settings.findOne({ key: "CF_ACCOUNT_ID" });
                        cfAccountId = s?.value || "";
                    }
                    if (!cfAccountId) throw new Error("CF_ACCOUNT_ID no configurado");
                    const cfModel = "@cf/black-forest-labs/flux-1-schnell";
                    // Cloudflare usa clasificador IA — quitamos framing en español y envolvemos
                    // términos estilísticos conocidos en comillas para que el clasificador los lea
                    // como referencias/nombres, no como contenido descriptivo
                    const cfPrompt = "safe illustration: " + prompt
                        .replace(/Genera una imagen con la siguiente temática:/gi, "")
                        .replace(/que tenga las siguientes especificaciones:/gi, "")
                        .replace(/con los siguientes detalles:/gi, "")
                        .replace(/coloring\s*(book|page|pages|sheet|sheets)/gi, "with outlines")
                        .replace(/\bcolorear\b|\bpara\s+colorear\b/gi, "with outlines")
                        // Envolver términos estilísticos que disparan el filtro
                        .replace(/\b(graffiti|grafiti|hypebeast|KAWS|gore|horror|demon|devil|beast|cannabis|weed)\b/gi,
                            (m) => `"${m}"`)
                        .replace(/\s{2,}/g, " ")
                        .trim();
                    console.log(`[ai/generate-image] Cloudflare cfPrompt="${cfPrompt.slice(0, 200)}"`);
                    console.log(`[ai/generate-image] Intentando Cloudflare Workers AI...`);
                    const cfRes = await fetch(
                        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${cfModel}`,
                        {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${apiKey.trim()}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ prompt: cfPrompt, steps: 4 }),
                            signal: AbortSignal.timeout(60_000),
                        }
                    );
                    if (cfRes.ok) {
                        const ct = cfRes.headers.get("content-type") ?? "";
                        if (ct.includes("image/")) {
                            // Respuesta binaria directa
                            const buf = Buffer.from(await cfRes.arrayBuffer());
                            trackCfNeurons();
                            console.log(`[ai/generate-image] Cloudflare Workers AI OK binary (${buf.length} bytes) — neurons today: ${cfUsage.neurons}/${CF_NEURONS_DAILY_LIMIT}`);
                            return reply.type(ct).send(buf);
                        }
                        // Respuesta JSON con base64 (formato REST API de Cloudflare)
                        const cfData = await cfRes.json() as any;
                        const b64 = cfData?.result?.image;
                        if (typeof b64 === "string" && b64.length > 0) {
                            const buf = Buffer.from(b64, "base64");
                            trackCfNeurons();
                            console.log(`[ai/generate-image] Cloudflare Workers AI OK base64 (${buf.length} bytes) — neurons today: ${cfUsage.neurons}/${CF_NEURONS_DAILY_LIMIT}`);
                            return reply.type("image/png").send(buf);
                        }
                        throw new Error("Cloudflare: no image field in response");
                    }
                    const errText = await cfRes.text();
                    if (errText.includes("NSFW") || errText.includes("3030")) {
                        console.warn(`[ai/generate-image] Cloudflare NSFW — intentando reescribir prompt con IA...`);
                        try {
                            const rewritten = await generateTextWithLLM(
                                "You are an expert at rewriting image generation prompts. When given a prompt blocked by an NSFW filter, rewrite it preserving the exact same visual style, aesthetic and composition using neutral terminology. Keep all technical specs (outlines, contrast, dimensions, etc.) intact. Return ONLY the rewritten prompt, no explanations.",
                                `Rewrite this prompt to pass a strict content filter while keeping the same visual style:\n\n${cfPrompt}`
                            );
                            const safePrompt = rewritten.trim().replace(/^["']|["']$/g, "");
                            console.log(`[ai/generate-image] Prompt reescrito: "${safePrompt.slice(0, 150)}"`);
                            const retryRes = await fetch(
                                `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${cfModel}`,
                                {
                                    method: "POST",
                                    headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
                                    body: JSON.stringify({ prompt: safePrompt, steps: 4 }),
                                    signal: AbortSignal.timeout(60_000),
                                }
                            );
                            if (retryRes.ok) {
                                const ct2 = retryRes.headers.get("content-type") ?? "";
                                if (ct2.includes("image/")) {
                                    trackCfNeurons();
                                    return reply.type(ct2).send(Buffer.from(await retryRes.arrayBuffer()));
                                }
                                const d2 = await retryRes.json() as any;
                                const b2 = d2?.result?.image;
                                if (typeof b2 === "string" && b2.length > 0) {
                                    trackCfNeurons();
                                    console.log(`[ai/generate-image] Cloudflare OK tras reescritura IA`);
                                    return reply.type("image/png").send(Buffer.from(b2, "base64"));
                                }
                            }
                            console.warn(`[ai/generate-image] Cloudflare sigue bloqueando tras reescritura — status=${retryRes.status}`);
                        } catch (rewriteErr: any) {
                            console.warn(`[ai/generate-image] Error reescribiendo prompt — ${rewriteErr?.message}`);
                        }
                    }
                    console.warn(`[ai/generate-image] Cloudflare FALLÓ — status=${cfRes.status} ${errText.slice(0, 150)}`);
                } catch (cfErr: any) {
                    console.warn(`[ai/generate-image] Cloudflare ERROR — ${cfErr?.message}`);
                }
            }

            // --- STABLE HORDE ---
            if (provider === "Stable Horde") {
                const hordeApiKey = apiKey || "0000000000";
                let hordeJobId: string | null = null;
                let clientGone = false;
                const onClientClose = () => { clientGone = true; };
                request.raw.on("close", onClientClose);

                const cancelHordeJob = async (jobId: string) => {
                    try {
                        await axios.delete(`https://stablehorde.net/api/v2/generate/status/${jobId}`, {
                            headers: { "apikey": hordeApiKey, "Client-Agent": "emi-gestor:1.0:anonymous" },
                            timeout: 10000,
                        });
                        console.log(`[ai/generate-image] Stable Horde job ${jobId} cancelado`);
                    } catch { /* silencioso */ }
                };

                try {
                    const hordeModelName = typeof modelId === "string" && modelId.trim().length > 0
                        ? modelId.trim()
                        : "SDXL 1.0";
                    const snapTo64 = (n: number) => Math.max(64, Math.min(1024, Math.round(n / 64) * 64));
                    const w = snapTo64(width || 1024);
                    const h = snapTo64(height || 1024);
                    const hordePrompt = negativePrompt ? `${prompt} ### ${negativePrompt}` : prompt;

                    console.log(`[ai/generate-image] Enviando a Stable Horde modelo=${hordeModelName} ${w}x${h}...`);
                    const submitResp = await axios({
                        url: "https://stablehorde.net/api/v2/generate/async",
                        method: "POST",
                        headers: { "Content-Type": "application/json", "apikey": hordeApiKey, "Client-Agent": "emi-gestor:1.0:anonymous" },
                        data: {
                            prompt: hordePrompt,
                            params: { width: w, height: h, steps: steps ?? 20, n: 1, sampler_name: "k_euler_a", cfg_scale: guidanceScale ?? 7 },
                            models: [hordeModelName],
                            r2: false, shared: false, slow_workers: true, nsfw: false,
                        },
                        timeout: 30000,
                    });

                    hordeJobId = submitResp.data?.id ?? null;
                    if (!hordeJobId) throw new Error(`Stable Horde: no job ID — ${JSON.stringify(submitResp.data).slice(0, 200)}`);
                    console.log(`[ai/generate-image] Stable Horde job ID: ${hordeJobId}`);

                    const startedAt = Date.now();
                    const maxWait = 180_000;

                    while (Date.now() - startedAt < maxWait) {
                        await new Promise(r => setTimeout(r, 5000));

                        if (clientGone) {
                            console.log(`[ai/generate-image] Stable Horde — cliente desconectado, cancelando job ${hordeJobId}`);
                            await cancelHordeJob(hordeJobId);
                            return;
                        }

                        const checkResp = await axios({
                            url: `https://stablehorde.net/api/v2/generate/check/${hordeJobId}`,
                            method: "GET",
                            headers: { "Client-Agent": "emi-gestor:1.0:anonymous" },
                            timeout: 15000,
                        });
                        const { done, faulted, queue_position, wait_time } = checkResp.data;
                        console.log(`[ai/generate-image] Stable Horde — done=${done} faulted=${faulted} queue=${queue_position} wait=${wait_time}s`);
                        if (faulted) throw new Error("Stable Horde: job faulted");
                        if (typeof wait_time === "number" && wait_time > 300) {
                            throw new Error(`Stable Horde: cola demasiado larga (${wait_time}s) — abortando`);
                        }
                        if (done) {
                            const resultResp = await axios({
                                url: `https://stablehorde.net/api/v2/generate/status/${hordeJobId}`,
                                method: "GET",
                                headers: { "apikey": hordeApiKey, "Client-Agent": "emi-gestor:1.0:anonymous" },
                                timeout: 30000,
                            });
                            const imgB64 = resultResp.data?.generations?.[0]?.img;
                            if (typeof imgB64 === "string" && imgB64.length > 0) {
                                console.log(`[ai/generate-image] Stable Horde OK`);
                                return reply.type("image/webp").send(Buffer.from(imgB64, "base64"));
                            }
                            throw new Error("Stable Horde: no image in result");
                        }
                    }
                    throw new Error("Stable Horde: generation timed out after 3 minutes");
                } catch (hordeErr: any) {
                    if (hordeJobId && !clientGone) await cancelHordeJob(hordeJobId);
                    const status = hordeErr?.response?.status;
                    const errDetail = hordeErr?.response?.data ? JSON.stringify(hordeErr.response.data).slice(0, 200) : hordeErr?.message;
                    console.warn(`[ai/generate-image] Stable Horde FALLÓ — status=${status} ${errDetail}`);
                } finally {
                    request.raw.removeListener("close", onClientClose);
                }
            }

            console.warn(`[ai/generate-image] ${provider} FALLÓ — devolviendo 503`);
            return reply.status(503).send({ error: "Servicio de generación de imágenes no disponible", details: "All providers failed" });

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
                "https://router.huggingface.co/hf-inference/models/caidas/swin2SR-realworld-sr-x4-64",
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
        const { platform = "etsy", productType = "" } = request.body as { platform?: "etsy" | "amazon" | "general" | "trends"; productType?: string };

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
            trends: "Google Trends (detect rising adoption curves for KDP/Etsy products before saturation — apply root+modifier technique)",
        };
        const urlFormat = platform === "amazon"
            ? "https://www.amazon.com/s?k=<search+term>"
            : platform === "trends"
                ? "https://trends.google.com/trends/explore?q=<search+term>&geo=US"
                : "https://www.etsy.com/search?q=<search+term>";

        // Highly specific creative angles — each forces a different, uncommon niche direction
        const angles = [
            { angle: "a specific neurodivergent or mental health community (ADHD, autism, anxiety, OCD) that buys products for coping or self-expression", examples: "ADHD adult coloring, autism sensory patterns, anxiety cat journal" },
            { angle: "a hyper-specific pet niche beyond dogs/cats (axolotls, ferrets, hairless cats, capybaras, bearded dragons, hedgehogs)", examples: "axolotl lover wall art, ferret coloring book, capybara digital print" },
            { angle: "a profession that is overlooked despite having a passionate identity community (maritime workers, zookeepers, librarians, welders, wildfire fighters)", examples: "librarian wall art, zookeeper humor coloring, trucker journal" },
            { angle: "a very specific age or life-stage transition (retirement women, newly divorced adults, empty nesters, first-time grandparents, turning 40/50/60)", examples: "retirement women coloring, grandma first year journal, empty nester wall art" },
            { angle: "a cultural or diaspora identity not well represented in POD (Filipino mythology, Slavic folklore, Yoruba symbols, Sámi art, Andean textiles)", examples: "Filipino mythology coloring, Yoruba adinkra pattern, Slavic folk art poster" },
            { angle: "a micro-hobby with a passionate niche community but almost no merch (urban foraging, sourdough artistry, competitive jigsaw, fountain pen collecting, film photography revival)", examples: "sourdough bread art print, fountain pen botanical, film photography journal" },
            { angle: "a sport or physical activity that is growing fast but underserved in KDP/Etsy (pickleball, padel, indoor climbing, freediving, disc golf, roller derby, kitesurfing)", examples: "pickleball humor journal, indoor climbing hold pattern, disc golf mandala" },
            { angle: "a crossover of two very specific unexpected topics (gothic gardening, cottagecore bodybuilding, kawaii true crime, dark academia cooking, punk birdwatching)", examples: "gothic gardening poster, cottagecore weightlifting, kawaii mystery coloring" },
            { angle: "a food or drink micro-niche with visual/aesthetic appeal (bento art, ugly vegetable beauty, elaborate cocktail garnishes, mushroom foraging, artisan bread shaping)", examples: "bento art print, mushroom foraging coloring, artisan bread baker journal" },
            { angle: "a gaming or tabletop niche specific enough to avoid saturation (cozy gaming aesthetic, solo board gaming, OSR dungeon maps, specific retro console era, LARPing community)", examples: "cozy gaming wall art, solo board game journal, retro SNES pixel art poster" },
            { angle: "a seasonal niche that is very specific and NOT Christmas/Halloween (hummingbird migration, spring equinox, firefly season, strawberry moon, autumn mushroom season)", examples: "hummingbird migration print, firefly summer coloring, strawberry moon poster" },
            { angle: "a spiritual or esoteric niche that is specific and not mainstream (green witchcraft, Norse runes, secular ceremony, plant parenthood spirituality, animism modern practice)", examples: "green witch botanical coloring, Norse rune wall art, plant parenthood journal" },
        ];
        const picked = angles[Math.floor(Math.random() * angles.length)];
        const entropy = Math.random().toString(36).slice(2, 9);

        const banned = "mandala, affirmation quotes, generic sunflowers, generic cats, generic dogs, unicorns, mermaids, generic butterflies, generic flowers, zodiac (generic), chakras (generic), paw prints, generic watercolor, boho (generic), farmhouse (generic), Christmas (generic), Halloween (generic), adult coloring (generic), gratitude journal (generic)";

        const productTypeDescriptions: Record<string, string> = {
            "coloring-book": "KDP coloring books (printable/physical, thick line art, themed scenes)",
            "printable-poster": "Etsy printable wall art / digital download posters",
            "seamless-pattern": "seamless repeat patterns for POD (Spoonflower, Redbubble, fabric)",
        };
        const productConstraint = productType && productTypeDescriptions[productType]
            ? `\nProduct type constraint: the niche MUST be for ${productTypeDescriptions[productType]}.`
            : "";
        const styleHints: Record<string, string> = {
            "coloring-book": "also suggest a styleCategory from: generic, anime, children, watercolor, realistic, abstract",
            "printable-poster": "also suggest a styleCategory from: wall-art, botanical, celestial, geometric, retro, affirmation, illustration",
            "seamless-pattern": "also suggest a styleCategory from: geometric, botanical, abstract, celestial, retro",
        };
        const styleHint = productType && styleHints[productType]
            ? `\nFor the style field, ${styleHints[productType]}.`
            : "";

        const isTrends = platform === "trends";

        const promptText = `Today: ${new Date().toISOString().slice(0, 10)} | seed: ${entropy}

You are an advanced passive-income product strategist specializing in long-tail niche research for ${platformDescriptions[platform] ?? "Etsy"}.
Find ONE niche a solo creator can REALISTICALLY dominate because it has real demand but is NOT yet crowded.${productConstraint}

BANNED (oversaturated — never suggest): ${banned}

Today's creative angle — you MUST follow this direction: ${picked.angle}
Example directions (do NOT copy, be more original): ${picked.examples}

${isTrends ? `GOOGLE TRENDS STRATEGY — apply the "Root + Modifier" technique:
- ROOT: a hobby, lifestyle or identity topic currently showing rising interest (NOT a generic term)
- MODIFIER: a KDP/Etsy product format (e.g. "coloring book adults", "activity book seniors", "for stress relief", "mindfulness printable", "pattern seamless")
- RESULT: ROOT + MODIFIER = specific, searchable, unsaturated niche (e.g. "Urban Foraging Activity Book", "Stave Church Architecture Coloring Book", "Axolotl Mindfulness Coloring Adults")
- The Google Trends URL should use "Compare" mode with 3 related variants so we can see which sub-niche has the strongest rising curve.
- Bonus: prefer niches with strong seasonal patterns (pico predecible) — flag it in the reasoning.
` : ""}Self-check before answering — reject your first idea if:
1. The niche is broader than 2-3 specific words
2. A generic creator would think of it in under 5 seconds
3. It would appear in "top 10 Etsy niches" listicles
4. It resembles anything in the BANNED list

${platform === "amazon" ? "For Amazon: use URL format " + urlFormat : platform === "trends" ? "For Google Trends: use URL format " + urlFormat + " — ideally compare 3 variants: ROOT+modifier1, ROOT+modifier2, ROOT+modifier3 (comma-separated in the q= parameter)" : "For Etsy: use URL format " + urlFormat} (properly URL-encoded, replace spaces with +)
Search term: 2-5 words, exactly what a buyer or researcher would type.${styleHint}

Return ONLY a JSON object:
{
  "niche": "Niche name (3-6 words, specific and memorable — not generic)",
  "productType": "${productType || "coloring-book|printable-poster|seamless-pattern — pick the most natural fit"}",
  "style": "suggested style category",
  "url": "complete ready-to-use search URL",
  "searchTerm": "the exact search term used",
  "competition": "baja|media|alta",
  "reasoning": "2-3 sentences in Spanish: WHO specifically buys this, WHAT makes it unsaturated right now, and WHY it fits the creative angle"
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
            platform?: "etsy" | "amazon" | "general" | "trends";
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
            trends: "Google Trends (find rising search interest for KDP/Etsy product ideas)",
        };

        const promptText = `You are an expert at finding profitable niches on ${platformDescriptions[platform] ?? "Etsy"}.
The user has this idea: "${idea.trim()}"

Generate the BEST search URL for ${platform === "etsy" ? "Etsy" : platform === "amazon" ? "Amazon" : platform === "trends" ? "Google Trends" : "the web"} to research this idea as a passive-income product niche.

Rules:
- For Etsy: use https://www.etsy.com/search?q=<search+term> (URL-encode the query)
- For Amazon: use https://www.amazon.com/s?k=<search+term> (URL-encode the query)
- For Google Trends: use https://trends.google.com/trends/explore?q=<search+term>&geo=US (URL-encode, replace spaces with +)
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

    // GET /ai/leonardo-balance — fetch token balance from Leonardo API
    app.get("/ai/leonardo-balance", async (_req, reply) => {
        try {
            const apiKey = (process.env.LEONARDO_API_KEY || "").trim()
                || ((await Settings.findOne({ key: "LEONARDO_API_KEY" }).lean()) as any)?.value?.trim()
                || "";
            if (!apiKey) return reply.status(400).send({ error: "LEONARDO_API_KEY no configurada" });

            const res = await fetch("https://cloud.leonardo.ai/api/rest/v1/me", {
                headers: { accept: "application/json", authorization: `Bearer ${apiKey}` },
                signal: AbortSignal.timeout(15_000),
            });
            if (!res.ok) return reply.status(res.status).send({ error: `Leonardo API error ${res.status}` });

            const data = await res.json() as any;
            const detail = data?.user_details?.[0] ?? {};
            const tokens = (detail.subscriptionTokens ?? 0) + (detail.apiSubscriptionTokens ?? 0) + (detail.paidTokens ?? 0);
            const renewal = detail.tokenRenewalDate
                ? new Date(detail.tokenRenewalDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
                : "";
            return reply.send({ tokens, renewal, raw: detail });
        } catch (e: any) {
            return reply.status(500).send({ error: e?.message ?? "Error" });
        }
    });
}
