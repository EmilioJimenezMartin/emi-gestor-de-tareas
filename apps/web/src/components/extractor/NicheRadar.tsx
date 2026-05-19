"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
    TrendingUp, Globe, Play, X, Activity, ChevronRight,
    Loader2, RefreshCw, Target, BarChart3, ShoppingBag,
    Users, DollarSign, Tag, Zap, Search, AlertCircle,
} from "lucide-react";
import { createApiSocket } from "@/lib/socket";
import { toast } from "sonner";

interface NicheInsight {
    niche: string;
    competition: "low" | "medium" | "high";
    demand: "low" | "medium" | "high";
    trend: "rising" | "stable" | "declining";
    topKeywords: string[];
    priceRange: string;
    topCompetitors: string[];
    entryOpportunity: string;
    buyerProfile: string;
    summary: string;
}

interface LogEntry {
    id: string;
    timestamp: string;
    level: "info" | "success" | "error" | "warning";
    message: string;
}

interface NicheRadarProps {
    apiUrl: string;
    niches?: { _id: string; name: string }[];
}

const PRESET_URLS = [
    { label: "Amazon", placeholder: "https://www.amazon.com/s?k=coloring+book+adults" },
    { label: "Etsy", placeholder: "https://www.etsy.com/search?q=coloring+book" },
    { label: "Google Trends", placeholder: "https://trends.google.com/trends/explore?q=coloring+book" },
];

const LEVEL_COLOR: Record<string, string> = {
    competition: {
        low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        high: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    } as any,
    demand: {
        low: "text-rose-400 bg-rose-500/10 border-rose-500/20",
        medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        high: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    } as any,
    trend: {
        rising: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        stable: "text-sky-400 bg-sky-500/10 border-sky-500/20",
        declining: "text-neutral-400 bg-neutral-500/10 border-neutral-500/20",
    } as any,
};

const TREND_ICON: Record<string, string> = {
    rising: "↑",
    stable: "→",
    declining: "↓",
};

