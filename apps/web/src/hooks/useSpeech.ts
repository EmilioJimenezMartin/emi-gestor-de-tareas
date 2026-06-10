"use client";
import { useCallback, useRef } from "react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");

// Module-level ref so all hook instances share the same current audio (only one voice at a time)
let _currentAudio: HTMLAudioElement | null = null;

function stopCurrentAudio() {
    if (_currentAudio) {
        _currentAudio.pause();
        _currentAudio.src = "";
        _currentAudio = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}

function stripNonSpeech(text: string): string {
    return text.replace(/[^\p{L}\p{N}\s.,;:!?'"()\-]/gu, " ").replace(/\s+/g, " ").trim();
}

function browserSpeak(clean: string, lang: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    stopCurrentAudio();

    const doSpeak = () => {
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = lang;
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        setTimeout(() => window.speechSynthesis.speak(utterance), 50);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
        doSpeak();
    } else {
        window.speechSynthesis.addEventListener("voiceschanged", doSpeak, { once: true });
    }
}

// Plays audio via the server TTS endpoint. Falls back to browser synthesis.
async function serverSpeak(clean: string, lang: string): Promise<boolean> {
    try {
        const token = typeof window !== "undefined" ? localStorage.getItem("emi_auth_token") : null;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/voice/tts`, {
            method: "POST",
            headers,
            body: JSON.stringify({ text: clean, lang }),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return false;

        const blob = await res.blob();
        if (blob.size < 500) return false;

        stopCurrentAudio();

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        _currentAudio = audio;
        audio.onended = () => { URL.revokeObjectURL(url); if (_currentAudio === audio) _currentAudio = null; };
        audio.onerror = () => { URL.revokeObjectURL(url); if (_currentAudio === audio) _currentAudio = null; };
        await audio.play();
        return true;
    } catch {
        return false;
    }
}

export function useSpeech(lang = "es-ES") {
    const speak = useCallback(async (text: string) => {
        if (typeof window === "undefined") return;
        if (localStorage.getItem("voice_enabled") === "false") return;
        const clean = stripNonSpeech(text).slice(0, 200);
        if (!clean) return;

        const ok = await serverSpeak(clean, lang);
        if (!ok) browserSpeak(clean, lang);
    }, [lang]);

    const stop = useCallback(() => {
        stopCurrentAudio();
    }, []);

    return { speak, stop };
}

/** Standalone browser TTS — usable outside React (e.g. ajustes testVoice fallback) */
export function speakBrowser(text: string, lang = "es-ES") {
    const clean = stripNonSpeech(text).slice(0, 200);
    if (!clean) return;
    browserSpeak(clean, lang);
}
