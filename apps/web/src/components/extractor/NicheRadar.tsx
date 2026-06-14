"use client";

import { useState, useEffect, useRef } from "react";
import {
    TrendingUp, Activity,
    Loader2, RefreshCw, Target, BarChart3, ShoppingBag,
    Users, DollarSign, Tag, Zap, Search,
    ShoppingCart, BookOpen, Flame,
    HelpCircle, Rocket, MessageCircle, Shuffle, ScanSearch,
    Send, Package, ChevronDown, Globe,
} from "lucide-react";
import { createApiSocket } from "@/lib/socket";
import { Modal } from "@/components/ui/modal";
import { SectionHeader } from "@/components/ui/section-header";
import { toast } from "sonner";
import { SearchQueryBuilder, type SearchConfig } from "@/components/search/SearchQueryBuilder";
import { useSpeech } from "@/hooks/useSpeech";

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

// ── Category chips ─────────────────────────────────────────────────────────────
const CATEGORIES = [
    { id: "coloring-books", label: "Coloring Books", trendsQ: "coloring book", etsyQ: "coloring+book+pdf", gumroadQ: "coloring book", amazonQ: "coloring+book+adults" },
    { id: "activity-books", label: "Activity Books", trendsQ: "activity book kids", etsyQ: "activity+book+printable", gumroadQ: "activity book", amazonQ: "activity+book+children" },
    { id: "journals", label: "Journals", trendsQ: "journal printable", etsyQ: "journal+printable+pdf", gumroadQ: "journal printable", amazonQ: "journal+printable" },
    { id: "patterns", label: "Patterns", trendsQ: "seamless pattern digital", etsyQ: "seamless+pattern+printable", gumroadQ: "seamless pattern", amazonQ: "seamless+pattern" },
    { id: "stickers", label: "Stickers", trendsQ: "sticker sheet printable", etsyQ: "sticker+sheet+printable+pdf", gumroadQ: "sticker sheet", amazonQ: "sticker+activity+book" },
    { id: "custom", label: "URL personalizada", trendsQ: "", etsyQ: "", gumroadQ: "", amazonQ: "" },
] as const;
type CategoryId = typeof CATEGORIES[number]["id"];

// ── Intent system ──────────────────────────────────────────────────────────────
type Intent = "emergentes" | "oportunidades" | "explorar" | "general";

type IntentModeConfig = {
    id: Mode;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
    needsCategory: boolean;
    autoUrl: (cat: typeof CATEGORIES[number], custom: string) => string;
};

