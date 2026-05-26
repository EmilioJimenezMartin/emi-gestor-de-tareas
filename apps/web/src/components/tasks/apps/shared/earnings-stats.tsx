"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface EarningsProduct {
    totalEarnings: number;
    status: "activo" | "pausado" | "borrador";
    platforms: Array<{ name: string; earnings: number }>;
    earningsHistory?: Array<{ date: string | Date; total: number }>;
}

interface EarningsStatsProps {
    products: EarningsProduct[];
    isLoading?: boolean;
}

// ── Mini sparkline SVG ────────────────────────────────────────────────────────

function MiniSparkline({ points, color }: { points: number[]; color: string }) {
    if (points.length < 2) {
        return <div className="h-8 w-16 flex items-end"><div className="w-full h-px opacity-20" style={{ backgroundColor: color }} /></div>;
    }

    const w = 64;
    const h = 32;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const step = w / (points.length - 1);

    const coords = points.map((v, i) => ({
        x: i * step,
        y: h - ((v - min) / range) * (h * 0.85) - h * 0.075,
    }));

    const d = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const fill = [
        ...coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
        `${(w).toFixed(1)},${h}`,
        `0,${h}`,
    ].join(" ");

    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    const trend = last > prev ? "up" : last < prev ? "down" : "flat";

    return (
        <div className="flex items-center gap-1.5">
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
                <defs>
                    <linearGradient id={`sg-${color.replace(/[^a-z]/gi,"")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polygon points={fill} fill={`url(#sg-${color.replace(/[^a-z]/gi,"")})`} />
                <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="2.5" fill={color} />
            </svg>
            <span className="text-[9px]" style={{ color }}>
                {trend === "up" ? <TrendingUp size={10} /> : trend === "down" ? <TrendingDown size={10} /> : <Minus size={10} />}
            </span>
        </div>
    );
}

// ── Build sparkline from history ──────────────────────────────────────────────

function buildSparkPoints(products: EarningsProduct[]): number[] {
    // Merge all earningsHistory entries, bucket by week (last 8 weeks)
    const now = Date.now();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const buckets = new Array(8).fill(0);

    for (const p of products) {
        for (const snap of (p.earningsHistory ?? [])) {
            const age = now - new Date(snap.date).getTime();
            const bucket = Math.floor(age / WEEK);
            if (bucket >= 0 && bucket < 8) {
                buckets[7 - bucket] = Math.max(buckets[7 - bucket], snap.total);
            }
        }
    }

    // Fill forward: if bucket is 0 but previous was non-zero, carry forward
    for (let i = 1; i < buckets.length; i++) {
        if (buckets[i] === 0 && buckets[i - 1] > 0) buckets[i] = buckets[i - 1];
    }

    return buckets;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EarningsStats({ products, isLoading }: EarningsStatsProps) {
    const total           = products.reduce((s, p) => s + (p.totalEarnings ?? 0), 0);
    const avg             = products.length > 0 ? total / products.length : 0;
    const activePlatforms = new Set(
        products.flatMap(p => p.platforms.filter(pl => pl.earnings > 0).map(pl => pl.name))
    );
    const activeCount = products.filter(p => p.status === "activo").length;
    const sparkPoints = buildSparkPoints(products);
    const hasHistory  = sparkPoints.some(v => v > 0);

    const stats = [
        {
            label: "Ganancias totales",
            value: `${total.toFixed(2)}€`,
            color: "text-indigo-400",
            hex: "#818cf8",
            glow: "rgba(99,102,241,0.12)",
            spark: true,
        },
        {
            label: "Media / producto",
            value: `${avg.toFixed(2)}€`,
            color: "text-sky-400",
            hex: "#38bdf8",
            glow: "rgba(56,189,248,0.12)",
            spark: false,
        },
        {
            label: "Plataformas activas",
            value: activePlatforms.size,
            color: "text-emerald-400",
            hex: "#34d399",
            glow: "rgba(52,211,153,0.12)",
            spark: false,
        },
        {
            label: "Productos activos",
            value: activeCount,
            color: "text-amber-400",
            hex: "#fbbf24",
            glow: "rgba(251,191,36,0.12)",
            spark: false,
        },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map(s => (
                <div key={s.label}
                    className="relative rounded-2xl border border-white/8 bg-white/[0.025] p-4 space-y-1 overflow-hidden group hover:border-white/15 transition-all"
                >
                    <div className="absolute -right-4 -top-4 w-12 h-12 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: s.glow }} />
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">{s.label}</p>
                    {isLoading
                        ? <div className="h-8 w-16 bg-white/5 rounded-lg animate-pulse" />
                        : (
                            <div className="flex items-end justify-between gap-2">
                                <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                                {s.spark && hasHistory && (
                                    <MiniSparkline points={sparkPoints} color={s.hex} />
                                )}
                            </div>
                        )
                    }
                </div>
            ))}
        </div>
    );
}
