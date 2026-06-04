"use client";
import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceButtonProps {
    onTranscript: (text: string) => void;
    apiUrl: string;
    className?: string;
    size?: number;
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export function VoiceButton({ onTranscript, apiUrl, className = "", size = 14 }: VoiceButtonProps) {
    const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
    const mediaRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const stopAndTranscribe = useCallback(() => {
        mediaRef.current?.stop();
        mediaRef.current = null;
    }, []);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : "audio/webm";
            const mr = new MediaRecorder(stream, { mimeType });
            chunksRef.current = [];

            mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            mr.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                setState("processing");
                try {
                    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                    const audio = await blobToBase64(blob);
                    const res = await fetch(`${apiUrl}/voice/transcribe`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ audio, mimeType: "audio/webm" }),
                    });
                    if (res.ok) {
                        const data = await res.json() as { text?: string };
                        if (data.text) onTranscript(data.text);
                    }
                } catch { /* ignore */ }
                setState("idle");
            };

            mediaRef.current = mr;
            mr.start();
            setState("recording");
        } catch {
            setState("idle");
        }
    }, [apiUrl, onTranscript]);

    const toggle = () => {
        if (state === "idle") void startRecording();
        else if (state === "recording") stopAndTranscribe();
    };

    const colors = {
        idle: "text-neutral-600 hover:text-white hover:bg-white/8",
        recording: "text-red-400 bg-red-500/10 border-red-500/30 animate-pulse",
        processing: "text-neutral-500",
    };

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={state === "processing"}
            title={state === "recording" ? "Parar grabación" : state === "processing" ? "Transcribiendo…" : "Grabar audio"}
            className={`p-1.5 rounded-lg border border-transparent transition-all ${colors[state]} disabled:cursor-not-allowed ${className}`}
        >
            {state === "processing"
                ? <Loader2 size={size} className="animate-spin" />
                : state === "recording"
                ? <MicOff size={size} />
                : <Mic size={size} />}
        </button>
    );
}
