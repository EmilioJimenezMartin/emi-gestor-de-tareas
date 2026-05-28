"use client";

import { useState, useEffect, useRef } from "react";
import {
    TrendingUp, Globe, Play, X, Activity, ChevronRight,
    Loader2, RefreshCw, Target, BarChart3, ShoppingBag,
    Users, DollarSign, Tag, Zap, Search,
    ShoppingCart, ArrowRight, BookOpen, Plus, Flame,
    HelpCircle, Star,
} from "lucide-react";
import { createApiSocket } from "@/lib/socket";
import { Modal } from "@/components/ui/modal";
import { SectionHeader } from "@/components/ui/section-header";
import { toast } from "sonner";

// Re-export shared types so consumers can import from one place
export type { EtsyListing, EtsyNicheResult, RowAction } from "./RadarResultsTable";

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

type Mode = "etsy-niches" | "amazon-niches" | "general";

interface NicheRadarProps {
    apiUrl: string;
    niches?: { _id: string; name: string; sourceTitulo?: string }[];
    etsyPresets?: { label: string; url: string }[];
    generalPresets?: { label: string; url: string }[];
    defaultMode?: Mode;
    headerTitle?: React.ReactNode;
    headerSubtitle?: string;
    modeLabels?: { etsy?: string; general?: string };
    /** Clave de storage de esta app — se envía al backend para que el job lo incluya en el evento radar:result. */
    storageKey: string;
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

const AMAZON_PRESET_URLS = [
    { label: "Coloring Adults", url: "https://www.amazon.com/s?k=coloring+book+adults&rh=n%3A283155" },
    { label: "Mandala Books", url: "https://www.amazon.com/s?k=mandala+coloring+book" },
    { label: "Animal Patterns", url: "https://www.amazon.com/s?k=animal+coloring+book+adults" },
    { label: "KDP Bestsellers", url: "https://www.amazon.com/Best-Sellers-Books-Coloring/zgbs/books/4291/ref=zg_bs_nav_books_3_4" },
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

export function NicheRadar({
    apiUrl,
    niches = [],
    etsyPresets,
    generalPresets,
    defaultMode = "etsy-niches",
    headerTitle,
    headerSubtitle,
    modeLabels,
    storageKey,
}: NicheRadarProps) {
    const [mode, setMode] = useState<Mode>(defaultMode);
    const [url, setUrl] = useState("");
    const [nicheName, setNicheName] = useState("");
    const [context, setContext] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [generalResult, setGeneralResult] = useState<NicheInsight | null>(null);
    const [showLogs, setShowLogs] = useState(true);
    const [history, setHistory] = useState<{ url: string; insight: NicheInsight; ts: number }[]>([]);
    const [showHelp, setShowHelp] = useState(false);
    const [geminiModel, setGeminiModel] = useState("gemini-2.0-flash");
    const logsEndRef = useRef<HTMLDivElement>(null);
    const isFirstLog = useRef(true);
    const activeJobId = useRef<string | null>(null);

    // Restore logs and running state from last job on mount (filtered by this app's storageKey)
    useEffect(() => {
        fetch(`${apiUrl}/radar/jobs/latest?key=${encodeURIComponent(storageKey)}`)
            .then(r => r.json())
            .then(({ job }: any) => {
                if (!job) return;
                const restoredLogs: LogEntry[] = (job.logs ?? []).map((l: any) => ({
                    id: Math.random().toString(),
                    timestamp: new Date(l.timestamp).toLocaleTimeString(),
                    level: l.level,
                    message: l.message,
                }));
                if (job.status === "running") {
                    setIsAnalyzing(true);
                    activeJobId.current = job.jobId;
                    setLogs(restoredLogs);
                } else {
                    setLogs(restoredLogs);
                    if (job.status === "completed" && job.mode === "general") {
                        setGeneralResult(job.result);
                    }
                }
            })
            .catch(() => {});
    }, [apiUrl]);

    // Socket: logs, done, error, general results
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
            // Only handle general mode results here — etsy results are handled by RadarResultsTable
            if (data.mode === "general" && data.data && !data.data.nichos_detectados) {
                setGeneralResult(data.data);
                if (data.data) setHistory(prev => [{ url, insight: data.data, ts: Date.now() }, ...prev.slice(0, 4)]);
            }
        });

