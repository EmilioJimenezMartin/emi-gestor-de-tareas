// Shared AI model & dimension constants — used by KDP Factory, Seamless Pattern Engine, etc.

export interface AIModel {
    id: string;
    name: string;
    provider: string;
    type: string;
    modelId: string;
    status: "ok" | "limited" | "paid" | "blocked";
}

export interface AIDimension {
    id: string;
    name: string;
    ratio: string;
    width: number;
    height: number;
}

export const STATUS_COLOR: Record<AIModel["status"], string> = {
    ok:      "emerald",
    limited: "amber",
    paid:    "orange",
    blocked: "red",
};

export const AI_MODELS: AIModel[] = [
    { id: "flux-schnell", name: "FLUX.1 [schnell]", provider: "Hugging Face", type: "Ultra High Quality", modelId: "black-forest-labs/FLUX.1-schnell", status: "blocked" },
    { id: "flux-dev", name: "FLUX.1 [dev]", provider: "Hugging Face", type: "Higher fidelity", modelId: "black-forest-labs/FLUX.1-dev", status: "blocked" },
    { id: "sd-3.5", name: "Stable Diffusion 3.5", provider: "Hugging Face", type: "Versatile", modelId: "stabilityai/stable-diffusion-3.5-large-turbo", status: "blocked" },
    { id: "openjourney-v4", name: "OpenJourney v4", provider: "Hugging Face", type: "Artistic/MJ Style", modelId: "prompthero/openjourney", status: "blocked" },
    { id: "google-gemini-2-5", name: "Google Gemini 2.5 Flash Image", provider: "Google", type: "Fast image gen", modelId: "gemini-2.5-flash-image", status: "paid" },
    // Leonardo AI — 150 tokens/día gratis · todos estos modelos son hosted (no premium)
    { id: "leo-phoenix",      name: "Phoenix 1.0 ✦ (Leonardo)",    provider: "Leonardo", type: "150 tok/día · Flagship · Fantasy · Retratos · Mejor calidad", modelId: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3", status: "limited" },
    { id: "leo-kino-xl",      name: "KINO XL ✦ (Leonardo)",        provider: "Leonardo", type: "150 tok/día · Cinematográfico · Escenas épicas · Alta fidelidad", modelId: "aa77f04e-3eec-4034-9c07-d0f619684628", status: "limited" },
    { id: "leo-albedo-xl",    name: "AlbedoBase XL (Leonardo)",    provider: "Leonardo", type: "150 tok/día · CG · Fantasy · Concept art",  modelId: "2067ae52-33fd-4a82-bb92-c2c55e7d2786", status: "limited" },
    { id: "leo-diffusion-xl", name: "Leonardo Diffusion XL",       provider: "Leonardo", type: "150 tok/día · Versátil · Ilustración",      modelId: "1e60896f-3c26-4296-8ecc-53e2afecc132", status: "limited" },
    { id: "leo-lucid-origin", name: "Lucid Origin (Leonardo)",     provider: "Leonardo", type: "150 tok/día · Generalista · Ilimitado relajado", modelId: "7b592283-e8a7-4c5a-9ba6-d18c31f258b9", status: "limited" },
    { id: "leo-lucid-real",   name: "Lucid Realism (Leonardo)",    provider: "Leonardo", type: "150 tok/día · Hiperrealista · Ilimitado relajado", modelId: "05ce0082-2d80-4a2d-8653-4d1c85e2418e", status: "limited" },
    { id: "leo-anime-xl",     name: "Leonardo Anime XL",           provider: "Leonardo", type: "150 tok/día · Anime · Ilustración 2D",      modelId: "e71a1c2f-4f80-4800-934f-2c68979d8cc8", status: "limited" },
    { id: "sdxl-base", name: "Stable Diffusion XL Base 1.0", provider: "Hugging Face", type: "General (OSS weights)", modelId: "stabilityai/stable-diffusion-xl-base-1.0", status: "blocked" },
    { id: "sdxl-turbo", name: "SDXL Turbo", provider: "Hugging Face", type: "Fast (OSS weights)", modelId: "stabilityai/sdxl-turbo", status: "blocked" },
    { id: "sd-1.5", name: "Stable Diffusion 1.5", provider: "Hugging Face", type: "Classic (OSS weights)", modelId: "runwayml/stable-diffusion-v1-5", status: "blocked" },
    { id: "kandinsky-2.2", name: "Kandinsky 2.2", provider: "Hugging Face", type: "Creative", modelId: "ai-forever/Kandinsky-2.2", status: "blocked" },
    { id: "coloringbook-redmond", name: "ColoringBook.Redmond (LoRA)", provider: "Hugging Face", type: "Coloring Book (clean lines)", modelId: "artificialguybr/ColoringBookRedmond", status: "blocked" },
    { id: "coloringbook-redmond-v2", name: "ColoringBook.Redmond V2 (LoRA)", provider: "Hugging Face", type: "Coloring Book (clean lines)", modelId: "artificialguybr/ColoringBookRedmond-V2", status: "blocked" },
    // Pollinations — gateway nuevo gen.pollinations.ai con API key (proxy backend)
    { id: "pollinations-flux", name: "FLUX (Pollinations)", provider: "Pollinations", type: "Gratis · API Key propia", modelId: "flux", status: "ok" },
    { id: "pollinations-flux-realism", name: "FLUX Realism (Pollinations)", provider: "Pollinations", type: "Gratis · Fotorrealista", modelId: "flux-realism", status: "ok" },
    { id: "pollinations-flux-anime", name: "FLUX Anime (Pollinations)", provider: "Pollinations", type: "Gratis · Anime/Ilustración", modelId: "flux-anime", status: "ok" },
    { id: "pollinations-turbo", name: "Turbo (Pollinations)", provider: "Pollinations", type: "Gratis · Ultra Rápido", modelId: "turbo", status: "ok" },
    // fal.ai
    { id: "falai-flux-schnell", name: "FLUX Schnell (fal.ai)", provider: "fal.ai", type: "Rápido · $0.003/img", modelId: "fal-ai/flux/schnell", status: "blocked" },
    { id: "falai-flux-dev", name: "FLUX Dev (fal.ai)", provider: "fal.ai", type: "Alta calidad · fal.ai", modelId: "fal-ai/flux/dev", status: "blocked" },
    { id: "falai-flux-lora-coloring", name: "FLUX LoRA Coloring (fal.ai)", provider: "fal.ai", type: "Línea art · Coloring Book", modelId: "fal-ai/flux/dev/lora", status: "blocked" },
    // Segmind
    { id: "segmind-flux-schnell", name: "FLUX Schnell (Segmind)", provider: "Segmind", type: "100 gratis/día · Rápido", modelId: "flux-schnell", status: "blocked" },
    { id: "segmind-sdxl", name: "SDXL 1.0 (Segmind)", provider: "Segmind", type: "100 gratis/día · General", modelId: "sdxl1.0", status: "blocked" },
    { id: "segmind-canny", name: "SDXL Canny (Segmind)", provider: "Segmind", type: "100 gratis/día · Línea art", modelId: "canny-sdxl", status: "blocked" },
    // Cloudflare Workers AI — 10k neurons/día gratis, sin bloqueos geo
    { id: "cf-flux-schnell", name: "⭐ FLUX Schnell (Cloudflare)", provider: "Cloudflare", type: "Gratis · ~33img/día · FLUX · ~5s", modelId: "@cf/black-forest-labs/flux-1-schnell", status: "ok" },
    { id: "cf-sdxl-lightning", name: "SDXL Lightning (Cloudflare)", provider: "Cloudflare", type: "Gratis · Ultrarrápido · Alta calidad", modelId: "@cf/bytedance/stable-diffusion-xl-lightning", status: "ok" },
    { id: "cf-sdxl", name: "SDXL Base (Cloudflare)", provider: "Cloudflare", type: "Gratis · Detallado · SDXL 1.0", modelId: "@cf/stabilityai/stable-diffusion-xl-base-1.0", status: "ok" },
    { id: "cf-dreamshaper", name: "DreamShaper LCM (Cloudflare)", provider: "Cloudflare", type: "Gratis · Artístico · Estilos creativos", modelId: "@cf/lykon/dreamshaper-8-lcm", status: "ok" },
    // Together AI — $5 gratis sin tarjeta, FLUX schnell
    { id: "together-flux-schnell", name: "FLUX Schnell (Together AI)", provider: "Together AI", type: "$5 gratis · Sin bloqueo geo · ~5-10s", modelId: "black-forest-labs/FLUX.1-schnell-Free", status: "blocked" },
    // Tensor.art — 100 créditos/día gratis · renovación diaria · sin tarjeta
    // modelId format: "checkpointId" OR "checkpointId:loraId:weight"
    { id: "ta-sdxl-base",         name: "SDXL 1.0 Base (Tensor.art)",         provider: "Tensor.art", type: "100 créd/día · Base SDXL · General",             modelId: "619225630271212879", status: "blocked" },
    { id: "ta-coloringbook-v2",   name: "ColoringBook Redmond XL (Tensor.art)", provider: "Tensor.art", type: "100 créd/día · LoRA Coloring Book · Línea limpia", modelId: "619225630271212879:656285193671448586:0.85", status: "blocked" },
    { id: "ta-coloringbook-dom",  name: "Coloring Book Dominator (Tensor.art)", provider: "Tensor.art", type: "100 créd/día · LoRA Dominante · Línea gruesa",    modelId: "619225630271212879:647832655083339586:0.85", status: "blocked" },
    { id: "ta-extra-realistic",   name: "Extra Realistic XL (Tensor.art)",     provider: "Tensor.art", type: "100 créd/día · Fotorrealista · Fantasia",           modelId: "879130987013876797", status: "blocked" },
    { id: "ta-thinkdiffusion",    name: "ThinkDiffusion XL (Tensor.art)",      provider: "Tensor.art", type: "100 créd/día · Alta calidad · Versatil",            modelId: "651192230041814458", status: "blocked" },
    { id: "ta-autismmix-light",   name: "AutismMix SDXL Lightning (Tensor.art)", provider: "Tensor.art", type: "100 créd/día · Anime · Ultra rápido (4 steps)",  modelId: "705519017965662383", status: "blocked" },
    { id: "ta-sdxl-flash",        name: "SDXL Flash Mini (Tensor.art)",        provider: "Tensor.art", type: "100 créd/día · Ultrarrápido · Ligero",              modelId: "738164703605494864", status: "blocked" },
    // SiliconFlow — FLUX.1-schnell gratis y confirmado ✅
    { id: "sf-flux-schnell",  name: "⭐ FLUX.1-schnell (SiliconFlow)", provider: "SiliconFlow", type: "Gratis · Sin límite diario · FLUX · Rápido",     modelId: "black-forest-labs/FLUX.1-schnell", status: "ok" },
    { id: "sf-flux-dev",      name: "FLUX.1-dev (SiliconFlow)",        provider: "SiliconFlow", type: "Pago · Alta calidad · FLUX · ~$0.014/img",      modelId: "black-forest-labs/FLUX.1-dev", status: "paid" },
    { id: "sf-sdxl",          name: "SDXL Base 1.0 (SiliconFlow)",     provider: "SiliconFlow", type: "Pago · Versátil · $0.002/img",                  modelId: "stabilityai/stable-diffusion-xl-base-1.0", status: "paid" },
    // Dezgo — gratis sin API key, SD/SDXL
    { id: "dezgo-sdxl",        name: "SDXL 1.0 (Dezgo)",          provider: "Dezgo", type: "Gratis · Sin key · SDXL · ~10s",         modelId: "sdxl", status: "blocked" },
    { id: "dezgo-dreamshaper", name: "DreamShaper 8 (Dezgo)",      provider: "Dezgo", type: "Gratis · Sin key · Artístico · SD 1.5",  modelId: "dreamshaper_8", status: "blocked" },
    { id: "dezgo-realistic",   name: "Realistic Vision (Dezgo)",   provider: "Dezgo", type: "Gratis · Sin key · Fotorrealista · SD 1.5", modelId: "epicrealism_naturalSin_rc1vae", status: "blocked" },
    // Stable Horde — totalmente gratis, comunidad voluntaria
    { id: "stable-horde-sdxl", name: "SDXL 1.0 (Stable Horde)", provider: "Stable Horde", type: "Gratis · Sin API Key · ~1-3min", modelId: "SDXL 1.0", status: "limited" },
    { id: "stable-horde-sd15", name: "SD 1.5 (Stable Horde)", provider: "Stable Horde", type: "Gratis · Sin API Key · Rápido", modelId: "stable_diffusion", status: "limited" },
    { id: "stable-horde-dreamshaper", name: "DreamShaper 8 (Stable Horde)", provider: "Stable Horde", type: "Gratis · Sin API Key · Artístico", modelId: "dreamshaper_8", status: "limited" },
    { id: "stable-horde-albedo", name: "AlbedoBase XL (Stable Horde)", provider: "Stable Horde", type: "Gratis · Sin API Key · SDXL", modelId: "AlbedoBase XL (SDXL)", status: "limited" },
];

export const AI_DIMENSIONS: AIDimension[] = [
    { id: "sq", name: "Square", ratio: "1:1", width: 1024, height: 1024 },
    { id: "pt", name: "Portrait", ratio: "4:5", width: 896, height: 1152 },
    { id: "p23", name: "Portrait", ratio: "2:3", width: 832, height: 1248 },
    { id: "p34", name: "Portrait", ratio: "3:4", width: 864, height: 1152 },
    { id: "v", name: "Vertical", ratio: "9:16", width: 832, height: 1472 },
    { id: "ls", name: "Landscape", ratio: "16:9", width: 1152, height: 648 },
    { id: "a4-150", name: "A4 (150 DPI)", ratio: "A4", width: 1240, height: 1754 },
    { id: "a4-200", name: "A4 (200 DPI)", ratio: "A4", width: 1654, height: 2339 },
    { id: "a4-300", name: "A4 (300 DPI)", ratio: "A4", width: 2480, height: 3508 },
];

/** Groups models by provider for display in selectors */
export function groupModelsByProvider(models: AIModel[]): Record<string, AIModel[]> {
    return models.reduce<Record<string, AIModel[]>>((acc, m) => {
        (acc[m.provider] ??= []).push(m);
        return acc;
    }, {});
}

/**
 * Generates an image via the local API proxy.
 * Handles both binary (image/png) and JSON ({ url }) responses transparently.
 * Returns a blob object URL usable as <img src>.
 */
export async function generateImageBlobUrl(
    apiBase: string,
    params: {
        prompt: string;
        modelId: string;
        provider: string;
        width?: number;
        height?: number;
        negativePrompt?: string;
        seed?: number;
        retryCount?: number;
        onRetry?: (wait: number, attempt: number) => void;
    }
): Promise<string> {
    const { prompt, modelId, provider, width = 1024, height = 1024, negativePrompt, seed, retryCount = 0, onRetry } = params;

    const res = await fetch(`${apiBase}/ai/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt,
            modelId,
            provider,
            width,
            height,
            advancedParams: {
                negativePrompt: negativePrompt?.trim() || undefined,
                seed,
            },
        }),
    });

    if (res.status === 429 && retryCount < 2) {
        const retryAfter = Math.max(3, Number(res.headers.get("Retry-After") || "15"));
        onRetry?.(retryAfter, retryCount + 1);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return generateImageBlobUrl(apiBase, { ...params, retryCount: retryCount + 1 });
    }

    if (!res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("json")) {
            const err = await res.json();
            throw new Error(err?.error ?? err?.details ?? `Error ${res.status}`);
        }
        throw new Error(`Error generando imagen (${res.status})`);
    }

    // API may return binary image (Pollinations) or JSON { url } (Cloudinary/etc.)
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}
