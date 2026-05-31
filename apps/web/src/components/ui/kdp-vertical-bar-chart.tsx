import { Card } from "@/components/ui/card";

interface KdpVerticalBarChartItem {
    label: string;
    value: number;
}

type ChartColor = "indigo" | "sky" | "blue" | "emerald" | "amber" | "violet" | "cyan";

const colorMap: Record<ChartColor, { bar: string; glow: string; value: string; track: string }> = {
    indigo:  { bar: "bg-gradient-to-r from-indigo-500/40 to-indigo-400/80",  glow: "shadow-[4px_0_12px_rgba(99,102,241,0.4)]",   value: "text-indigo-300",  track: "bg-indigo-500/5"  },
    sky:     { bar: "bg-gradient-to-r from-sky-500/40 to-sky-400/80",        glow: "shadow-[4px_0_12px_rgba(14,165,233,0.4)]",   value: "text-sky-300",     track: "bg-sky-500/5"     },
    blue:    { bar: "bg-gradient-to-r from-blue-500/40 to-blue-400/80",      glow: "shadow-[4px_0_12px_rgba(59,130,246,0.4)]",   value: "text-blue-300",    track: "bg-blue-500/5"    },
    emerald: { bar: "bg-gradient-to-r from-emerald-500/40 to-emerald-400/80",glow: "shadow-[4px_0_12px_rgba(52,211,153,0.4)]",   value: "text-emerald-300", track: "bg-emerald-500/5" },
    amber:   { bar: "bg-gradient-to-r from-amber-500/40 to-amber-400/80",    glow: "shadow-[4px_0_12px_rgba(251,191,36,0.4)]",   value: "text-amber-300",   track: "bg-amber-500/5"   },
    violet:  { bar: "bg-gradient-to-r from-violet-500/40 to-violet-400/80",  glow: "shadow-[4px_0_12px_rgba(167,139,250,0.4)]",  value: "text-violet-300",  track: "bg-violet-500/5"  },
    cyan:    { bar: "bg-gradient-to-r from-cyan-500/40 to-cyan-400/80",      glow: "shadow-[4px_0_12px_rgba(34,211,238,0.4)]",   value: "text-cyan-300",    track: "bg-cyan-500/5"    },
};

const iconColor: Record<ChartColor, string> = {
    indigo: "text-indigo-400", sky: "text-sky-400", blue: "text-blue-400",
    emerald: "text-emerald-400", amber: "text-amber-400", violet: "text-violet-400", cyan: "text-cyan-400",
};

interface KdpVerticalBarChartProps {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    items: KdpVerticalBarChartItem[];
    color?: ChartColor;
    height?: number;
    emptyMessage?: string;
    unit?: string;
    glass?: boolean;
    maxItems?: number;
}

export function KdpVerticalBarChart({
    title, subtitle, icon, items, color = "indigo",
    emptyMessage = "Sin datos", unit = "", glass = true, maxItems = 8,
}: KdpVerticalBarChartProps) {
    const visible = items.slice(0, maxItems);
    const max = Math.max(...visible.map(i => i.value), 1);
    const c = colorMap[color];
    const ic = iconColor[color];

    const truncate = (s: string, n = 22) => s.length > n ? s.slice(0, n - 1) + "…" : s;

    return (
        <Card
            variant={glass ? "glass" : "outline"}
            className="p-5 border-white/5 bg-white/[0.01] relative overflow-hidden hover:shadow-[0_0_30px_rgba(99,102,241,0.06)] transition-all duration-500"
        >
            {/* Header */}
            <div className="flex flex-col gap-0.5 mb-4">
                <h3 className="text-[11px] font-black text-white italic tracking-widest uppercase flex items-center gap-2">
                    <span className={ic}>{icon}</span>
                    {title}
                </h3>
                {subtitle && <p className="text-[9px] text-neutral-600 font-medium tracking-tight">{subtitle}</p>}
            </div>

            {visible.length === 0 ? (
                <div className="flex items-center justify-center text-[9px] text-neutral-700 italic h-20">
                    {emptyMessage}
                </div>
            ) : (
                <div className="space-y-[7px]">
                    {visible.map((item, i) => {
                        const pct = Math.max(2, Math.round((item.value / max) * 100));
                        return (
                            <div key={i} className="group/row flex items-center gap-3">
                                {/* Label */}
                                <span
                                    className="text-[10px] font-semibold text-white/75 group-hover/row:text-white transition-colors shrink-0 text-right"
                                    style={{ width: 110 }}
                                    title={item.label}
                                >
                                    {truncate(item.label, 18)}
                                </span>

                                {/* Track + bar */}
                                <div className={`flex-1 h-[18px] rounded-full ${c.track} relative overflow-hidden`}>
                                    <div
                                        className={`h-full rounded-full ${c.bar} ${c.glow} transition-all duration-700 ease-out`}
                                        style={{ width: `${pct}%` }}
                                    >
                                        <div className="absolute inset-y-0 right-0 w-3 bg-white/20 rounded-full blur-sm" />
                                    </div>
                                </div>

                                {/* Value */}
                                <span className={`text-[10px] font-black ${c.value} shrink-0 tabular-nums`} style={{ width: 32, textAlign: "right" }}>
                                    {item.value}{unit}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
