// Returns { buffer, mimeType } trying StreamElements → Google Translate as fallback.
export async function synthesizeSpeech(text: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const stripped = text.replace(/[^\p{L}\p{N}\s.,;:!?'"()\-]/gu, " ").replace(/\s+/g, " ").trim();
    const clean = stripped.length <= 200 ? stripped : stripped.slice(0, 200).replace(/\s\S*$/, "").trim();
    if (!clean) return null;

    // Strategy 1: StreamElements TTS (free, no key, Google Lucia voice)
    try {
        const url = `https://api.streamelements.com/kappa/v2/speech?voice=Lucia&text=${encodeURIComponent(clean)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (res.ok) {
            const ct = res.headers.get("content-type") ?? "";
            if (ct.startsWith("audio/")) {
                const buffer = Buffer.from(await res.arrayBuffer());
                if (buffer.length > 1000) return { buffer, mimeType: "audio/mpeg" };
            }
        }
        console.warn(`[tts] StreamElements failed: ${res.status}`);
    } catch (e: any) {
        console.warn(`[tts] StreamElements error: ${e?.message}`);
    }

    // Strategy 2: Google Translate TTS (unofficial fallback)
    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(clean)}&tl=es&client=tw-ob`;
        const res = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; TTS-proxy/1.0)" },
            signal: AbortSignal.timeout(8_000),
        });
        if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            if (buffer.length > 1000) return { buffer, mimeType: "audio/mpeg" };
        }
        console.warn(`[tts] Google TTS failed: ${res.status}`);
    } catch (e: any) {
        console.warn(`[tts] Google TTS error: ${e?.message}`);
    }

    return null;
}
