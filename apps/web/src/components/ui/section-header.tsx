type SectionColor = "blue" | "sky" | "emerald" | "amber" | "violet" | "indigo" | "rose" | "cyan" | "orange";

const iconColors: Record<SectionColor, string> = {
    blue:    "text-blue-400",
    sky:     "text-sky-400",
    emerald: "text-emerald-400",
    amber:   "text-amber-400",
    violet:  "text-violet-400",
    indigo:  "text-indigo-400",
    rose:    "text-rose-400",
    cyan:    "text-cyan-400",
    orange:  "text-orange-400",
};

const barGradients: Record<SectionColor, string> = {
    blue:    "bg-gradient-to-r from-blue-500 to-transparent",
    sky:     "bg-gradient-to-r from-sky-500 to-transparent",
    emerald: "bg-gradient-to-r from-emerald-500 to-transparent",
    amber:   "bg-gradient-to-r from-amber-500 to-transparent",
    violet:  "bg-gradient-to-r from-violet-500 to-transparent",
    indigo:  "bg-gradient-to-r from-indigo-500 to-transparent",
    rose:    "bg-gradient-to-r from-rose-500 to-transparent",
    cyan:    "bg-gradient-to-r from-cyan-500 to-transparent",
    orange:  "bg-gradient-to-r from-orange-500 to-transparent",
};

interface SectionHeaderProps {
    icon: React.ReactNode;
    title: React.ReactNode;
    subtitle?: string;
    color?: SectionColor;
    size?: "sm" | "md" | "lg";
}

const titleSize = { sm: "text-base", md: "text-xl", lg: "text-2xl" };
const barWidth  = { sm: "w-10",     md: "w-14",    lg: "w-20"    };

export function SectionHeader({ icon, title, subtitle, color = "blue", size = "md" }: SectionHeaderProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <span className={iconColors[color]}>{icon}</span>
                <h2 className={`${titleSize[size]} font-black text-white tracking-tight leading-none`}>{title}</h2>
            </div>
            <div className={`h-[2px] ${barWidth[size]} ${barGradients[color]} rounded-full`} />
            {subtitle && <p className="text-[11px] text-neutral-500 leading-snug">{subtitle}</p>}
        </div>
    );
}
