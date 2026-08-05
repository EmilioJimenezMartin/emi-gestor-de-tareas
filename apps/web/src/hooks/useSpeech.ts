"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");

// ── Shared mute state ────────────────────────────────────────────────────────
// Single source of truth for "voice_enabled" so the persistent header button,
// the Ajustes toggle, and chat commands ("mutea", "activa el sonido"...) all
// stay in sync without a page reload — localStorage's own `storage` event only
// fires in OTHER tabs, so we dispatch a custom event for same-tab listeners.
const APP_MUTE_EVENT = "app-mute-changed";

export function isAppMuted(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("voice_enabled") === "false";
}

export function setAppMuted(muted: boolean): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("voice_enabled", muted ? "false" : "true");
    window.dispatchEvent(new CustomEvent(APP_MUTE_EVENT, { detail: { muted } }));
}

export function useAppMuted(): [boolean, (muted: boolean) => void] {
    const [muted, setMuted] = useState(false);
    useEffect(() => {
        setMuted(isAppMuted());
        const handler = (e: Event) => setMuted((e as CustomEvent<{ muted: boolean }>).detail.muted);
        window.addEventListener(APP_MUTE_EVENT, handler);
        return () => window.removeEventListener(APP_MUTE_EVENT, handler);
    }, []);
    return [muted, setAppMuted];
}

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

    const synth = window.speechSynthesis;

    const doSpeak = () => {
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = lang;
        utterance.rate = 1.0;
        utterance.volume = 1.0;
        const savedVoice = localStorage.getItem("voice_name");
        if (savedVoice) {
            const match = synth.getVoices().find(v => v.name === savedVoice);
            if (match) {
                utterance.voice = match;
                utterance.lang = match.lang;
            }
        }
        // Chrome bug: cancel() + speak() same tick = silence. Yield 100ms + resume().
        synth.cancel();
        setTimeout(() => { synth.resume(); synth.speak(utterance); }, 100);
    };

    if (synth.getVoices().length > 0) {
        doSpeak();
    } else {
        synth.addEventListener("voiceschanged", doSpeak, { once: true });
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
        if (isAppMuted()) return;
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
