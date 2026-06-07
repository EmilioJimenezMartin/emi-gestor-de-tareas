import { getApiKey } from "./keys.js";

/**
 * Speech-to-text via HuggingFace Whisper (large-v3-turbo).
 * Requiere HUGGINGFACE_API_KEY (env o MongoDB Settings).
 */
async function transcribeWithWhisper(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
    try {
        const hfKey = (await getApiKey("HUGGINGFACE_API_KEY")).trim();
        if (!hfKey) return null;
        const res = await fetch(
            "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo",
            {
                method: "POST",
                headers: { Authorization: `Bearer ${hfKey}`, "Content-Type": mimeType },
                body: audioBuffer,
                signal: AbortSignal.timeout(40_000),
            }
        );
        if (!res.ok) { console.warn(`[whisper] HF error ${res.status}`); return null; }
        const data = await res.json() as any;
        return (data.text as string | undefined)?.trim() || null;
    } catch (e: any) {
        console.warn(`[whisper] HF error: ${e?.message}`);
        return null;
    }
}

/**
 * Speech-to-text via Google Gemini (gemini-2.0-flash).
 * Requiere GOOGLE_API_KEY (env o MongoDB Settings).
 */
async function transcribeWithGemini(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
    try {
        const googleKey = (await getApiKey("GOOGLE_API_KEY")).trim();
        if (!googleKey) { console.warn("[whisper] GOOGLE_API_KEY not set"); return null; }
        const b64 = audioBuffer.toString("base64");
        // gemini-1.5-flash has solid audio support; 2.0-flash-exp as alternative
        const model = "gemini-1.5-flash";
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: "audio/ogg", data: b64 } },
                            { text: "Transcribe exactly what is said in this audio. Return only the transcribed text, nothing else." },
                        ],
                    }],
                }),
                signal: AbortSignal.timeout(40_000),
            }
        );
        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            console.warn(`[whisper] Gemini ${res.status}: ${errBody.slice(0, 300)}`);
            return null;
        }
        const data = await res.json() as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
        return text?.trim() || null;
    } catch (e: any) {
        console.warn(`[whisper] Gemini error: ${e?.message}`);
        return null;
    }
}

/**
 * Speech-to-text via Groq Whisper (whisper-large-v3-turbo).
 * Requiere GROQ_API_KEY. Usa multipart/form-data igual que OpenAI.
 */
async function transcribeWithGroq(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
    try {
        const groqKey = (await getApiKey("GROQ_API_KEY")).trim();
        if (!groqKey) return null;
        const form = new FormData();
        const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : mimeType.includes("wav") ? "wav" : "ogg";
        form.append("file", new Blob([audioBuffer as unknown as Uint8Array<ArrayBuffer>], { type: mimeType }), `audio.${ext}`);
        form.append("model", "whisper-large-v3-turbo");
        form.append("response_format", "json");
        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${groqKey}` },
            body: form,
            signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            console.warn(`[whisper] Groq ${res.status}: ${errBody.slice(0, 200)}`);
            return null;
        }
        const data = await res.json() as any;
        return (data.text as string | undefined)?.trim() || null;
    } catch (e: any) {
        console.warn(`[whisper] Groq error: ${e?.message}`);
        return null;
    }
}

/**
 * Transcribe audio to text.
 * Cascade: HuggingFace Whisper → Groq Whisper → Google Gemini
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType = "audio/ogg"): Promise<string | null> {
    const safeMime = mimeType.startsWith("audio/") ? mimeType : "audio/ogg";

    const hfResult = await transcribeWithWhisper(audioBuffer, safeMime);
    if (hfResult) return hfResult;

    console.log("[whisper] HF falló — intentando Groq…");
    const groqResult = await transcribeWithGroq(audioBuffer, safeMime);
    if (groqResult) return groqResult;

    console.log("[whisper] Groq falló — intentando Google Gemini…");
    return transcribeWithGemini(audioBuffer, safeMime);
}
