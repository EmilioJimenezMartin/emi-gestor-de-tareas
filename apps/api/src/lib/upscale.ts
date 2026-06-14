import { Settings } from "../models/settings.js";

async function getHFKey(): Promise<string> {
    let key = process.env.HUGGINGFACE_API_KEY ?? "";
    if (!key) {
        try {
            const row = await Settings.findOne({ key: "HUGGINGFACE_API_KEY" });
            if (row?.value) key = row.value;
        } catch { /* ignore */ }
    }
    return key;
}

/**
 * Upscales an image buffer using HuggingFace Real-ESRGAN (4x).
 * Returns the upscaled buffer, or null if the API is unavailable/fails.
 */
export async function upscaleWithHF(imageBuffer: Buffer): Promise<Buffer | null> {
    const token = await getHFKey();
    if (!token) {
        console.warn("[upscale] No HuggingFace API key — skipping Real-ESRGAN");
        return null;
    }

    const MODEL = "ai-forever/Real-ESRGAN";
    const url = `https://api-inference.huggingface.co/models/${MODEL}`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "image/png",
                "Accept": "image/png",
            },
            body: imageBuffer,
            signal: AbortSignal.timeout(90_000),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            // 503 = model loading (cold start) — not an error worth retrying here
            console.warn(`[upscale] HF Real-ESRGAN ${res.status}: ${text.slice(0, 200)}`);
            return null;
        }

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 10_000) {
            console.warn("[upscale] HF returned suspiciously small buffer — ignoring");
            return null;
        }

        return buf;
    } catch (e: any) {
        console.warn(`[upscale] HF Real-ESRGAN failed: ${e.message}`);
        return null;
    }
}
