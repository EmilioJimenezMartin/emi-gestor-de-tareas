"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, BarChart2, TrendingUp, Target, Zap, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { KdpVerticalBarChart } from "@/components/ui/kdp-vertical-bar-chart";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RadarInsight {
    _id: string;
    createdAt: string;
    filters: {
        platforms: string[];
        dateRange: string;
        totalProducts: number;
    };
    analysis: {
        summary: string;
        topNiches: { name: string; count: number; platforms: string[] }[];
        emergingNiches: { name: string; reason: string; confidence: "high" | "medium" | "low" }[];
        repeatedThemes: { theme: string; count: number }[];
        platformBreakdown: { platform: string; count: number; percentage: number }[];
        recommendations: string[];
    };
    aiProvider: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = [
    { id: "etsy",      label: "Etsy",      icon: "🏪", color: "rose" },
    { id: "amazon",    label: "Amazon",    icon: "🛒", color: "orange" },
    { id: "trends",    label: "Trends",    icon: "📈", color: "emerald" },
    { id: "reddit",    label: "Reddit",    icon: "💬", color: "orange" },
    { id: "cross",     label: "Cross",     icon: "🔀", color: "cyan" },
    { id: "gap",       label: "Gap",       icon: "🔍", color: "fuchsia" },
    { id: "pinterest", label: "Pinterest", icon: "📌", color: "pink" },
    { id: "general",   label: "General",   icon: "🌐", color: "slate" },
] as const;

const DATE_RANGES = [
    { id: "7d",  label: "7 días" },
    { id: "30d", label: "30 días" },
    { id: "90d", label: "90 días" },
    { id: "all", label: "Todo" },
] as const;

