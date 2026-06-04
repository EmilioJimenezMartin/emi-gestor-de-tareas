"use client";
import { useCallback } from "react";

export function useSpeech(lang = "es-ES") {
    const speak = useCallback((text: string) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }, [lang]);

    const stop = useCallback(() => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
    }, []);

    return { speak, stop };
}
