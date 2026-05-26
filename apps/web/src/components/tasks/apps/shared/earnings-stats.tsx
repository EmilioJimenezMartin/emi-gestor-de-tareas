"use client";

import React from "react";

export interface EarningsProduct {
    totalEarnings: number;
    status: "activo" | "pausado" | "borrador";
    platforms: Array<{ name: string; earnings: number }>;
}

interface EarningsStatsProps {
    products: EarningsProduct[];
    isLoading?: boolean;
}

export function EarningsStats({ products, isLoading }: EarningsStatsProps) {
    const total           = products.reduce((s, p) => s + (p.totalEarnings ?? 0), 0);
    const avg             = products.length > 0 ? total / products.length : 0;
    const activePlatforms = new Set(
        products.flatMap(p => p.platforms.filter(pl => pl.earnings > 0).map(pl => pl.name))
    );
    const activeCount = products.filter(p => p.status === "activo").length;

    const stats = [
        { label: "Ganancias totales",  value: `${total.toFixed(2)}€`, color: "text-indigo-400",  glow: "rgba(99,102,241,0.12)" },
        { label: "Media / producto",   value: `${avg.toFixed(2)}€`,   color: "text-sky-400",     glow: "rgba(56,189,248,0.12)" },
        { label: "Plataformas activas",value: activePlatforms.size,    color: "text-emerald-400", glow: "rgba(52,211,153,0.12)" },
        { label: "Productos activos",  value: activeCount,             color: "text-amber-400",   glow: "rgba(251,191,36,0.12)" },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map(s => (
                <div key={s.label}
                    className="relative rounded-2xl border border-white/8 bg-white/[0.025] p-4 space-y-1 overflow-hidden group hover:border-white/15 transition-all"
                    style={{ boxShadow: `0 0 0 0 transparent` }}
                >
                    <div className="absolute -right-4 -top-4 w-12 h-12 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: s.glow }} />
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">{s.label}</p>
                    {isLoading
                        ? <div className="h-8 w-16 bg-white/5 rounded-lg animate-pulse" />
                        : <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                    }
                </div>
            ))}
        </div>
    );
}