const CONFIDENCE_STYLE: Record<string, string> = {
    high:   "bg-emerald-500/15 border-emerald-500/25 text-emerald-400",
    medium: "bg-amber-500/15 border-amber-500/25 text-amber-400",
    low:    "bg-neutral-500/15 border-neutral-500/25 text-neutral-400",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
    apiUrl: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RadarInsightsPanel({ apiUrl }: Props) {
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<string>("all");
    const [analyzing, setAnalyzing] = useState(false);
    const [current, setCurrent] = useState<RadarInsight | null>(null);
    const [history, setHistory] = useState<RadarInsight[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);

    const loadHistory = useCallback(async () => {
        try {
            const res = await fetch(`${apiUrl}/radar/insights`);
            const data = await res.json();
            if (data.insights?.length) {
                setHistory(data.insights);
                if (!current) setCurrent(data.insights[0]);
            }
        } catch { /* ignore */ }
        setHistoryLoaded(true);
    }, [apiUrl, current]);

    useEffect(() => { loadHistory(); }, [apiUrl]); // eslint-disable-line

    const togglePlatform = (id: string) => {
        setSelectedPlatforms(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const analyze = async () => {
        setAnalyzing(true);
        try {
            const res = await fetch(`${apiUrl}/radar/insights/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platforms: selectedPlatforms, dateRange }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
            setCurrent(data.insight);
            setHistory(prev => [data.insight, ...prev.filter(h => h._id !== data.insight._id)]);
            toast.success("Análisis completado");
        } catch (e: any) {
            toast.error(e.message ?? "Error al analizar");
        } finally {
            setAnalyzing(false);
        }
    };

    // ── Derived chart data ────────────────────────────────────────────────────

    const platformItems = current?.analysis.platformBreakdown.map(p => ({
        label: p.platform,
        value: p.count,
    })) ?? [];

    const nicheItems = current?.analysis.topNiches.slice(0, 10).map(n => ({
        label: n.name,
        value: n.count,
    })) ?? [];

    const themeItems = current?.analysis.repeatedThemes.slice(0, 12).map(t => ({
        label: t.theme,
        value: t.count,
    })) ?? [];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5">
            {/* Filters + CTA */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] overflow-hidden">
                <div className="h-px w-full bg-gradient-to-r from-violet-500/60 via-indigo-400/30 to-transparent" />
                <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2">
                        <Sparkles size={13} className="text-violet-400" />
                        <span className="text-[11px] font-black text-white">Análisis inteligente de nichos</span>
                        <span className="text-[9px] text-neutral-600 font-medium">· powered by AI</span>
                    </div>

                    {/* Platform selector */}
                    <div className="space-y-1.5">
                        <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600">Plataformas</span>
                        <div className="flex flex-wrap gap-1.5">
                            {PLATFORMS.map(p => {
                                const active = selectedPlatforms.includes(p.id);
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => togglePlatform(p.id)}
                                        className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${
                                            active
                                                ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                                                : "bg-white/[0.02] border-white/8 text-neutral-500 hover:text-neutral-300 hover:border-white/15"
                                        }`}
                                    >
                                        {p.icon} {p.label}
                                    </button>
                                );
                            })}
                            {selectedPlatforms.length > 0 && (
                                <button
                                    onClick={() => setSelectedPlatforms([])}
                                    className="h-6 px-2 rounded-lg border border-white/8 text-[8px] text-neutral-600 hover:text-neutral-300 hover:border-white/15 transition-all"
                                >
                                    ✕ Todas
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Date range */}
                    <div className="space-y-1.5">
                        <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600">Período</span>
                        <div className="flex gap-1.5">
                            {DATE_RANGES.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => setDateRange(r.id)}
                                    className={`h-6 px-3 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${
                                        dateRange === r.id
                                            ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                                            : "border-white/8 text-neutral-500 hover:text-neutral-300 hover:border-white/15"
                                    }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Analyze button */}
                    <button
                        onClick={analyze}
                        disabled={analyzing}
                        className="flex items-center gap-2 h-9 px-5 rounded-xl bg-gradient-to-r from-violet-600/30 to-indigo-600/30 border border-violet-500/30 text-[10px] font-black uppercase tracking-widest text-violet-300 hover:from-violet-600/45 hover:to-indigo-600/45 hover:border-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {analyzing
                            ? <><Loader2 size={11} className="animate-spin" /> Analizando…</>
                            : <><Sparkles size={11} /> Analizar {selectedPlatforms.length > 0 ? `(${selectedPlatforms.join(", ")})` : "todos los datos"}</>
                        }
                    </button>
                </div>
            </div>

            {/* Current insight results */}
            {current && (
                <div className="space-y-4">
                    {/* Meta bar */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Análisis</span>
                        <span className="text-[9px] text-neutral-500">
                            {new Date(current.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-white/5 border border-white/8 text-[8px] text-neutral-500">
                            {current.filters.totalProducts} productos
                        </span>
                        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-violet-500/10 border border-violet-500/15 text-[8px] text-violet-400 font-black uppercase">
                            {current.aiProvider}
                        </span>
                        {current.filters.dateRange !== "all" && (
                            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-sky-500/10 border border-sky-500/15 text-[8px] text-sky-400">
                                {current.filters.dateRange}
                            </span>
                        )}
                    </div>

                    {/* Summary card */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <p className="text-[11px] text-neutral-300 leading-relaxed">{current.analysis.summary}</p>
                    </div>

                    {/* Charts row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        <KdpVerticalBarChart
                            title="Top nichos"
                            subtitle="por frecuencia de aparición"
                            icon={<Target size={12} />}
                            items={nicheItems}
                            color="indigo"
                            maxItems={10}
                        />
                        <KdpVerticalBarChart
                            title="Temas repetidos"
                            subtitle="keywords más frecuentes"
                            icon={<TrendingUp size={12} />}
                            items={themeItems}
                            color="violet"
                            maxItems={12}
                        />
                        <KdpVerticalBarChart
                            title="Distribución plataformas"
                            subtitle="productos por fuente"
                            icon={<BarChart2 size={12} />}
                            items={platformItems}
                            color="sky"
                            unit=""
                            maxItems={8}
                        />
                    </div>

                    {/* Emerging niches + Recommendations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Emerging niches */}
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Zap size={12} className="text-amber-400" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Nichos emergentes</span>
                            </div>
                            {current.analysis.emergingNiches.length === 0 ? (
                                <p className="text-[9px] text-neutral-700 italic">Sin nichos emergentes detectados</p>
                            ) : (
                                <div className="space-y-2">
                                    {current.analysis.emergingNiches.map((n, i) => (
                                        <div key={i} className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-white">{n.name}</span>
                                                <span className={`inline-flex items-center h-4 px-1.5 rounded text-[7px] font-black uppercase border ${CONFIDENCE_STYLE[n.confidence]}`}>
                                                    {n.confidence}
                                                </span>
                                            </div>
                                            <p className="text-[9px] text-neutral-500 leading-snug">{n.reason}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recommendations */}
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Sparkles size={12} className="text-emerald-400" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Recomendaciones</span>
                            </div>
                            {current.analysis.recommendations.length === 0 ? (
                                <p className="text-[9px] text-neutral-700 italic">Sin recomendaciones</p>
                            ) : (
                                <ol className="space-y-2">
                                    {current.analysis.recommendations.map((r, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span className="shrink-0 w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[8px] font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                                            <span className="text-[9px] text-neutral-400 leading-snug">{r}</span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* History */}
            {historyLoaded && history.length > 1 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.015] overflow-hidden">
                    <button
                        onClick={() => setShowHistory(h => !h)}
                        className="w-full flex items-center justify-between gap-2 p-3 text-[9px] font-black uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Clock size={10} />
                            Historial de análisis ({history.length})
                        </div>
                        {showHistory ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                    {showHistory && (
                        <div className="border-t border-white/5 divide-y divide-white/5">
                            {history.map(h => (
                                <button
                                    key={h._id}
                                    onClick={() => setCurrent(h)}
                                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors ${current?._id === h._id ? "bg-violet-500/5" : ""}`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[9px] text-neutral-400 shrink-0">
                                            {new Date(h.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                        <span className="text-[8px] text-neutral-600 truncate">
                                            {h.filters.totalProducts} productos · {h.filters.platforms.join(", ") || "todas"}
                                        </span>
                                    </div>
                                    {current?._id === h._id && (
                                        <span className="shrink-0 h-4 px-1.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-[7px] text-violet-400 font-black uppercase">activo</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Empty state */}
            {historyLoaded && history.length === 0 && !analyzing && (
                <div className="flex flex-col items-center justify-center gap-3 py-12 rounded-2xl border border-white/8 border-dashed">
                    <Sparkles size={24} className="text-neutral-700" />
                    <p className="text-[10px] text-neutral-600 font-medium">Pulsa &quot;Analizar&quot; para generar tu primer insight</p>
                </div>
            )}
        </div>
    );
}
