"use client";

import React from "react";

export interface StatusGroupOption {
    id: string;
    label: string;
    /** Tailwind bg color class for the dot (e.g. "bg-emerald-400"). Omit for icon slot. */
    dot?: string;
    /** Tailwind classes for the active state: bg + border + text */
    activeClass: string;
    count?: number;
    /** Optional icon to render instead of dot */
    icon?: React.ReactNode;
}

interface Props {
    options: StatusGroupOption[];
    value: string;
    onChange: (value: string) => void;
    size?: "xs" | "sm";
}

export function StatusGroupFilter({ options, value, onChange, size = "sm" }: Props) {
    const h   = size === "xs" ? "h-6"  : "h-7";
    const px  = size === "xs" ? "px-2.5" : "px-3";
    const txt = size === "xs" ? "text-xs"  : "text-xs";
    const cnt = size === "xs" ? "text-xs"  : "text-xs";

    return (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {options.map(opt => {
                const isAct = value === opt.id;
                return (
                    <button
                        key={opt.id}
                        onClick={() => onChange(opt.id)}
                        className={`flex items-center gap-1.5 ${h} ${px} rounded-xl border ${txt} font-black whitespace-nowrap shrink-0 transition-all ${
                            isAct
                                ? `${opt.activeClass} shadow-[0_0_10px_rgba(0,0,0,0.25)]`
                                : "border-white/8 bg-white/[0.02] text-neutral-600 hover:text-neutral-300 hover:border-white/15 hover:bg-white/[0.04]"
                        }`}
                    >
                        {opt.dot  && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opt.dot}`} />}
                        {!opt.dot && opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        {opt.label}
                        {opt.count !== undefined && opt.count > 0 && (
                            <span className={`${cnt} tabular-nums ${isAct ? "opacity-60" : "text-neutral-700"}`}>
                                {opt.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
