/**
 * Text-to-speech via HuggingFace MMS-TTS (Spanish).
 * Requiere HUGGINGFACE_API_KEY. Devuelve buffer de audio (flac).
 */
export async function synthesizeSpeech(text: string): Promise<Buffer | null> {
    try {
        const hfKey = (process.env.HUGGINGFACE_API_KEY ?? "").trim();
        if (!hfKey) return null;

        const res = await fetch(
            "https://router.huggingface.co/hf-inference/models/facebook/mms-tts-spa",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${hfKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ inputs: text }),
                signal: AbortSignal.timeout(15_000),
            }
        );
        const ct = res.headers.get("content-type") ?? "";
        if (!res.ok || !ct.includes("audio")) {
            console.warn(`[tts] HuggingFace TTS failed: ${res.status} ${ct}`);
            return null;
        }
        return Buffer.from(await res.arrayBuffer());
    } catch (e: any) {
        console.warn(`[tts] Error: ${e?.message}`);
        return null;
    }
}
