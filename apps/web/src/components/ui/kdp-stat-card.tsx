import { Card } from "@/components/ui/card";

type StatColor = "indigo" | "blue" | "emerald" | "sky" | "amber" | "violet" | "cyan" | "fuchsia" | "orange" | "purple";

const colorMap: Record<StatColor, { border: string; shadow: string; glow: string; iconBg: string; iconText: string }> = {
    indigo:  { border: "hover:border-indigo-500/30",  shadow: "hover:shadow-[0_0_30px_rgba(99,102,241,0.12)]",  glow: "bg-indigo-500/10",  iconBg: "bg-indigo-500/10",  iconText: "text-indigo-400"  },
    blue:    { border: "hover:border-blue-500/30",    shadow: "hover:shadow-[0_0_30px_rgba(59,130,246,0.12)]",  glow: "bg-blue-500/10",    iconBg: "bg-blue-500/10",    iconText: "text-blue-400"    },
    emerald: { border: "hover:border-emerald-500/30", shadow: "hover:shadow-[0_0_30px_rgba(16,185,129,0.12)]",  glow: "bg-emerald-500/10", iconBg: "bg-emerald-500/10", iconText: "text-emerald-400" },
    sky:     { border: "hover:border-sky-500/30",     shadow: "hover:shadow-[0_0_30px_rgba(14,165,233,0.12)]",  glow: "bg-sky-500/10",     iconBg: "bg-sky-500/10",     iconText: "text-sky-400"     },
    amber:   { border: "hover:border-amber-500/30",   shadow: "hover:shadow-[0_0_30px_rgba(245,158,11,0.12)]",  glow: "bg-amber-500/10",   iconBg: "bg-amber-500/10",   iconText: "text-amber-400"   },
    violet:  { border: "hover:border-violet-500/30",  shadow: "hover:shadow-[0_0_30px_rgba(139,92,246,0.12)]",  glow: "bg-violet-500/10",  iconBg: "bg-violet-500/10",  iconText: "text-violet-400"  },
    cyan:    { border: "hover:border-cyan-500/30",    shadow: "hover:shadow-[0_0_30px_rgba(6,182,212,0.12)]",   glow: "bg-cyan-500/10",    iconBg: "bg-cyan-500/10",    iconText: "text-cyan-400"    },
    fuchsia: { border: "hover:border-fuchsia-500/30", shadow: "hover:shadow-[0_0_30px_rgba(217,70,239,0.12)]",  glow: "bg-fuchsia-500/10", iconBg: "bg-fuchsia-500/10", iconText: "text-fuchsia-400" },
    orange:  { border: "hover:border-orange-500/30",  shadow: "hover:shadow-[0_0_30px_rgba(249,115,22,0.12)]",  glow: "bg-orange-500/10",  iconBg: "bg-orange-500/10",  iconText: "text-orange-400"  },
    purple:  { border: "hover:border-purple-500/30",  shadow: "hover:shadow-[0_0_30px_rgba(168,85,247,0.12)]",  glow: "bg-purple-500/10",  iconBg: "bg-purple-500/10",  iconText: "text-purple-400"  },
};

interface KdpStatCardProps {
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    color: StatColor;
    subtitle?: React.ReactNode;
}

export function KdpStatCard({ label, value, icon, color, subtitle }: KdpStatCardProps) {
    const c = colorMap[color];
    return (
        <Card
            variant="outline"
            className={`p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 ${c.border} ${c.shadow} transition-all duration-500 group relative overflow-hidden`}
        >
            <div className={`absolute -right-4 -top-4 w-16 h-16 ${c.glow} blur-2xl rounded-full transition-all group-hover:scale-150`} />
            <div className="flex items-center justify-between relative">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{label}</span>
                <div className={`p-2 rounded-xl ${c.iconBg} ${c.iconText}`}>{icon}</div>
            </div>
            <div className="space-y-1 relative">
                <p className="text-3xl font-black italic tracking-tighter text-white tabular-nums">{value}</p>
                {subtitle && <div className="text-[10px] font-bold text-neutral-500 italic">{subtitle}</div>}
            </div>
        </Card>
    );
}
