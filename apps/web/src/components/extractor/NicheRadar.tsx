"use client";

import { useState, useEffect, useRef } from "react";
import {
    TrendingUp, Globe, Play, X, Activity, ChevronRight,
    Loader2, RefreshCw, Target, BarChart3, ShoppingBag,
    Users, DollarSign, Tag, Zap, Search,
    Star, ShoppingCart, Download, ArrowUpDown, CheckCircle2,
    HelpCircle, ArrowRight, BookOpen, Sparkles,
} from "lucide-react";
import { createApiSocket } from "@/lib/socket";
import { Modal } from "@/components/ui/modal";
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

interface EtsyListing {
    titulo_producto: string;
    precio: string;
    bestseller: boolean;
    personas_carrito: number;
    total_reseñas: number;
    sub_nicho_estimado: string;
}

interface EtsyNicheResult {
    nichos_detectados: EtsyListing[];
}

interface PreNicho {
    nombre: string;
    descripcion: string;
    potencial: "low" | "medium" | "high";
    sub_nichos: string[];
    keywords_clave: string[];
}

interface LogEntry {
    id: string;
    timestamp: string;
    level: "info" | "success" | "error" | "warning";
    message: string;
}

type Mode = "etsy-niches" | "general";
type SortKey = keyof EtsyListing;

interface NicheRadarProps {
    apiUrl: string;
    niches?: { _id: string; name: string }[];
}

const GENERAL_PRESET_URLS = [
    { label: "Amazon", url: "https://www.amazon.com/s?k=coloring+book+adults" },
    { label: "Etsy", url: "https://www.etsy.com/search?q=coloring+book" },
    { label: "Google Trends", url: "https://trends.google.com/trends/explore?q=coloring+book" },
];

const ETSY_PRESET_URLS = [
    { label: "Bold & Easy", url: "https://www.etsy.com/es/search?q=bold+and+easy+coloring+book&page=1" },
    { label: "Coloring PDF Adults", url: "https://www.etsy.com/es/search?q=coloring+pages+pdf+adults&page=1" },
    { label: "Kawaii Digital", url: "https://www.etsy.com/es/search?q=kawaii+coloring+book+digital&page=1" },
];

