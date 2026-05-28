"use client";

import React from "react";
import { Layers, X } from "lucide-react";
import { StatusGroupFilter } from "./status-group-filter";

export type NicheFilterStatus = "all" | "active" | "research" | "found" | "archived" | "none";

interface NicheItem {
    _id: string;
    name: string;
    status: "found" | "active" | "research" | "archived";
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

const STATUS_META: Array<{
    id: NicheFilterStatus;
    label: string;
    dot?: string;
    activeClass: string;
}> = [
    { id: "all",      label: "Todos",       dot: undefined,        activeClass: "bg-sky-500/20 border-sky-500/40 text-sky-300" },
    { id: "active",   label: "Activos",     dot: "bg-emerald-400", activeClass: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
    { id: "research", label: "En estudio",  dot: "bg-blue-400",    activeClass: "bg-blue-500/20 border-blue-500/40 text-blue-300" },
    { id: "found",    label: "Encontrados", dot: "bg-sky-400",     activeClass: "bg-sky-500/20 border-sky-500/40 text-sky-300" },
    { id: "none",     label: "Sin nicho",   dot: "bg-neutral-600", activeClass: "bg-neutral-500/20 border-neutral-500/40 text-neutral-300" },
    { id: "archived", label: "Archivados",  dot: "bg-neutral-700", activeClass: "bg-neutral-500/15 border-neutral-500/30 text-neutral-400" },
];

const STATUS_DOT: Record<string, string> = {
    found: "bg-sky-400",
    research: "bg-blue-400",
    active: "bg-emerald-400",
    archived: "bg-neutral-600",
};

export function NicheFilterBar({
    niches, totalCount, getCount, getStatusCount,
    statusFilter, onStatusFilterChange,
    selectedNicheId, onNicheChange,
    allLabel = "Todos",
}: Props) {
    const statusOptions = STATUS_META.map(s => ({
        id: s.id,
        label: s.id === "all" ? allLabel : s.label,
        dot: s.dot,
        icon: s.id === "all" ? <Layers size={9} /> : undefined,
        activeClass: s.activeClass,
        count: s.id === "all" ? totalCount : getStatusCount(s.id),
    }));

    const visibleNiches = statusFilter === "all"   ? niches
        : statusFilter === "none"    ? []
        : niches.filter(n => n.status === statusFilter);

    const hasActiveFilter = statusFilter !== "all" || !!selectedNicheId;

    const filterLabel = [
        statusFilter !== "all" && STATUS_META.find(s => s.id === statusFilter)?.label,
        selectedNicheId && niches.find(n => n._id === selectedNicheId)?.name,
    ].filter(Boolean).join(" · ");

    const clearAll = () => { onStatusFilterChange("all"); onNicheChange(null); };

    return (
        <div className="space-y-2">
            {/* Row 1: status group */}
            <StatusGroupFilter
                options={statusOptions}
                value={statusFilter}
                onChange={v => { onStatusFilterChange(v as NicheFilterStatus); onNicheChange(null); }}
                size="sm"
            />

            {/* Row 2: per-niche pills */}
            {visibleNiches.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                    {visibleNiches.map(n => {
                        const count = getCount(n._id);
                        const isAct = selectedNicheId === n._id;
                        return (
                            <button key={n._id}
                                onClick={() => onNicheChange(isAct ? null : n._id)}
                                className={`flex items-center gap-1.5 h-7 px-3 rounded-xl border text-xs font-black whitespace-nowrap shrink-0 transition-all ${
                                    isAct
                                        ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                                        : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-neutral-300 hover:border-white/15"
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[n.status] ?? "bg-neutral-500"}`} />
                                {n.name}
                                <span className={`text-xs tabular-nums px-1 py-0.5 rounded ${isAct ? "bg-sky-500/30 text-sky-300" : count > 0 ? "bg-white/5 text-neutral-600" : "text-neutral-800"}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Active filter label */}
            {hasActiveFilter && (
                <div className="flex items-center gap-2 px-1">
                    <div className="h-px flex-1 bg-sky-500/15" />
                    <span className="text-xs font-black uppercase tracking-widest text-sky-400/50">{filterLabel}</span>
                    <button onClick={clearAll} className="text-neutral-700 hover:text-sky-400 transition-colors"><X size={10} /></button>
                    <div className="h-px flex-1 bg-sky-500/15" />
                </div>
            )}
        </div>
    );
}
