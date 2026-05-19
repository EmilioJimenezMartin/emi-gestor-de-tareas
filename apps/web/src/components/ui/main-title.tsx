type TitleColor = "blue" | "sky" | "emerald" | "amber" | "violet" | "indigo" | "rose" | "cyan" | "orange";

const highlightGradients: Record<TitleColor, string> = {
    blue:    "from-blue-300 via-blue-400 to-cyan-400",
    sky:     "from-sky-300 via-sky-400 to-cyan-400",
    emerald: "from-emerald-300 via-emerald-400 to-teal-400",
    amber:   "from-amber-300 via-amber-400 to-orange-400",
    violet:  "from-violet-300 via-violet-400 to-purple-400",
    indigo:  "from-indigo-300 via-indigo-400 to-blue-400",
    rose:    "from-rose-300 via-rose-400 to-pink-400",
    cyan:    "from-cyan-300 via-cyan-400 to-sky-400",
    orange:  "from-orange-300 via-orange-400 to-amber-400",
};

interface MainTitleProps {
    /** White (neutral) part of the title */
    prefix?: string;
    /** Colored gradient part of the title */
    highlight: string;
    color?: TitleColor;
    size?: "xl" | "2xl" | "3xl" | "4xl";
    subtitle?: string;
    className?: string;
}

const sizeMap = { xl: "text-xl", "2xl": "text-2xl", "3xl": "text-3xl", "4xl": "text-4xl" };

export function MainTitle({ prefix, highlight, color = "blue", size = "3xl", subtitle, className = "" }: MainTitleProps) {
    const grad = highlightGradients[color];
    return (
        <div className={`space-y-1 ${className}`}>
            <h1 className={`${sizeMap[size]} font-black tracking-tight leading-tight`}>
                {prefix && <span className="text-white">{prefix} </span>}
                <span className={`bg-gradient-to-r ${grad} bg-clip-text text-transparent`}>{highlight}</span>
            </h1>
            {subtitle && <p className="text-xs text-neutral-500 font-medium">{subtitle}</p>}
        </div>
    );
}
