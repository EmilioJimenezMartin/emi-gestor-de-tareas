"use client";

import React from "react";
import { Layers, X } from "lucide-react";

export type NicheFilterStatus = "all" | "active" | "research" | "found" | "archived" | "none";

interface NicheItem {
    _id: string;
    name: string;
    nickname?: string;
}

interface Props {
    niches: NicheItem[];
    /** Count of total items (e.g. iaCatalogs.length) */
    totalCount: number;
    /** Returns how many items belong to a given niche ID */
    getCount: (nicheId: string) => number;
    /** Returns how many items match a given niche status */
    getStatusCount: (status: NicheFilterStatus) => number;

    statusFilter: NicheFilterStatus;
    onStatusFilterChange: (s: NicheFilterStatus) => void;

    selectedNicheId: string | null;
    onNicheChange: (id: string | null) => void;

    /** Label shown in the "all" button. Default: "Todos" */
    allLabel?: string;
}

export function NicheFilterBar({
    niches, totalCount, getCount, getStatusCount,
    statusFilter, onStatusFilterChange,
    selectedNicheId, onNicheChange,
    allLabel = "Todos",
}: Props) {
    const hasActiveFilter = statusFilter !== "all" || !!selectedNicheId;

    const clearAll = () => { onStatusFilterChange("all"); onNicheChange(null); };

    return (
        <div className="space-y-2">
            {/* Niche pills row */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                {/* "All" pill */}
                <button
                    onClick={() => { onStatusFilterChange("all"); onNicheChange(null); }}
                    className={`flex items-center gap-1.5 h-7 px-3 rounded-xl border text-xs font-black whitespace-nowrap shrink-0 transition-all ${
                        !selectedNicheId && statusFilter === "all"
                            ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                            : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-neutral-300 hover:border-white/15"
                    }`}>
                    <Layers size={9} />
                    {allLabel}
                    <span className="text-xs tabular-nums px-1 py-0.5 rounded bg-white/5 text-neutral-600">{totalCount}</span>
                </button>
                {/* "Sin nicho" pill */}
                <button
                    onClick={() => { onStatusFilterChange("none"); onNicheChange(null); }}
                    className={`flex items-center gap-1.5 h-7 px-3 rounded-xl border text-xs font-black whitespace-nowrap shrink-0 transition-all ${
                        statusFilter === "none"
                            ? "bg-neutral-500/20 border-neutral-500/40 text-neutral-300"
                            : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-neutral-300 hover:border-white/15"
                    }`}>
                    Sin nicho
                    <span className="text-xs tabular-nums px-1 py-0.5 rounded bg-white/5 text-neutral-600">{getStatusCount("none")}</span>
                </button>
                {/* Per-niche pills */}
                {niches.map(n => {
                    const count = getCount(n._id);
                    const isAct = selectedNicheId === n._id;
                    const label = n.nickname?.trim() || n.name;
                    return (
                        <button key={n._id}
                            onClick={() => { onStatusFilterChange("all"); onNicheChange(isAct ? null : n._id); }}
                            className={`flex items-center gap-1.5 h-7 px-3 rounded-xl border text-xs font-black whitespace-nowrap shrink-0 transition-all ${
                                isAct
                                    ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                                    : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-neutral-300 hover:border-white/15"
                            }`}>
                            {label}
                            <span className={`text-xs tabular-nums px-1 py-0.5 rounded ${isAct ? "bg-sky-500/30 text-sky-300" : count > 0 ? "bg-white/5 text-neutral-600" : "text-neutral-800"}`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Active filter label */}
            {hasActiveFilter && (
                <div className="flex items-center gap-2 px-1">
                    <div className="h-px flex-1 bg-sky-500/15" />
                    <span className="text-xs font-black uppercase tracking-widest text-sky-400/50">
                        {statusFilter === "none" ? "Sin nicho" : selectedNicheId ? (niches.find(n => n._id === selectedNicheId)?.nickname?.trim() || niches.find(n => n._id === selectedNicheId)?.name) : ""}
                    </span>
                    <button onClick={clearAll} className="text-neutral-700 hover:text-sky-400 transition-colors"><X size={10} /></button>
                    <div className="h-px flex-1 bg-sky-500/15" />
                </div>
            )}
        </div>
    );
}
