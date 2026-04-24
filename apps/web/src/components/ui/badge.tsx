"use client";

import * as React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: "success" | "warning" | "error" | "info" | "neutral";
}

export const Badge = ({ className, variant = "neutral", children, ...props }: BadgeProps) => {
    const variants = {
        success: "bg-emerald-500/10 text-emerald-500",
        warning: "bg-amber-500/10 text-amber-500",
        error: "bg-red-500/10 text-red-500",
        info: "bg-blue-500/10 text-blue-500",
        neutral: "bg-white/10 text-neutral-400",
    };

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${variants[variant]} ${className || ""}`}
            {...props}
        >
            {children}
        </span>
    );
};
