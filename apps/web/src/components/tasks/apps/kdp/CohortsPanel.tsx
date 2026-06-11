"use client";
// Dashboard de cohortes: cada nicho publicado comparado contra la curva media
// de TUS nichos anteriores en el mismo mes de vida. Detecta ganadores/perdedores
// sin esperar al día 30.
import { useState, useEffect } from "react";
import { BarChart3, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";

interface CohortNiche {
    nicheId: string;
    name: string;
    lifecycleStage: string;
    verdict?: string;
    monthsLive: number;
    curve: number[];
    totalUnits: number;
    currentMonth: number;
    unitsThisMonth: number;
    avgAtSameMonth: number;
    vsAverage: number | null;
}

interface CohortsData {
    cohorts: CohortNiche[];
    average: Array<{ month: number; avgUnits: number; niches: number }>;
    sampleSize: number;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function vsBadge(vs: number | null) {
    if (vs === null) return { label: "sin media", cls: "bg-white/[0.04] border-white/10 text-neutral-600", icon: null };
    if (vs >= 1.5) return { label: `${vs}× 🔥`, cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300", icon: <TrendingUp size={8} /> };
    if (vs >= 1.0) return { label: `${vs}×`, cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", icon: <TrendingUp size={8} /> };
    if (vs >= 0.5) return { label: `${vs}×`, cls: "bg-amber-500/10 border-amber-500/25 text-amber-400", icon: <TrendingDown size={8} /> };
    return { label: `${vs}×`, cls: "bg-rose-500/10 border-rose-500/25 text-rose-400", icon: <TrendingDown size={8} /> };
}

export function CohortsPanel() {
    const [data, setData] = useState<CohortsData | null>(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/niches/cohorts`);
            if (res.ok) setData(await res.json());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    if (!loading && (!data || data.sampleSize === 0)) return null; // sin nichos publicados aún — no ocupar espacio

    const maxAvg = Math.max(1, ...(data?.average ?? []).map(a => a.avgUnits));

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.07] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <BarChart3 size={11} className="text-violet-400/80 shrink-0" />
                    <span className="text-[9px] uppercase tracking-wider text-neutral-600 font-black">Cohortes · vs tu media histórica</span>
                </div>
                <button onClick={() => void load()} disabled={loading}
                    className="flex items-center gap-1 text-[9px] text-neutral-600 hover:text-violet-400 transition-colors disabled:opacity-40">
                    <RefreshCw size={8} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Curva media */}
            {data && data.average.length > 0 && (
                <div className="space-y-1">
                    <span className="text-[8px] uppercase tracking-wider text-neutral-700 font-black">Curva media (unidades/mes de vida · {data.sampleSize} nichos)</span>
                    <div className="flex items-end gap-1 h-10">
                        {data.average.map(a => (
                            <div key={a.month} className="flex-1 flex flex-col items-center gap-0.5" title={`Mes ${a.month + 1}: media ${a.avgUnits} uds (${a.niches} nichos)`}>
                                <div className="w-full rounded-t bg-gradient-to-t from-violet-500/40 to-violet-400/20 transition-all"
                                    style={{ height: `${Math.max(8, (a.avgUnits / maxAvg) * 100)}%` }} />
                                <span className="text-[7px] text-neutral-700 tabular-nums">M{a.month + 1}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Ranking de nichos vs media */}
            <div className="space-y-1">
                {(data?.cohorts ?? []).slice(0, 8).map(c => {
                    const badge = vsBadge(c.vsAverage);
                    return (
                        <div key={c.nicheId} className="flex items-center gap-2 py-1 border-b border-white/[0.04] last:border-0">
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-neutral-300 truncate">{c.name}</p>
                                <p className="text-[8px] text-neutral-700">
                                    Mes {c.currentMonth + 1} · {c.unitsThisMonth} uds este mes · media {c.avgAtSameMonth} · {c.totalUnits} total
                                </p>
                            </div>
                            <span className={`flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full border shrink-0 ${badge.cls}`}>
                                {badge.icon}{badge.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            <p className="text-[8px] text-neutral-700 italic leading-snug">
                ≥1× = vende más que tu media en el mismo mes de vida → considera double-down. &lt;0.5× = candidato a rotar metadatos o fin de vida.
            </p>
        </div>
    );
}
