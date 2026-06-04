"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { MicOff, Loader2, X, Check, RotateCcw, ImageIcon, BookOpen } from "lucide-react";
import { useSpeech } from "@/hooks/useSpeech";

type ModalMode = "niche" | "image";
type ModalState = "recording" | "processing" | "confirm" | "creating" | "done" | "error";

interface VoiceRecorderModalProps {
    mode: ModalMode;
    isOpen: boolean;
    onClose: () => void;
    apiUrl: string;
    onNicheCreated?: (name: string, nicheId: string) => void;
    onImageGenerated?: (url: string, prompt: string) => void;
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

const BAR_HEIGHTS = [18, 30, 44, 52, 48, 36, 56, 40, 48, 34, 24, 40, 50, 42, 28];

export function VoiceRecorderModal({
    mode, isOpen, onClose, apiUrl, onNicheCreated, onImageGenerated,
}: VoiceRecorderModalProps) {
    const [state, setState] = useState<ModalState>("recording");
    const [transcript, setTranscript] = useState("");
    const [generatedImageUrl, setGeneratedImageUrl] = useState("");
    const [imgLoaded, setImgLoaded] = useState(false);
    const [error, setError] = useState("");
    const [createdNicheName, setCreatedNicheName] = useState("");
    const mediaRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const { speak } = useSpeech();

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
                speak("Transcribiendo");
                try {
                    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                    const audio = await blobToBase64(blob);
                    const res = await fetch(`${apiUrl}/voice/transcribe`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ audio, mimeType: "audio/webm" }),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json() as { text?: string };
                    if (!data.text) throw new Error("Sin transcripción");
                    setTranscript(data.text);
                    speak(`Escuché: ${data.text.slice(0, 60)}`);
                    setState("confirm");
                } catch (e: any) {
                    setError(e.message ?? "Error al transcribir");
                    setState("error");
                }
            };
            mediaRef.current = mr;
            mr.start();
            speak(mode === "niche" ? "Dime el nombre del nicho" : "Dime qué imagen quieres generar");
        } catch {
            setError("No se pudo acceder al micrófono");
            setState("error");
        }
    }, [apiUrl, mode, speak]);

    const stopRecording = useCallback(() => {
        if (mediaRef.current?.state === "recording") {
            mediaRef.current.stop();
            mediaRef.current = null;
        }
    }, []);

    const reset = useCallback(() => {
        setState("recording");
        setTranscript("");
        setGeneratedImageUrl("");
        setImgLoaded(false);
        setError("");
        void startRecording();
    }, [startRecording]);

    const confirm = async () => {
        if (!transcript) return;
        setState("creating");

        if (mode === "niche") {
            const name = transcript
                .replace(/^(crea(?:r)?|añade?|nuevo nicho de|nueva categoría de|un nicho de|crea un nicho de|crea nicho|nicho)\s+/i, "")
                .replace(/^(nuevo|nueva)\s+/i, "")
                .trim() || transcript;
            const displayName = name.charAt(0).toUpperCase() + name.slice(1);
            speak(`Creando nicho ${displayName}`);
            try {
                const res = await fetch(`${apiUrl}/niches`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: displayName, status: "found" }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json() as any;
                const nicheId = data._id ?? data.id ?? "";
                setCreatedNicheName(displayName);
                speak(`Nicho ${displayName} creado. Iniciando discovery.`);
                setState("done");
                onNicheCreated?.(displayName, nicheId);
                if (nicheId) {
                    void fetch(`${apiUrl}/autopilot/discover/${nicheId}`, { method: "POST" }).catch(() => {});
                }
            } catch (e: any) {
                setError(e.message ?? "Error al crear el nicho");
                setState("error");
            }
        } else {
            const stripped = transcript
                .replace(/^(genera(?:me)?\s+(?:una?\s+)?imagen\s+(?:de\s+)?)/i, "")
                .replace(/^(dibuja(?:me)?\s+(?:una?\s+)?)/i, "")
                .replace(/^(crea(?:me)?\s+(?:una?\s+)?imagen\s+(?:de\s+)?)/i, "")
                .replace(/^((?:una?\s+)?imagen\s+de\s+)/i, "")
                .trim() || transcript;
            const prompt = stripped.charAt(0).toUpperCase() + stripped.slice(1);
            const model = /\banime\b/i.test(prompt) ? "flux-anime" : "flux-realism";
            const seed = Math.floor(Math.random() * 99999);
            const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${model}&width=1024&height=1024&seed=${seed}&enhance=true`;
            speak(`Generando imagen: ${prompt.slice(0, 40)}`);
            setImgLoaded(false);
            setGeneratedImageUrl(url);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setState("recording");
            setTranscript("");
            setGeneratedImageUrl("");
            setImgLoaded(false);
            setError("");
            void startRecording();
        } else {
            if (mediaRef.current?.state === "recording") {
                mediaRef.current.stop();
                mediaRef.current = null;
            }
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!isOpen) return null;

    const isNiche = mode === "niche";
    const accent = isNiche
        ? { ring: "border-sky-500/20 shadow-sky-500/10", icon: "bg-sky-500/15 text-sky-400 border-sky-500/20", bar: "#38bdf8", btn: "bg-sky-500/20 border-sky-500/40 text-sky-300 hover:bg-sky-500/30", confirm: "bg-sky-500 hover:bg-sky-400 text-white shadow-[0_4px_20px_rgba(14,165,233,0.4)]" }
        : { ring: "border-amber-500/20 shadow-amber-500/10", icon: "bg-amber-500/15 text-amber-400 border-amber-500/20", bar: "#fbbf24", btn: "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30", confirm: "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_4px_20px_rgba(245,158,11,0.4)]" };

    const stateLabel: Record<ModalState, string> = {
        recording: "Grabando…",
        processing: "Transcribiendo…",
        confirm: "Confirmar",
        creating: isNiche ? "Creando…" : "Generando…",
        done: "Completado",
        error: "Error",
    };

    return (
        <>
            <style>{`
                @keyframes voiceWaveBar {
                    0%   { transform: scaleY(0.15); }
                    100% { transform: scaleY(1); }
                }
            `}</style>
            <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
                <div className={`relative w-full max-w-sm rounded-3xl border bg-[#0a0a0a] shadow-2xl overflow-hidden ${accent.ring}`}
                    style={{ boxShadow: `0 25px 60px -10px ${isNiche ? "rgba(14,165,233,0.15)" : "rgba(245,158,11,0.15)"}` }}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 pt-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl border ${accent.icon}`}>
                                {isNiche ? <BookOpen size={15} /> : <ImageIcon size={15} />}
                            </div>
                            <div>
                                <p className="text-sm font-black text-white">
                                    {isNiche ? "Crear nicho con voz" : "Generar imagen con voz"}
                                </p>
                                <p className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold">
                                    {stateLabel[state]}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl text-neutral-600 hover:text-white hover:bg-white/10 transition-all">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-6 pb-6 space-y-4">

                        {/* ── Recording ── */}
                        {state === "recording" && (
                            <>
                                <div className="flex items-end justify-center gap-[3px] h-16 py-1">
                                    {BAR_HEIGHTS.map((h, i) => (
                                        <div key={i} className="w-1.5 rounded-full origin-bottom"
                                            style={{
                                                height: `${h}px`,
                                                backgroundColor: accent.bar,
                                                opacity: 0.65 + (i % 3) * 0.12,
                                                animationName: "voiceWaveBar",
                                                animationDuration: `${0.38 + (i % 5) * 0.09}s`,
                                                animationTimingFunction: "ease-in-out",
                                                animationIterationCount: "infinite",
                                                animationDirection: "alternate",
                                                animationDelay: `${i * 0.045}s`,
                                            }}
                                        />
                                    ))}
                                </div>
                                <p className="text-center text-[11px] text-neutral-600">
                                    {isNiche ? "Di el nombre del nicho que quieres crear…" : "Di qué imagen quieres generar…"}
                                </p>
                                <button onClick={stopRecording}
                                    className={`w-full h-12 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${accent.btn}`}>
                                    <MicOff size={15} /> Parar y enviar
                                </button>
                            </>
                        )}

                        {/* ── Processing ── */}
                        {state === "processing" && (
                            <div className="flex flex-col items-center gap-4 py-6">
                                <Loader2 size={32} className="animate-spin" style={{ color: accent.bar }} />
                                <p className="text-sm text-neutral-500">Transcribiendo audio…</p>
                            </div>
                        )}

                        {/* ── Confirm ── */}
                        {state === "confirm" && (
                            <>
                                <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4">
                                    <p className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold mb-2">Escuché</p>
                                    <p className="text-white font-bold text-sm leading-relaxed">«{transcript}»</p>
                                </div>
                                <p className="text-[11px] text-neutral-600 text-center">
                                    {isNiche
                                        ? "Se creará el nicho y se lanzará discovery automáticamente."
                                        : "Se generará la imagen con Pollinations IA."}
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={reset}
                                        className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-neutral-400 hover:text-white transition-all flex items-center justify-center gap-2">
                                        <RotateCcw size={13} /> Repetir
                                    </button>
                                    <button onClick={confirm}
                                        className={`flex-1 h-11 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${accent.confirm}`}>
                                        <Check size={15} /> Confirmar
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ── Creating / generating ── */}
                        {state === "creating" && (
                            <>
                                {/* Image mode: show img immediately (renders hidden, reveals on load) */}
                                {!isNiche && generatedImageUrl ? (
                                    <div className="relative rounded-2xl overflow-hidden bg-white/5" style={{ aspectRatio: "1/1" }}>
                                        {!imgLoaded && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                                                <Loader2 size={28} className="animate-spin" style={{ color: accent.bar }} />
                                                <p className="text-xs text-neutral-600">Generando imagen…</p>
                                            </div>
                                        )}
                                        <img
                                            src={generatedImageUrl}
                                            alt="Generando…"
                                            className="w-full h-full object-cover transition-opacity duration-700"
                                            style={{ opacity: imgLoaded ? 1 : 0 }}
                                            onLoad={() => {
                                                setImgLoaded(true);
                                                speak("Imagen generada");
                                                onImageGenerated?.(generatedImageUrl, transcript);
                                                setState("done");
                                            }}
                                            onError={() => {
                                                setError("No se pudo generar la imagen");
                                                setState("error");
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 py-6">
                                        <Loader2 size={32} className="animate-spin" style={{ color: accent.bar }} />
                                        <p className="text-sm text-neutral-500">
                                            {isNiche ? "Creando nicho…" : "Generando imagen…"}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── Done ── */}
                        {state === "done" && (
                            <>
                                {isNiche ? (
                                    <div className="flex flex-col items-center gap-4 py-2">
                                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                            <Check size={24} className="text-emerald-400" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-white font-black text-sm">Nicho creado</p>
                                            <p className="text-neutral-400 text-xs mt-1">«{createdNicheName}»</p>
                                            <p className="text-neutral-700 text-[10px] mt-2">Discovery iniciado automáticamente</p>
                                        </div>
                                        <button onClick={onClose}
                                            className="w-full h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-neutral-400 hover:text-white transition-all">
                                            Cerrar
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {generatedImageUrl && (
                                            <div className="rounded-2xl overflow-hidden">
                                                <img src={generatedImageUrl} alt={transcript} className="w-full object-cover rounded-2xl" />
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <button onClick={reset}
                                                className="flex-1 h-10 rounded-2xl bg-white/5 border border-white/10 text-xs font-black text-neutral-400 hover:text-white transition-all flex items-center justify-center gap-1.5">
                                                <RotateCcw size={11} /> Nueva imagen
                                            </button>
                                            <button onClick={onClose}
                                                className="flex-1 h-10 rounded-2xl bg-white/5 border border-white/10 text-xs font-black text-neutral-400 hover:text-white transition-all">
                                                Cerrar
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {/* ── Error ── */}
                        {state === "error" && (
                            <>
                                <div className="flex flex-col items-center gap-3 py-2">
                                    <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                                        <X size={24} className="text-red-400" />
                                    </div>
                                    <p className="text-sm text-red-400 text-center">{error}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={reset}
                                        className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-neutral-400 hover:text-white transition-all flex items-center justify-center gap-2">
                                        <RotateCcw size={13} /> Reintentar
                                    </button>
                                    <button onClick={onClose}
                                        className="flex-1 h-11 rounded-2xl bg-red-500/20 border border-red-500/30 text-sm font-black text-red-400 hover:bg-red-500/30 transition-all">
                                        Cerrar
                                    </button>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            </div>
        </>
    );
}
