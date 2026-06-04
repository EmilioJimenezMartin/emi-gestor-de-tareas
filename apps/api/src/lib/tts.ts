// Returns { buffer, mimeType } using Google Translate TTS (fast, no API key needed).
export async function synthesizeSpeech(text: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    try {
        const clean = text.replace(/[^\p{L}\p{N}\s.,;:!?'"()\-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 200);
        if (!clean) return null;
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(clean)}&tl=es&client=tw-ob`;
        const res = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; TTS-proxy/1.0)" },
            signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) {
            console.warn(`[tts] Google TTS failed: ${res.status}`);
            return null;
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        return { buffer, mimeType: "audio/mpeg" };
    } catch (e: any) {
        console.warn(`[tts] Error: ${e?.message}`);
        return null;
    }
}
