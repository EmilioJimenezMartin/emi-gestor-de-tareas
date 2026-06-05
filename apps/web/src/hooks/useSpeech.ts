"use client";
import { useCallback } from "react";

function stripNonSpeech(text: string): string {
    return text.replace(/[^\p{L}\p{N}\s.,;:!?'"()\-]/gu, " ").replace(/\s+/g, " ").trim();
}

export function useSpeech(lang = "es-ES") {
    const speak = useCallback((text: string) => {
        if (typeof window === "undefined" || !window.speechSynthesis) return;
        if (localStorage.getItem("voice_enabled") === "false") return;
        const clean = stripNonSpeech(text).slice(0, 200);
        if (!clean) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = lang;
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }, [lang]);

    const stop = useCallback(() => {
        if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    }, []);

    return { speak, stop };
}
