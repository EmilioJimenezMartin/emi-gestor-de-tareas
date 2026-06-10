import { pollinationsFetch } from "./pollinations-circuit.js";
import { getApiKey } from "./keys.js";
import { Settings } from "../models/settings.js";

export interface AutopilotImageModel { id: string; name: string; provider: string; modelId: string; }

/** Lee el modelo de imagen configurado en Settings; si no existe usa SiliconFlow como default. */
export async function getAutopilotImageModel(): Promise<AutopilotImageModel> {
    try {
        const row = await Settings.findOne({ key: "AUTOPILOT_IMAGE_MODEL" }).lean();
        if ((row as any)?.value) {
            const parsed = JSON.parse((row as any).value as string);
            if (parsed?.provider && parsed?.modelId !== undefined) return parsed as AutopilotImageModel;
        }
    } catch { /* fallback */ }
    return { id: "sf-flux-schnell", name: "FLUX.1-schnell (SiliconFlow)", provider: "SiliconFlow", modelId: "black-forest-labs/FLUX.1-schnell" };
}

let _cachedHfKey = process.env.HUGGINGFACE_API_KEY ?? "";
let _cachedGoogleKey = process.env.GOOGLE_API_KEY ?? "";
let _cachedFalKey = process.env.FALAI_API_KEY ?? "";
let _cachedSegmindKey = process.env.SEGMIND_API_KEY ?? "";
let _cachedLeonardoKey = process.env.LEONARDO_API_KEY ?? "";
let _cachedSiliconflowKey = process.env.SILICONFLOW_API_KEY ?? "";
let _cachedTensorartApiKey = process.env.TENSORART_API_KEY ?? "";
let _cachedTensorartAppId = process.env.TENSORART_APP_ID ?? "";
let _cachedTensorartPrivateKey = process.env.TENSORART_PRIVATE_KEY ?? "";

export function setImageHfKey(key: string) { if (key) _cachedHfKey = key; }
export function setImageGoogleKey(key: string) { if (key) _cachedGoogleKey = key; }
export function setImageFalKey(key: string) { if (key) _cachedFalKey = key; }
export function setImageSegmindKey(key: string) { if (key) _cachedSegmindKey = key; }
export function setImageLeonardoKey(key: string) { if (key) _cachedLeonardoKey = key; }
export function setSiliconflowKey(val: string) { if (val) _cachedSiliconflowKey = val; }
export function getSiliconflowKey(): string { return _cachedSiliconflowKey; }
export function setTensorartApiKey(val: string) { if (val) _cachedTensorartApiKey = val; }
export function setTensorartAppId(val: string) { if (val) _cachedTensorartAppId = val; }
export function setTensorartPrivateKey(val: string) { if (val) _cachedTensorartPrivateKey = val; }
export function getImageHfKey(): string { return _cachedHfKey; }
export function getImageFalKey(): string { return _cachedFalKey; }
export function getImageLeonardoKey(): string { return _cachedLeonardoKey; }
export function getTensorartApiKey(): string { return _cachedTensorartApiKey; }
export function getTensorartAppId(): string { return _cachedTensorartAppId; }
export function getTensorartPrivateKey(): string { return _cachedTensorartPrivateKey; }

export interface GenerateImageOpts {
    width?: number;
    height?: number;
    model?: string;
    enhance?: boolean;
    signal?: AbortSignal;
    seed?: number;
    hfModelId?: string;
}

/**
 * Cadena de fallback para jobs automáticos (autopilot, catalog).
 * Prueba: Pollinations → Segmind → HuggingFace → null
 */
