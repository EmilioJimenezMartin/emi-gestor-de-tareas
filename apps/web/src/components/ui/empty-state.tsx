"use client";

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function EmptyState({ icon, title, description, action, size = "md", className }: EmptyStateProps) {
    const py = size === "sm" ? "py-8" : size === "lg" ? "py-20" : "py-12";
    const iconSize = size === "sm" ? "text-2xl" : size === "lg" ? "text-5xl" : "text-3xl";
    const titleSize = size === "sm" ? "text-xs" : "text-sm";

    return (
        <div className={`flex flex-col items-center justify-center gap-3 ${py} rounded-2xl border border-white/8 border-dashed ${className ?? ""}`}>
            {icon && (
                <div className={`${iconSize} text-neutral-700`}>{icon}</div>
            )}
            <div className="text-center space-y-1 px-4">
                <p className={`${titleSize} font-bold text-neutral-500`}>{title}</p>
                {description && (
                    <p className="text-[11px] text-neutral-700 leading-relaxed max-w-[260px] mx-auto">
                        {description}
                    </p>
                )}
            </div>
            {action && <div className="mt-1">{action}</div>}
        </div>
    );
}
