/**
 * Speech-to-text via HuggingFace Whisper (large-v3-turbo).
 * Requiere HUGGINGFACE_API_KEY.
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType = "audio/ogg"): Promise<string | null> {
    try {
        const hfKey = (process.env.HUGGINGFACE_API_KEY ?? "").trim();
        if (!hfKey) {
            console.warn("[whisper] HUGGINGFACE_API_KEY not set");
            return null;
        }
        const res = await fetch(
            "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${hfKey}`,
                    "Content-Type": mimeType,
                },
                body: audioBuffer,
                signal: AbortSignal.timeout(40_000),
            }
        );
        if (!res.ok) {
            console.warn(`[whisper] API error ${res.status}`);
            return null;
        }
        const data = await res.json() as any;
        return (data.text as string | undefined)?.trim() || null;
    } catch (e: any) {
        console.warn(`[whisper] Error: ${e?.message}`);
        return null;
    }
}
