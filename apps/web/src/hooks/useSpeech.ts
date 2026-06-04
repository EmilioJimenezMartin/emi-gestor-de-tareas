"use client";
import { useCallback, useRef } from "react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

function stripNonSpeech(text: string): string {
    return text.replace(/[^\p{L}\p{N}\s.,;:!?'"()\-]/gu, " ").replace(/\s+/g, " ").trim();
}

export function useSpeech(_lang = "es-ES") {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blobUrlRef = useRef<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const speak = useCallback(async (text: string) => {
        if (typeof window === "undefined") return;
        if (localStorage.getItem("voice_enabled") === "false") return;
        const clean = stripNonSpeech(text);
        if (!clean) return;

        // Cancel any in-flight request so two rapid speak() calls don't overlap
        abortRef.current?.abort();
        abortRef.current = null;
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch(`${API_URL}/voice/tts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: clean }),
                signal: controller.signal,
            });
            if (!res.ok || controller.signal.aborted) return;
            const blob = await res.blob();
            if (controller.signal.aborted) return;
            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            const audio = new Audio(url);
            audioRef.current = audio;
            abortRef.current = null;
            audio.onended = () => {
                URL.revokeObjectURL(url);
                blobUrlRef.current = null;
                audioRef.current = null;
            };
            audio.play().catch(() => {});
        } catch { /* AbortError o fallo de red — silencioso */ }
    }, []);

    const stop = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    }, []);

    return { speak, stop };
}
