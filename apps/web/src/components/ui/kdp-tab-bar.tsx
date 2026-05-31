import React from "react";

export interface KdpTabDef<T extends string = string> {
    id: T;
    label: string;
    icon: React.ReactNode;
    color?: string;      // inactive icon color, e.g. "text-amber-400"
    activeBg?: string;   // active button classes, e.g. "bg-amber-500/10 border-amber-500/25 text-amber-300"
}

interface KdpTabBarProps<T extends string = string> {
    tabs: KdpTabDef<T>[];
    active: T;
    onChange: (id: T) => void;
    className?: string;
}

export function KdpTabBar<T extends string = string>({
    tabs, active, onChange, className = "",
}: KdpTabBarProps<T>) {
    return (
        <div className={`flex gap-1 overflow-x-auto no-scrollbar ${className}`}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`flex items-center gap-1.5 h-9 px-4 rounded-xl border text-[11px] font-black whitespace-nowrap transition-all shrink-0
                        ${active === tab.id
                            ? (tab.activeBg ?? "bg-white/10 border-white/20 text-white")
                            : "border-white/8 text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.03]"
                        }`}
                >
                    <span className={active === tab.id ? "" : (tab.color ?? "text-neutral-500")}>
                        {tab.icon}
                    </span>
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
