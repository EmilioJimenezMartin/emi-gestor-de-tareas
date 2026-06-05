"use client";

import { useState, useEffect, useRef } from "react";
import {
    TrendingUp, Play, X, Activity, ChevronRight,
    Loader2, RefreshCw, Target, BarChart3, ShoppingBag,
    Users, DollarSign, Tag, Zap, Search,
    ShoppingCart, BookOpen, Flame,
    HelpCircle, Rocket, MessageCircle, Shuffle, ScanSearch,
} from "lucide-react";
import { createApiSocket } from "@/lib/socket";
import { Modal } from "@/components/ui/modal";
import { SectionHeader } from "@/components/ui/section-header";
import { toast } from "sonner";
import { SearchQueryBuilder, type SearchConfig } from "@/components/search/SearchQueryBuilder";

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

export type Mode =
    | "etsy-niches"
    | "amazon-niches"
    | "gumroad-niches"
    | "general"
    | "trends-niches"
    | "opportunity"
    | "amazon-movers"
    | "reddit-niches"
    | "cross-niche"
    | "gap-finder";

export const MODE_STORAGE_KEY: Record<Mode, string> = {
    "etsy-niches": "RADAR_ETSY_RESULT",
    "amazon-niches": "RADAR_AMAZON_RESULT",
    "gumroad-niches": "RADAR_GUMROAD_RESULT",
    "general": "RADAR_GENERAL_RESULT",
    "trends-niches": "RADAR_TRENDS_RESULT",
    "opportunity": "RADAR_OPPORTUNITY_RESULT",
    "amazon-movers": "RADAR_MOVERS_RESULT",
    "reddit-niches": "RADAR_REDDIT_RESULT",
    "cross-niche": "RADAR_CROSS_RESULT",
    "gap-finder": "RADAR_GAP_RESULT",
};

const MOVERS_URL = "https://www.amazon.com/gp/movers-and-shakers/books/154606011";
const REDDIT_URL = "https://www.reddit.com/r/kdp+coloringbooks/new.json?limit=100";

interface NicheRadarProps {
    apiUrl: string;
    niches?: { _id: string; name: string; sourceTitulo?: string }[];
    etsyPresets?: { label: string; url: string }[];
    generalPresets?: { label: string; url: string }[];
    defaultMode?: Mode;
    headerTitle?: React.ReactNode;
    headerSubtitle?: string;
    modeLabels?: { etsy?: string; general?: string };
    /** If provided, overrides the per-mode storage key (useful for app-scoped keys like seamless patterns). */
    storageKey?: string;
    onStorageKeyChange?: (key: string) => void;
}


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

function getModePlatform(m: Mode): SearchConfig["platform"] {
    if (m === "amazon-niches" || m === "amazon-movers") return "amazon";
    if (m === "etsy-niches" || m === "opportunity") return "etsy";
    if (m === "trends-niches" || m === "cross-niche") return "trends";
    if (m === "reddit-niches") return "reddit";
    if (m === "gumroad-niches") return "general";
    return "general";
}

function getModeDefaultUrl(m: Mode): string {
    if (m === "amazon-movers") return MOVERS_URL;
    if (m === "reddit-niches") return REDDIT_URL;
    return "";
}

const RADAR_MODE_LS_KEY = "radar_last_mode";

