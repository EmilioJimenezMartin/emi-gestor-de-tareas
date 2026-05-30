import { Card } from "@/components/ui/card";

interface KdpVerticalBarChartItem {
    label: string;
    value: number;
}

type ChartColor = "indigo" | "sky" | "blue" | "emerald" | "amber" | "violet" | "cyan";

const barGradient: Record<ChartColor, { from: string; via: string; to: string; hover: string; top: string }> = {
    indigo:  { from: "from-indigo-500/10", via: "via-indigo-500/30", to: "to-indigo-500/50", hover: "group-hover/bar:to-indigo-400", top: "bg-indigo-400/40" },
    sky:     { from: "from-sky-500/10",    via: "via-sky-500/30",    to: "to-sky-500/50",    hover: "group-hover/bar:to-sky-400",    top: "bg-sky-400/40"    },
    blue:    { from: "from-blue-500/10",   via: "via-blue-500/30",   to: "to-blue-500/50",   hover: "group-hover/bar:to-blue-400",   top: "bg-blue-400/40"   },
    emerald: { from: "from-emerald-500/10",via: "via-emerald-500/30",to: "to-emerald-500/50",hover: "group-hover/bar:to-emerald-400",top: "bg-emerald-400/40"},
    amber:   { from: "from-amber-500/10",  via: "via-amber-500/30",  to: "to-amber-500/50",  hover: "group-hover/bar:to-amber-400",  top: "bg-amber-400/40"  },
    violet:  { from: "from-violet-500/10", via: "via-violet-500/30", to: "to-violet-500/50", hover: "group-hover/bar:to-violet-400", top: "bg-violet-400/40" },
    cyan:    { from: "from-cyan-500/10",   via: "via-cyan-500/30",   to: "to-cyan-500/50",   hover: "group-hover/bar:to-cyan-400",   top: "bg-cyan-400/40"   },
};

const tooltipColor: Record<ChartColor, string> = {
    indigo: "text-indigo-300", sky: "text-sky-300", blue: "text-blue-300",
    emerald: "text-emerald-300", amber: "text-amber-300", violet: "text-violet-300", cyan: "text-cyan-300",
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
}

export function KdpVerticalBarChart({
    title, subtitle, icon, items, color = "indigo",
    height = 200, emptyMessage = "Sin datos", unit = "", glass = true,
}: KdpVerticalBarChartProps) {
    const max = Math.max(...items.map(i => i.value), 1);
    const g = barGradient[color];
    const tc = tooltipColor[color];

    return (
        <Card
            variant={glass ? "glass" : "outline"}
            className="p-6 border-white/5 bg-white/[0.01] space-y-6 relative overflow-hidden hover:shadow-[0_0_40px_rgba(99,102,241,0.08)] transition-all duration-500"
        >
            <div className="flex flex-col gap-0.5">
                <h3 className="text-[11px] font-black text-white italic tracking-widest uppercase flex items-center gap-2">
                    <span className={tc}>{icon}</span>
                    {title}
                </h3>
                {subtitle && <p className="text-[9px] text-neutral-600 font-medium tracking-tight">{subtitle}</p>}
            </div>

            {items.length === 0 ? (
                <div className="flex items-center justify-center text-[9px] text-neutral-700 italic" style={{ height }}>
                    {emptyMessage}
                </div>
            ) : (
                <div className="flex items-end justify-between gap-1 sm:gap-2" style={{ height }}>
                    {items.map((item, i) => {
                        const pct = Math.max(3, Math.round((item.value / max) * 100));
                        return (
                            <div key={i} className="flex-1 group/bar relative h-full flex items-end">
                                <div
                                    className={`w-full bg-gradient-to-t ${g.from} ${g.via} ${g.to} ${g.hover} rounded-t-sm sm:rounded-t-lg transition-all duration-700 relative overflow-hidden`}
                                    style={{ height: `${pct}%` }}
                                >
                                    <div className={`absolute inset-x-0 top-0 h-0.5 ${g.top} blur-[1px]`} />
                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/bar:translate-y-0 transition-transform duration-500" />
                                </div>
                                <div className={`absolute -top-9 left-1/2 -translate-x-1/2 bg-white text-[9px] font-black text-black px-2 py-1 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all scale-75 group-hover/bar:scale-100 pointer-events-none shadow-2xl z-20 whitespace-nowrap`}>
                                    {item.value}{unit}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {items.length > 0 && (
                <div className="flex justify-between pt-3 border-t border-white/5 gap-1">
                    {items.map((item, i) => (
                        <div key={i} className="flex-1 flex justify-center" style={{ height: 60 }}>
                            <span
                                className="text-[8px] font-black text-neutral-600 uppercase tracking-widest whitespace-nowrap"
                                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                                title={item.label}
                            >
                                {item.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
