"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Loader2, Send, SendHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { useSpeech } from "@/hooks/useSpeech";
import { toast } from "sonner";
import { createApiSocket } from "@/lib/socket";

type Message = { _id?: string; role: "user" | "assistant"; text: string; source?: "ui" | "telegram"; createdAt?: string };

type Props = {
    systemContext: string;
    apiBase: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const JSON_KEY_ICONS: Record<string, string> = {
    foco: "🎯", accion: "⚡", prioridad: "📊", titulo: "📌",
    recomendacion: "💡", resultado: "✅", error: "❌", nota: "📝",
    nicho: "🏷️", keywords: "🔑", descripcion: "📄", fecha: "📅",
};

const PRIORITY_COLORS: Record<string, string> = {
    alta: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    media: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    baja: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

function JsonCard({ data }: { data: Record<string, unknown> }) {
    return (
        <div className="space-y-2.5">
            {Object.entries(data).map(([key, val]) => {
                const valStr = String(val);
                const lowerKey = key.toLowerCase();
                const lowerVal = valStr.toLowerCase();
                const isPriority = lowerKey === "prioridad";
                const priorityClass = isPriority ? (PRIORITY_COLORS[lowerVal] ?? "text-neutral-300 bg-white/5 border-white/10") : null;
                return (
                    <div key={key} className="flex gap-2.5 items-start">
                        <span className="text-sm shrink-0 mt-0.5">{JSON_KEY_ICONS[lowerKey] ?? "·"}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600 mb-0.5">{key}</p>
                            {isPriority ? (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${priorityClass}`}>{valStr}</span>
                            ) : (
                                <p className="text-[11px] text-neutral-200 leading-relaxed">{valStr}</p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function RichText({ text }: { text: string }) {
    const lines = text.split("\n").filter(l => l.trim() !== "");
    return (
        <div className="space-y-1.5">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                const isBullet = /^[-•*▸]\s/.test(trimmed);
                const content = isBullet ? trimmed.replace(/^[-•*▸]\s/, "") : trimmed;
                const parts = content.split(/\*\*(.*?)\*\*/g);
                const rendered = parts.map((p, j) =>
                    j % 2 === 1
                        ? <strong key={j} className="text-white font-black">{p}</strong>
                        : <span key={j}>{p}</span>
                );
                return isBullet ? (
                    <div key={i} className="flex gap-1.5 items-start">
                        <span className="text-indigo-400 shrink-0 mt-0.5 text-[10px]">▸</span>
                        <span className="text-[11px] text-neutral-300 leading-relaxed">{rendered}</span>
                    </div>
                ) : (
                    <p key={i} className="text-[11px] text-neutral-300 leading-relaxed">{rendered}</p>
                );
            })}
        </div>
    );
}

function renderContent(text: string): React.ReactNode {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
                return <JsonCard data={parsed} />;
            }
        } catch { /* fall through */ }
    }
    return <RichText text={text} />;
}

const SUGGESTION_MAP: { keywords: string[]; label: string; question: string }[] = [
    { keywords: ["nicho", "producir", "idea"], label: "🏷️ ¿Qué nicho priorizar?", question: "¿Qué nicho debería priorizar ahora mismo?" },
    { keywords: ["seo", "listing", "keyword", "descripci"], label: "📝 Optimizar SEO", question: "¿Cómo optimizo el SEO de mis libros?" },
    { keywords: ["temporad", "calendario", "fecha", "semana"], label: "📅 Plan semanal", question: "¿Qué debería publicar esta semana?" },
    { keywords: ["imagen", "catálogo", "generar"], label: "🖼 Más imágenes", question: "¿Cuántas imágenes necesito generar hoy?" },
    { keywords: ["publicar", "amazon", "kdp", "venta"], label: "🚀 Maximizar ventas", question: "¿Cómo maximizo mis ventas en Amazon?" },
    { keywords: ["clone", "competencia", "bestseller", "bsr"], label: "🔍 Analizar competencia", question: "¿Qué puedo aprender de la competencia?" },
];

function getSuggestions(text: string): { label: string; question: string }[] {
    const lower = text.toLowerCase();
    return SUGGESTION_MAP.filter(s => s.keywords.some(k => lower.includes(k))).slice(0, 3);
}

function wrapSystemContext(ctx: string): string {
    return `${ctx}

FORMATO DE RESPUESTA:
- Responde SIEMPRE en español natural y conversacional. NUNCA en formato JSON.
- Máximo 4 oraciones o 4 puntos de lista.
- Usa **negrita** para resaltar conceptos clave.
- Usa guiones (-) para listas de acciones concretas.
- Prioriza el mayor impacto económico inmediato.`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FocusChat({ systemContext, apiBase }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { speak } = useSpeech();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    // Load history on mount
    useEffect(() => {
        fetch(`${apiBase}/assistant/history`)
            .then(r => r.json())
            .then((data: Message[]) => {
                if (Array.isArray(data) && data.length > 0) setMessages(data);
                setHistoryLoaded(true);
            })
            .catch(() => setHistoryLoaded(true));
    }, [apiBase]);

    // Real-time: listen for new messages from any source
    useEffect(() => {
        const socket = createApiSocket();
        socket.on("chat:message", (msg: Message) => {
            setMessages(prev => {
                // Avoid duplicates if this client sent it
                if (msg._id && prev.some(m => m._id === msg._id)) return prev;
                return [...prev, msg];
            });
        });
        socket.on("chat:cleared", () => setMessages([]));
        return () => { socket.disconnect(); };
    }, []);

    const chat = async (text: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${apiBase}/assistant/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, systemContext: wrapSystemContext(systemContext) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Error");
            // Server persists + broadcasts via socket — but also update locally for instant feedback
            // The socket event will dedupe if _id matches
            const reply = (data.reply as string).trim();
            const plain = reply.replace(/\*\*(.*?)\*\*/g, "$1").replace(/^[-•▸]\s/gm, "").slice(0, 180);
            void speak(plain);
        } catch {
            toast.error("Error conectando con el asistente");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpen = () => {
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 200);
        // Only send greeting if no history at all
        if (historyLoaded && messages.length === 0) {
            const greet = "¿Cuál es mi foco de trabajo más importante hoy?";
            setMessages([{ role: "user", text: greet, source: "ui" }]);
            void chat(greet);
        }
    };

    const send = (text?: string) => {
        const t = (text ?? input).trim();
        if (!t || isLoading) return;
        setInput("");
        // Optimistically add user message — socket will add the real one with _id
        setMessages(prev => [...prev, { role: "user", text: t, source: "ui" }]);
        void chat(t);
    };

    const clearHistory = async () => {
        try {
            await fetch(`${apiBase}/assistant/history`, { method: "DELETE" });
            // socket chat:cleared will update state
        } catch {
            toast.error("Error limpiando historial");
        }
    };

    const forwardToTelegram = async (text: string) => {
        try {
            const res = await fetch(`${apiBase}/assistant/telegram-send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            if (!res.ok) throw new Error();
            toast.success("Enviado a Telegram");
        } catch {
            toast.error("Error enviando a Telegram");
        }
    };

    // Hide the initial greeting user message
    const visibleMessages = messages.filter((m, i) => !(m.role === "user" && i === 0 && m.text === "¿Cuál es mi foco de trabajo más importante hoy?"));

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {isOpen && (
                <div
                    className="w-[340px] rounded-3xl border border-white/12 bg-black/90 backdrop-blur-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
                    style={{ height: 480 }}
                >
                    {/* ── Header ── */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-gradient-to-r from-indigo-500/10 to-violet-500/5 shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="relative">
                                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <Sparkles size={12} className="text-white" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-white leading-none">Daily Focus</p>
                                <p className="text-[9px] text-indigo-300/60 mt-0.5">Conversación unificada UI + Telegram</p>
                            </div>
                            {isLoading && <Loader2 size={11} className="animate-spin text-indigo-400 ml-1" />}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={clearHistory}
                                className="p-1.5 rounded-xl hover:bg-white/10 text-neutral-600 hover:text-rose-400 transition-all"
                                title="Limpiar historial"
                            >
                                <Trash2 size={11} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-xl hover:bg-white/10 text-neutral-500 hover:text-white transition-all"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    </div>

                    {/* ── Messages ── */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">
                        {visibleMessages.length === 0 && !isLoading && (
                            <div className="flex flex-col items-center gap-2 mt-10 text-center">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center">
                                    <Sparkles size={16} className="text-indigo-400" />
                                </div>
                                <p className="text-[10px] text-neutral-600">Analizando tu negocio...</p>
                            </div>
                        )}

                        {visibleMessages.map((m, i) => (
                            m.role === "user" ? (
                                <div key={m._id ?? i} className="flex justify-end">
                                    <div className={`max-w-[82%] rounded-2xl rounded-br-sm px-3 py-2.5 border text-[11px] leading-relaxed ${m.source === "telegram" ? "bg-sky-500/15 border-sky-500/25 text-sky-100" : "bg-indigo-500/20 border-indigo-500/20 text-indigo-100"}`}>
                                        {m.source === "telegram" && <span className="text-[8px] font-black uppercase tracking-widest text-sky-400/70 block mb-0.5">📱 Telegram</span>}
                                        {m.text}
                                    </div>
                                </div>
                            ) : (
                                <div key={m._id ?? i} className="flex gap-2 items-start group">
                                    <div className={`w-6 h-6 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${m.source === "telegram" ? "bg-sky-500/20 border-sky-500/25" : "bg-gradient-to-br from-indigo-500/25 to-violet-500/25 border-indigo-500/20"}`}>
                                        {m.source === "telegram" ? <span className="text-[9px]">📱</span> : <Sparkles size={9} className="text-indigo-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="rounded-2xl rounded-tl-sm px-3.5 py-3 bg-white/[0.04] border border-white/8">
                                            {renderContent(m.text)}
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <button
                                                onClick={() => void forwardToTelegram(m.text)}
                                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-neutral-600 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <SendHorizontal size={8} /> Telegram
                                            </button>
                                        </div>
                                        {i === visibleMessages.length - 1 && !isLoading && (() => {
                                            const sugg = getSuggestions(m.text);
                                            if (sugg.length === 0) return null;
                                            return (
                                                <div className="flex gap-1.5 flex-wrap pt-0.5">
                                                    {sugg.map((s, si) => (
                                                        <button
                                                            key={si}
                                                            onClick={() => send(s.question)}
                                                            className="px-2.5 py-1 rounded-full text-[9px] font-black border border-indigo-500/20 bg-indigo-500/8 text-indigo-300/80 hover:bg-indigo-500/15 hover:text-indigo-200 hover:border-indigo-500/30 transition-all"
                                                        >
                                                            {s.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )
                        ))}

                        {isLoading && (
                            <div className="flex gap-2 items-start">
                                <div className="w-6 h-6 rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 border border-indigo-500/20 flex items-center justify-center shrink-0">
                                    <Sparkles size={9} className="text-indigo-400" />
                                </div>
                                <div className="flex gap-1 px-3.5 py-3 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/8">
                                    {[0, 1, 2].map(j => (
                                        <div
                                            key={j}
                                            className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 animate-bounce"
                                            style={{ animationDelay: `${j * 160}ms` }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* ── Input ── */}
                    <div className="px-3 py-3 border-t border-white/8 bg-white/[0.015] shrink-0">
                        <div className="flex gap-2 items-center">
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                                placeholder="Pregúntame algo..."
                                className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-[11px] text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.08] transition-all"
                            />
                            <button
                                onClick={() => send()}
                                disabled={!input.trim() || isLoading}
                                className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center hover:bg-indigo-500/30 hover:scale-105 transition-all disabled:opacity-25 disabled:scale-100 shrink-0"
                            >
                                <Send size={11} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toggle button ── */}
            <button
                onClick={isOpen ? () => setIsOpen(false) : handleOpen}
                className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 ${
                    isOpen
                        ? "bg-white/10 border border-white/15 text-neutral-400 hover:bg-white/15"
                        : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/40 hover:scale-110 hover:shadow-indigo-500/60"
                }`}
                title={isOpen ? "Cerrar asistente" : "Daily Focus — Asistente IA"}
            >
                {isOpen ? <ChevronDown size={16} /> : <Bot size={18} />}
            </button>
        </div>
    );
}
