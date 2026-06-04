"use client";
import { useCallback, useRef } from "react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

function stripNonSpeech(text: string): string {
    return text.replace(/[^\p{L}\p{N}\s.,;:!?'"()\-]/gu, " ").replace(/\s+/g, " ").trim();
}

export function useSpeech(_lang = "es-ES") {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blobUrlRef = useRef<string | null>(null);

    const _cleanup = () => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };

    const speak = useCallback(async (text: string) => {
        if (typeof window === "undefined") return;
        if (localStorage.getItem("voice_enabled") === "false") return;
        const clean = stripNonSpeech(text);
        if (!clean) return;

        _cleanup();

        try {
            const res = await fetch(`${API_URL}/voice/tts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: clean }),
                signal: AbortSignal.timeout(10_000),
            });
            if (!res.ok) return;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => {
                URL.revokeObjectURL(url);
                blobUrlRef.current = null;
                audioRef.current = null;
            };
            audio.play().catch(() => {});
        } catch { /* silently fail */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stop = useCallback(() => { _cleanup(); }, []);

    return { speak, stop };
}
