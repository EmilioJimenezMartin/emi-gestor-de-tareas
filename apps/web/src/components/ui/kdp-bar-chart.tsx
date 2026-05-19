interface KdpBarChartItem {
    label: string;
    value: number;
}

type ChartColor = "indigo" | "blue" | "emerald" | "sky" | "amber" | "violet" | "cyan";

const gradientMap: Record<ChartColor, string> = {
    indigo:  "bg-gradient-to-r from-indigo-500/10 via-indigo-500/30 to-indigo-500/50 group-hover/bar:to-indigo-400",
    blue:    "bg-gradient-to-r from-blue-500/10 via-blue-500/30 to-blue-500/50 group-hover/bar:to-blue-400",
    emerald: "bg-gradient-to-r from-emerald-500/10 via-emerald-500/30 to-emerald-500/50 group-hover/bar:to-emerald-400",
    sky:     "bg-gradient-to-r from-sky-500/10 via-sky-500/30 to-sky-500/50 group-hover/bar:to-sky-400",
    amber:   "bg-gradient-to-r from-amber-500/10 via-amber-500/30 to-amber-500/50 group-hover/bar:to-amber-400",
    violet:  "bg-gradient-to-r from-violet-500/10 via-violet-500/30 to-violet-500/50 group-hover/bar:to-violet-400",
    cyan:    "bg-gradient-to-r from-cyan-500/10 via-cyan-500/30 to-cyan-500/50 group-hover/bar:to-cyan-400",
};

const valueTextMap: Record<ChartColor, string> = {
    indigo:  "text-indigo-300",
    blue:    "text-blue-300",
    emerald: "text-emerald-300",
    sky:     "text-sky-300",
    amber:   "text-amber-300",
    violet:  "text-violet-300",
    cyan:    "text-cyan-300",
};

interface KdpBarChartProps {
    title: string;
    icon: React.ReactNode;
    items: KdpBarChartItem[];
    color: ChartColor;
    emptyMessage?: string;
    maxItems?: number;
}

export function KdpBarChart({ title, icon, items, color, emptyMessage = "Sin datos", maxItems = 6 }: KdpBarChartProps) {
    const top = items.slice(0, maxItems);
    const max = Math.max(...top.map(i => i.value), 1);
    const gradient = gradientMap[color];
    const valueText = valueTextMap[color];

    return (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
            <div className="flex items-center gap-2">
                <span className={`${valueText} opacity-70`}>{icon}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">{title}</span>
            </div>
            {top.length === 0 ? (
                <p className="text-[9px] text-neutral-700 italic py-2">{emptyMessage}</p>
            ) : (
                <div className="space-y-3">
                    {top.map((item, i) => {
                        const pct = Math.max(4, Math.round((item.value / max) * 100));
                        return (
                            <div key={i} className="group/bar space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[9px] text-neutral-400 font-semibold truncate max-w-[140px]">{item.label}</span>
                                    <span className={`text-[9px] font-black tabular-nums shrink-0 ${valueText}`}>{item.value}</span>
                                </div>
                                <div className="h-[5px] w-full bg-white/[0.04] rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 relative overflow-hidden ${gradient}`}
                                        style={{ width: `${pct}%` }}
                                    >
                                        <div className="absolute inset-x-0 top-0 h-px bg-white/30 blur-[1px]" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