export function NicheRadar({
    apiUrl,
    niches = [],
    etsyPresets,
    generalPresets,
    defaultMode = "etsy-niches",
    headerTitle,
    headerSubtitle,
    modeLabels,
    storageKey: storageKeyOverride,
    onStorageKeyChange,
}: NicheRadarProps) {
    const restoredMode = (): Mode => {
        if (typeof window === "undefined") return defaultMode;
        const saved = localStorage.getItem(RADAR_MODE_LS_KEY) as Mode | null;
        const valid: Mode[] = ["etsy-niches","amazon-niches","gumroad-niches","general","trends-niches","opportunity","amazon-movers","reddit-niches","cross-niche","gap-finder"];
        return saved && valid.includes(saved) ? saved : defaultMode;
    };

    const [mode, setMode] = useState<Mode>(restoredMode);
    const [searchConfig, setSearchConfig] = useState<SearchConfig>({
        platform: getModePlatform(restoredMode()),
        url: getModeDefaultUrl(restoredMode()),
    });
    const url = searchConfig.url;
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

    // Notify parent of initial mode so radarStorageKey is correct from the start
    useEffect(() => {
        onStorageKeyChange?.(storageKeyOverride ?? MODE_STORAGE_KEY[mode]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const changeMode = (newMode: Mode) => {
        setMode(newMode);
        setSearchConfig({ platform: getModePlatform(newMode), url: getModeDefaultUrl(newMode) });
        onStorageKeyChange?.(storageKeyOverride ?? MODE_STORAGE_KEY[newMode]);
        if (typeof window !== "undefined") localStorage.setItem(RADAR_MODE_LS_KEY, newMode);
    };

    const effectiveStorageKey = storageKeyOverride ?? MODE_STORAGE_KEY[mode];

    // Restore logs and running state from last job on mount
    useEffect(() => {
        fetch(`${apiUrl}/radar/jobs/latest?key=${encodeURIComponent(effectiveStorageKey)}`)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const urlForBackend = mode === "gap-finder" ? "gap-finder" : url.trim();
        if (!urlForBackend) { toast.error("Introduce una URL para analizar"); return; }
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        setGeneralResult(null);
        setLogs([]);
        isFirstLog.current = true;
        const modeLabelMap: Record<Mode, string> = {
            "etsy-niches": "Etsy Nichos",
            "amazon-niches": "Amazon KDP",
            "gumroad-niches": "Gumroad",
            "trends-niches": "Google Trends",
            "general": "Análisis General",
            "opportunity": "Oportunidad",
            "amazon-movers": "Movers & Shakers",
            "reddit-niches": "Reddit KDP",
            "cross-niche": "Cross-Nicho",
            "gap-finder": "Detector Huecos",
        };
        toast.info(`Iniciando análisis · ${modeLabelMap[mode]}...`);
        try {
            const body: Record<string, string> = { url: urlForBackend, mode, geminiModel, storageKey: effectiveStorageKey };
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

    // ── Tab definitions ──────────────────────────────────────────────────────────

    const ROW1_TABS = [
        { id: "etsy-niches" as Mode, label: modeLabels?.etsy ?? "Etsy", icon: ShoppingCart, active: "bg-sky-500/15 border border-sky-500/25 text-sky-300", btn: "bg-gradient-to-r from-sky-500 to-cyan-500" },
        { id: "amazon-niches" as Mode, label: "Amazon KDP", icon: ShoppingBag, active: "bg-orange-500/15 border border-orange-500/25 text-orange-300", btn: "bg-gradient-to-r from-orange-500 to-amber-500" },
        { id: "trends-niches" as Mode, label: "Trends", icon: TrendingUp, active: "bg-emerald-500/15 border border-emerald-500/25 text-emerald-300", btn: "bg-gradient-to-r from-emerald-500 to-teal-500" },
        { id: "general" as Mode, label: modeLabels?.general ?? "General", icon: BarChart3, active: "bg-amber-500/15 border border-amber-500/25 text-amber-300", btn: "bg-gradient-to-r from-amber-500 to-orange-500" },
    ] as const;

    const ROW2_TABS = [
        { id: "gumroad-niches" as Mode, label: "Gumroad", icon: ShoppingCart, active: "bg-emerald-500/15 border border-emerald-500/25 text-emerald-300", btn: "bg-gradient-to-r from-emerald-500 to-green-500" },
        { id: "opportunity" as Mode, label: "Oportunidad", icon: Target, active: "bg-violet-500/15 border border-violet-500/25 text-violet-300", btn: "bg-gradient-to-r from-violet-500 to-purple-500" },
        { id: "amazon-movers" as Mode, label: "Movers", icon: Rocket, active: "bg-rose-500/15 border border-rose-500/25 text-rose-300", btn: "bg-gradient-to-r from-rose-500 to-orange-500" },
        { id: "reddit-niches" as Mode, label: "Reddit KDP", icon: MessageCircle, active: "bg-orange-500/15 border border-orange-500/25 text-orange-300", btn: "bg-gradient-to-r from-orange-500 to-red-500" },
        { id: "cross-niche" as Mode, label: "Cross-Nicho", icon: Shuffle, active: "bg-cyan-500/15 border border-cyan-500/25 text-cyan-300", btn: "bg-gradient-to-r from-cyan-500 to-teal-500" },
        { id: "gap-finder" as Mode, label: "Huecos", icon: ScanSearch, active: "bg-fuchsia-500/15 border border-fuchsia-500/25 text-fuchsia-300", btn: "bg-gradient-to-r from-fuchsia-500 to-pink-500" },
    ] as const;

    const allTabs = [...ROW1_TABS, ...ROW2_TABS];
    const activeTab = allTabs.find(t => t.id === mode);
    const btnStyle = activeTab?.btn ?? "bg-gradient-to-r from-sky-500 to-cyan-500";

    const btnLabel = mode === "etsy-niches" ? <span className="flex items-center justify-center gap-2"><ShoppingCart size={14} className="fill-black" /> Escanear Etsy</span>
        : mode === "amazon-niches" ? <span className="flex items-center justify-center gap-2"><ShoppingBag size={14} className="fill-black" /> Escanear Amazon</span>
        : mode === "gumroad-niches" ? <span className="flex items-center justify-center gap-2"><ShoppingCart size={14} className="fill-black" /> Escanear Gumroad</span>
        : mode === "trends-niches" ? <span className="flex items-center justify-center gap-2"><TrendingUp size={14} className="fill-black" /> Analizar Trends</span>
        : mode === "opportunity" ? <span className="flex items-center justify-center gap-2"><Target size={14} /> Buscar Oportunidades</span>
        : mode === "amazon-movers" ? <span className="flex items-center justify-center gap-2"><Rocket size={14} /> Ver Movers & Shakers</span>
        : mode === "reddit-niches" ? <span className="flex items-center justify-center gap-2"><MessageCircle size={14} /> Analizar Reddit</span>
        : mode === "cross-niche" ? <span className="flex items-center justify-center gap-2"><Shuffle size={14} /> Detectar Cross-Nichos</span>
        : mode === "gap-finder" ? <span className="flex items-center justify-center gap-2"><ScanSearch size={14} /> Buscar Huecos</span>
        : <span className="flex items-center justify-center gap-2"><Play size={14} className="fill-black" /> Analizar Mercado</span>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    icon={<TrendingUp size={20} />}
                    title={headerTitle ?? <><span className="text-white">Radar de </span><span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">Nichos</span></>}
                    subtitle={headerSubtitle ?? "Análisis de mercado con IA · Gemini + llm-scraper · Playwright headless"}
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
                            <p className="text-[11px] text-neutral-500">9 modos de análisis · Gemini + llm-scraper</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            { icon: ShoppingCart, color: "sky", label: "Etsy / Amazon", desc: "Escanea páginas de resultados y extrae todos los productos con señales de demanda (carrito, reseñas, bestseller)." },
                            { icon: Target, color: "violet", label: "Oportunidad", desc: "Mismo escaneo pero con scoring INVERTIDO: prioriza alto carrito + pocas reseñas = nichos con demanda y sin competencia." },
                            { icon: Rocket, color: "rose", label: "Movers & Shakers", desc: "Amazon Movers & Shakers de libros de colorear — los libros que más suben en ranking en las últimas 24h." },
                            { icon: MessageCircle, color: "orange", label: "Reddit KDP", desc: "Analiza posts recientes en r/kdp y r/coloringbooks para detectar nichos que la comunidad está discutiendo." },
                            { icon: TrendingUp, color: "emerald", label: "Trends / Cross-Nicho", desc: "Google Trends para detectar nichos emergentes (Trends) o cruzar categorías adyacentes con KDP (Cross-Nicho)." },
                            { icon: ScanSearch, color: "fuchsia", label: "Detector Huecos", desc: "Sin URL — analiza tu catálogo existente y sugiere nichos adyacentes, audiencias y estilos que te faltan." },
                        ].map(({ icon: Icon, color, label, desc }) => (
                            <div key={label} className={`rounded-2xl border border-${color}-500/15 bg-${color}-500/[0.04] p-3 space-y-2`}>
                                <div className="flex items-center gap-2">
                                    <Icon size={12} className={`text-${color}-400`} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest text-${color}-400`}>{label}</span>
                                </div>
                                <p className="text-[10px] text-neutral-400 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen size={13} className="text-neutral-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Tips</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                                "Escanea página 1 y página 3 del mismo término — la 3 muestra nichos emergentes",
                                "Oportunidad + ordenar por Carrito ASC = nichos vírgenes con demanda real",
                                "Reddit KDP revela lo que los creadores buscan y no encuentran",
                                "Detector Huecos es el único modo sin URL — corre periódicamente",
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

            {/* Mode tabs — 2 rows */}
            <div className="space-y-1">
                {/* Row 1: Standard */}
                <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/8 rounded-2xl w-fit flex-wrap">
                    {ROW1_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = mode === tab.id;
                        return (
                            <button key={tab.id}
                                onClick={() => changeMode(tab.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? tab.active : "text-neutral-600 hover:text-neutral-400"}`}>
                                <Icon size={12} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                {/* Row 2: Advanced */}
                <div className="flex gap-1 p-1 bg-white/[0.02] border border-white/[0.05] rounded-2xl w-fit flex-wrap">
                    <span className="flex items-center self-center px-2 text-[7px] font-black uppercase tracking-[0.2em] text-neutral-700 shrink-0">Avanzado</span>
                    {ROW2_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = mode === tab.id;
                        return (
                            <button key={tab.id}
                                onClick={() => changeMode(tab.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? tab.active : "text-neutral-700 hover:text-neutral-400"}`}>
                                <Icon size={11} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Config + Terminal */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Config */}
                <div className="lg:col-span-4 space-y-4">
                    {/* Gap-finder: special UI — no URL */}
                    {mode === "gap-finder" ? (
                        <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <ScanSearch size={14} className="text-fuchsia-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400">Catálogo actual</span>
                            </div>
                            <p className="text-[10px] text-neutral-400 leading-relaxed">
                                La IA analizará los <span className="text-fuchsia-300 font-black">{niches.length} nichos</span> de tu catálogo y sugerirá sub-nichos adyacentes, audiencias y estilos que no tienes.
                            </p>
                            {niches.length === 0 && (
                                <p className="text-[9px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                                    ⚠ Catálogo vacío — crea algunos nichos primero para obtener mejores sugerencias.
                                </p>
                            )}
                            <div className="space-y-1">
                                {[
                                    { icon: ScanSearch, label: "Sub-nichos adyacentes" },
                                    { icon: Users, label: "Audiencias no representadas" },
                                    { icon: Shuffle, label: "Combinaciones de nichos" },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-2 text-[9px] text-neutral-500">
                                        <Icon size={9} className="text-fuchsia-400/60 shrink-0" />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <SearchQueryBuilder
                            apiUrl={apiUrl}
                            lockPlatform={getModePlatform(mode)}
                            value={searchConfig}
                            onChange={cfg => setSearchConfig(cfg)}
                            extraEtsyPresets={etsyPresets}
                            extraGeneralPresets={generalPresets}
                        />
                    )}

                    {/* Mode-specific info panels */}
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
                                    { icon: ShoppingCart, label: "Personas en carrito (demanda)" },
                                    { icon: Tag, label: "Sub-nicho estimado" },
                                    { icon: Flame, label: "Señal de demanda alta/media/nueva" },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-2 text-[9px] text-neutral-500">
                                        <Icon size={9} className="text-sky-400/60 shrink-0" />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === "gumroad-niches" && (
                        <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15 p-3 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/80">URLs sugeridas</p>
                            <div className="space-y-1 mb-2">
                                {[
                                    "https://gumroad.com/discover?query=coloring+book",
                                    "https://gumroad.com/discover?query=printable",
                                    "https://gumroad.com/discover?query=coloring+pages",
                                ].map(u => (
                                    <button key={u} onClick={() => setSearchConfig({ platform: "general", url: u })}
                                        className="w-full text-left text-[9px] font-mono text-emerald-400/70 hover:text-emerald-300 truncate transition-colors">
                                        {u}
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-1 border-t border-white/5 pt-2">
                                {[
                                    { icon: DollarSign, label: "Nº ventas reales (validación de mercado)" },
                                    { icon: Tag, label: "Precio típico por categoría" },
                                    { icon: Flame, label: "Sub-nichos populares en Gumroad" },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-2 text-[9px] text-neutral-500">
                                        <Icon size={9} className="text-emerald-400/60 shrink-0" />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === "opportunity" && (
                        <div className="rounded-xl bg-violet-500/[0.05] border border-violet-500/15 p-3 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-violet-400/80">Scoring invertido</p>
                            <div className="space-y-1.5">
                                {[
                                    { icon: ShoppingCart, label: "Alto carrito = demanda real", cls: "text-violet-400/60" },
                                    { icon: TrendingUp, label: "Pocas reseñas = baja competencia", cls: "text-violet-400/60" },
                                    { icon: Target, label: "Alta demanda + sin competencia = oportunidad", cls: "text-fuchsia-400/60" },
                                ].map(({ icon: Icon, label, cls }) => (
                                    <div key={label} className="flex items-center gap-2 text-[9px] text-neutral-500">
                                        <Icon size={9} className={`${cls} shrink-0`} />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === "amazon-movers" && (
                        <div className="rounded-xl bg-rose-500/[0.05] border border-rose-500/15 p-3 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-rose-400/80">URL pre-cargada</p>
                            <p className="text-[9px] text-neutral-500 leading-relaxed">Amazon Movers & Shakers para Coloring Books — los libros que más suben en ranking en las últimas 24h.</p>
                            <div className="space-y-1">
                                {[
                                    { icon: Rocket, label: "Libros subiendo en ranking" },
                                    { icon: Flame, label: "Tendencias calientes del día" },
                                    { icon: TrendingUp, label: "Señales de demanda en tiempo real" },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-2 text-[9px] text-neutral-500">
                                        <Icon size={9} className="text-rose-400/60 shrink-0" />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === "reddit-niches" && (
                        <div className="rounded-xl bg-orange-500/[0.05] border border-orange-500/15 p-3 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-orange-400/80">Reddit KDP</p>
                            <p className="text-[9px] text-neutral-500 leading-relaxed">Analiza posts recientes de r/kdp y r/coloringbooks. URL pre-cargada con los posts más nuevos.</p>
                            <div className="space-y-1">
                                {[
                                    { icon: MessageCircle, label: "Nichos que la comunidad pide" },
                                    { icon: Users, label: "Conversaciones activas = demanda real" },
                                    { icon: Flame, label: "Posts con alto upvotes = trending" },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-2 text-[9px] text-neutral-500">
                                        <Icon size={9} className="text-orange-400/60 shrink-0" />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === "trends-niches" && (
                        <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15 p-3 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/80">Datos extraídos</p>
                            <div className="space-y-1">
                                {[
                                    { icon: TrendingUp, label: "Related queries (rising/top)" },
                                    { icon: Activity, label: "Índice de interés relativo" },
                                    { icon: Flame, label: "Breakout → oportunidad KDP" },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-2 text-[9px] text-neutral-500">
                                        <Icon size={9} className="text-emerald-400/60 shrink-0" />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === "cross-niche" && (
                        <div className="rounded-xl bg-cyan-500/[0.05] border border-cyan-500/15 p-3 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-cyan-400/80">Cross-nicho KDP</p>
                            <p className="text-[9px] text-neutral-500 leading-relaxed">Usa una URL de Google Trends de una categoría adyacente (música, gaming, hobbies) para encontrar fans sin coloring books.</p>
                            <div className="space-y-1">
                                {[
                                    { icon: Shuffle, label: "Categoría adyacente → KDP" },
                                    { icon: Users, label: "Comunidades fan sin productos KDP" },
                                    { icon: Target, label: "Nichos vírgenes con audiencia activa" },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-2 text-[9px] text-neutral-500">
                                        <Icon size={9} className="text-cyan-400/60 shrink-0" />
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
                        disabled={isAnalyzing || (mode !== "gap-finder" && !url.trim())}
                        className={`w-full h-12 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] transition-all relative overflow-hidden group shadow-lg ${isAnalyzing
                            ? "bg-sky-600/60 text-white cursor-not-allowed"
                            : `${btnStyle} text-black hover:opacity-90 active:scale-[0.98] disabled:opacity-40 shadow-black/20`
                            }`}
                    >
                        {!isAnalyzing && (mode === "gap-finder" || url.trim()) && (
                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                        )}
                        {isAnalyzing
                            ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Analizando...</span>
                            : btnLabel
                        }
                    </button>

                    {mode === "general" && history.length > 0 && (
                        <div className="space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Historial</span>
                            {history.map((h, i) => (
                                <button key={i}
                                    onClick={() => { setGeneralResult(h.insight); setSearchConfig(c => ({ ...c, url: h.url })); }}
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
                                    <span className="text-[8px] font-mono text-neutral-800 ml-1">radar.log · {mode}</span>
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
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeTab ? `bg-${activeTab.active.split("bg-")[1]?.split(" ")[0]?.replace("/15", "/8")} border border-white/[0.06]` : "bg-white/[0.04] border border-white/8"}`}>
                                {activeTab && <activeTab.icon size={24} className="opacity-30" />}
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-[11px] font-black uppercase tracking-widest text-neutral-700">Sin análisis aún</p>
                                <p className="text-[10px] text-neutral-800">
                                    {mode === "gap-finder" ? "Pulsa el botón para analizar tu catálogo" : "Selecciona una URL o preset y pulsa el botón"}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Analyzing state */}
                    {isAnalyzing && !generalResult && (
                        <div className="flex flex-col items-center justify-center py-14 rounded-2xl gap-4 border border-white/[0.06] bg-white/[0.02]">
                            <Loader2 size={28} className="animate-spin text-neutral-400" />
                            <div className="text-center space-y-1">
                                <p className="text-[11px] font-black uppercase tracking-widest text-neutral-400/80">
                                    {mode === "gap-finder" ? "Analizando tu catálogo..." : mode === "reddit-niches" ? "Leyendo Reddit..." : mode === "cross-niche" ? "Detectando cross-nichos..." : "Analizando con Gemini..."}
                                </p>
                                <p className="text-[10px] text-neutral-600">
                                    {mode === "gap-finder" || mode === "reddit-niches" || mode === "cross-niche" || mode === "trends-niches" ? "Petición HTTP directa + análisis IA" : "Playwright cargando la página · llm-scraper extrayendo datos"}
                                </p>
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