        socket.on("radar:done", () => {
            setIsAnalyzing(false);
            activeJobId.current = null;
            toast.success("Análisis completado");
        });

        socket.on("radar:error", (data: any) => {
            toast.error(data.message ?? "Error en el análisis");
            setIsAnalyzing(false);
            activeJobId.current = null;
        });

        return () => { socket.disconnect(); };
    }, [apiUrl, url]);

    useEffect(() => {
        if (logs.length > 0 && logsEndRef.current) {
            isFirstLog.current = false;
            const container = logsEndRef.current.parentElement;
            if (container) container.scrollTop = container.scrollHeight;
        }
    }, [logs]);

    const analyze = async () => {
        if (!url.trim()) { toast.error("Introduce una URL para analizar"); return; }
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        setGeneralResult(null);
        setLogs([]);
        isFirstLog.current = true;
        toast.info(`Iniciando análisis · modo: ${mode === "etsy-niches" ? "Etsy Nichos" : "General"}...`);
        try {
            const body: Record<string, string> = { url: url.trim(), mode, geminiModel, storageKey };
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
            const { jobId } = await res.json().catch(() => ({}));
            if (jobId) activeJobId.current = jobId;
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
                <SectionHeader
                    icon={<TrendingUp size={20} />}
                    title={headerTitle ?? <><span className="text-white">Radar de </span><span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">Nichos</span></>}
                    subtitle={headerSubtitle ?? "Análisis de mercado con IA · Powered by Gemini + llm-scraper · Playwright headless"}
                    color="amber"
                    size="lg"
                />
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
                <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                            <TrendingUp size={18} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="text-base font-black text-white">Radar — Guía de uso</p>
                            <p className="text-[11px] text-neutral-500">Gemini + llm-scraper + Playwright headless</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-sky-500/15 bg-sky-500/[0.04] p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <ShoppingCart size={14} className="text-sky-400" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-sky-400">Modo Etsy</span>
                            </div>
                            <div className="space-y-1.5">
                                {["Selecciona un preset o pega una URL de búsqueda", "Pulsa el botón de escaneo — tarda 30–60 s", "Ordena la tabla por «Carrito» para ver demanda inmediata", "Pulsa el botón de acción en cada fila para guardar", "Exporta a CSV para analizar en Excel"].map((step, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="text-[9px] font-black text-sky-400/70 tabular-nums mt-px shrink-0">{i + 1}.</span>
                                        <span className="text-[10px] text-neutral-400">{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <BarChart3 size={14} className="text-amber-400" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">Análisis General</span>
                            </div>
                            <div className="space-y-1.5">
                                {["Pega la URL de resultados de cualquier marketplace", "Escribe el nicho objetivo (opcional)", "Añade contexto si lo necesitas", "Pulsa «Analizar Mercado»", "Revisa competencia · demanda · tendencia · oportunidad"].map((step, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="text-[9px] font-black text-amber-400/70 tabular-nums mt-px shrink-0">{i + 1}.</span>
                                        <span className="text-[10px] text-neutral-400">{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen size={13} className="text-neutral-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Tips avanzados</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                                "Escanea la página 1 y la página 3 del mismo término — la 3 muestra nichos emergentes sin posicionar",
                                "Usa la tabla CSV en Google Sheets y filtra: bestseller=true AND carrito>5",
                                "Busca términos muy específicos: «octopus coloring page pdf adults»",
                                "El análisis general en Amazon revela el rango de precios exacto",
                            ].map((tip, i) => (
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
                    { id: "etsy-niches" as Mode, label: modeLabels?.etsy ?? "Nichos Etsy", icon: ShoppingCart, active: "bg-sky-500/15 border border-sky-500/25 text-sky-300" },
                    { id: "amazon-niches" as Mode, label: "Amazon KDP", icon: ShoppingBag, active: "bg-orange-500/15 border border-orange-500/25 text-orange-300" },
                    { id: "general" as Mode, label: modeLabels?.general ?? "Análisis General", icon: BarChart3, active: "bg-amber-500/15 border border-amber-500/25 text-amber-300" },
                ] as const).map(tab => {
                    const Icon = tab.icon;
                    const isActive = mode === tab.id;
                    return (
                        <button key={tab.id}
                            onClick={() => { setMode(tab.id); setUrl(""); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? tab.active : "text-neutral-600 hover:text-neutral-400"}`}>
                            <Icon size={12} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Config + Terminal */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Config */}
                <div className="lg:col-span-4 space-y-4">
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
                                placeholder={mode === "etsy-niches" ? "https://www.etsy.com/es/search?q=..." : mode === "amazon-niches" ? "https://www.amazon.com/s?k=..." : "https://www.amazon.com/s?k=..."}
                                className="flex-1 bg-transparent text-[11px] text-white placeholder:text-neutral-700 focus:outline-none font-mono"
                            />
                            {url && <button onClick={() => setUrl("")} className="text-neutral-700 hover:text-white transition-colors"><X size={11} /></button>}
                        </div>

                        {mode === "etsy-niches" ? (
                            <div className="space-y-1.5">
                                <span className="text-[8px] font-black uppercase tracking-widest text-neutral-700">Búsquedas predefinidas</span>
                                <div className="flex flex-col gap-1">
                                    {(etsyPresets ?? ETSY_PRESET_URLS).map(p => (
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
                        ) : mode === "amazon-niches" ? (
                            <div className="space-y-1.5">
                                <span className="text-[8px] font-black uppercase tracking-widest text-neutral-700">Búsquedas predefinidas</span>
                                <div className="flex flex-col gap-1">
                                    {AMAZON_PRESET_URLS.map(p => (
                                        <button key={p.label}
                                            onClick={() => setUrl(p.url)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all text-[9px] font-black uppercase ${url === p.url
                                                ? "bg-orange-500/15 border-orange-500/25 text-orange-300"
                                                : "bg-white/[0.02] border-white/8 text-neutral-600 hover:text-orange-400 hover:border-orange-500/20"
                                                }`}>
                                            <ShoppingBag size={9} />
                                            {p.label} ↗
                                            <span className="font-normal text-neutral-700 normal-case truncate flex-1 text-[8px]">{p.url.split("?k=")[1]?.replace(/\+/g, " ").split("&")[0]}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="rounded-xl bg-orange-500/[0.05] border border-orange-500/15 p-3 space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-orange-400/80">Señales detectadas</p>
                                    <div className="space-y-1">
                                        {[
                                            { icon: Star, label: "Rating + número de reseñas" },
                                            { icon: Tag, label: "Sub-nicho / patrón estimado" },
                                            { icon: Flame, label: "Best Seller / Amazon's Choice" },
                                        ].map(({ icon: Icon, label }) => (
                                            <div key={label} className="flex items-center gap-2 text-[9px] text-neutral-500">
                                                <Icon size={9} className="text-orange-400/60 shrink-0" />
                                                {label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-1.5 flex-wrap">
                                {(generalPresets ?? GENERAL_PRESET_URLS).map(p => (
                                    <button key={p.label}
                                        onClick={() => setUrl(p.url)}
                                        className="text-[8px] font-black uppercase px-2 py-1 rounded-lg bg-white/[0.03] border border-white/8 text-neutral-600 hover:text-amber-400 hover:border-amber-500/20 transition-all">
                                        {p.label} ↗
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

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

                    {mode === "etsy-niches" && (
                        <div className="rounded-xl bg-sky-500/[0.05] border border-sky-500/15 p-3 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-sky-400/80">Señales detectadas</p>
                            <div className="space-y-1">
                                {[
                                    { icon: ShoppingCart, label: "Personas en carrito" },
                                    { icon: Tag, label: "Sub-nicho estimado" },
                                    { icon: Flame, label: "Señal de demanda (alta/media/nueva)" },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-2 text-[9px] text-neutral-500">
                                        <Icon size={9} className="text-sky-400/60 shrink-0" />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Model selector */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Zap size={11} className="text-violet-400/70" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Modelo Gemini</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {[
                                { id: "gemini-2.0-flash", label: "Flash 2.0", hint: "Rápido" },
                                { id: "gemini-2.0-flash-lite", label: "Flash Lite", hint: "Más cuota" },
                                { id: "gemini-1.5-flash", label: "Flash 1.5", hint: "Cuota sep." },
                            ].map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setGeminiModel(m.id)}
                                    className={`flex flex-col items-center gap-0.5 py-2 px-2 rounded-xl border transition-all text-center ${geminiModel === m.id
                                        ? "bg-violet-500/15 border-violet-500/35 text-violet-300"
                                        : "bg-white/[0.02] border-white/8 text-neutral-600 hover:border-violet-500/20 hover:text-violet-400"
                                        }`}
                                >
                                    <span className="text-[10px] font-black">{m.label}</span>
                                    <span className="text-[8px] font-medium opacity-60">{m.hint}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => void analyze()}
                        disabled={isAnalyzing || !url.trim()}
                        className={`w-full h-12 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] transition-all relative overflow-hidden group shadow-lg ${isAnalyzing
                            ? "bg-sky-600/60 text-white cursor-not-allowed"
                            : mode === "etsy-niches"
                                ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-black hover:from-sky-400 hover:to-cyan-400 shadow-sky-500/20 active:scale-[0.98] disabled:opacity-40"
                                : mode === "amazon-niches"
                                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black hover:from-orange-400 hover:to-amber-400 shadow-orange-500/20 active:scale-[0.98] disabled:opacity-40"
                                    : "bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-amber-500/20 active:scale-[0.98] disabled:opacity-40"
                            }`}
                    >
                        {!isAnalyzing && url.trim() && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />}
                        {isAnalyzing
                            ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Analizando con Gemini...</span>
                            : mode === "etsy-niches"
                                ? <span className="flex items-center justify-center gap-2"><ShoppingCart size={14} className="fill-black" /> Escanear Etsy</span>
                                : mode === "amazon-niches"
                                    ? <span className="flex items-center justify-center gap-2"><ShoppingBag size={14} className="fill-black" /> Escanear Amazon</span>
                                    : <span className="flex items-center justify-center gap-2"><Play size={14} className="fill-black" /> Analizar Mercado</span>
                        }
                    </button>

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

                {/* Right: Terminal */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-white/8 flex items-center justify-center">
                                    <Activity size={12} className="text-neutral-600" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 font-mono">Log</span>
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${isAnalyzing ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : logs.length > 0 ? "bg-white/5 text-neutral-600 border border-white/8" : "bg-white/5 text-neutral-700 border border-white/8"}`}>
                                    {isAnalyzing ? "RUNNING" : logs.length > 0 ? `${logs.length} líneas` : "IDLE"}
                                </span>
                            </div>
                            <button onClick={() => setShowLogs(v => !v)} className="text-[9px] text-neutral-600 hover:text-white transition-colors font-black uppercase">
                                {showLogs ? "Ocultar" : "Mostrar"}
                            </button>
                        </div>
                        {showLogs && (
                            <div className="h-[420px] rounded-2xl border border-white/8 bg-[#040404] overflow-hidden flex flex-col">
                                <div className="h-8 bg-white/[0.015] border-b border-white/5 flex items-center px-3 gap-1.5 shrink-0">
                                    <div className="w-2 h-2 rounded-full bg-rose-500/40" />
                                    <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                                    <div className={`w-2 h-2 rounded-full ${isAnalyzing ? "bg-emerald-500/60 animate-pulse" : "bg-emerald-500/20"}`} />
                                    <span className="text-[8px] font-mono text-neutral-800 ml-1">radar.log · Gemini + llm-scraper · {mode === "amazon-niches" ? "amazon" : mode}</span>
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
                    {!generalResult && !isAnalyzing && logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-14 rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.01] gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${mode === "etsy-niches" ? "bg-sky-500/8 border border-sky-500/15" : mode === "amazon-niches" ? "bg-orange-500/8 border border-orange-500/15" : "bg-amber-500/8 border border-amber-500/15"}`}>
                                {mode === "etsy-niches" ? <ShoppingCart size={24} className="text-sky-400/40" /> : mode === "amazon-niches" ? <ShoppingBag size={24} className="text-orange-400/40" /> : <BarChart3 size={24} className="text-amber-400/40" />}
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-[11px] font-black uppercase tracking-widest text-neutral-700">Sin análisis aún</p>
                                <p className="text-[10px] text-neutral-800">
                                    {mode === "etsy-niches" || mode === "amazon-niches" ? "Selecciona una búsqueda predefinida o escribe una URL" : "Introduce una URL y pulsa Analizar"}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Analyzing state */}
                    {isAnalyzing && !generalResult && (
                        <div className={`flex flex-col items-center justify-center py-14 rounded-2xl gap-4 ${mode === "etsy-niches" ? "border border-sky-500/10 bg-sky-500/[0.02]" : mode === "amazon-niches" ? "border border-orange-500/10 bg-orange-500/[0.02]" : "border border-amber-500/10 bg-amber-500/[0.02]"}`}>
                            <Loader2 size={28} className={`animate-spin ${mode === "etsy-niches" ? "text-sky-400" : mode === "amazon-niches" ? "text-orange-400" : "text-amber-400"}`} />
                            <div className="text-center space-y-1">
                                <p className={`text-[11px] font-black uppercase tracking-widest ${mode === "etsy-niches" ? "text-sky-400/80" : mode === "amazon-niches" ? "text-orange-400/80" : "text-amber-400/80"}`}>
                                    {mode === "etsy-niches" ? "Escaneando Etsy con Gemini..." : mode === "amazon-niches" ? "Escaneando Amazon con Gemini..." : "Gemini analizando mercado..."}
                                </p>
                                <p className="text-[10px] text-neutral-600">Playwright cargando la página · llm-scraper extrayendo datos</p>
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
                                        <div className="flex items-center gap-1.5"><DollarSign size={11} className="text-emerald-400" /><span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Precio típico</span></div>
                                        <p className="text-sm font-black text-white">{generalResult.priceRange}</p>
                                    </div>
                                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-1.5">
                                        <div className="flex items-center gap-1.5"><Zap size={11} className="text-amber-400" /><span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Oportunidad</span></div>
                                        <p className="text-[10px] text-neutral-300 leading-snug line-clamp-2">{generalResult.entryOpportunity}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-2">
                                        <div className="flex items-center gap-1.5"><Tag size={11} className="text-sky-400" /><span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Top Keywords</span></div>
                                        <div className="flex flex-wrap gap-1">
                                            {generalResult.topKeywords.slice(0, 6).map(k => (
                                                <span key={k} className="text-[8px] px-1.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 font-black">{k}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-2">
                                        <div className="flex items-center gap-1.5"><ShoppingBag size={11} className="text-cyan-400" /><span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Competidores</span></div>
                                        <div className="space-y-0.5">
                                            {generalResult.topCompetitors.slice(0, 4).map((c, i) => (
                                                <p key={i} className="text-[9px] text-neutral-400 flex items-center gap-1.5"><span className="text-neutral-700 tabular-nums w-3">{i + 1}.</span> {c}</p>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-1.5">
                                    <div className="flex items-center gap-1.5"><Users size={11} className="text-orange-400" /><span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Perfil del comprador</span></div>
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
