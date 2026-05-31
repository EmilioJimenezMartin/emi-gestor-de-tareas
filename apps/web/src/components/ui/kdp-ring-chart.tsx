"use client";

import { Card } from "@/components/ui/card";

export interface KdpRingSegment {
    label: string;
    value: number;
    color: string;       // tailwind bg color class for legend dot
    stroke: string;      // raw hex/rgba for SVG stroke
    glow?: string;       // optional drop-shadow color
}

interface KdpRingChartProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    segments: KdpRingSegment[];
    centerLabel?: string;
    glass?: boolean;
}

const R = 52;
const C = 2 * Math.PI * R;
const GAP = 3; // gap between arcs in px (on the circumference)

export function KdpRingChart({
    title, subtitle, icon, segments, centerLabel, glass = true,
}: KdpRingChartProps) {
    const total = segments.reduce((s, seg) => s + seg.value, 0);

    // Build arcs: each segment gets a dasharray positioned around the ring
    let accPct = 0;
    const arcs = segments.map(seg => {
        const pct = total > 0 ? seg.value / total : 0;
        const arcLen = Math.max(0, pct * C - GAP);
        const startOffset = C * 0.25 - accPct * C; // start from top (12 o'clock)
        accPct += pct;
        return { ...seg, arcLen, gapLen: C - arcLen, dashOffset: startOffset };
    });

    return (
        <Card
            variant={glass ? "glass" : "outline"}
            className="p-5 border-white/5 bg-white/[0.01] relative overflow-hidden hover:shadow-[0_0_30px_rgba(99,102,241,0.06)] transition-all duration-500"
        >
            {/* Header */}
            <div className="flex flex-col gap-0.5 mb-4">
                <h3 className="text-[11px] font-black text-white italic tracking-widest uppercase flex items-center gap-2">
                    {icon && <span className="text-violet-400">{icon}</span>}
                    {title}
                </h3>
                {subtitle && <p className="text-[9px] text-neutral-600 font-medium tracking-tight">{subtitle}</p>}
            </div>

            {total === 0 ? (
                <div className="flex items-center justify-center text-[9px] text-neutral-700 italic h-24">
                    Sin datos todavía
                </div>
            ) : (
                <div className="flex items-center gap-5">
                    {/* SVG ring */}
                    <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
                        <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
                            {/* Track */}
                            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
                            {/* Segments */}
                            {arcs.map((arc, i) => (
                                arc.arcLen > 0 && (
                                    <circle
                                        key={i}
                                        cx="60" cy="60" r={R}
                                        fill="none"
                                        stroke={arc.stroke}
                                        strokeWidth="14"
                                        strokeDasharray={`${arc.arcLen} ${arc.gapLen}`}
                                        strokeDashoffset={arc.dashOffset}
                                        strokeLinecap="round"
                                        style={{
                                            filter: arc.glow ? `drop-shadow(0 0 6px ${arc.glow})` : undefined,
                                            transition: "stroke-dasharray 0.6s ease",
                                        }}
                                    />
                                )
                            ))}
                        </svg>
                        {/* Center label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-black text-white leading-none">{total}</span>
                            {centerLabel && <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mt-0.5">{centerLabel}</span>}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex-1 space-y-2.5 min-w-0">
                        {segments.map((seg, i) => {
                            const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
                            return (
                                <div key={i} className="flex items-center gap-2 group">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: seg.stroke, boxShadow: seg.glow ? `0 0 6px ${seg.glow}` : undefined }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-1">
                                            <span className="text-[10px] font-semibold text-neutral-300 truncate">{seg.label}</span>
                                            <span className="text-[10px] font-black text-white shrink-0 tabular-nums">{seg.value}</span>
                                        </div>
                                        {/* Mini progress bar */}
                                        <div className="h-1 rounded-full bg-white/5 mt-0.5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${pct}%`, backgroundColor: seg.stroke, opacity: 0.6 }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-bold text-neutral-600 shrink-0 tabular-nums">{pct}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </Card>
    );
}
