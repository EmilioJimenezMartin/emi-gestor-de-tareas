"use client";
import { DollarSign, Zap, Tag, ShoppingBag, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface NicheInsight {
    niche?: string;
    competition?: "low" | "medium" | "high";
    demand?: "low" | "medium" | "high";
    trend?: "rising" | "stable" | "declining";
    topKeywords?: string[];
    priceRange?: string;
    topCompetitors?: string[];
    entryOpportunity?: string;
    buyerProfile?: string;
    summary?: string;
    // extra fields the LLM sometimes adds
    [key: string]: unknown;
}

const COMP_COLOR: Record<string, string> = {
    low:    "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    medium: "bg-amber-500/10 border-amber-500/25 text-amber-400",
    high:   "bg-rose-500/10 border-rose-500/25 text-rose-400",
};
const DEMAND_COLOR: Record<string, string> = {
    low:    "bg-rose-500/10 border-rose-500/25 text-rose-400",
    medium: "bg-amber-500/10 border-amber-500/25 text-amber-400",
    high:   "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
};
const TREND_ICON: Record<string, React.ReactNode> = {
    rising:   <TrendingUp size={9} className="text-emerald-400" />,
    stable:   <Minus size={9} className="text-amber-400" />,
    declining:<TrendingDown size={9} className="text-rose-400" />,
};
const TREND_COLOR: Record<string, string> = {
    rising:   "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    stable:   "bg-amber-500/10 border-amber-500/25 text-amber-400",
    declining:"bg-rose-500/10 border-rose-500/25 text-rose-400",
};

export function RadarInsightCard({ insight }: { insight: NicheInsight }) {
    if (!insight || typeof insight !== "object") return null;

    const kws: string[]      = Array.isArray(insight.topKeywords)   ? insight.topKeywords   : [];
    const comps: string[]    = Array.isArray(insight.topCompetitors) ? insight.topCompetitors: [];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.07] overflow-hidden">
            {/* header bar */}
            <div className="h-px w-full bg-gradient-to-r from-amber-500/60 via-orange-400/20 to-transparent" />
            <div className="p-3 space-y-3">

                {/* title + badges */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <Zap size={10} className="text-amber-400/80 shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-wider text-neutral-600">Análisis Radar</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                        {insight.competition && (
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${COMP_COLOR[insight.competition] ?? ""}`}>
                                Comp: {insight.competition}
                            </span>
                        )}
                        {insight.demand && (
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${DEMAND_COLOR[insight.demand] ?? ""}`}>
                                Dem: {insight.demand}
                            </span>
                        )}
                        {insight.trend && (
                            <span className={`flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${TREND_COLOR[insight.trend] ?? ""}`}>
                                {TREND_ICON[insight.trend]} {insight.trend}
                            </span>
                        )}
                    </div>
                </div>

                {/* summary */}
                {insight.summary && (
                    <p className="text-[10px] text-neutral-400 leading-relaxed border-l-2 border-amber-500/30 pl-2.5">{insight.summary}</p>
                )}

                {/* price + opportunity */}
                <div className="grid grid-cols-2 gap-2">
                    {insight.priceRange && (
                        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 space-y-1">
                            <div className="flex items-center gap-1">
                                <DollarSign size={9} className="text-emerald-400" />
                                <span className="text-[8px] font-black uppercase tracking-wider text-neutral-600">Precio típico</span>
                            </div>
                            <p className="text-[11px] font-black text-white">{insight.priceRange}</p>
                        </div>
                    )}
                    {insight.entryOpportunity && (
                        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 space-y-1">
                            <div className="flex items-center gap-1">
                                <Zap size={9} className="text-amber-400" />
                                <span className="text-[8px] font-black uppercase tracking-wider text-neutral-600">Oportunidad</span>
                            </div>
                            <p className="text-[9px] text-neutral-300 leading-snug line-clamp-3">{insight.entryOpportunity}</p>
                        </div>
                    )}
                </div>

                {/* keywords + competitors */}
                {(kws.length > 0 || comps.length > 0) && (
                    <div className="grid grid-cols-2 gap-2">
                        {kws.length > 0 && (
                            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 space-y-1.5">
                                <div className="flex items-center gap-1">
                                    <Tag size={9} className="text-sky-400" />
                                    <span className="text-[8px] font-black uppercase tracking-wider text-neutral-600">Keywords</span>
                                </div>
                                <div className="flex flex-wrap gap-0.5">
                                    {kws.slice(0, 8).map(k => (
                                        <span key={k} className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 font-black">{k}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {comps.length > 0 && (
                            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 space-y-1.5">
                                <div className="flex items-center gap-1">
                                    <ShoppingBag size={9} className="text-cyan-400" />
                                    <span className="text-[8px] font-black uppercase tracking-wider text-neutral-600">Competidores</span>
                                </div>
                                <div className="space-y-0.5">
                                    {comps.slice(0, 4).map((c, i) => (
                                        <p key={i} className="text-[8px] text-neutral-400 flex items-center gap-1">
                                            <span className="text-neutral-700 tabular-nums w-3 shrink-0">{i + 1}.</span>
                                            <span className="line-clamp-1">{c}</span>
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* buyer profile */}
                {insight.buyerProfile && (
                    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 space-y-1">
                        <div className="flex items-center gap-1">
                            <Users size={9} className="text-orange-400" />
                            <span className="text-[8px] font-black uppercase tracking-wider text-neutral-600">Perfil del comprador</span>
                        </div>
                        <p className="text-[9px] text-neutral-400 leading-relaxed">{insight.buyerProfile}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