const LEVEL_COLOR: Record<string, any> = {
    competition: {
        low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        high: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    },
    demand: {
        low: "text-rose-400 bg-rose-500/10 border-rose-500/20",
        medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        high: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    trend: {
        rising: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        stable: "text-sky-400 bg-sky-500/10 border-sky-500/20",
        declining: "text-neutral-400 bg-neutral-500/10 border-neutral-500/20",
    },
};

const TREND_ICON: Record<string, string> = { rising: "↑", stable: "→", declining: "↓" };

function exportCSV(rows: EtsyListing[]) {
    const headers = ["Título", "Precio", "Bestseller", "En carrito", "Reseñas", "Sub-nicho"];
    const lines = [
        headers.join(";"),
        ...rows.map(r => [
            `"${r.titulo_producto.replace(/"/g, '""')}"`,
            r.precio,
            r.bestseller ? "Sí" : "No",
            r.personas_carrito,
            r.total_reseñas,
            `"${r.sub_nicho_estimado.replace(/"/g, '""')}"`,
        ].join(";")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `etsy-niches-${Date.now()}.csv`;
    a.click();
}

export function NicheRadar({ apiUrl, niches = [] }: NicheRadarProps) {
    const [mode, setMode] = useState<Mode>("etsy-niches");
    const [url, setUrl] = useState("");
    const [nicheName, setNicheName] = useState("");
    const [context, setContext] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [etsyResult, setEtsyResult] = useState<EtsyNicheResult | null>(null);
    const [generalResult, setGeneralResult] = useState<NicheInsight | null>(null);
    const [showLogs, setShowLogs] = useState(true);
    const [history, setHistory] = useState<{ url: string; insight: NicheInsight; ts: number }[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>("personas_carrito");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [showHelp, setShowHelp] = useState(false);
    const [preNichos, setPreNichos] = useState<PreNicho[] | null>(null);
    const [isGeneratingPreNichos, setIsGeneratingPreNichos] = useState(false);
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
            if (data.mode === "etsy-niches" || data.data?.nichos_detectados) {
                setEtsyResult(data.data);
            } else {
                setGeneralResult(data.data);
                if (data.data) setHistory(prev => [{ url, insight: data.data, ts: Date.now() }, ...prev.slice(0, 4)]);
            }
        });
        socket.on("radar:done", () => {
            setIsAnalyzing(false);
            toast.success("Análisis completado");
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
        setEtsyResult(null);
        setGeneralResult(null);
        setPreNichos(null);
        setLogs([]);
        isFirstLog.current = true;
        toast.info(`Iniciando análisis · modo: ${mode === "etsy-niches" ? "Etsy Nichos" : "General"}...`);
        try {
            const body: Record<string, string> = { url: url.trim(), mode };
            if (mode === "general") {
                if (nicheName.trim()) body.nicheName = nicheName.trim();
                if (context.trim()) body.context = context.trim();
            }
            const res = await fetch(`${apiUrl}/radar/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as any).error || `Error ${res.status}`);
            }
        } catch (e: any) {
            toast.error(e.message ?? "Error al conectar");
            setIsAnalyzing(false);
        }
    };

    const generatePreNichos = async () => {
        if (!etsyResult?.nichos_detectados?.length) return;
        setIsGeneratingPreNichos(true);
        setPreNichos(null);
        try {
            const res = await fetch(`${apiUrl}/radar/pre-nichos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nichos: etsyResult.nichos_detectados }),
            });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const data = await res.json();
            setPreNichos(data.pre_nichos ?? []);
        } catch (e: any) {
            toast.error(e.message ?? "Error generando pre-nichos");
        } finally {
            setIsGeneratingPreNichos(false);
        }
    };

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("desc"); }
    };

    const sortedRows = etsyResult ? [...etsyResult.nichos_detectados].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === "boolean" && typeof bv === "boolean") return sortDir === "desc" ? (bv ? 1 : 0) - (av ? 1 : 0) : (av ? 1 : 0) - (bv ? 1 : 0);
        if (typeof av === "number" && typeof bv === "number") return sortDir === "desc" ? bv - av : av - bv;
        return sortDir === "desc"
            ? String(bv).localeCompare(String(av))
            : String(av).localeCompare(String(bv));
    }) : [];

    const levelColor = (l: string) =>
        l === "success" ? "text-emerald-400" : l === "error" ? "text-rose-400" : l === "warning" ? "text-amber-400" : "text-neutral-500";
    const levelPrefix = (l: string) =>
        l === "success" ? "▶" : l === "error" ? "✕" : l === "warning" ? "▲" : "›";

    const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
        <button onClick={() => toggleSort(k)}
            className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-widest transition-colors ${sortKey === k ? "text-sky-400" : "text-neutral-600 hover:text-neutral-400"}`}>
            {label}
            <ArrowUpDown size={8} className={sortKey === k ? "text-sky-400" : "text-neutral-700"} />
        </button>
    );

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
                <button
                    onClick={() => setShowHelp(true)}
                    title="Instrucciones de uso"
                    className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-xl bg-white/[0.04] border border-white/8 text-neutral-500 hover:text-amber-400 hover:border-amber-500/25 hover:bg-amber-500/[0.06] transition-all text-[9px] font-black uppercase tracking-widest"
                >
                    <HelpCircle size={12} />
                    Ayuda
                </button>
            </div>

            {/* Help modal */}
            <Modal open={showHelp} onClose={() => setShowHelp(false)} maxWidth="max-w-2xl" showClose zIndex={200}>
                <div className="p-6 space-y-5">
                    {/* Header */}
                    <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                            <TrendingUp size={18} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="text-base font-black text-white">Radar de Nichos — Guía de uso</p>
                            <p className="text-[11px] text-neutral-500">Gemini + llm-scraper + Playwright headless</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Modo Etsy */}
                        <div className="rounded-2xl border border-sky-500/15 bg-sky-500/[0.04] p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <ShoppingCart size={14} className="text-sky-400" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-sky-400">Nichos Etsy</span>
                            </div>
                            <p className="text-[10px] text-neutral-400 leading-relaxed">
                                Extrae señales de demanda real de páginas de resultados de Etsy: bestsellers, productos en carrito activo, reseñas acumuladas y micro-nicho estimado.
                            </p>
                            <div className="space-y-1.5">
                                {[
                                    "Selecciona un preset o pega una URL de búsqueda de Etsy",
                                    "Pulsa «Escanear Etsy» — tarda 30–60 s",
                                    "Ordena la tabla por «Carrito» para ver demanda inmediata",
                                    "Ordena por «Reseñas» para ver nichos establecidos",
                                    "Exporta a CSV para analizar en Excel o Google Sheets",
                                ].map((step, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="text-[9px] font-black text-sky-400/70 tabular-nums mt-px shrink-0">{i + 1}.</span>
                                        <span className="text-[10px] text-neutral-400">{step}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="rounded-xl bg-sky-500/[0.08] border border-sky-500/15 p-2.5 space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-sky-400/80">URLs para archivos digitales</p>
                                {[
                                    "etsy.com/es/search?q=digital+download+svg+bundle",
                                    "etsy.com/es/search?q=printable+wall+art+pdf",
                                    "etsy.com/es/search?q=digital+planner+pdf+2025",
                                    "etsy.com/es/search?q=clip+art+bundle+commercial+use",
                                ].map(url => (
                                    <p key={url} className="text-[8px] font-mono text-neutral-600 truncate">{url}</p>
                                ))}
                            </div>
                        </div>

                        {/* Modo General */}
                        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <BarChart3 size={14} className="text-amber-400" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">Análisis General</span>
                            </div>
                            <p className="text-[10px] text-neutral-400 leading-relaxed">
                                Analiza cualquier marketplace — Amazon, Gumroad, Creative Market, Google Trends — y devuelve un informe de competencia, demanda, tendencia, keywords y oportunidad de entrada.
                            </p>
                            <div className="space-y-1.5">
                                {[
                                    "Pega la URL de resultados de cualquier marketplace",
                                    "Escribe el nicho objetivo (opcional pero recomendado)",
                                    "Añade contexto: qué quieres saber exactamente",
                                    "Pulsa «Analizar Mercado»",
                                    "Revisa competencia · demanda · tendencia · oportunidad",
                                ].map((step, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="text-[9px] font-black text-amber-400/70 tabular-nums mt-px shrink-0">{i + 1}.</span>
                                        <span className="text-[10px] text-neutral-400">{step}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="rounded-xl bg-amber-500/[0.08] border border-amber-500/15 p-2.5 space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/80">Ejemplo de contexto</p>
                                <p className="text-[9px] font-mono text-neutral-500 leading-relaxed italic">
                                    "Busco hueco para un libro digital de colorear a 4–7€, enfocado en adultos, estilo mandala minimalista"
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Interpretación de resultados */}
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={13} className="text-neutral-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Cómo interpretar los resultados</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] text-neutral-500">
                            <div className="space-y-2">
                                <p className="font-black text-neutral-300">Modo Etsy</p>
                                <div className="flex items-start gap-2"><ArrowRight size={10} className="text-sky-400 mt-0.5 shrink-0" /><span><span className="text-sky-400 font-black">Carrito alto (&gt;10)</span> — demanda activa ahora mismo</span></div>
                                <div className="flex items-start gap-2"><ArrowRight size={10} className="text-amber-400 mt-0.5 shrink-0" /><span><span className="text-amber-400 font-black">Bestseller = true</span> — el mercado ya valida ese producto</span></div>
                                <div className="flex items-start gap-2"><ArrowRight size={10} className="text-emerald-400 mt-0.5 shrink-0" /><span><span className="text-emerald-400 font-black">Reseñas &gt;500</span> — nicho establecido, entrada más difícil</span></div>
                                <div className="flex items-start gap-2"><ArrowRight size={10} className="text-neutral-400 mt-0.5 shrink-0" /><span><span className="text-neutral-300 font-black">Sub-nicho</span> — el micro-tema específico del producto</span></div>
                            </div>
                            <div className="space-y-2">
                                <p className="font-black text-neutral-300">Modo General</p>
                                <div className="flex items-start gap-2"><ArrowRight size={10} className="text-emerald-400 mt-0.5 shrink-0" /><span><span className="text-emerald-400 font-black">Competencia baja + Demanda alta</span> — oportunidad ideal</span></div>
                                <div className="flex items-start gap-2"><ArrowRight size={10} className="text-amber-400 mt-0.5 shrink-0" /><span><span className="text-amber-400 font-black">Tendencia rising</span> — el nicho crece, entra pronto</span></div>
                                <div className="flex items-start gap-2"><ArrowRight size={10} className="text-rose-400 mt-0.5 shrink-0" /><span><span className="text-rose-400 font-black">Competencia alta</span> — diferénciate con sub-nicho muy específico</span></div>
                                <div className="flex items-start gap-2"><ArrowRight size={10} className="text-neutral-400 mt-0.5 shrink-0" /><span><span className="text-neutral-300 font-black">Top Keywords</span> — úsalos en el título y tags de Etsy/KDP</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Tips avanzados */}
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen size={13} className="text-neutral-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Tips avanzados</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                                { tip: "Escanea la página 1 y la página 3 del mismo término — la 3 muestra nichos emergentes sin posicionar aún" },
                                { tip: "Usa la tabla CSV en Google Sheets y filtra: bestseller=true AND carrito>5 = nichos de acción inmediata" },
                                { tip: "Busca términos muy específicos: «octopus coloring page pdf adults» en vez de «coloring book»" },
                                { tip: "El análisis general en Amazon revela el rango de precios exacto — fíjate en cuántos tienen 4+ estrellas" },
                            ].map(({ tip }, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <span className="text-amber-400/60 text-[10px] mt-px shrink-0">✦</span>
                                    <span className="text-[10px] text-neutral-500 leading-relaxed">{tip}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Mode tabs */}
            <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/8 rounded-2xl w-fit">
                {([
                    { id: "etsy-niches" as Mode, label: "Nichos Etsy", icon: ShoppingCart },
                    { id: "general" as Mode, label: "Análisis General", icon: BarChart3 },
                ] as const).map(tab => {
                    const Icon = tab.icon;
                    const active = mode === tab.id;
                    return (
                        <button key={tab.id}
                            onClick={() => { setMode(tab.id); setUrl(""); setEtsyResult(null); setGeneralResult(null); setPreNichos(null); setLogs([]); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active
                                ? tab.id === "etsy-niches"
                                    ? "bg-sky-500/15 border border-sky-500/25 text-sky-300"
                                    : "bg-amber-500/15 border border-amber-500/25 text-amber-300"
                                : "text-neutral-600 hover:text-neutral-400"
                                }`}>
                            <Icon size={12} />
                            {tab.label}
                        </button>
                    );
                })}
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
                                placeholder={mode === "etsy-niches" ? "https://www.etsy.com/es/search?q=..." : "https://www.amazon.com/s?k=..."}
                                className="flex-1 bg-transparent text-[11px] text-white placeholder:text-neutral-700 focus:outline-none font-mono"
                            />
                            {url && <button onClick={() => setUrl("")} className="text-neutral-700 hover:text-white transition-colors"><X size={11} /></button>}
                        </div>

                        {/* Presets */}
                        {mode === "etsy-niches" ? (
                            <div className="space-y-1.5">
                                <span className="text-[8px] font-black uppercase tracking-widest text-neutral-700">Búsquedas predefinidas</span>
                                <div className="flex flex-col gap-1">
                                    {ETSY_PRESET_URLS.map(p => (
                                        <button key={p.label}
                                            onClick={() => setUrl(p.url)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all text-[9px] font-black uppercase ${url === p.url
                                                ? "bg-sky-500/15 border-sky-500/25 text-sky-300"
                                                : "bg-white/[0.02] border-white/8 text-neutral-600 hover:text-sky-400 hover:border-sky-500/20"
                                                }`}>
                                            <ShoppingCart size={9} />
                                            {p.label} ↗
                                            <span className="font-normal text-neutral-700 normal-case truncate flex-1 text-[8px]">{p.url.split("?q=")[1]?.replace(/\+/g, " ").replace("&page=1", "")}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-1.5 flex-wrap">
                                {GENERAL_PRESET_URLS.map(p => (
                                    <button key={p.label}
                                        onClick={() => setUrl(p.url)}
                                        className="text-[8px] font-black uppercase px-2 py-1 rounded-lg bg-white/[0.03] border border-white/8 text-neutral-600 hover:text-amber-400 hover:border-amber-500/20 transition-all">
                                        {p.label} ↗
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* General mode extras */}
                    {mode === "general" && (
                        <>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Target size={13} className="text-amber-400/70" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Nicho objetivo (opcional)</span>
                                </div>
                                <input
                                    list="niches-datalist"
                                    value={nicheName}
                                    onChange={e => setNicheName(e.target.value)}
                                    placeholder="Ej: Mandalas zen para adultos"
                                    className="w-full h-9 bg-white/[0.025] border border-white/8 rounded-xl px-3 text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/30 transition-all"
                                />
                                <datalist id="niches-datalist">
                                    {niches.map(n => <option key={n._id} value={n.name} />)}
                                </datalist>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Search size={13} className="text-sky-400/70" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Contexto adicional</span>
                                </div>
                                <textarea
                                    value={context}
                                    onChange={e => setContext(e.target.value)}
                                    rows={2}
                                    placeholder="Ej: Focus en libros de colorear para adultos..."
                                    className="w-full bg-white/[0.025] border border-white/8 rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/30 transition-all resize-none"
                                />
                            </div>
                        </>
                    )}

                    {/* Etsy mode info */}
                    {mode === "etsy-niches" && (
                        <div className="rounded-xl bg-sky-500/[0.05] border border-sky-500/15 p-3 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-sky-400/80">Señales detectadas</p>
                            <div className="space-y-1">
                                {[
                                    { icon: Star, label: "Bestseller badge" },
                                    { icon: ShoppingCart, label: "Personas en carrito" },
                                    { icon: Users, label: "Total de reseñas" },
                                    { icon: Tag, label: "Sub-nicho estimado" },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-2 text-[9px] text-neutral-500">
                                        <Icon size={9} className="text-sky-400/60 shrink-0" />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Analyze button */}
                    <button
                        onClick={() => void analyze()}
                        disabled={isAnalyzing || !url.trim()}
                        className={`w-full h-12 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] transition-all relative overflow-hidden group shadow-lg ${isAnalyzing
                            ? "bg-sky-600/60 text-white cursor-not-allowed"
                            : mode === "etsy-niches"
                                ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-black hover:from-sky-400 hover:to-cyan-400 shadow-sky-500/20 active:scale-[0.98] disabled:opacity-40"
                                : "bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-amber-500/20 active:scale-[0.98] disabled:opacity-40"
                            }`}
                    >
                        {!isAnalyzing && url.trim() && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />}
                        {isAnalyzing
                            ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Analizando con Gemini...</span>
                            : mode === "etsy-niches"
                                ? <span className="flex items-center justify-center gap-2"><ShoppingCart size={14} className="fill-black" /> Escanear Etsy</span>
                                : <span className="flex items-center justify-center gap-2"><Play size={14} className="fill-black" /> Analizar Mercado</span>
                        }
                    </button>

                    {/* General mode history */}
                    {mode === "general" && history.length > 0 && (
                        <div className="space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Historial</span>
                            {history.map((h, i) => (
                                <button key={i}
                                    onClick={() => { setGeneralResult(h.insight); setUrl(h.url); }}
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
                            <div className="h-[140px] rounded-2xl border border-white/8 bg-[#040404] overflow-hidden flex flex-col">
                                <div className="h-8 bg-white/[0.015] border-b border-white/5 flex items-center px-3 gap-1.5 shrink-0">
                                    <div className="w-2 h-2 rounded-full bg-rose-500/40" />
                                    <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                                    <div className={`w-2 h-2 rounded-full ${isAnalyzing ? "bg-emerald-500/60 animate-pulse" : "bg-emerald-500/20"}`} />
                                    <span className="text-[8px] font-mono text-neutral-800 ml-1">radar.log · Gemini + llm-scraper · {mode}</span>
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
                                            {isAnalyzing && <div className="animate-pulse pl-8 text-sky-400/40 text-lg">_</div>}
                                        </>
                                    )}
                                    <div ref={logsEndRef} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Empty state */}
                    {!etsyResult && !generalResult && !isAnalyzing && (
                        <div className="flex flex-col items-center justify-center py-14 rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.01] gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${mode === "etsy-niches" ? "bg-sky-500/8 border border-sky-500/15" : "bg-amber-500/8 border border-amber-500/15"}`}>
                                {mode === "etsy-niches" ? <ShoppingCart size={24} className="text-sky-400/40" /> : <BarChart3 size={24} className="text-amber-400/40" />}
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-[11px] font-black uppercase tracking-widest text-neutral-700">Sin análisis aún</p>
                                <p className="text-[10px] text-neutral-800">
                                    {mode === "etsy-niches" ? "Selecciona una búsqueda predefinida o escribe una URL de Etsy" : "Introduce una URL y pulsa Analizar"}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Analyzing state */}
                    {isAnalyzing && !etsyResult && !generalResult && (
                        <div className={`flex flex-col items-center justify-center py-14 rounded-2xl gap-4 ${mode === "etsy-niches" ? "border border-sky-500/10 bg-sky-500/[0.02]" : "border border-amber-500/10 bg-amber-500/[0.02]"}`}>
                            <Loader2 size={28} className={`animate-spin ${mode === "etsy-niches" ? "text-sky-400" : "text-amber-400"}`} />
                            <div className="text-center space-y-1">
                                <p className={`text-[11px] font-black uppercase tracking-widest ${mode === "etsy-niches" ? "text-sky-400/80" : "text-amber-400/80"}`}>
                                    {mode === "etsy-niches" ? "Escaneando Etsy con Gemini..." : "Gemini analizando mercado..."}
                                </p>
                                <p className="text-[10px] text-neutral-600">Playwright cargando la página · llm-scraper extrayendo datos</p>
                            </div>
                        </div>
                    )}

                    {/* Etsy result table */}
                    {etsyResult && mode === "etsy-niches" && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] overflow-hidden">
                            <div className="h-px w-full bg-gradient-to-r from-sky-500/60 via-cyan-400/30 to-transparent" />
                            <div className="p-4 space-y-3">
                                {/* Table header */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-sky-400" />
                                        <span className="text-[11px] font-black text-white">{etsyResult.nichos_detectados.length} productos detectados</span>
                                        {etsyResult.nichos_detectados.filter(r => r.bestseller).length > 0 && (
                                            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-400">
                                                {etsyResult.nichos_detectados.filter(r => r.bestseller).length} bestsellers
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => exportCSV(sortedRows)}
                                            className="flex items-center gap-1.5 h-7 px-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[9px] font-black uppercase hover:bg-sky-500/20 transition-all">
                                            <Download size={10} /> CSV
                                        </button>
                                        <button onClick={() => { setEtsyResult(null); setPreNichos(null); void analyze(); }}
                                            className="flex items-center gap-1.5 h-7 px-3 rounded-xl bg-white/5 border border-white/8 text-[9px] font-black uppercase text-neutral-400 hover:text-white hover:border-white/15 transition-all">
                                            <RefreshCw size={10} /> Repetir
                                        </button>
                                    </div>
                                </div>

                                {/* Sort controls */}
                                <div className="flex items-center gap-3 pb-1 border-b border-white/5">
                                    <span className="text-[8px] uppercase tracking-widest text-neutral-700 font-black">Ordenar:</span>
                                    <SortBtn k="personas_carrito" label="Carrito" />
                                    <SortBtn k="total_reseñas" label="Reseñas" />
                                    <SortBtn k="bestseller" label="Bestseller" />
                                    <SortBtn k="precio" label="Precio" />
                                    <SortBtn k="sub_nicho_estimado" label="Sub-nicho" />
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto rounded-xl border border-white/8">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-white/[0.03] border-b border-white/8">
                                                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600">#</th>
                                                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600">Título</th>
                                                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600 text-right">Precio</th>
                                                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600 text-center">BS</th>
                                                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600 text-right">Carrito</th>
                                                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600 text-right">Reseñas</th>
                                                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600">Sub-nicho</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedRows.map((row, i) => (
                                                <tr key={i} className={`border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.02] ${row.bestseller ? "bg-amber-500/[0.03]" : ""}`}>
                                                    <td className="px-3 py-2.5 text-[9px] text-neutral-700 tabular-nums font-black">{i + 1}</td>
                                                    <td className="px-3 py-2.5 max-w-[200px]">
                                                        <p className="text-[10px] text-white font-semibold line-clamp-2 leading-snug">{row.titulo_producto}</p>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        <span className="text-[10px] font-black text-emerald-400 tabular-nums">{row.precio}</span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        {row.bestseller
                                                            ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30"><Star size={9} className="text-amber-400 fill-amber-400" /></span>
                                                            : <span className="text-neutral-800 text-[9px]">—</span>
                                                        }
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        {row.personas_carrito > 0
                                                            ? <span className={`text-[10px] font-black tabular-nums ${row.personas_carrito >= 20 ? "text-sky-400" : row.personas_carrito >= 10 ? "text-sky-400/70" : "text-neutral-400"}`}>{row.personas_carrito >= 20 ? "20+" : row.personas_carrito}</span>
                                                            : <span className="text-neutral-800 text-[9px]">—</span>
                                                        }
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        {row.total_reseñas > 0
                                                            ? <span className={`text-[10px] font-black tabular-nums ${row.total_reseñas >= 1000 ? "text-emerald-400" : row.total_reseñas >= 100 ? "text-emerald-400/70" : "text-neutral-400"}`}>{row.total_reseñas >= 1000 ? `${(row.total_reseñas / 1000).toFixed(1)}k` : row.total_reseñas}</span>
                                                            : <span className="text-neutral-800 text-[9px]">—</span>
                                                        }
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/15 text-sky-400 whitespace-nowrap">{row.sub_nicho_estimado}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pre-nichos section */}
                    {etsyResult && mode === "etsy-niches" && (
                        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] overflow-hidden">
                            <div className="h-px w-full bg-gradient-to-r from-violet-500/60 via-purple-400/30 to-transparent" />
                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={14} className="text-violet-400" />
                                        <span className="text-[11px] font-black text-white">Pre-Nichos</span>
                                        <span className="text-[9px] text-neutral-600">· categorías agrupadas por IA</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {preNichos && !isGeneratingPreNichos && (
                                            <button onClick={() => void generatePreNichos()} disabled={isGeneratingPreNichos}
                                                className="flex items-center gap-1 h-6 px-2 rounded-lg bg-white/5 border border-white/8 text-neutral-600 text-[9px] font-black uppercase hover:text-white transition-all">
                                                <RefreshCw size={9} />
                                            </button>
                                        )}
                                        {!preNichos && (
                                            <button onClick={() => void generatePreNichos()} disabled={isGeneratingPreNichos}
                                                className="flex items-center gap-1.5 h-7 px-3 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-300 text-[9px] font-black uppercase hover:bg-violet-500/25 transition-all disabled:opacity-50">
                                                {isGeneratingPreNichos ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                                {isGeneratingPreNichos ? "Generando..." : "Generar Pre-Nichos"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {isGeneratingPreNichos && (
                                    <div className="flex items-center justify-center py-8 gap-3">
                                        <Loader2 size={18} className="animate-spin text-violet-400" />
                                        <span className="text-[10px] text-neutral-600 font-black uppercase tracking-widest">Gemini agrupando nichos...</span>
                                    </div>
                                )}

                                {preNichos && !isGeneratingPreNichos && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {preNichos.map((pn, i) => (
                                            <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-[11px] font-black text-white leading-tight">{pn.nombre}</p>
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md border shrink-0 ${pn.potencial === "high" ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400" : pn.potencial === "medium" ? "bg-amber-500/15 border-amber-500/25 text-amber-400" : "bg-neutral-500/15 border-neutral-500/25 text-neutral-400"}`}>
                                                        {pn.potencial === "high" ? "Alto" : pn.potencial === "medium" ? "Medio" : "Bajo"}
                                                    </span>
                                                </div>
                                                <p className="text-[9px] text-neutral-500 leading-relaxed">{pn.descripcion}</p>
                                                {pn.keywords_clave?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {pn.keywords_clave.map(k => (
                                                            <span key={k} className="text-[7px] font-black px-1.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/15 text-violet-400">{k}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {pn.sub_nichos?.length > 0 && (
                                                    <div>
                                                        <p className="text-[7px] font-black uppercase tracking-widest text-neutral-700 mb-1">Sub-nichos ({pn.sub_nichos.length})</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {pn.sub_nichos.slice(0, 5).map(s => (
                                                                <span key={s} className="text-[7px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/8 text-neutral-500">{s}</span>
                                                            ))}
                                                            {pn.sub_nichos.length > 5 && <span className="text-[7px] text-neutral-700">+{pn.sub_nichos.length - 5}</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!preNichos && !isGeneratingPreNichos && (
                                    <div className="flex items-center justify-center py-5 opacity-30">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Genera pre-nichos a partir de los resultados del escaneo</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* General result card */}
                    {generalResult && mode === "general" && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] overflow-hidden">
                            <div className="h-px w-full bg-gradient-to-r from-amber-500/60 via-orange-400/30 to-transparent" />
                            <div className="p-5 space-y-5">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 mb-1">Nicho analizado</p>
                                        <h3 className="text-lg font-black text-white leading-tight">{generalResult.niche}</h3>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        {(["competition", "demand", "trend"] as const).map(key => (
                                            <span key={key} className={`flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1 rounded-full border ${(LEVEL_COLOR[key] as any)[generalResult[key]]}`}>
                                                {key === "trend" && TREND_ICON[generalResult.trend]}
                                                {key === "competition" ? "Comp." : key === "demand" ? "Demand." : "Tendencia"}:&nbsp;
                                                {generalResult[key]}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <p className="text-[11px] text-neutral-400 leading-relaxed border-l-2 border-amber-500/30 pl-3">{generalResult.summary}</p>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <DollarSign size={11} className="text-emerald-400" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Precio típico</span>
                                        </div>
                                        <p className="text-sm font-black text-white">{generalResult.priceRange}</p>
                                    </div>
                                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <Zap size={11} className="text-amber-400" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Oportunidad</span>
                                        </div>
                                        <p className="text-[10px] text-neutral-300 leading-snug line-clamp-2">{generalResult.entryOpportunity}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <Tag size={11} className="text-sky-400" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Top Keywords</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {generalResult.topKeywords.slice(0, 6).map(k => (
                                                <span key={k} className="text-[8px] px-1.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 font-black">{k}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <ShoppingBag size={11} className="text-cyan-400" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Competidores</span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {generalResult.topCompetitors.slice(0, 4).map((c, i) => (
                                                <p key={i} className="text-[9px] text-neutral-400 flex items-center gap-1.5">
                                                    <span className="text-neutral-700 tabular-nums w-3">{i + 1}.</span> {c}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Users size={11} className="text-orange-400" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Perfil del comprador</span>
                                    </div>
                                    <p className="text-[10px] text-neutral-400 leading-relaxed">{generalResult.buyerProfile}</p>
                                </div>

                                <button onClick={() => { setGeneralResult(null); void analyze(); }}
                                    className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-white/5 border border-white/8 text-[9px] font-black uppercase text-neutral-400 hover:text-white hover:border-white/15 transition-all">
                                    <RefreshCw size={11} /> Analizar de nuevo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <p className="text-[8px] text-neutral-800 text-center">
                Powered by <span className="text-neutral-600">Google Gemini</span> · <span className="text-neutral-600">llm-scraper</span> · <span className="text-neutral-600">Playwright</span>
            </p>
        </div>
    );
}
