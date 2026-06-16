"use client";

export type ToggleColor = "violet" | "emerald" | "amber" | "sky" | "rose" | "indigo" | "neutral";

interface ToggleProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    color?: ToggleColor;
    size?: "sm" | "md";
    disabled?: boolean;
    className?: string;
}

const TRACK_ON: Record<ToggleColor, string> = {
    violet:  "bg-violet-500  shadow-[0_0_10px_rgba(139,92,246,0.35)]",
    emerald: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]",
    amber:   "bg-amber-500   shadow-[0_0_10px_rgba(245,158,11,0.35)]",
    sky:     "bg-sky-500     shadow-[0_0_10px_rgba(14,165,233,0.35)]",
    rose:    "bg-rose-500    shadow-[0_0_10px_rgba(244,63,94,0.35)]",
    indigo:  "bg-indigo-500  shadow-[0_0_10px_rgba(99,102,241,0.35)]",
    neutral: "bg-neutral-500 shadow-none",
};

export function Toggle({ checked, onChange, color = "violet", size = "md", disabled, className }: ToggleProps) {
    const isMd = size === "md";
    const track  = isMd ? "w-11 h-6" : "w-8 h-[18px]";
    const thumb  = isMd ? "w-5 h-5 top-0.5"     : "w-[14px] h-[14px] top-px";
    const thumbOn  = isMd ? "left-[22px]" : "left-[14px]";
    const thumbOff = "left-0.5";

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative ${track} rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:opacity-40 disabled:pointer-events-none ${checked ? TRACK_ON[color] : "bg-white/10"} ${className ?? ""}`}
        >
            <span
                className={`absolute ${thumb} rounded-full bg-white shadow-md transition-all duration-[180ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${checked ? thumbOn : thumbOff}`}
            />
        </button>
    );
}