export async function generateImage(prompt: string, opts: GenerateImageOpts = {}): Promise<Buffer | null> {
    const { width = 1024, height = 1024, model = "flux", enhance = false } = opts;
    const seed = opts.seed ?? Math.floor(Math.random() * 999999);
    const hfModelId = opts.hfModelId ?? "black-forest-labs/FLUX.1-schnell";

    // ── Pollinations ──────────────────────────────────────────────────────────
    const pollinationsUrl =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
        `?width=${width}&height=${height}&seed=${seed}&model=${encodeURIComponent(model)}&enhance=${enhance}&nologo=true`;
    try {
        const res = await pollinationsFetch(pollinationsUrl, {
            signal: opts.signal ?? AbortSignal.timeout(60_000),
        });
        const ct = res.headers.get("content-type") ?? "";
        if (res.ok && ct.startsWith("image/")) {
            console.log(`[image-gen] Pollinations OK (${model})`);
            return Buffer.from(await res.arrayBuffer());
        }
        await res.body?.cancel();
        console.warn(`[image-gen] Pollinations ${res.status}`);
    } catch (e: any) {
        if (e?.name === "AbortError") return null;
        console.warn(`[image-gen] Pollinations error: ${e.message}`);
    }

    // ── Cloudflare Workers AI (gratis ~10k neurons/día) ──────────────────────
    try {
        const cfToken = process.env.CF_API_TOKEN || String((await Settings.findOne({ key: "CF_API_TOKEN" }).lean() as any)?.value ?? "");
        const cfAccount = process.env.CF_ACCOUNT_ID || String((await Settings.findOne({ key: "CF_ACCOUNT_ID" }).lean() as any)?.value ?? "");
        if (cfToken && cfAccount) {
            console.log("[image-gen] Intentando Cloudflare flux-1-schnell...");
            const cfRes = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
                {
                    method: "POST",
                    headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 8 }),
                    signal: opts.signal ?? AbortSignal.timeout(60_000),
                }
            );
            if (cfRes.ok) {
                const data = await cfRes.json() as any;
                const b64 = data?.result?.image;
                if (b64) {
                    console.log("[image-gen] Cloudflare OK");
                    return Buffer.from(b64, "base64");
                }
            } else {
                await cfRes.body?.cancel();
                console.warn(`[image-gen] Cloudflare ${cfRes.status}`);
            }
        }
    } catch (e: any) {
        if (e?.name === "AbortError") return null;
        console.warn(`[image-gen] Cloudflare error: ${e.message}`);
    }

    // ── SiliconFlow (FLUX.1-schnell gratis) ───────────────────────────────────
    try {
        const sfKey = _cachedSiliconflowKey || await getApiKey("SILICONFLOW_API_KEY");
        if (sfKey && sfKey !== _cachedSiliconflowKey) _cachedSiliconflowKey = sfKey;
        if (sfKey) {
            console.log("[image-gen] Intentando SiliconFlow FLUX.1-schnell...");
            const sfRes = await fetch("https://api.siliconflow.com/v1/images/generations", {
                method: "POST",
                headers: { Authorization: `Bearer ${sfKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "black-forest-labs/FLUX.1-schnell", prompt, image_size: `${width}x${height}`, seed }),
                signal: opts.signal ?? AbortSignal.timeout(60_000),
            });
            if (sfRes.ok) {
                const data = await sfRes.json() as any;
                const imgUrl = data?.images?.[0]?.url;
                if (imgUrl) {
                    const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(30_000) });
                    if (imgRes.ok) {
                        console.log("[image-gen] SiliconFlow OK");
                        return Buffer.from(await imgRes.arrayBuffer());
                    }
                }
            } else {
                await sfRes.body?.cancel();
                console.warn(`[image-gen] SiliconFlow ${sfRes.status}`);
            }
        }
    } catch (e: any) {
        if (e?.name === "AbortError") return null;
        console.warn(`[image-gen] SiliconFlow error: ${e.message}`);
    }

    // ── Segmind ───────────────────────────────────────────────────────────────
    const segmindKey = _cachedSegmindKey || await getApiKey("SEGMIND_API_KEY");
    if (segmindKey && segmindKey !== _cachedSegmindKey) _cachedSegmindKey = segmindKey;
    if (segmindKey) {
        console.log("[image-gen] Intentando Segmind FLUX.1-schnell...");
        try {
            const segRes = await fetch("https://api.segmind.com/v1/flux-schnell", {
                method: "POST",
                headers: { "x-api-key": segmindKey, "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, width, height, steps: 4, seed, samples: 1 }),
                signal: AbortSignal.timeout(60_000),
            });
            const ct = segRes.headers.get("content-type") ?? "";
            if (segRes.ok && ct.startsWith("image/")) {
                console.log("[image-gen] Segmind OK");
                return Buffer.from(await segRes.arrayBuffer());
            }
            const err = await segRes.text().catch(() => "");
            console.warn(`[image-gen] Segmind ${segRes.status}: ${err.slice(0, 100)}`);
        } catch (e: any) {
            if (e?.name === "AbortError") return null;
            console.warn(`[image-gen] Segmind error: ${e.message}`);
        }
    }

    // ── HuggingFace ───────────────────────────────────────────────────────────
    const hfKey = _cachedHfKey || await getApiKey("HUGGINGFACE_API_KEY");
    if (hfKey && hfKey !== _cachedHfKey) _cachedHfKey = hfKey;
    if (!hfKey) {
        console.warn("[image-gen] No HUGGINGFACE_API_KEY — todos los proveedores fallaron");
        return null;
    }
    const hfEndpoint = `https://router.huggingface.co/hf-inference/models/${hfModelId}`;
    const modelName = hfModelId.split("/").pop() ?? hfModelId;
    console.log(`[image-gen] Intentando HuggingFace ${modelName}...`);
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const hfRes = await fetch(hfEndpoint, {
                method: "POST",
                headers: { Authorization: `Bearer ${hfKey}`, "Content-Type": "application/json", "x-use-cache": "false" },
                body: JSON.stringify({ inputs: prompt }),
                signal: AbortSignal.timeout(90_000),
            });
            const ct = hfRes.headers.get("content-type") ?? "";
            if (hfRes.ok && ct.includes("image/")) {
                console.log(`[image-gen] HF ${modelName} OK`);
                return Buffer.from(await hfRes.arrayBuffer());
            }
            await hfRes.body?.cancel();
            console.warn(`[image-gen] HF ${modelName} → ${hfRes.status}`);
            if (hfRes.status === 503 && attempt === 1) {
                await new Promise(r => setTimeout(r, 8_000));
                continue;
            }
            break;
        } catch (e: any) {
            if (e?.name === "AbortError") return null;
            console.warn(`[image-gen] HF ${modelName} error: ${e.message}`);
            break;
        }
    }

    console.warn("[image-gen] All providers failed");
    return null;
}