export function NicheRadar({ apiUrl, niches = [] }: NicheRadarProps) {
    const [url, setUrl] = useState("");
    const [nicheName, setNicheName] = useState("");
    const [context, setContext] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [result, setResult] = useState<NicheInsight | null>(null);
    const [showLogs, setShowLogs] = useState(true);
    const [history, setHistory] = useState<{ url: string; insight: NicheInsight; ts: number }[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const isFirstLog = useRef(true);

    useEffect(() => {
        const socket = createApiSocket(apiUrl);
        socket.on("radar:log", (data: any) => {
            setLogs(prev => [...prev, {
                id: Math.random().toString(),
                timestamp: new Date(data.timestamp).toLocaleTimeString(),
                level: data.level || "info",
                message: data.message,
            }]);
        });
        socket.on("radar:result", (data: any) => {
            setResult(data.data);
            if (data.data) setHistory(prev => [{ url, insight: data.data, ts: Date.now() }, ...prev.slice(0, 4)]);
        });
        socket.on("radar:done", () => {
            setIsAnalyzing(false);
            toast.success("Análisis de radar completado");
        });
        socket.on("radar:error", (data: any) => {
            toast.error(data.message ?? "Error en el análisis");
            setIsAnalyzing(false);
        });
        return () => { socket.disconnect(); };
    }, [apiUrl, url]);

    useEffect(() => {
        if (logs.length > 0) {
            if (isFirstLog.current) { isFirstLog.current = false; logsEndRef.current?.scrollIntoView({ behavior: "auto" }); }
            else logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    const analyze = async () => {
        if (!url.trim()) { toast.error("Introduce una URL para analizar"); return; }
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        setResult(null);
        setLogs([]);
        isFirstLog.current = true;
        toast.info("Iniciando análisis con Gemini + llm-scraper...");
        try {
            const res = await fetch(`${apiUrl}/radar/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: url.trim(), nicheName: nicheName.trim(), context: context.trim() }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Error ${res.status}`);
            }
        } catch (e: any) {
            toast.error(e.message ?? "Error al conectar");
            setIsAnalyzing(false);
        }
    };

    const levelColor = (l: string) =>
        l === "success" ? "text-emerald-400" : l === "error" ? "text-rose-400" : l === "warning" ? "text-amber-400" : "text-neutral-500";
    const levelPrefix = (l: string) =>
        l === "success" ? "▶" : l === "error" ? "✕" : l === "warning" ? "▲" : "›";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-xl font-black bg-gradient-to-r from-amber-400 to-orange-300 bg-clip-text text-transparent flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                            <TrendingUp size={18} className="text-amber-400" />
                        </div>
                        Radar de Nichos
                    </h2>
                    <p className="text-xs text-neutral-500 pl-12">
                        Análisis de mercado con IA · Powered by Gemini + llm-scraper · Playwright headless
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Config */}
                <div className="lg:col-span-4 space-y-4">
                    {/* URL Input */}
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                            <Globe size={13} className="text-amber-400/70" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">URL a analizar</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white/[0.025] border border-white/8 rounded-2xl px-4 h-11 focus-within:border-amber-500/40 transition-all">
                            <ChevronRight size={13} className="text-neutral-700 shrink-0" />
                            <input
                                type="url"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && void analyze()}
                                placeholder="https://www.amazon.com/s?k=..."
                                className="flex-1 bg-transparent text-[11px] text-white placeholder:text-neutral-700 focus:outline-none font-mono"
                            />
                            {url && <button onClick={() => setUrl("")} className="text-neutral-700 hover:text-white transition-colors"><X size={11} /></button>}
                        </div>
                        {/* Presets */}
                        <div className="flex gap-1.5 flex-wrap">
                            {PRESET_URLS.map(p => (
                                <button key={p.label}
                                    onClick={() => setUrl(p.placeholder)}
                                    className="text-[8px] font-black uppercase px-2 py-1 rounded-lg bg-white/[0.03] border border-white/8 text-neutral-600 hover:text-amber-400 hover:border-amber-500/20 transition-all">
                                    {p.label} ↗
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Optional niche name (autocomplete from existing niches) */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Target size={13} className="text-violet-400/70" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Nicho objetivo (opcional)</span>
                        </div>
                        <input
                            list="niches-datalist"
                            value={nicheName}
                            onChange={e => setNicheName(e.target.value)}
                            placeholder="Ej: Mandalas zen para adultos"
                            className="w-full h-9 bg-white/[0.025] border border-white/8 rounded-xl px-3 text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/30 transition-all"
                        />
                        <datalist id="niches-datalist">
                            {niches.map(n => <option key={n._id} value={n.name} />)}
                        </datalist>
                    </div>

                    {/* Context */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Search size={13} className="text-sky-400/70" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Contexto adicional</span>
                        </div>
                        <textarea
                            value={context}
                            onChange={e => setContext(e.target.value)}
                            rows={2}
                            placeholder="Ej: Focus en libros de colorear para adultos, precio medio..."
                            className="w-full bg-white/[0.025] border border-white/8 rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/30 transition-all resize-none"
                        />
                    </div>

                    {/* Analyze button */}
                    <button
                        onClick={() => void analyze()}
                        disabled={isAnalyzing || !url.trim()}
                        className={`w-full h-12 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] transition-all relative overflow-hidden group shadow-lg ${isAnalyzing
                            ? "bg-amber-600/60 text-white cursor-not-allowed"
                            : "bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-amber-500/20 active:scale-[0.98] disabled:opacity-40"
                            }`}
                    >
                        {!isAnalyzing && !(!url.trim()) && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />}
                        {isAnalyzing
                            ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Analizando con Gemini...</span>
                            : <span className="flex items-center justify-center gap-2"><Play size={14} className="fill-black" /> Analizar Mercado</span>
                        }
                    </button>

                    {/* History */}
                    {history.length > 0 && (
                        <div className="space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Historial</span>
                            {history.map((h, i) => (
                                <button key={i}
                                    onClick={() => { setResult(h.insight); setUrl(h.url); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/6 hover:border-white/12 text-left transition-all group">
                                    <TrendingUp size={11} className="text-amber-400/50 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-white truncate">{h.insight.niche}</p>
                                        <p className="text-[9px] text-neutral-700 truncate">{h.url}</p>
                                    </div>
                                    <ChevronRight size={10} className="text-neutral-700 group-hover:text-white transition-colors shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Terminal + Result */}
                <div className="lg:col-span-8 space-y-4">
                    {/* Terminal */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-white/8 flex items-center justify-center">
                                    <Activity size={12} className="text-neutral-600" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 font-mono">Log</span>
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${isAnalyzing ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-neutral-700 border border-white/8"}`}>
                                    {isAnalyzing ? "RUNNING" : "IDLE"}
                                </span>
                            </div>
                            <button onClick={() => setShowLogs(v => !v)} className="text-[9px] text-neutral-600 hover:text-white transition-colors font-black uppercase">
                                {showLogs ? "Ocultar" : "Mostrar"}
                            </button>
                        </div>
                        {showLogs && (
                            <div className="h-[160px] rounded-2xl border border-white/8 bg-[#040404] overflow-hidden flex flex-col">
                                <div className="h-8 bg-white/[0.015] border-b border-white/5 flex items-center px-3 gap-1.5 shrink-0">
                                    <div className="w-2 h-2 rounded-full bg-rose-500/40" />
                                    <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                                    <div className={`w-2 h-2 rounded-full ${isAnalyzing ? "bg-emerald-500/60 animate-pulse" : "bg-emerald-500/20"}`} />
                                    <span className="text-[8px] font-mono text-neutral-800 ml-1">radar.log · Gemini + llm-scraper</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 font-mono text-[9px] space-y-0.5">
                                    {logs.length === 0 ? (
                                        <div className="flex items-center justify-center h-full text-neutral-800 italic text-[9px]">Esperando análisis...</div>
                                    ) : (
                                        <>
                                            {logs.map(log => (
                                                <div key={log.id} className="flex gap-2 leading-relaxed animate-in fade-in duration-150">
                                                    <span className="text-neutral-800 shrink-0 opacity-50">{log.timestamp}</span>
                                                    <span className={`shrink-0 ${levelColor(log.level)}`}>{levelPrefix(log.level)}</span>
                                                    <span className={levelColor(log.level)}>{log.message}</span>
                                                </div>
                                            ))}
                                            {isAnalyzing && <div className="animate-pulse pl-8 text-amber-400/40 text-lg">_</div>}
                                        </>
                                    )}
                                    <div ref={logsEndRef} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Result Card */}
                    {!result && !isAnalyzing && (
                        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.01] gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center">
                                <BarChart3 size={24} className="text-amber-400/40" />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-[11px] font-black uppercase tracking-widest text-neutral-700">Sin análisis aún</p>
                                <p className="text-[10px] text-neutral-800">Introduce una URL y pulsa Analizar</p>
                            </div>
                        </div>
                    )}

                    {isAnalyzing && !result && (
                        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-amber-500/10 bg-amber-500/[0.02] gap-4">
                            <Loader2 size={28} className="text-amber-400 animate-spin" />
                            <div className="text-center space-y-1">
                                <p className="text-[11px] font-black uppercase tracking-widest text-amber-400/80">Gemini analizando mercado...</p>
                                <p className="text-[10px] text-neutral-600">Playwright cargando la página · llm-scraper extrayendo datos</p>
                            </div>
                        </div>
                    )}

                    {result && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] overflow-hidden space-y-0">
                            <div className="h-px w-full bg-gradient-to-r from-amber-500/60 via-orange-400/30 to-transparent" />
                            <div className="p-5 space-y-5">
                                {/* Niche name + pills */}
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 mb-1">Nicho analizado</p>
                                        <h3 className="text-lg font-black text-white leading-tight">{result.niche}</h3>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        {(["competition", "demand", "trend"] as const).map(key => (
                                            <span key={key} className={`flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1 rounded-full border ${(LEVEL_COLOR[key] as any)[result[key]]}`}>
                                                {key === "trend" && TREND_ICON[result.trend]}
                                                {key === "competition" ? "Comp." : key === "demand" ? "Demand." : "Tendencia"}:&nbsp;
                                                {result[key]}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Summary */}
                                <p className="text-[11px] text-neutral-400 leading-relaxed border-l-2 border-amber-500/30 pl-3">{result.summary}</p>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Price */}
                                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <DollarSign size={11} className="text-emerald-400" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Precio típico</span>
                                        </div>
                                        <p className="text-sm font-black text-white">{result.priceRange}</p>
                                    </div>
                                    {/* Opportunity */}
                                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <Zap size={11} className="text-amber-400" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Oportunidad</span>
                                        </div>
                                        <p className="text-[10px] text-neutral-300 leading-snug line-clamp-2">{result.entryOpportunity}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Keywords */}
                                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <Tag size={11} className="text-sky-400" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Top Keywords</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {result.topKeywords.slice(0, 6).map(k => (
                                                <span key={k} className="text-[8px] px-1.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 font-black">{k}</span>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Competitors */}
                                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <ShoppingBag size={11} className="text-violet-400" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Competidores</span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {result.topCompetitors.slice(0, 4).map((c, i) => (
                                                <p key={i} className="text-[9px] text-neutral-400 flex items-center gap-1.5">
                                                    <span className="text-neutral-700 tabular-nums w-3">{i + 1}.</span> {c}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Buyer profile */}
                                <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Users size={11} className="text-orange-400" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Perfil del comprador</span>
                                    </div>
                                    <p className="text-[10px] text-neutral-400 leading-relaxed">{result.buyerProfile}</p>
                                </div>

                                {/* Re-analyze */}
                                <button onClick={() => { setResult(null); void analyze(); }}
                                    className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-white/5 border border-white/8 text-[9px] font-black uppercase text-neutral-400 hover:text-white hover:border-white/15 transition-all">
                                    <RefreshCw size={11} /> Analizar de nuevo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Powered by notice */}
            <p className="text-[8px] text-neutral-800 text-center">
                Powered by <span className="text-neutral-600">Google Gemini</span> · <span className="text-neutral-600">llm-scraper</span> · <span className="text-neutral-600">Playwright</span>
            </p>
        </div>
    );
}