const INTENTS: {
    id: Intent;
    label: string;
    sublabel: string;
    color: string;
    borderColor: string;
    textColor: string;
    bgColor: string;
    modes: IntentModeConfig[];
}[] = [
    {
        id: "emergentes",
        label: "Emergentes",
        sublabel: "Nichos en alza antes de saturarse",
        color: "emerald",
        borderColor: "border-emerald-500/30",
        textColor: "text-emerald-300",
        bgColor: "bg-emerald-500/10",
        modes: [
            { id: "trends-niches", label: "Google Trends", icon: TrendingUp, needsCategory: true, autoUrl: (cat, custom) => cat.id === "custom" ? custom : `https://trends.google.com/trends/explore?q=${encodeURIComponent(cat.trendsQ)}&geo=US&hl=en` },
            { id: "reddit-niches", label: "Reddit KDP", icon: MessageCircle, needsCategory: false, autoUrl: () => REDDIT_URL },
            { id: "cross-niche", label: "Cross-Nicho", icon: Shuffle, needsCategory: true, autoUrl: (cat, custom) => cat.id === "custom" ? custom : `https://trends.google.com/trends/explore?q=${encodeURIComponent(cat.trendsQ + " fan art")}&geo=US&hl=en` },
        ],
    },
    {
        id: "oportunidades",
        label: "Oportunidades",
        sublabel: "Demanda alta, competencia baja",
        color: "violet",
        borderColor: "border-violet-500/30",
        textColor: "text-violet-300",
        bgColor: "bg-violet-500/10",
        modes: [
            { id: "opportunity", label: "Etsy Scoring", icon: Target, needsCategory: true, autoUrl: (cat, custom) => cat.id === "custom" ? custom : `https://www.etsy.com/search?q=${cat.etsyQ}&explicit=1&ship_to=US` },
            { id: "gap-finder", label: "Huecos catálogo", icon: ScanSearch, needsCategory: false, autoUrl: () => "gap-finder" },
            { id: "amazon-movers", label: "Movers & Shakers", icon: Rocket, needsCategory: false, autoUrl: () => MOVERS_URL },
        ],
    },
    {
        id: "explorar",
        label: "Explorar",
        sublabel: "Ver qué está vendiendo ahora",
        color: "sky",
        borderColor: "border-sky-500/30",
        textColor: "text-sky-300",
        bgColor: "bg-sky-500/10",
        modes: [
            { id: "etsy-niches", label: "Etsy", icon: ShoppingCart, needsCategory: true, autoUrl: (cat, custom) => cat.id === "custom" ? custom : `https://www.etsy.com/search?q=${cat.etsyQ}&explicit=1&ship_to=US` },
            { id: "amazon-niches", label: "Amazon KDP", icon: ShoppingBag, needsCategory: true, autoUrl: (cat, custom) => cat.id === "custom" ? custom : `https://www.amazon.com/s?k=${encodeURIComponent(cat.amazonQ)}&rh=n%3A283155` },
            { id: "gumroad-niches", label: "Gumroad", icon: ShoppingCart, needsCategory: true, autoUrl: (cat, custom) => cat.id === "custom" ? custom : `https://gumroad.com/discover?query=${encodeURIComponent(cat.gumroadQ)}&sort=featured` },
        ],
    },
    {
        id: "general",
        label: "General",
        sublabel: "Análisis IA de cualquier URL",
        color: "amber",
        borderColor: "border-amber-500/30",
        textColor: "text-amber-300",
        bgColor: "bg-amber-500/10",
        modes: [
            { id: "general", label: "Análisis General", icon: BarChart3, needsCategory: false, autoUrl: (_cat, custom) => custom },
        ],
    },
];

function getIntentFromMode(m: Mode): Intent {
    if (["trends-niches", "reddit-niches", "cross-niche"].includes(m)) return "emergentes";
    if (["opportunity", "gap-finder", "amazon-movers"].includes(m)) return "oportunidades";
    if (["etsy-niches", "amazon-niches", "gumroad-niches"].includes(m)) return "explorar";
    return "general";
}

function getModePlatform(m: Mode): SearchConfig["platform"] {
    if (m === "amazon-niches" || m === "amazon-movers") return "amazon";
    if (m === "etsy-niches" || m === "opportunity") return "etsy";
    if (m === "trends-niches" || m === "cross-niche") return "trends";
    if (m === "reddit-niches") return "reddit";
    if (m === "gumroad-niches") return "gumroad";
    return "general";
}

