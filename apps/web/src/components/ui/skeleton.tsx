"use client";

// ── Base Skeleton ─────────────────────────────────────────────────────────────

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    rounded?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ className, width, height, rounded = "rounded-xl", style }: SkeletonProps) {
    return (
        <div
            className={`relative overflow-hidden bg-white/[0.035] ${rounded} ${className ?? ""}`}
            style={{ width, height, ...style }}
        >
            <div className="absolute inset-0 skeleton-shimmer" />
        </div>
    );
}

// ── Convenience variants ──────────────────────────────────────────────────────

export function SkeletonLine({ width = "100%", className }: { width?: string | number; className?: string }) {
    return <Skeleton height={11} width={width} rounded="rounded-full" className={className} />;
}

export function SkeletonCircle({ size = 40, className }: { size?: number; className?: string }) {
    return <Skeleton width={size} height={size} rounded="rounded-full" className={className} />;
}

/** Generic card-shaped skeleton */
export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div className={`rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-3 ${className ?? ""}`}>
            <div className="flex items-center gap-3">
                <Skeleton width={40} height={40} rounded="rounded-xl" />
                <div className="flex-1 space-y-2">
                    <SkeletonLine width="55%" />
                    <SkeletonLine width="35%" />
                </div>
            </div>
            <SkeletonLine />
            <SkeletonLine width="75%" />
        </div>
    );
}

/** Square image grid skeleton (e.g. catalog images) */
export function SkeletonImageGrid({
    count = 6,
    cols = 3,
    className,
}: {
    count?: number;
    cols?: 2 | 3 | 4;
    className?: string;
}) {
    const gridCols = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[cols];
    return (
        <div className={`grid ${gridCols} gap-2 ${className ?? ""}`}>
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" rounded="rounded-xl" />
            ))}
        </div>
    );
}

/** Niche/catalog list row skeleton */
export function SkeletonListRow({ className }: { className?: string }) {
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.015] ${className ?? ""}`}>
            <Skeleton width={36} height={36} rounded="rounded-xl" />
            <div className="flex-1 space-y-2">
                <SkeletonLine width="45%" />
                <SkeletonLine width="30%" />
            </div>
            <Skeleton width={60} height={22} rounded="rounded-lg" />
        </div>
    );
}

/** Stat card skeleton */
export function SkeletonStat({ className }: { className?: string }) {
    return (
        <div className={`rounded-2xl border border-white/6 bg-white/[0.02] p-4 space-y-3 ${className ?? ""}`}>
            <SkeletonLine width="40%" />
            <Skeleton height={32} width="60%" rounded="rounded-lg" />
            <SkeletonLine width="50%" />
        </div>
    );
}
