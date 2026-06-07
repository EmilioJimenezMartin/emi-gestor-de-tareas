"use client";
import { useCallback } from "react";

function stripNonSpeech(text: string): string {
    return text.replace(/[^\p{L}\p{N}\s.,;:!?'"()\-]/gu, " ").replace(/\s+/g, " ").trim();
}

function browserSpeak(clean: string, lang: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    // Chrome bug: synthesis can silently pause. Resume it before cancelling.
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.cancel();

    const doSpeak = () => {
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = lang;
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        // Chrome bug: give cancel() a tick to flush before queuing new utterance
        setTimeout(() => window.speechSynthesis.speak(utterance), 50);
    };

    // Voices may load asynchronously on first call
    if (window.speechSynthesis.getVoices().length > 0) {
        doSpeak();
    } else {
        window.speechSynthesis.addEventListener("voiceschanged", doSpeak, { once: true });
    }
}

export function useSpeech(lang = "es-ES") {
    const speak = useCallback((text: string) => {
        if (typeof window === "undefined" || !window.speechSynthesis) return;
        if (localStorage.getItem("voice_enabled") === "false") return;
        const clean = stripNonSpeech(text).slice(0, 200);
        if (!clean) return;
        browserSpeak(clean, lang);
    }, [lang]);

    const stop = useCallback(() => {
        if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    }, []);

    return { speak, stop };
}

/** Standalone browser TTS — usable outside React (e.g. ajustes testVoice fallback) */
export function speakBrowser(text: string, lang = "es-ES") {
    const clean = stripNonSpeech(text).slice(0, 200);
    if (!clean) return;
    browserSpeak(clean, lang);
}
