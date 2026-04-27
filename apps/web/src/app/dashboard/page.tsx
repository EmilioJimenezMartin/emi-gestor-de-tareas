"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
    Terminal, Database, Play, StopCircle, Search, Plus, X,
    Save, Trash2, Globe, BrainCircuit, Filter, Zap, Sparkles,
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
    const [tab, setTab] = useState<"motor" | "inteligencia">("motor");

    const [urls, setUrls] = useState<string[]>([""]);
    const [prompt, setPrompt] = useState("Extrae todos los elementos relevantes con título, descripción, tipo y etiquetas.");
    const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
    const [kwInput, setKwInput] = useState("");
    const [isExtracting, setIsExtracting] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [staged, setStaged] = useState<StagedItem[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const [libraryData, setLibraryData] = useState<any[]>([]);
    const [libTotal, setLibTotal] = useState(0);
    const [libSearch, setLibSearch] = useState("");
    const [libSourceType, setLibSourceType] = useState("");
    const [libLoading, setLibLoading] = useState(false);

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

    useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [logs]);
    useEffect(() => { if (tab === "inteligencia") fetchLibrary() }, [tab, libSearch, libSourceType]);

    const fetchLibrary = async () => {
        setLibLoading(true);
        try {
            const params = new URLSearchParams();
            if (libSearch) params.set("q", libSearch);
            if (libSourceType) params.set("source_type", libSourceType);
            const res = await fetch(`${apiUrl}/extractor/data?${params}`);
            if (res.ok) {
                const json = await res.json();
                setLibraryData(json.data || []);
                setLibTotal(json.total || 0);
            }
        } catch (e) { console.error(e) }
        setLibLoading(false);
    };

    const startExtraction = async () => {
        const validUrls = urls.filter(u => u.trim().length > 0);
        if (validUrls.length === 0) { toast.error("Añade al menos una URL o endpoint de API"); return; }
        if (isExtracting) return;
        setLogs([]);
        setStaged([]);
        setIsExtracting(true);
        try {
            const res = await fetch(`${apiUrl}/extractor/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: validUrls, prompt, excludeKeywords })
            });
            if (!res.ok) throw new Error(await res.text());
        } catch (e: any) {
            toast.error(`Error: ${e?.message ?? "No se pudo conectar"}`);
            setIsExtracting(false);
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
                setLibTotal(t => t + 1);
            } else toast.error("Error al guardar");
        } catch { toast.error("Error de red") }
    };

    const discardItem = (stageId: string) => {
        setStaged(prev => prev.filter(s => s.stageId !== stageId));
    };

    const deleteLibraryItem = async (id: string) => {
        try {
            const res = await fetch(`${apiUrl}/extractor/data/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Eliminado");
                setLibraryData(prev => prev.filter(d => d.id !== id));
                setLibTotal(t => t - 1);
            }
        } catch { toast.error("Error al eliminar") }
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
        <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-in fade-in duration-700">

            {/* ── Header ── */}
            <header className="flex flex-col gap-6 relative">
                <div className="absolute -left-10 -top-10 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none" />
                <div className="flex flex-col gap-2 relative">
                    <div className="flex items-center gap-2 text-primary">
                        <Database size={18} className="sm:size-5" />
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">Capa de Inteligencia</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white italic">
                        Motor <span className="text-primary italic">Extractor</span>
                    </h1>
                    <p className="text-sm sm:text-base text-neutral-500 max-w-2xl font-medium">
                        Extrae, analiza y normaliza datos de cualquier URL o API usando IA. Guarda solo lo que importa.
                    </p>
                </div>
            </header>

            {/* ── Tabs ── */}
            <div className="flex gap-1 p-1 bg-black/40 border border-white/5 backdrop-blur-xl rounded-2xl w-fit">
                {(["motor", "inteligencia"] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${tab === t
                                ? "bg-primary text-black shadow-lg shadow-primary/30"
                                : "text-neutral-500 hover:text-white"
                            }`}
                    >
                        {t === "motor" ? (
                            <span className="flex items-center gap-1.5"><Zap size={11} /> Motor</span>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                <Database size={11} /> Inteligencia
                                {libTotal > 0 && (
                                    <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] font-black ${tab === "inteligencia" ? "bg-black/20" : "bg-primary/20 text-primary"}`}>
                                        {libTotal}
                                    </span>
                                )}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ──────────── TAB: MOTOR ──────────── */}
            {tab === "motor" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-320px)] lg:min-h-[620px] mb-32 md:mb-0">

                    {/* Left: Config Panel */}
                    <div className="lg:col-span-4 flex flex-col gap-5 h-auto lg:h-full lg:overflow-y-auto lg:pr-1">

                        {/* Fuentes */}
                        <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01] p-0">
                            <div className="p-5 border-b border-white/5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                                            <Globe size={14} className="text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-black text-white uppercase tracking-widest">Fuentes</h3>
                                            <p className="text-[9px] text-neutral-600 font-medium">URLs y endpoints API</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setUrls(prev => [...prev, ""])}
                                        className="flex items-center gap-1 text-[9px] font-black text-primary/70 hover:text-primary uppercase tracking-widest transition-colors px-2 py-1 bg-primary/5 border border-primary/10 rounded-lg hover:border-primary/30"
                                    >
                                        <Plus size={10} /> Añadir
                                    </button>
                                </div>
                            </div>
                            <div className="p-5 space-y-2.5">
                                {urls.map((u, i) => (
                                    <div key={i} className="flex gap-2 items-center group">
                                        <div className="relative flex-1">
                                            <ChevronRight size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-700" />
                                            <input
                                                type="url"
                                                value={u}
                                                onChange={e => {
                                                    const n = [...urls]; n[i] = e.target.value;
                                                    setUrls(n);
                                                }}
                                                placeholder="https://example.com  o  https://api.xyz/v1/data"
                                                className="w-full h-10 pl-7 pr-3 bg-white/5 border border-white/5 rounded-xl text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-primary/40 transition-colors font-mono"
                                            />
                                        </div>
                                        {urls.length > 1 && (
                                            <button
                                                onClick={() => setUrls(prev => prev.filter((_, idx) => idx !== i))}
                                                className="text-neutral-700 hover:text-rose-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                                            >
                                                <X size={13} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* AI Prompt */}
                        <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01] p-0">
                            <div className="absolute -right-8 -top-8 w-24 h-24 bg-primary/5 blur-[40px] pointer-events-none" />
                            <div className="p-5 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
                                        <BrainCircuit size={14} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Instrucciones IA</h3>
                                        <p className="text-[9px] text-neutral-600 font-medium">Qué debe extraer el modelo</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 space-y-3">
                                <textarea
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                    rows={4}
                                    placeholder="Extrae todos los elementos con título, descripción, tipo y etiquetas..."
                                    className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder:text-neutral-700 resize-none focus:outline-none focus:border-primary/40 transition-colors leading-relaxed"
                                />
                                <p className="text-[9px] text-neutral-700 leading-relaxed">
                                    Usa lenguaje natural. Ej: «Extrae solo bounties activos con recompensa en euros y marca si están expirados»
                                </p>
                            </div>
                        </Card>

                        {/* Keyword exclusion */}
                        <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01] p-0">
                            <div className="p-5 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 border border-rose-500/20 flex items-center justify-center">
                                        <Filter size={14} className="text-rose-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Palabras a Descartar</h3>
                                        <p className="text-[9px] text-neutral-600 font-medium">Filtra contenido no deseado</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 space-y-3">
                                <div className="flex gap-2">
                                    <input
                                        value={kwInput}
                                        onChange={e => setKwInput(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && addKeyword()}
                                        placeholder="spam, expired, borrador..."
                                        className="flex-1 h-9 bg-white/5 border border-white/5 rounded-xl px-4 text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-rose-500/30 transition-colors"
                                    />
                                    <button
                                        onClick={addKeyword}
                                        className="h-9 px-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500/20 transition-colors"
                                    >
                                        +
                                    </button>
                                </div>
                                {excludeKeywords.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {excludeKeywords.map(kw => (
                                            <span key={kw} className="flex items-center gap-1 text-[9px] font-black uppercase bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-1 rounded-lg">
                                                {kw}
                                                <button onClick={() => setExcludeKeywords(p => p.filter(k => k !== kw))} className="hover:text-white ml-0.5"><X size={9} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* CTA */}
                        <button
                            onClick={startExtraction}
                            disabled={isExtracting}
                            className={`w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all relative overflow-hidden group ${isExtracting
                                    ? "bg-amber-600/80 text-white shadow-[0_0_25px_rgba(217,119,6,0.25)]"
                                    : "bg-primary text-black shadow-[0_0_25px_rgba(var(--primary),0.3)] hover:shadow-[0_0_35px_rgba(var(--primary),0.5)]"
                                }`}
                        >
                            {!isExtracting && <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />}
                            {isExtracting
                                ? <span className="flex items-center justify-center gap-2"><Activity size={16} className="animate-pulse" /> Extrayendo datos...</span>
                                : <span className="flex items-center justify-center gap-2"><Play size={16} className="fill-black" /> Iniciar Extracción</span>
                            }
                        </button>
                    </div>

                    {/* Right: Terminal + Staged results */}
                    <div className="lg:col-span-8 flex flex-col gap-5 h-auto lg:h-full min-h-0">

                        {/* Terminal */}
                        <Card variant="outline" className="h-56 sm:h-64 lg:h-72 bg-[#030303] border-white/5 overflow-hidden flex flex-col shadow-[inset_0_2px_20px_rgba(0,0,0,0.8)] shrink-0">
                            <div className="h-10 bg-white/[0.015] border-b border-white/5 flex items-center px-5 justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500/40 border border-rose-500/60" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40 border border-amber-500/60" />
                                        <div className={`w-2.5 h-2.5 rounded-full border ${isExtracting ? "bg-emerald-500/60 border-emerald-500 animate-pulse" : "bg-emerald-500/20 border-emerald-500/40"}`} />
                                    </div>
                                    <Terminal size={11} className="text-neutral-600" />
                                    <span className="text-[9px] font-mono text-neutral-600">extractor_daemon_v2.sh — {isExtracting ? "RUNNING" : "IDLE"}</span>
                                </div>
                                {logs.length > 0 && (
                                    <button onClick={() => setLogs([])} className="text-[8px] font-black uppercase text-neutral-700 hover:text-neutral-400 transition-colors tracking-widest">clear</button>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-1 scrollbar-none">
                                {logs.length === 0 && !isExtracting ? (
                                    <p className="text-neutral-800 italic">Esperando señal de ignición...</p>
                                ) : (
                                    <>
                                        {logs.map(log => (
                                            <div key={log.id} className="flex gap-2 leading-snug animate-in slide-in-from-bottom-1 duration-150">
                                                <span className="text-neutral-800 shrink-0 select-none">{log.timestamp}</span>
                                                <span className={`shrink-0 select-none ${levelColor(log.level)}`}>{levelPrefix(log.level)}</span>
                                                <span className={levelColor(log.level)}>{log.message}</span>
                                            </div>
                                        ))}
                                        {isExtracting && (
                                            <div className="flex gap-2 animate-pulse">
                                                <span className="text-neutral-800 select-none">···</span>
                                                <span className="text-primary/50">_</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        </Card>

                        {/* Staged results */}
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xs font-black text-white uppercase tracking-widest italic">
                                        Resultados Pendientes
                                    </h3>
                                    {staged.length > 0 && (
                                        <Badge variant="neutral" className="text-[8px] font-black bg-primary/10 text-primary border-primary/20">
                                            {staged.length} nuevos
                                        </Badge>
                                    )}
                                </div>
                                {staged.length > 0 && (
                                    <button onClick={() => setStaged([])} className="text-[8px] font-black uppercase text-neutral-700 hover:text-neutral-400 transition-colors tracking-widest">
                                        descartar todos
                                    </button>
                                )}
                            </div>

                            {staged.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-neutral-800 gap-4 py-14 border border-dashed border-white/[0.04] rounded-2xl">
                                    <Sparkles size={40} className="text-white/[0.03] stroke-1" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-700">Los resultados de la IA aparecerán aquí</p>
                                    <p className="text-[9px] text-neutral-800">Pulsa «Iniciar Extracción» con al menos una URL</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
                                    {staged.map(({ stageId, item }) => (
                                        <div key={stageId} className="group relative p-5 rounded-2xl bg-black/40 border border-white/5 hover:border-primary/20 transition-all flex flex-col gap-3 overflow-hidden">
                                            <div className="absolute top-0 left-0 w-0.5 h-full bg-gradient-to-b from-primary/60 via-primary/30 to-transparent group-hover:from-primary transition-colors" />
                                            <div className="flex items-start justify-between gap-2 pl-2">
                                                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md shrink-0">
                                                    {item.source?.source_type || "web"}
                                                </span>
                                                {item.metadata?.confidence_score && (
                                                    <span className="text-[8px] font-mono text-neutral-600">
                                                        conf. {Math.round((item.metadata.confidence_score ?? 0) * 100)}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="pl-2">
                                                <h4 className="font-bold text-sm text-white line-clamp-2 leading-tight mb-1.5">{item.title}</h4>
                                                <p className="text-[10px] text-neutral-500 line-clamp-3 leading-relaxed">{item.description}</p>
                                            </div>
                                            {(item.metadata?.tags ?? []).length > 0 && (
                                                <div className="flex flex-wrap gap-1 pl-2">
                                                    {item.metadata.tags.slice(0, 4).map((t: string) => (
                                                        <span key={t} className="text-[7px] font-black uppercase text-neutral-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">{t}</span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex gap-2 pl-2">
                                                <button
                                                    onClick={() => saveItem(stageId, item)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 h-8 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500/20 transition-all"
                                                >
                                                    <Save size={10} /> Guardar
                                                </button>
                                                <button
                                                    onClick={() => discardItem(stageId)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 h-8 bg-white/[0.03] border border-white/5 text-neutral-600 text-[9px] font-black uppercase tracking-widest rounded-xl hover:border-rose-500/20 hover:text-rose-500/70 transition-all"
                                                >
                                                    <X size={10} /> Descartar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ──────────── TAB: INTELIGENCIA ──────────── */}
            {tab === "inteligencia" && (
                <div className="space-y-6 mb-32 md:mb-0">

                    {/* Filters bar */}
                    <Card variant="outline" className="p-4 sm:p-5 border-white/5 bg-white/[0.01]">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={13} />
                                <input
                                    placeholder="Buscar títulos, descripciones, fuentes..."
                                    className="w-full h-10 pl-10 bg-white/5 border border-white/5 rounded-xl text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-primary/40 transition-colors"
                                    value={libSearch}
                                    onChange={e => setLibSearch(e.target.value)}
                                />
                            </div>
                            <select
                                className="h-10 bg-white/5 border border-white/5 rounded-xl px-4 text-xs font-bold text-white appearance-none focus:outline-none focus:border-primary/40 sm:w-44"
                                value={libSourceType}
                                onChange={e => setLibSourceType(e.target.value)}
                            >
                                <option value="">Todas las fuentes</option>
                                <option value="web">Web</option>
                                <option value="api">API</option>
                                <option value="rss">RSS</option>
                                <option value="manual">Manual</option>
                            </select>
                            <button
                                onClick={fetchLibrary}
                                className="h-10 px-5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary/20 transition-colors shrink-0"
                            >
                                Refrescar
                            </button>
                        </div>
                    </Card>

                    {/* Header row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-black text-white tracking-tighter italic">Base de Inteligencia</h2>
                            <span className="bg-white/10 text-neutral-300 px-2 py-0.5 rounded text-[9px] uppercase tracking-widest border border-white/10">MongoDB</span>
                        </div>
                        <Badge variant="neutral" className="text-[9px] font-black bg-primary/10 text-primary border-primary/20">
                            {libTotal} registros
                        </Badge>
                    </div>

                    {/* Grid */}
                    {libLoading ? (
                        <div className="flex items-center justify-center py-20 gap-3 text-neutral-700">
                            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Cargando registros...</span>
                        </div>
                    ) : libraryData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-20 border border-dashed border-white/[0.04] rounded-2xl text-neutral-800">
                            <Database size={48} className="text-white/[0.03] stroke-1" />
                            <p className="text-[10px] font-black uppercase tracking-widest">La bóveda de inteligencia está vacía</p>
                            <p className="text-[9px]">Usa el Motor para extraer y guardar registros</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {libraryData.map((data, i) => (
                                <div key={data.id || i} className="group relative p-5 rounded-2xl bg-black/40 border border-white/5 hover:border-white/10 transition-all flex flex-col gap-3 overflow-hidden">
                                    <div className="absolute top-0 left-0 w-0.5 h-full bg-gradient-to-b from-primary/40 via-primary/20 to-transparent group-hover:from-primary/70 transition-colors" />
                                    <div className="flex items-start justify-between gap-2 pl-2">
                                        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md shrink-0">
                                            {data.source?.source_type || "scraped"}
                                        </span>
                                        <span className="text-[8px] text-neutral-700 font-mono whitespace-nowrap">
                                            {data.temporal?.created_at ? new Date(data.temporal.created_at).toLocaleDateString("es-ES") : "—"}
                                        </span>
                                    </div>
                                    <div className="pl-2">
                                        <h4 className="font-bold text-sm text-white line-clamp-2 leading-tight mb-1.5">{data.title}</h4>
                                        <p className="text-[10px] text-neutral-500 line-clamp-3 leading-relaxed">
                                            {data.description || data.content?.raw?.substring(0, 150) || "—"}
                                        </p>
                                    </div>
                                    {(data.metadata?.tags ?? []).length > 0 && (
                                        <div className="flex flex-wrap gap-1 pl-2">
                                            {data.metadata.tags.slice(0, 4).map((t: string) => (
                                                <span key={t} className="text-[7px] font-black uppercase text-neutral-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">{t}</span>
                                            ))}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => deleteLibraryItem(data.id)}
                                        className="pl-2 flex items-center justify-center gap-1.5 w-full h-7 bg-white/[0.02] border border-white/[0.04] text-neutral-700 text-[8px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={9} /> Eliminar registro
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
