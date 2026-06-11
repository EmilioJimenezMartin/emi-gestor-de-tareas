// Selects custom del dominio KDP (dropdown glass + buscador de nichos).
// Extraídos de kdp-factory-app.tsx sin cambios de lógica.
"use client";
import React from "react";
import { ChevronDown, Check, Search, Target, X } from "lucide-react";
import type { NicheFE } from "./types";

export function KdpSelect({ value, onChange, options, accent = "white" }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    accent?: "white" | "violet" | "amber";
}) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);
    const current = options.find(o => o.value === value);
    const ringCls = accent === "violet" ? "border-sky-500/50 bg-sky-500/5" : accent === "amber" ? "border-amber-500/50 bg-amber-500/5" : "border-white/20 bg-white/5";
    const activeCls = accent === "violet" ? "text-sky-300 bg-sky-500/10" : accent === "amber" ? "text-amber-300 bg-amber-500/10" : "text-white bg-white/10";
    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold text-white transition-all bg-white/[0.03] border-white/8 hover:${ringCls} ${open ? ringCls : ""}`}>
                <span>{current?.label ?? value}</span>
                <ChevronDown size={12} className={`text-neutral-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    {options.map(opt => (
                        <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5 ${opt.value === value ? activeCls : "text-neutral-300"}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── NicheSelect — shared searchable dropdown for picking a niche ─────────────
export function NicheSelect({
    niches,
    selectedId,
    onChange,
    placeholder = "Seleccionar nicho…",
    className = "",
}: {
    niches: NicheFE[];
    selectedId: string | null;
    onChange: (niche: NicheFE | null) => void;
    placeholder?: string;
    className?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const ref = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    React.useEffect(() => {
        if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 50); }
    }, [open]);

    const selected = niches.find(n => n._id === selectedId) ?? null;
    const display = selected ? (selected.nickname?.trim() || selected.name) : null;

    const filtered = niches.filter(n => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (n.nickname?.toLowerCase().includes(q) || n.name.toLowerCase().includes(q));
    });

    const nicheColor = (n: NicheFE) =>
        n.phase === "published" ? "text-emerald-400" : "text-neutral-300";

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`w-full h-8 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all ${
                    selectedId
                        ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                        : "border-white/10 bg-white/[0.03] text-neutral-500 hover:text-white hover:bg-white/6"
                }`}
            >
                <Target size={9} className="shrink-0 opacity-60" />
                <span className="flex-1 truncate text-left">{display ?? placeholder}</span>
                {selectedId && (
                    <span
                        role="button"
                        onClick={e => { e.stopPropagation(); onChange(null); }}
                        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                    >
                        <X size={10} />
                    </span>
                )}
                <ChevronDown size={10} className={`shrink-0 opacity-40 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-xl border border-white/12 bg-[#141414] shadow-2xl overflow-hidden">
                    <div className="px-2 pt-2 pb-1">
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Buscar nicho…"
                            className="w-full h-7 px-2.5 rounded-lg bg-white/6 border border-white/10 text-sm text-white outline-none placeholder:text-neutral-600"
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-neutral-600">Sin resultados</p>
                        ) : filtered.map(n => {
                            const label = n.nickname?.trim() || n.name;
                            const isSelected = n._id === selectedId;
                            return (
                                <button
                                    key={n._id}
                                    type="button"
                                    onClick={() => { onChange(isSelected ? null : n); setOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
                                        isSelected ? "bg-sky-500/15 text-sky-300" : "hover:bg-white/5 " + nicheColor(n)
                                    }`}
                                >
                                    <Target size={8} className="shrink-0 opacity-50" />
                                    <span className="flex-1 truncate font-medium">{label}</span>
                                    {isSelected && <Check size={9} className="shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
