"use client";

import * as React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="flex flex-col gap-1.5 w-full">
                {label && (
                    <label className="text-[13px] font-medium text-slate-400 px-0.5">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    <input
                        ref={ref}
                        className={`w-full h-12 bg-secondary border border-white/5 rounded-2xl px-4 text-sm text-white placeholder:text-neutral-500 outline-none transition-all duration-200 group-hover:border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/10 ${error ? "border-destructive/50 focus:border-destructive focus:ring-destructive/10" : ""
                            } ${className || ""}`}
                        {...props}
                    />
                </div>
                {error && (
                    <span className="text-[11px] font-medium text-red-500 px-1">
                        {error}
                    </span>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";