const LEVEL_COLOR: Record<string, Record<string, string>> = {
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

const RADAR_MODE_LS_KEY = "radar_last_mode";

interface NicheRadarProps {
    apiUrl: string;
    niches?: { _id: string; name: string; sourceTitulo?: string }[];
    etsyPresets?: { label: string; url: string }[];
    generalPresets?: { label: string; url: string }[];
    defaultMode?: Mode;
    headerTitle?: React.ReactNode;
    headerSubtitle?: string;
    modeLabels?: { etsy?: string; general?: string };
    storageKey?: string;
    onStorageKeyChange?: (key: string) => void;
}

export function NicheRadar({
    apiUrl,
    niches = [],
    etsyPresets,
    generalPresets,
    defaultMode = "trends-niches",
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
    const [intent, setIntent] = useState<Intent>(() => getIntentFromMode(restoredMode()));
    const [category, setCategory] = useState<CategoryId>("coloring-books");
    const [customUrl, setCustomUrl] = useState("");
    const [searchConfig, setSearchConfig] = useState<SearchConfig>({
        platform: getModePlatform(restoredMode()),
        url: "",
    });
    const [nicheName, setNicheName] = useState("");
    const [context, setContext] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [generalResult, setGeneralResult] = useState<NicheInsight | null>(null);
    const [showLogs, setShowLogs] = useState(true);
    const [history, setHistory] = useState<{ url: string; insight: NicheInsight; ts: number }[]>([]);
    const [showHelp, setShowHelp] = useState(false);
    const [launchingAction, setLaunchingAction] = useState<"telegram" | "catalog" | "save" | null>(null);
    const [similarNiches, setSimilarNiches] = useState<Array<{ niche: string; angle: string; audience: string; whyLessCompetition: string; keywordEn: string; _scan?: { score: number; verdict: string } | null; _scanning?: boolean; _saved?: boolean }>>([]);
    const [findingSimilar, setFindingSimilar] = useState(false);
    const [geminiModel, setGeminiModel] = useState("gemini-2.0-flash");
    const logsEndRef = useRef<HTMLDivElement>(null);
    const isFirstLog = useRef(true);
    const activeJobId = useRef<string | null>(null);
    const pendingResultRef = useRef<{ count: number; mode: string } | null>(null);
    const { speak } = useSpeech();

    // Compute the effective URL from category + mode
    const currentIntentConfig = INTENTS.find(i => i.id === intent)!;
    const currentModeConfig = currentIntentConfig.modes.find(m2 => m2.id === mode) ?? currentIntentConfig.modes[0];
    const catObj = CATEGORIES.find(c => c.id === category) ?? CATEGORIES[0];
    const effectiveUrl = currentModeConfig.autoUrl(catObj, category === "custom" ? customUrl : searchConfig.url);

    const needsCategory = currentModeConfig.needsCategory;
    const isNoUrlMode = mode === "gap-finder" || mode === "reddit-niches" || mode === "amazon-movers";

    // Notify parent of initial mode so radarStorageKey is correct from the start
    useEffect(() => {
        onStorageKeyChange?.(storageKeyOverride ?? MODE_STORAGE_KEY[mode]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const changeIntent = (newIntent: Intent) => {
        setIntent(newIntent);
        const intentConfig = INTENTS.find(i => i.id === newIntent)!;
        const newMode = intentConfig.modes[0].id;
        setMode(newMode);
        onStorageKeyChange?.(storageKeyOverride ?? MODE_STORAGE_KEY[newMode]);
        if (typeof window !== "undefined") localStorage.setItem(RADAR_MODE_LS_KEY, newMode);
    };

    const changeMode = (newMode: Mode) => {
        setMode(newMode);
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
                if (data.data) setHistory(prev => [{ url: effectiveUrl, insight: data.data, ts: Date.now() }, ...prev.slice(0, 4)]);
            }
            const count = (data?.data?.nichos_detectados ?? []).length;
            if (count > 0) pendingResultRef.current = { count, mode: data.mode ?? "" };
        });

        socket.on("radar:done", () => {
            setIsAnalyzing(false);
            activeJobId.current = null;
            toast.success("Análisis completado");
            const result = pendingResultRef.current;
            pendingResultRef.current = null;
            if (result && result.count > 0) {
                const word = result.mode === "gap-finder" ? "huecos"
                    : result.mode === "trends-niches" || result.mode === "cross-niche" ? "tendencias"
                    : result.mode === "reddit-niches" ? "posts detectados"
                    : "productos detectados";
                speak(`Radar completado. ${result.count} ${word}.`);
            }
        });

        socket.on("radar:error", (data: any) => {
            toast.error(data.message ?? "Error en el análisis");
            setIsAnalyzing(false);
            activeJobId.current = null;
        });

        return () => { socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl]);

    useEffect(() => {
        if (logs.length > 0 && logsEndRef.current) {
            isFirstLog.current = false;
            const container = logsEndRef.current.parentElement;
            if (container) container.scrollTop = container.scrollHeight;
        }
    }, [logs]);

    const findSimilar = async (insight: NicheInsight) => {
        setFindingSimilar(true);
        setSimilarNiches([]);
        try {
            const res = await fetch(`${apiUrl}/radar/similar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ insight }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Error");
            setSimilarNiches(data.similar ?? []);
            toast.success(`${(data.similar ?? []).length} nichos adyacentes encontrados`);
        } catch (e: any) {
            toast.error(e.message ?? "Error buscando similares");
        } finally {
            setFindingSimilar(false);
        }
    };

    const scanSimilar = async (idx: number) => {
        const item = similarNiches[idx];
        setSimilarNiches(prev => prev.map((s, i) => i === idx ? { ...s, _scanning: true } : s));
        try {
            const res = await fetch(`${apiUrl}/niches/market-scan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keyword: item.keywordEn }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Error");
            setSimilarNiches(prev => prev.map((s, i) => i === idx ? { ...s, _scanning: false, _scan: { score: data.score, verdict: data.verdict } } : s));
        } catch (e: any) {
            setSimilarNiches(prev => prev.map((s, i) => i === idx ? { ...s, _scanning: false, _scan: null } : s));
            toast.error(e.message ?? "Error en scan");
        }
    };

    const saveSimilar = async (idx: number) => {
        const item = similarNiches[idx];
        try {
            const res = await fetch(`${apiUrl}/niches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: item.niche,
                    description: `${item.angle} · Audiencia: ${item.audience}`,
                    notes: `Similar a "${generalResult?.niche}". ${item.whyLessCompetition}`,
                    tags: [item.keywordEn],
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Error");
            setSimilarNiches(prev => prev.map((s, i) => i === idx ? { ...s, _saved: true } : s));
            toast.success(data.duplicate ? "Ya existía — reutilizado" : `Nicho "${item.niche}" guardado`);
        } catch (e: any) {
            toast.error(e.message ?? "Error guardando");
        }
    };

    const launchFromInsight = async (insight: NicheInsight, action: "telegram" | "catalog" | "save") => {
        setLaunchingAction(action);
        try {
            const nicheRes = await fetch(`${apiUrl}/niches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: insight.niche,
                    description: insight.summary,
                    tags: insight.topKeywords.slice(0, 8),
                    competition: insight.competition,
                    demand: insight.demand,
                    notes: `Radar: ${insight.entryOpportunity}`,
                    radarInsight: insight,
                }),
            });
            const nicheData = await nicheRes.json();
            if (!nicheRes.ok) throw new Error(nicheData.error ?? "Error creando nicho");
            const nicheId = nicheData.niche._id;
            if (nicheData.duplicate) toast.info("El nicho ya existía — reutilizando");

            if (action === "save") {
                toast.success(`Nicho "${insight.niche}" guardado con todo su análisis`);
            } else if (action === "telegram") {
                const res = await fetch(`${apiUrl}/autopilot/discover/${nicheId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ force: true }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error ?? "Error lanzando discovery");
                toast.success("Generando imagen… te llegará a Telegram para aceptar el nicho");
            } else {
                const res = await fetch(`${apiUrl}/autopilot/quick-catalog/${nicheId}`, { method: "POST" });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? "Error creando catálogo");
                toast.success(`Catálogo creado con ${data.model} — generando imágenes en cola`);
            }
        } catch (e: any) {
            toast.error(e.message ?? "Error lanzando el nicho");
        } finally {
            setLaunchingAction(null);
        }
    };

    const analyze = async () => {
        const urlForBackend = mode === "gap-finder" ? "gap-finder" : effectiveUrl.trim();
        if (!urlForBackend && mode !== "gap-finder") { toast.error("Introduce una URL para analizar"); return; }
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        setGeneralResult(null);
        setLogs([]);
        isFirstLog.current = true;
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

    // Btn gradient per intent
    const intentGradient: Record<Intent, string> = {
        emergentes: "from-emerald-500 to-teal-500",
        oportunidades: "from-violet-500 to-purple-500",
        explorar: "from-sky-500 to-cyan-500",
        general: "from-amber-500 to-orange-500",
    };

    const canRun = mode === "gap-finder" || mode === "reddit-niches" || mode === "amazon-movers" || (category !== "custom" ? true : customUrl.trim().length > 0);

    // Mode description per mode
    const modeDesc: Record<Mode, string> = {
        "trends-niches": "Detecta términos RISING y Breakout en Google Trends — solo nichos emergentes, no los ya saturados.",
        "reddit-niches": "Lee r/kdp + r/coloringbooks en busca de nichos pedidos por la comunidad.",
        "cross-niche": "Cruza una categoría adyacente (música, gaming, hobbies) con KDP para encontrar fans sin coloring books.",
        "opportunity": "Escanea Etsy con scoring invertido: alto carrito + pocas reseñas = oportunidad crítica.",
        "gap-finder": "Analiza tu catálogo actual y detecta sub-nichos, audiencias y estilos que te faltan.",
        "amazon-movers": "Los libros que más suben en Amazon en las últimas 24h — señales de demanda en tiempo real.",
        "etsy-niches": "Escanea Etsy y extrae todos los productos con señales de demanda.",
        "amazon-niches": "Escanea Amazon KDP y extrae bestsellers, reseñas y micro-nichos.",
        "gumroad-niches": "Escanea Gumroad para encontrar productos digitales creativos con ventas reales.",
        "general": "Análisis libre de cualquier URL con análisis completo de competencia, demanda y tendencia.",
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    icon={<TrendingUp size={20} />}
                    title={headerTitle ?? <><span className="text-white">Radar de </span><span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">Nichos</span></>}
                    subtitle={headerSubtitle ?? "Detecta nichos emergentes antes de que exploten · Gemini + Playwright"}
                    color="amber"
                    size="lg"
                />
                <button
                    onClick={() => setShowHelp(true)}
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
                            <p className="text-[11px] text-neutral-500">4 intenciones · 10 modos · Gemini + llm-scraper</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            { icon: TrendingUp, color: "emerald", label: "Emergentes", desc: "Trends + Reddit + Cross-Nicho: detecta nichos en alza antes de que el mercado se sature. Solo extrae señales RISING y Breakout." },
                            { icon: Target, color: "violet", label: "Oportunidades", desc: "Scoring invertido: prioriza alto carrito + pocas reseñas. Huecos en catálogo: detecta lo que te falta. Movers: lo que sube en 24h." },
                            { icon: ShoppingCart, color: "sky", label: "Explorar", desc: "Escanea Etsy, Amazon KDP o Gumroad para ver qué está vendiendo. Útil para validar que el mercado existe." },
                            { icon: BarChart3, color: "amber", label: "General", desc: "Análisis completo de cualquier URL: competencia, demanda, perfil del comprador, keywords. Ideal para validar un nicho específico." },
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
                            <Flame size={13} className="text-amber-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Tips para nichos emergentes</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                                "Emergentes → Trends muestra SOLO queries rising/breakout, nunca los ya populares",
                                "Oportunidad → busca carrito > 5 con reseñas < 100 = nicho crítico sin competencia",
                                "Reddit KDP revela lo que los creadores buscan y no encuentran en el mercado",
                                "Huecos en catálogo: el único modo sin URL — corre periodicamente para completar tu catálogo",
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

            {/* ── Intent selector ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {INTENTS.map(intentConfig => {
                    const isActive = intent === intentConfig.id;
                    return (
                        <button
                            key={intentConfig.id}
                            onClick={() => changeIntent(intentConfig.id)}
                            className={`flex flex-col items-start gap-1 px-4 py-3 rounded-2xl border transition-all text-left ${
                                isActive
                                    ? `${intentConfig.bgColor} ${intentConfig.borderColor}`
                                    : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]"
                            }`}
                        >
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? intentConfig.textColor : "text-neutral-500"}`}>
                                {intentConfig.label}
                            </span>
                            <span className={`text-[9px] leading-snug ${isActive ? "text-neutral-300" : "text-neutral-700"}`}>
                                {intentConfig.sublabel}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Sub-source pills ── */}
            <div className="flex gap-1.5 flex-wrap">
                {currentIntentConfig.modes.map(modeConfig => {
                    const Icon = modeConfig.icon;
                    const isActive = mode === modeConfig.id;
                    return (
                        <button
                            key={modeConfig.id}
                            onClick={() => changeMode(modeConfig.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                isActive
                                    ? `${currentIntentConfig.bgColor} ${currentIntentConfig.borderColor} ${currentIntentConfig.textColor}`
                                    : "bg-white/[0.02] border-white/[0.06] text-neutral-600 hover:text-neutral-400 hover:border-white/[0.1]"
                            }`}
                        >
                            <Icon size={11} />
                            {modeConfig.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Mode description ── */}
            <p className="text-[10px] text-neutral-500 leading-relaxed px-1">{modeDesc[mode]}</p>

            {/* ── Category chips (only when mode needs a URL) ── */}
            {needsCategory && !isNoUrlMode && (
                <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Categoría</span>
                    <div className="flex gap-1.5 flex-wrap">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setCategory(cat.id)}
                                className={`px-3 py-1.5 rounded-xl border text-[10px] font-black transition-all ${
                                    category === cat.id
                                        ? "bg-white/[0.08] border-white/20 text-white"
                                        : "bg-white/[0.02] border-white/[0.06] text-neutral-600 hover:text-neutral-400 hover:border-white/[0.1]"
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Gap-finder special notice ── */}
            {mode === "gap-finder" && (
                <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <ScanSearch size={14} className="text-fuchsia-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400">Analizando tu catálogo</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-relaxed">
                        La IA analizará los <span className="text-fuchsia-300 font-black">{niches.length} nichos</span> de tu catálogo y sugerirá sub-nichos adyacentes, audiencias no representadas y combinaciones que no tienes.
                    </p>
                    {niches.length === 0 && (
                        <p className="text-[9px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                            Catálogo vacío — crea algunos nichos primero para mejores sugerencias.
                        </p>
                    )}
                </div>
            )}

            {/* ── Reddit/Movers auto-URL notice ── */}
            {(mode === "reddit-niches" || mode === "amazon-movers") && (
                <div className={`rounded-2xl border p-3 flex items-center gap-3 ${mode === "reddit-niches" ? "border-orange-500/20 bg-orange-500/[0.04]" : "border-rose-500/20 bg-rose-500/[0.04]"}`}>
                    <Globe size={14} className={mode === "reddit-niches" ? "text-orange-400 shrink-0" : "text-rose-400 shrink-0"} />
                    <div>
                        <p className={`text-[10px] font-black ${mode === "reddit-niches" ? "text-orange-300" : "text-rose-300"}`}>URL pre-configurada</p>
                        <p className="text-[9px] text-neutral-500 font-mono truncate">{effectiveUrl}</p>
                    </div>
                </div>
            )}

            {/* ── Custom URL input ── */}
            {category === "custom" && needsCategory && !isNoUrlMode && (
                <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">URL personalizada</span>
                    <input
                        value={customUrl}
                        onChange={e => setCustomUrl(e.target.value)}
                        placeholder={mode === "trends-niches" ? "https://trends.google.com/trends/explore?q=..." : mode.includes("etsy") || mode === "opportunity" ? "https://www.etsy.com/search?q=..." : "https://..."}
                        className="w-full h-9 bg-white/[0.025] border border-white/8 rounded-xl px-3 text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-white/20 transition-all font-mono"
                    />
                </div>
            )}

            {/* ── General mode extra fields ── */}
            {mode === "general" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Nicho objetivo (opcional)</span>
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
                    <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Contexto adicional</span>
                        <input
                            value={context}
                            onChange={e => setContext(e.target.value)}
                            placeholder="Ej: Focus en libros de colorear para adultos..."
                            className="w-full h-9 bg-white/[0.025] border border-white/8 rounded-xl px-3 text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/30 transition-all"
                        />
                    </div>
                    {/* General mode also needs URL */}
                    <div className="sm:col-span-2 space-y-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">URL a analizar</span>
                        <SearchQueryBuilder
                            apiUrl={apiUrl}
                            lockPlatform="general"
                            value={searchConfig}
                            onChange={cfg => setSearchConfig(cfg)}
                            extraGeneralPresets={generalPresets}
                        />
                    </div>
                </div>
            )}

            {/* ── Preview of auto-built URL (when not custom, not noUrl) ── */}
            {!isNoUrlMode && category !== "custom" && mode !== "general" && effectiveUrl && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                    <Globe size={10} className="text-neutral-600 shrink-0" />
                    <span className="text-[9px] text-neutral-600 font-mono truncate flex-1">{effectiveUrl}</span>
                    <button
                        onClick={() => setCategory("custom")}
                        className="text-[8px] font-black text-neutral-700 hover:text-neutral-400 transition-colors uppercase tracking-widest shrink-0"
                    >
                        Cambiar
                    </button>
                </div>
            )}

            {/* ── Bottom controls: Model + Run button ── */}
            <div className="flex items-center gap-3">
                {/* Gemini model selector */}
                <div className="flex gap-1 bg-white/[0.02] border border-white/[0.06] rounded-xl p-1">
                    {[
                        { id: "gemini-2.0-flash", label: "Flash 2.0" },
                        { id: "gemini-2.0-flash-lite", label: "Lite" },
                        { id: "gemini-1.5-flash", label: "1.5" },
                    ].map(m => (
                        <button
                            key={m.id}
                            onClick={() => setGeminiModel(m.id)}
                            className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all ${geminiModel === m.id ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-neutral-700 hover:text-neutral-400"}`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* Run button */}
                <button
                    onClick={() => void analyze()}
                    disabled={isAnalyzing || !canRun}
                    className={`flex-1 h-10 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] transition-all relative overflow-hidden group shadow-lg ${
                        isAnalyzing
                            ? "bg-white/[0.06] text-neutral-400 cursor-not-allowed"
                            : `bg-gradient-to-r ${intentGradient[intent]} text-black hover:opacity-90 active:scale-[0.98] disabled:opacity-40`
                    }`}
                >
                    {!isAnalyzing && canRun && (
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                    )}
                    {isAnalyzing
                        ? <span className="flex items-center justify-center gap-2"><Loader2 size={13} className="animate-spin" /> Analizando...</span>
                        : <span className="flex items-center justify-center gap-2"><TrendingUp size={13} /> Buscar nichos {intent === "emergentes" ? "emergentes" : intent === "oportunidades" ? "con oportunidad" : intent === "explorar" ? "en el mercado" : ""}</span>
                    }
                </button>
            </div>

            {/* ── Log terminal ── */}
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

            {/* ── Empty state ── */}
            {!generalResult && !isAnalyzing && logs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.01] gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${currentIntentConfig.bgColor} border ${currentIntentConfig.borderColor}`}>
                        {(() => {
                            const Icon = currentModeConfig.icon;
                            return <Icon size={22} className="opacity-40" />;
                        })()}
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-widest text-neutral-700">
                            {intent === "emergentes" ? "Detecta nichos emergentes" : intent === "oportunidades" ? "Encuentra oportunidades reales" : "Explora el mercado"}
                        </p>
                        <p className="text-[10px] text-neutral-800">
                            {mode === "gap-finder" ? "Pulsa el botón para analizar tu catálogo" : "Selecciona categoría y pulsa el botón"}
                        </p>
                    </div>
                </div>
            )}

            {/* ── General result card ── */}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button onClick={() => void launchFromInsight(generalResult, "save")} disabled={launchingAction !== null}
                                className="flex items-center justify-center gap-2 h-10 rounded-xl bg-white/[0.04] border border-white/10 text-[9px] font-black uppercase text-neutral-300 hover:border-white/25 hover:text-white transition-all disabled:opacity-50">
                                {launchingAction === "save" ? <Loader2 size={11} className="animate-spin" /> : <BookOpen size={11} />}
                                Guardar nicho completo
                            </button>
                            <button onClick={() => void findSimilar(generalResult)} disabled={findingSimilar}
                                className="flex items-center justify-center gap-2 h-10 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-500/10 border border-violet-500/30 text-[9px] font-black uppercase text-violet-300 hover:from-violet-500/30 transition-all disabled:opacity-50">
                                {findingSimilar ? <Loader2 size={11} className="animate-spin" /> : <Shuffle size={11} />}
                                Encontrar similares
                            </button>
                            <button onClick={() => void launchFromInsight(generalResult, "telegram")} disabled={launchingAction !== null}
                                className="flex items-center justify-center gap-2 h-10 rounded-xl bg-gradient-to-r from-sky-500/20 to-blue-500/10 border border-sky-500/30 text-[9px] font-black uppercase text-sky-300 hover:from-sky-500/30 transition-all disabled:opacity-50">
                                {launchingAction === "telegram" ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                                Validar por Telegram
                            </button>
                            <button onClick={() => void launchFromInsight(generalResult, "catalog")} disabled={launchingAction !== null}
                                className="flex items-center justify-center gap-2 h-10 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-[9px] font-black uppercase text-emerald-300 hover:from-emerald-500/30 transition-all disabled:opacity-50">
                                {launchingAction === "catalog" ? <Loader2 size={11} className="animate-spin" /> : <Package size={11} />}
                                Crear catálogo directo
                            </button>
                        </div>
                        <button onClick={() => { setGeneralResult(null); setSimilarNiches([]); void analyze(); }}
                            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-white/5 border border-white/8 text-[9px] font-black uppercase text-neutral-400 hover:text-white hover:border-white/15 transition-all">
                            <RefreshCw size={11} /> Analizar de nuevo
                        </button>

                        {similarNiches.length > 0 && (
                            <div className="space-y-2 pt-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-violet-400/80 flex items-center gap-1.5"><Shuffle size={10} /> Nichos adyacentes</p>
                                {similarNiches.map((s, i) => (
                                    <div key={i} className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-black text-white leading-tight">{s.niche}</p>
                                                <p className="text-[9px] text-neutral-500 mt-0.5">{s.angle} · <span className="text-neutral-400">{s.audience}</span></p>
                                                <p className="text-[9px] text-emerald-400/70 italic mt-0.5">{s.whyLessCompetition}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {s._scan && (
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${s._scan.verdict === "gold" ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400" : s._scan.verdict === "good" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : s._scan.verdict === "saturated" ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-rose-500/15 border-rose-500/30 text-rose-400"}`}>
                                                        {s._scan.verdict === "gold" ? "🥇 " : ""}{s._scan.score}/100
                                                    </span>
                                                )}
                                                <button onClick={() => void scanSimilar(i)} disabled={s._scanning}
                                                    className="h-6 px-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[8px] font-black hover:bg-sky-500/20 transition-all disabled:opacity-50 flex items-center gap-1">
                                                    {s._scanning ? <Loader2 size={8} className="animate-spin" /> : <TrendingUp size={8} />} Scan
                                                </button>
                                                <button onClick={() => void saveSimilar(i)} disabled={s._saved}
                                                    className={`h-6 px-2 rounded-lg border text-[8px] font-black transition-all flex items-center gap-1 ${s._saved ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-white/[0.04] border-white/10 text-neutral-300 hover:border-white/25"}`}>
                                                    {s._saved ? "✓ Guardado" : "Guardar"}
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[8px] font-mono text-neutral-700">→ {s.keywordEn}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {mode === "general" && history.length > 0 && (
                            <div className="space-y-2 pt-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Historial</span>
                                {history.map((h, i) => (
                                    <button key={i}
                                        onClick={() => { setGeneralResult(h.insight); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/6 hover:border-white/12 text-left transition-all group">
                                        <TrendingUp size={11} className="text-amber-400/50 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-white truncate">{h.insight.niche}</p>
                                            <p className="text-[9px] text-neutral-700 truncate">{h.url}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <p className="text-[8px] text-neutral-800 text-center">
                Powered by <span className="text-neutral-600">Google Gemini</span> · <span className="text-neutral-600">llm-scraper</span> · <span className="text-neutral-600">Playwright</span>
            </p>
        </div>
    );
}
