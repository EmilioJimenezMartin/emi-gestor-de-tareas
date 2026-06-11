"use client";
import { useState, useEffect } from "react";
import { TrendingUp, RefreshCw, ExternalLink } from "lucide-react";

interface TrendSignal {
    source: "google-trends" | "reddit" | "amazon-movers";
    title: string;
    url?: string;
    traffic?: string;
    subreddit?: string;
    score?: number;
    capturedAt: string;
}

interface TrendsReport {
    signals: TrendSignal[];
    nicheMatches: string[];
    capturedAt: string;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    "google-trends": { label: "Google", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    "reddit":        { label: "Reddit", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
    "amazon-movers": { label: "Amazon", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function TrendsPanel() {
    const [report, setReport] = useState<TrendsReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<"matches" | "all">("matches");

    const load = async (refresh = false) => {
        setLoading(true);
        try {
            const url = refresh ? `${API}/trends/refresh` : `${API}/trends/signals`;
            const res = await fetch(url, refresh ? { method: "POST" } : {});
            if (res.ok) setReport(await res.json());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const displayed = tab === "matches"
        ? report?.nicheMatches ?? []
        : (report?.signals ?? []).map(s => `[${s.source}] ${s.title}`);

    const age = report?.capturedAt
        ? Math.round((Date.now() - new Date(report.capturedAt).getTime()) / 60000)
        : null;

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.07] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <TrendingUp size={11} className="text-purple-400/80 shrink-0" />
                    <span className="text-[9px] uppercase tracking-wider text-neutral-600 font-black">Tendencias</span>
                    {age !== null && (
                        <span className="text-[8px] text-neutral-700">hace {age}m</span>
                    )}
                </div>
                <button
                    onClick={() => void load(true)}
                    disabled={loading}
                    className="flex items-center gap-1 text-[9px] text-neutral-600 hover:text-purple-400 transition-colors disabled:opacity-40"
                >
                    <RefreshCw size={8} className={loading ? "animate-spin" : ""} />
                    Actualizar
                </button>
            </div>

            {/* Stats row */}
            {report && (
                <div className="flex gap-2">
                    {(["google-trends", "reddit", "amazon-movers"] as const).map(src => {
                        const count = report.signals.filter(s => s.source === src).length;
                        const { label, color } = SOURCE_LABELS[src];
                        return (
                            <div key={src} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-black ${color}`}>
                                {label} <span className="opacity-60">{count}</span>
                            </div>
                        );
                    })}
                    <div className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded border border-purple-500/20 bg-purple-500/10 text-[8px] font-black text-purple-400">
                        KDP {report.nicheMatches.length}
                    </div>
                </div>
            )}

            {/* Tab selector */}
            <div className="flex p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg gap-0.5">
                {([["matches", "Relevantes KDP"], ["all", "Todas"]] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setTab(id)}
                        className={`flex-1 h-6 rounded-[7px] text-[9px] font-black transition-all ${tab === id ? "bg-white/[0.06] text-white" : "text-neutral-600 hover:text-neutral-400"}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Signal list */}
            <div className="space-y-1 max-h-48 overflow-y-auto">
                {loading && !report && (
                    <div className="text-[9px] text-neutral-600 italic text-center py-3">Cargando señales...</div>
                )}
                {!loading && displayed.length === 0 && (
                    <div className="text-[9px] text-neutral-600 italic text-center py-3">
                        {tab === "matches" ? "Sin señales KDP hoy" : "Sin datos aún"}
                    </div>
                )}
                {displayed.map((item, i) => {
                    // For "all" tab, find the original signal to link it
                    const signal = tab === "all" ? report?.signals[i] : null;
                    return (
                        <div key={i} className="flex items-start gap-1.5 py-1 border-b border-white/[0.04] last:border-0">
                            <span className="text-[8px] text-neutral-700 shrink-0 tabular-nums mt-0.5">{i + 1}</span>
                            <span className="text-[9px] text-neutral-400 leading-snug flex-1">{item.replace(/^\[.*?\]\s*/, "")}</span>
                            {signal?.url && (
                                <a href={signal.url} target="_blank" rel="noopener noreferrer"
                                    className="text-neutral-700 hover:text-neutral-400 shrink-0 mt-0.5">
                                    <ExternalLink size={8} />
                                </a>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
