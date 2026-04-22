"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", isLoading, disabled, children, ...props }, ref) => {
        const baseStyles = "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 focus:outline-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none";

        const sizes = {
            sm: "px-4 py-2 text-xs",
            md: "px-6 py-3 text-sm",
            lg: "px-8 py-4 text-base",
        };

        const variants = {
            primary: "bg-white text-black hover:bg-neutral-100 shadow-[0_8px_30px_rgb(255,255,255,0.1)]",
            secondary: "bg-[#1971ff] text-white hover:bg-[#1565e6] shadow-[0_8px_30px_rgba(25,113,255,0.2)]",
            outline: "border border-white/10 bg-transparent text-white hover:bg-white/5",
            ghost: "bg-transparent text-neutral-400 hover:text-white hover:bg-white/5",
        };

        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className || ""}`}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";
