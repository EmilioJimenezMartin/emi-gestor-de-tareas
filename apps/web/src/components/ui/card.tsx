"use client";

import * as React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "glass" | "outline" | "solid";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = "outline", ...props }, ref) => {
        const variants = {
            glass: "glass",
            outline: "bg-secondary/50 border border-white/5",
            solid: "bg-secondary",
        };

        return (
            <div
                ref={ref}
                className={`rounded-3xl p-6 transition-all duration-300 ${variants[variant]} ${className || ""}`}
                {...props}
            />
        );
    }
);

Card.displayName = "Card";
