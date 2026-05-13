"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
    Terminal, Database, Play, Plus, X,
    Save, Globe, BrainCircuit, Filter, Sparkles,
    ChevronRight, Activity
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createApiSocket } from "@/lib/socket";
import { toast } from "sonner";

interface LogEntry {
    id: string;
    timestamp: string;
    level: "info" | "success" | "error" | "warning";
    message: string;
}

interface StagedItem {
    stageId: string;
    item: Record<string, any>;
}

export default function ExtractorDashboard() {
    const [urls, setUrls] = useState<{ id: string; value: string }[]>([
        { id: Math.random().toString(), value: "" }
    ]);
    const [prompt, setPrompt] = useState("Extrae todos los elementos relevantes con título, descripción, tipo y etiquetas.");
    const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
    const [kwInput, setKwInput] = useState("");
    const [isExtracting, setIsExtracting] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [staged, setStaged] = useState<StagedItem[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const apiUrl = useMemo(() => (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, ""), []);

    useEffect(() => {
        const socket = createApiSocket(apiUrl);
        socket.on("extractor:log", (data: any) => {
            setLogs(prev => [...prev, {
                id: Math.random().toString(),
                timestamp: new Date(data.timestamp).toLocaleTimeString(),
                level: data.level || "info",
                message: data.message
            }]);
        });
        socket.on("extractor:result", (data: any) => {
            setStaged(prev => [...prev, { stageId: Math.random().toString(), item: data.item }]);
        });
        socket.on("extractor:done", () => {
            setIsExtracting(false);
            toast.success("Extracción finalizada");
        });
        return () => { socket.disconnect() };
    }, [apiUrl]);

    // Only scroll if logs exist and it's not the initial mount
    const isFirstLogs = useRef(true);
    useEffect(() => {
        if (logs.length > 0) {
            if (isFirstLogs.current) {
                isFirstLogs.current = false;
                logsEndRef.current?.scrollIntoView({ behavior: "auto" });
            } else {
                logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }
        }
    }, [logs]);

    const startExtraction = async () => {
        const validUrls = urls.map(u => u.value.trim()).filter(v => v.length > 0);
        if (validUrls.length === 0) { toast.error("Añade al menos una URL o endpoint de API"); return; }
        if (isExtracting) return;

        toast.info("Lanzando motor extractor...");
        setLogs([]);
        setStaged([]);
        setIsExtracting(true);

        try {
            console.log("Starting extraction for:", validUrls);
            const res = await fetch(`${apiUrl}/extractor/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: validUrls, prompt, excludeKeywords })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || `Status: ${res.status}`);
            }

            const data = await res.json();
            console.log("Job launched successfully:", data.jobId);
        } catch (e: any) {
            console.error("Extraction error:", e);
            toast.error(`Error: ${e?.message ?? "No se pudo conectar con el servidor"}`);
            setIsExtracting(false);
            setLogs(prev => [...prev, {
                id: "error-" + Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                level: "error",
                message: `[ERROR] No se pudo iniciar el trabajo: ${e.message}`
            }]);
        }
    };

    const saveItem = async (stageId: string, item: Record<string, any>) => {
        try {
            const res = await fetch(`${apiUrl}/extractor/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item)
            });
            if (res.ok) {
                toast.success("Guardado en MongoDB");
                setStaged(prev => prev.filter(s => s.stageId !== stageId));
            } else toast.error("Error al guardar");
        } catch { toast.error("Error de red") }
    };

    const discardItem = (stageId: string) => {
        setStaged(prev => prev.filter(s => s.stageId !== stageId));
    };

    const addKeyword = () => {
        const kw = kwInput.trim();
        if (kw && !excludeKeywords.includes(kw)) setExcludeKeywords(prev => [...prev, kw]);
        setKwInput("");
    };

    const levelColor = (l: string) =>
        l === "success" ? "text-emerald-400 font-bold" :
            l === "error" ? "text-rose-400 font-bold" :
                l === "warning" ? "text-amber-400" : "text-primary/80";

    const levelPrefix = (l: string) =>
        l === "success" ? "▶" : l === "error" ? "✕" : l === "warning" ? "▲" : "›";

    return (
        <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 animate-in fade-in duration-700">

            {/* ── Header ── */}
            <header className="flex flex-col gap-6 relative">
                <div className="absolute -left-10 -top-10 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none" />
                <div className="flex flex-col gap-2 relative">
                    <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-white italic leading-tight">
                        Motor <span className="text-primary italic">Extractor</span>
                    </h1>
                    <p className="text-sm sm:text-lg text-neutral-500 max-w-2xl font-medium leading-relaxed">
                        Extrae, analiza y normaliza datos de cualquier URL o API usando IA.
                    </p>
                </div>
            </header>

            {/* ── Main Dashboard ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-32">

                {/* Left Column: Configuration */}
                <div className="lg:col-span-4 flex flex-col gap-8">

                    {/* Sources Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Globe size={18} className="text-primary" />
                                </div>
                                <h2 className="text-sm font-black text-white uppercase tracking-widest italic">Fuentes</h2>
                            </div>
                            <button
                                onClick={() => setUrls(prev => [...prev, { id: Math.random().toString(), value: "" }])}
                                className="flex items-center gap-1.5 text-[10px] font-black text-primary/70 hover:text-primary uppercase tracking-widest transition-all px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-xl hover:border-primary/40"
                            >
                                <Plus size={12} /> Añadir fuente
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {urls.map((u) => (
                                <div key={u.id} className="flex gap-3 items-center group">
                                    <div className="flex-1 flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-3xl px-5 h-16 focus-within:border-primary/40 focus-within:bg-white/[0.05] transition-all shadow-xl shadow-black/20">
                                        <ChevronRight size={16} className="text-neutral-700 shrink-0" />
                                        <input
                                            type="url"
                                            value={u.value}
                                            onChange={e => {
                                                setUrls(prev => prev.map(item =>
                                                    item.id === u.id ? { ...item, value: e.target.value } : item
                                                ));
                                            }}
                                            placeholder="https://example.com o endpoint API"
                                            className="flex-1 bg-transparent border-none text-sm text-white placeholder:text-neutral-700 focus:outline-none font-mono"
                                        />
                                    </div>
                                    {urls.length > 1 && (
                                        <button
                                            onClick={() => setUrls(prev => prev.filter(item => item.id !== u.id))}
                                            className="w-12 h-16 flex items-center justify-center text-neutral-700 hover:text-rose-400 hover:bg-rose-500/10 rounded-3xl transition-all shrink-0 border border-transparent hover:border-rose-500/20"
                                        >
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* AI Prompt Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <BrainCircuit size={18} className="text-blue-400" />
                            </div>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest italic">Instrucciones IA</h2>
                        </div>
                        <Card variant="outline" className="bg-white/[0.01] border-white/5 p-6 rounded-3xl shadow-xl shadow-black/20">
                            <textarea
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                rows={5}
                                placeholder="Extrae todos los elementos con título, descripción, tipo y etiquetas..."
                                className="w-full bg-transparent border-none text-sm text-white placeholder:text-neutral-700 resize-none focus:outline-none leading-relaxed"
                            />
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <p className="text-[10px] text-neutral-600 leading-relaxed font-medium">
                                    Ej: «Extrae solo criptomonedas con su capitalización de mercado y sentimiento actual»
                                </p>
                            </div>
                        </Card>
                    </section>

                    {/* Keyword Filter Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                <Filter size={18} className="text-rose-400" />
                            </div>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest italic">Filtrado</h2>
                        </div>
                        <Card variant="outline" className="bg-white/[0.01] border-white/5 p-6 rounded-3xl shadow-xl shadow-black/20 space-y-4">
                            <div className="flex gap-2">
                                <input
                                    value={kwInput}
                                    onChange={e => setKwInput(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && addKeyword()}
                                    placeholder="spam, expirado..."
                                    className="flex-1 h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-rose-500/30 transition-colors"
                                />
                                <button
                                    onClick={addKeyword}
                                    className="h-11 px-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500/20 transition-colors"
                                >
                                    Añadir
                                </button>
                            </div>
                            {excludeKeywords.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {excludeKeywords.map(kw => (
                                        <Badge key={kw} variant="neutral" className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider h-auto flex items-center gap-2">
                                            {kw}
                                            <X size={10} className="cursor-pointer hover:text-white" onClick={() => setExcludeKeywords(p => p.filter(k => k !== kw))} />
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </section>

                    {/* Action Button */}
                    <button
                        onClick={startExtraction}
                        disabled={isExtracting}
                        className={`w-full h-16 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs transition-all relative overflow-hidden group shadow-2xl ${isExtracting
                            ? "bg-amber-600/80 text-white shadow-amber-600/20"
                            : "bg-primary text-black shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]"
                            }`}
                    >
                        {!isExtracting && <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12" />}
                        {isExtracting
                            ? <span className="flex items-center justify-center gap-3"><Activity size={18} className="animate-pulse" /> Procesando datos...</span>
                            : <span className="flex items-center justify-center gap-3"><Play size={18} className="fill-black" /> Iniciar Motor Extractor</span>
                        }
                    </button>
                </div>

                {/* Right Column: Results & Terminal */}
                <div className="lg:col-span-8 flex flex-col gap-8">

                    {/* Terminal View */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center">
                                    <Terminal size={18} className="text-neutral-500" />
                                </div>
                                <h2 className="text-sm font-black text-white uppercase tracking-widest italic font-mono">Terminal Debug</h2>
                            </div>
                            {logs.length > 0 && (
                                <button onClick={() => setLogs([])} className="text-[10px] font-black uppercase text-neutral-700 hover:text-neutral-400 transition-colors tracking-widest">
                                    Limpiar log
                                </button>
                            )}
                        </div>
                        <Card variant="outline" className="h-[400px] bg-[#030303] border-white/5 overflow-hidden flex flex-col shadow-2xl rounded-3xl relative">
                            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-20" />
                            <div className="h-12 bg-white/[0.02] border-b border-white/5 flex items-center px-6 justify-between shrink-0 relative">
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 rounded-full bg-rose-500/40 border border-rose-500/60" />
                                        <div className="w-3 h-3 rounded-full bg-amber-500/40 border border-amber-500/60" />
                                        <div className={`w-3 h-3 rounded-full border ${isExtracting ? "bg-emerald-500/60 border-emerald-500 animate-pulse" : "bg-emerald-500/20 border-emerald-500/40"}`} />
                                    </div>
                                    <span className="text-[10px] font-mono text-neutral-600 tracking-wider">daemon_v2.log • state: {isExtracting ? "BUSY" : "LISTENING"}</span>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] space-y-1.5 scrollbar-thin scrollbar-thumb-white/5">
                                {logs.length === 0 && !isExtracting ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-800">
                                        <Activity size={24} className="stroke-1 opacity-20" />
                                        <p className="italic">Esperando parámetros de entrada...</p>
                                    </div>
                                ) : (
                                    <>
                                        {logs.map(log => (
                                            <div key={log.id} className="flex gap-3 leading-relaxed animate-in fade-in slide-in-from-bottom-1 duration-200">
                                                <span className="text-neutral-800 shrink-0 select-none opacity-50">{log.timestamp}</span>
                                                <span className={`shrink-0 select-none ${levelColor(log.level)}`}>{levelPrefix(log.level)}</span>
                                                <span className={`${levelColor(log.level)} tracking-tight`}>{log.message}</span>
                                            </div>
                                        ))}
                                        {isExtracting && (
                                            <div className="flex gap-2 animate-pulse pl-12">
                                                <span className="text-primary/40 text-lg">_</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        </Card>
                    </section>

                    {/* Staged Content */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Sparkles size={18} className="text-primary" />
                                </div>
                                <h2 className="text-sm font-black text-white uppercase tracking-widest italic">Resultados Listos</h2>
                                {staged.length > 0 && (
                                    <Badge className="bg-primary text-black font-black text-[9px] px-2 py-0.5 rounded-full border-none ml-2">
                                        {staged.length}
                                    </Badge>
                                )}
                            </div>
                            {staged.length > 0 && (
                                <button onClick={() => setStaged([])} className="text-[10px] font-black uppercase text-neutral-700 hover:text-neutral-400 transition-colors tracking-widest">
                                    descartar todo
                                </button>
                            )}
                        </div>

                        {staged.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-white/[0.03] rounded-[3rem] bg-white/[0.01] gap-4">
                                <div className="w-16 h-16 rounded-full bg-white/[0.02] flex items-center justify-center border border-white/5">
                                    <Database size={24} className="text-neutral-800" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-700">Sin datos que procesar</p>
                                    <p className="text-[10px] text-neutral-800 font-medium">Los resultados brutos de la IA aparecerán en este panel</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {staged.map(({ stageId, item }) => (
                                    <div key={stageId} className="group relative p-6 rounded-[2.5rem] bg-[#050505] border border-white/5 hover:border-primary/20 transition-all flex flex-col gap-5 overflow-hidden shadow-2xl">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                        <div className="flex items-start justify-between">
                                            <Badge variant="neutral" className="bg-primary/5 border-primary/20 text-primary text-[8px] font-black px-3 py-1 uppercase tracking-widest h-auto">
                                                {item.source?.source_type || "web"}
                                            </Badge>
                                            <span className="text-[9px] font-mono text-neutral-600 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                                                score: {Math.round((item.metadata?.confidence_score ?? 0) * 100)}%
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            <h4 className="font-bold text-base text-white leading-tight group-hover:text-primary/90 transition-colors">{item.title}</h4>
                                            <p className="text-[11px] text-neutral-500 leading-relaxed font-medium line-clamp-3">{item.description}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(item.metadata?.tags ?? []).slice(0, 3).map((t: string) => (
                                                <span key={t} className="text-[8px] font-black uppercase text-neutral-600 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl">#{t}</span>
                                            ))}
                                        </div>
                                        <div className="flex gap-3 mt-2">
                                            <button
                                                onClick={() => saveItem(stageId, item)}
                                                className="flex-1 flex items-center justify-center gap-2 h-11 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary hover:text-black transition-all"
                                            >
                                                <Save size={14} /> Guardar
                                            </button>
                                            <button
                                                onClick={() => discardItem(stageId)}
                                                className="w-12 h-11 flex items-center justify-center bg-white/[0.02] border border-white/5 text-neutral-700 rounded-2xl hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
