"use client";

import { useState, useEffect, useRef } from "react";
import {
    Terminal, Play, Plus, X, Save, Globe,
    BrainCircuit, Filter, Sparkles, ChevronRight,
    Activity, Database,
} from "lucide-react";
import { createApiSocket } from "@/lib/socket";
import { toast } from "sonner";

export interface LogEntry {
    id: string;
    timestamp: string;
    level: "info" | "success" | "error" | "warning";
    message: string;
}

export interface StagedItem {
    stageId: string;
    item: Record<string, any>;
}

interface MotorExtractorProps {
    apiUrl: string;
    defaultPrompt?: string;
    compact?: boolean;
    onResult?: (item: Record<string, any>) => void;
}

export function MotorExtractor({
    apiUrl,
    defaultPrompt = "Extrae todos los elementos relevantes con título, descripción, tipo y etiquetas.",
    compact = false,
    onResult,
}: MotorExtractorProps) {
    const [urls, setUrls] = useState<{ id: string; value: string }[]>([
        { id: Math.random().toString(), value: "" },
    ]);
    const [prompt, setPrompt] = useState(defaultPrompt);
    const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
    const [kwInput, setKwInput] = useState("");
    const [isExtracting, setIsExtracting] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [staged, setStaged] = useState<StagedItem[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const isFirstLogs = useRef(true);

    useEffect(() => {
        const socket = createApiSocket(apiUrl);
        socket.on("extractor:log", (data: any) => {
            setLogs(prev => [...prev, {
                id: Math.random().toString(),
                timestamp: new Date(data.timestamp).toLocaleTimeString(),
                level: data.level || "info",
                message: data.message,
            }]);
        });
        socket.on("extractor:result", (data: any) => {
            setStaged(prev => [...prev, { stageId: Math.random().toString(), item: data.item }]);
            onResult?.(data.item);
        });
        socket.on("extractor:done", () => {
            setIsExtracting(false);
            toast.success("Extracción finalizada");
        });
        return () => { socket.disconnect(); };
    }, [apiUrl, onResult]);

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
        if (validUrls.length === 0) { toast.error("Añade al menos una URL o endpoint"); return; }
        if (isExtracting) return;
        toast.info("Lanzando motor extractor...");
        setLogs([]);
        setStaged([]);
        setIsExtracting(true);
        try {
            const res = await fetch(`${apiUrl}/extractor/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: validUrls, prompt, excludeKeywords }),
            });
            if (!res.ok) throw new Error((await res.text()) || `Status: ${res.status}`);
        } catch (e: any) {
            toast.error(`Error: ${e?.message ?? "No se pudo conectar"}`);
            setIsExtracting(false);
            setLogs(prev => [...prev, {
                id: "error-" + Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                level: "error",
                message: `[ERROR] No se pudo iniciar: ${e.message}`,
            }]);
        }
    };

    const saveItem = async (stageId: string, item: Record<string, any>) => {
        try {
            const res = await fetch(`${apiUrl}/extractor/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item),
            });
            if (res.ok) {
                toast.success("Guardado en base de datos");
                setStaged(prev => prev.filter(s => s.stageId !== stageId));
            } else toast.error("Error al guardar");
        } catch { toast.error("Error de red"); }
    };

    const discardItem = (stageId: string) => setStaged(prev => prev.filter(s => s.stageId !== stageId));

    const addKeyword = () => {
        const kw = kwInput.trim();
        if (kw && !excludeKeywords.includes(kw)) setExcludeKeywords(prev => [...prev, kw]);
        setKwInput("");
    };

    const levelColor = (l: string) =>
        l === "success" ? "text-emerald-400 font-bold" :
            l === "error" ? "text-rose-400 font-bold" :
                l === "warning" ? "text-amber-400" : "text-neutral-400";

    const levelPrefix = (l: string) =>
        l === "success" ? "▶" : l === "error" ? "✕" : l === "warning" ? "▲" : "›";

    return (
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${compact ? "" : "gap-8"}`}>
            {/* Left Column: Configuration */}
            <div className="lg:col-span-4 flex flex-col gap-5">
                {/* Sources */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                                <Globe size={14} className="text-sky-400" />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400">Fuentes</span>
                        </div>
                        <button
                            onClick={() => setUrls(prev => [...prev, { id: Math.random().toString(), value: "" }])}
                            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-sky-400/70 hover:text-sky-400 transition-all px-2.5 py-1.5 bg-sky-500/5 border border-sky-500/10 rounded-xl hover:border-sky-500/30"
                        >
                            <Plus size={10} /> Añadir
                        </button>
                    </div>
                    <div className="flex flex-col gap-2">
                        {urls.map(u => (
                            <div key={u.id} className="flex gap-2 items-center group">
                                <div className="flex-1 flex items-center gap-3 bg-white/[0.025] border border-white/8 rounded-2xl px-4 h-11 focus-within:border-sky-500/40 focus-within:bg-white/[0.04] transition-all">
                                    <ChevronRight size={13} className="text-neutral-700 shrink-0" />
                                    <input
                                        type="url"
                                        value={u.value}
                                        onChange={e => setUrls(prev => prev.map(item => item.id === u.id ? { ...item, value: e.target.value } : item))}
                                        placeholder="https://amazon.com/s?k=coloring+book"
                                        className="flex-1 bg-transparent text-[11px] text-white placeholder:text-neutral-700 focus:outline-none font-mono"
                                    />
                                </div>
                                {urls.length > 1 && (
                                    <button
                                        onClick={() => setUrls(prev => prev.filter(item => item.id !== u.id))}
                                        className="w-9 h-9 flex items-center justify-center text-neutral-700 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* AI Prompt */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                            <BrainCircuit size={14} className="text-blue-400" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400">Instrucciones IA</span>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            rows={compact ? 3 : 5}
                            placeholder="Extrae elementos con título, descripción, tipo y etiquetas..."
                            className="w-full bg-transparent text-[11px] text-white placeholder:text-neutral-700 resize-none focus:outline-none leading-relaxed"
                        />
                    </div>
                </div>

                {/* Keyword Filter */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                            <Filter size={14} className="text-rose-400" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400">Filtrar</span>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3 space-y-2.5">
                        <div className="flex gap-2">
                            <input
                                value={kwInput}
                                onChange={e => setKwInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && addKeyword()}
                                placeholder="spam, expirado..."
                                className="flex-1 h-9 bg-white/5 border border-white/10 rounded-xl px-3 text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-rose-500/30 transition-colors"
                            />
                            <button onClick={addKeyword} className="h-9 px-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500/20 transition-colors">
                                +
                            </button>
                        </div>
                        {excludeKeywords.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {excludeKeywords.map(kw => (
                                    <span key={kw} className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide">
                                        {kw}
                                        <X size={8} className="cursor-pointer hover:text-white" onClick={() => setExcludeKeywords(p => p.filter(k => k !== kw))} />
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Launch button */}
                <button
                    onClick={startExtraction}
                    disabled={isExtracting}
                    className={`w-full h-12 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] transition-all relative overflow-hidden group shadow-lg ${isExtracting
                        ? "bg-amber-600/80 text-white cursor-not-allowed"
                        : "bg-sky-600 text-white hover:bg-sky-500 shadow-sky-500/20 hover:shadow-sky-500/30 active:scale-[0.98]"
                        }`}
                >
                    {!isExtracting && <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />}
                    {isExtracting
                        ? <span className="flex items-center justify-center gap-2"><Activity size={14} className="animate-pulse" /> Procesando...</span>
                        : <span className="flex items-center justify-center gap-2"><Play size={14} className="fill-white" /> Iniciar Motor Extractor</span>
                    }
                </button>
            </div>

            {/* Right Column: Terminal + Results */}
            <div className="lg:col-span-8 flex flex-col gap-5">
                {/* Terminal */}
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-center">
                                <Terminal size={14} className="text-neutral-500" />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400 font-mono">Terminal</span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isExtracting ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-neutral-600 border border-white/8"}`}>
                                {isExtracting ? "RUNNING" : "IDLE"}
                            </span>
                        </div>
                        {logs.length > 0 && (
                            <button onClick={() => setLogs([])} className="text-[9px] font-black uppercase text-neutral-700 hover:text-neutral-400 transition-colors tracking-widest">
                                Limpiar
                            </button>
                        )}
                    </div>
                    <div className={`rounded-2xl border border-white/8 bg-[#040404] overflow-hidden flex flex-col shadow-2xl ${compact ? "h-[220px]" : "h-[280px]"}`}>
                        <div className="h-9 bg-white/[0.02] border-b border-white/5 flex items-center px-4 gap-2 shrink-0">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/40 border border-rose-500/60" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40 border border-amber-500/60" />
                                <div className={`w-2.5 h-2.5 rounded-full border ${isExtracting ? "bg-emerald-500/60 border-emerald-500 animate-pulse" : "bg-emerald-500/20 border-emerald-500/40"}`} />
                            </div>
                            <span className="text-[9px] font-mono text-neutral-700 tracking-wider">extractor.log</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-1 scrollbar-thin scrollbar-thumb-white/5">
                            {logs.length === 0 && !isExtracting ? (
                                <div className="flex flex-col items-center justify-center h-full gap-2 text-neutral-800">
                                    <Activity size={20} className="stroke-1 opacity-20" />
                                    <p className="italic text-[9px]">Esperando instrucciones...</p>
                                </div>
                            ) : (
                                <>
                                    {logs.map(log => (
                                        <div key={log.id} className="flex gap-2.5 leading-relaxed animate-in fade-in duration-150">
                                            <span className="text-neutral-800 shrink-0 select-none opacity-50 text-[9px]">{log.timestamp}</span>
                                            <span className={`shrink-0 select-none ${levelColor(log.level)}`}>{levelPrefix(log.level)}</span>
                                            <span className={`${levelColor(log.level)} tracking-tight`}>{log.message}</span>
                                        </div>
                                    ))}
                                    {isExtracting && (
                                        <div className="flex gap-2 animate-pulse pl-10">
                                            <span className="text-sky-400/40 text-lg">_</span>
                                        </div>
                                    )}
                                </>
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                </div>

                {/* Staged Results */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <Sparkles size={14} className="text-amber-400" />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400">Resultados</span>
                            {staged.length > 0 && (
                                <span className="text-[9px] font-black bg-amber-500 text-black px-2 py-0.5 rounded-full">{staged.length}</span>
                            )}
                        </div>
                        {staged.length > 0 && (
                            <button onClick={() => setStaged([])} className="text-[9px] font-black uppercase text-neutral-700 hover:text-rose-400 transition-colors tracking-widest">
                                Descartar todo
                            </button>
                        )}
                    </div>

                    {staged.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.01] gap-3">
                            <Database size={22} className="text-neutral-800" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-700">Los resultados aparecerán aquí</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {staged.map(({ stageId, item }) => (
                                <div key={stageId} className="group relative p-4 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-amber-500/20 transition-all flex flex-col gap-3 overflow-hidden">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                            {item.source?.source_type || "web"}
                                        </span>
                                        <span className="text-[8px] font-mono text-neutral-600">
                                            {Math.round((item.metadata?.confidence_score ?? 0) * 100)}%
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-[12px] text-white leading-tight">{item.title}</h4>
                                        <p className="text-[10px] text-neutral-500 leading-relaxed line-clamp-2">{item.description}</p>
                                    </div>
                                    {(item.metadata?.tags ?? []).length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {(item.metadata.tags as string[]).slice(0, 4).map((t) => (
                                                <span key={t} className="text-[8px] font-black text-neutral-600 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded-md">#{t}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2 mt-auto">
                                        <button
                                            onClick={() => saveItem(stageId, item)}
                                            className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-500 hover:text-black transition-all"
                                        >
                                            <Save size={11} /> Guardar
                                        </button>
                                        <button
                                            onClick={() => discardItem(stageId)}
                                            className="w-9 h-9 flex items-center justify-center bg-white/[0.02] border border-white/8 text-neutral-700 rounded-xl hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
