// Shared AI model & dimension constants — used by KDP Factory, Seamless Pattern Engine, etc.

export interface AIModel {
    id: string;
    name: string;
    provider: string;
    type: string;
    modelId: string;
}

export interface AIDimension {
    id: string;
    name: string;
    ratio: string;
    width: number;
    height: number;
}

export const AI_MODELS: AIModel[] = [
    { id: "flux-schnell", name: "FLUX.1 [schnell]", provider: "Hugging Face", type: "Ultra High Quality", modelId: "black-forest-labs/FLUX.1-schnell" },
    { id: "flux-dev", name: "FLUX.1 [dev]", provider: "Hugging Face", type: "Higher fidelity", modelId: "black-forest-labs/FLUX.1-dev" },
    { id: "sd-3.5", name: "Stable Diffusion 3.5", provider: "Hugging Face", type: "Versatile", modelId: "stabilityai/stable-diffusion-3.5-large-turbo" },
    { id: "openjourney-v4", name: "OpenJourney v4", provider: "Hugging Face", type: "Artistic/MJ Style", modelId: "prompthero/openjourney" },
    { id: "google-gemini-2-5", name: "Google Gemini 2.5 Flash Image", provider: "Google", type: "Fast image gen", modelId: "gemini-2.5-flash-image" },
    { id: "leonardo", name: "Leonardo (API)", provider: "Leonardo", type: "External API", modelId: "" },
    { id: "sdxl-base", name: "Stable Diffusion XL Base 1.0", provider: "Hugging Face", type: "General (OSS weights)", modelId: "stabilityai/stable-diffusion-xl-base-1.0" },
    { id: "sdxl-turbo", name: "SDXL Turbo", provider: "Hugging Face", type: "Fast (OSS weights)", modelId: "stabilityai/sdxl-turbo" },
    { id: "sd-1.5", name: "Stable Diffusion 1.5", provider: "Hugging Face", type: "Classic (OSS weights)", modelId: "runwayml/stable-diffusion-v1-5" },
    { id: "kandinsky-2.2", name: "Kandinsky 2.2", provider: "Hugging Face", type: "Creative", modelId: "ai-forever/Kandinsky-2.2" },
    { id: "coloringbook-redmond", name: "ColoringBook.Redmond (LoRA)", provider: "Hugging Face", type: "Coloring Book (clean lines)", modelId: "artificialguybr/ColoringBookRedmond" },
    { id: "coloringbook-redmond-v2", name: "ColoringBook.Redmond V2 (LoRA)", provider: "Hugging Face", type: "Coloring Book (clean lines)", modelId: "artificialguybr/ColoringBookRedmond-V2" },
    // Pollinations — gratis, sin API key
    { id: "pollinations-flux", name: "FLUX (Pollinations)", provider: "Pollinations", type: "Gratis · Sin API Key", modelId: "flux" },
    { id: "pollinations-flux-realism", name: "FLUX Realism (Pollinations)", provider: "Pollinations", type: "Gratis · Fotorrealista", modelId: "flux-realism" },
    { id: "pollinations-flux-anime", name: "FLUX Anime (Pollinations)", provider: "Pollinations", type: "Gratis · Anime/Ilustración", modelId: "flux-anime" },
    { id: "pollinations-turbo", name: "Turbo (Pollinations)", provider: "Pollinations", type: "Gratis · Ultra Rápido", modelId: "turbo" },
    // fal.ai
    { id: "falai-flux-schnell", name: "FLUX Schnell (fal.ai)", provider: "fal.ai", type: "Rápido · $0.003/img", modelId: "fal-ai/flux/schnell" },
    { id: "falai-flux-dev", name: "FLUX Dev (fal.ai)", provider: "fal.ai", type: "Alta calidad · fal.ai", modelId: "fal-ai/flux/dev" },
    { id: "falai-flux-lora-coloring", name: "FLUX LoRA Coloring (fal.ai)", provider: "fal.ai", type: "Línea art · Coloring Book", modelId: "fal-ai/flux/dev/lora" },
    // Segmind
    { id: "segmind-flux-schnell", name: "FLUX Schnell (Segmind)", provider: "Segmind", type: "100 gratis/día · Rápido", modelId: "flux-schnell" },
    { id: "segmind-sdxl", name: "SDXL 1.0 (Segmind)", provider: "Segmind", type: "100 gratis/día · General", modelId: "sdxl1.0" },
    { id: "segmind-canny", name: "SDXL Canny (Segmind)", provider: "Segmind", type: "100 gratis/día · Línea art", modelId: "canny-sdxl" },
    // Cloudflare Workers AI — 10k neurons/día gratis, sin bloqueos geo
    { id: "cf-flux-schnell", name: "FLUX Schnell (Cloudflare)", provider: "Cloudflare", type: "Gratis · ~33img/día · FLUX · ~5s", modelId: "@cf/black-forest-labs/flux-1-schnell" },
    { id: "cf-sdxl-lightning", name: "SDXL Lightning (Cloudflare)", provider: "Cloudflare", type: "Gratis · Ultrarrápido · Alta calidad", modelId: "@cf/bytedance/stable-diffusion-xl-lightning" },
    { id: "cf-sdxl", name: "SDXL Base (Cloudflare)", provider: "Cloudflare", type: "Gratis · Detallado · SDXL 1.0", modelId: "@cf/stabilityai/stable-diffusion-xl-base-1.0" },
    { id: "cf-dreamshaper", name: "DreamShaper LCM (Cloudflare)", provider: "Cloudflare", type: "Gratis · Artístico · Estilos creativos", modelId: "@cf/lykon/dreamshaper-8-lcm" },
    // Together AI — $5 gratis sin tarjeta, FLUX schnell
    { id: "together-flux-schnell", name: "FLUX Schnell (Together AI)", provider: "Together AI", type: "$5 gratis · Sin bloqueo geo · ~5-10s", modelId: "black-forest-labs/FLUX.1-schnell-Free" },
    // Stable Horde — totalmente gratis, comunidad voluntaria
    { id: "stable-horde-sdxl", name: "SDXL 1.0 (Stable Horde)", provider: "Stable Horde", type: "Gratis · Sin API Key · ~1-3min", modelId: "SDXL 1.0" },
    { id: "stable-horde-sd15", name: "SD 1.5 (Stable Horde)", provider: "Stable Horde", type: "Gratis · Sin API Key · Rápido", modelId: "stable_diffusion" },
    { id: "stable-horde-dreamshaper", name: "DreamShaper 8 (Stable Horde)", provider: "Stable Horde", type: "Gratis · Sin API Key · Artístico", modelId: "dreamshaper_8" },
    { id: "stable-horde-albedo", name: "AlbedoBase XL (Stable Horde)", provider: "Stable Horde", type: "Gratis · Sin API Key · SDXL", modelId: "AlbedoBase XL (SDXL)" },
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
