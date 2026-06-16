"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Loader2, Send, Sparkles, X } from "lucide-react";
import { useSpeech } from "@/hooks/useSpeech";
import { toast } from "sonner";

type Message = { role: "user" | "assistant"; text: string };

type Props = {
    systemContext: string;
    apiBase: string;
};

export function FocusChat({ systemContext, apiBase }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [greeted, setGreeted] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { speak } = useSpeech();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const chat = async (msgs: Message[]) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${apiBase}/assistant/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: msgs.map(m => ({ role: m.role, content: m.text })),
                    systemContext,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Error");
            const reply = (data.reply as string).trim();
            setMessages(prev => [...prev, { role: "assistant", text: reply }]);
            void speak(reply.slice(0, 180));
        } catch {
            toast.error("Error conectando con el asistente");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpen = () => {
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 200);
        if (!greeted) {
            setGreeted(true);
            const initMsg: Message = { role: "user", text: "¿Cuál es mi foco de trabajo más importante hoy?" };
            setMessages([initMsg]);
            void chat([initMsg]);
        }
    };

    const send = () => {
        const text = input.trim();
        if (!text || isLoading) return;
        setInput("");
        const updated: Message[] = [...messages, { role: "user", text }];
        setMessages(updated);
        void chat(updated);
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

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {isOpen && (
                <div
                    className="w-80 rounded-3xl border border-white/12 bg-black/85 backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col"
                    style={{ height: 420 }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-white/[0.03] shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                                <Sparkles size={10} className="text-white" />
                            </div>
                            <span className="text-sm font-black text-white">Daily Focus</span>
                            {isLoading && <Loader2 size={10} className="animate-spin text-neutral-500" />}
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-all"
                        >
                            <X size={12} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
                        {messages.length === 0 && !isLoading && (
                            <p className="text-[10px] text-neutral-700 text-center mt-8">Iniciando asistente...</p>
                        )}
                        {messages.filter(m => m.role !== "user" || messages.indexOf(m) > 0).map((m, i) => (
                            m.role === "user" ? (
                                <div key={i} className="flex justify-end">
                                    <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-[11px] leading-relaxed bg-indigo-500/20 border border-indigo-500/20 text-indigo-100">
                                        {m.text}
                                    </div>
                                </div>
                            ) : (
                                <div key={i} className="flex gap-2 items-start group">
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <Sparkles size={8} className="text-indigo-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="rounded-2xl rounded-bl-sm px-3 py-2 text-[11px] leading-relaxed bg-white/[0.05] border border-white/8 text-neutral-300">
                                            {m.text}
                                        </div>
                                        <button
                                            onClick={() => void forwardToTelegram(m.text)}
                                            className="mt-0.5 opacity-0 group-hover:opacity-100 transition-all text-[9px] text-neutral-600 hover:text-indigo-400 flex items-center gap-0.5"
                                        >
                                            → Telegram
                                        </button>
                                    </div>
                                </div>
                            )
                        ))}
                        {isLoading && (
                            <div className="flex gap-2 items-start">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center shrink-0">
                                    <Sparkles size={8} className="text-indigo-400" />
                                </div>
                                <div className="flex gap-1 px-3 py-2.5 rounded-2xl rounded-bl-sm bg-white/[0.05] border border-white/8">
                                    {[0, 1, 2].map(j => (
                                        <div
                                            key={j}
                                            className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-bounce"
                                            style={{ animationDelay: `${j * 150}ms` }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="px-3 py-3 border-t border-white/8 bg-white/[0.02] shrink-0">
                        <div className="flex gap-2 items-center">
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                                placeholder="Pregúntame algo..."
                                className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-[11px] text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-indigo-500/40 transition-all"
                            />
                            <button
                                onClick={send}
                                disabled={!input.trim() || isLoading}
                                className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center hover:bg-indigo-500/30 transition-all disabled:opacity-30 shrink-0"
                            >
                                <Send size={11} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toggle button */}
            <button
                onClick={isOpen ? () => setIsOpen(false) : handleOpen}
                className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all ${
                    isOpen
                        ? "bg-white/10 border border-white/20 text-neutral-400 hover:bg-white/15"
                        : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/40 hover:scale-110 hover:shadow-indigo-500/60"
                }`}
                title={isOpen ? "Cerrar asistente" : "Daily Focus — Asistente IA"}
            >
                {isOpen ? <ChevronDown size={16} /> : <Bot size={18} />}
            </button>
        </div>
    );
}
