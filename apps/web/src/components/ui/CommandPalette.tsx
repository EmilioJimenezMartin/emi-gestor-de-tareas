"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
    Search, Home, CheckSquare, TrendingUp, Settings, Zap,
    Bot, BookOpen, LayoutGrid, ArrowRight, Loader2, X, Command,
} from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemKind = "nav" | "niche" | "action";

interface PaletteItem {
    id: string;
    kind: ItemKind;
    label: string;
    description?: string;
    icon: React.ReactNode;
    accent?: string;
    shortcut?: string;
    onSelect: () => void;
}

// ── Static items ──────────────────────────────────────────────────────────────

const NAV_ITEMS = (router: ReturnType<typeof useRouter>): PaletteItem[] => [
    {
        id: "nav-home", kind: "nav", label: "Home", description: "Página principal",
        icon: <Home size={14} />, accent: "text-neutral-400",
        onSelect: () => router.push("/"),
    },
    {
        id: "nav-tareas", kind: "nav", label: "Tareas", description: "Gestión de tareas",
        icon: <CheckSquare size={14} />, accent: "text-violet-400",
        onSelect: () => router.push("/tareas"),
    },
    {
        id: "nav-kdp", kind: "nav", label: "KDP Factory", description: "Autopilot · Catálogos · Nichos",
        icon: <BookOpen size={14} />, accent: "text-indigo-400",
        shortcut: "G F",
        onSelect: () => router.push("/tareas/kdp-factory/aplicacion"),
    },
    {
        id: "nav-dashboard", kind: "nav", label: "Dashboard", description: "Vista general",
        icon: <LayoutGrid size={14} />, accent: "text-sky-400",
        onSelect: () => router.push("/dashboard"),
    },
    {
        id: "nav-finanzas", kind: "nav", label: "Finanzas", description: "Ingresos y gastos",
        icon: <TrendingUp size={14} />, accent: "text-emerald-400",
        shortcut: "G $",
        onSelect: () => router.push("/finanzas"),
    },
    {
        id: "nav-ajustes", kind: "nav", label: "Ajustes", description: "Configuración del sistema",
        icon: <Settings size={14} />, accent: "text-neutral-400",
        onSelect: () => router.push("/ajustes"),
    },
];

const ACTION_ITEMS = (router: ReturnType<typeof useRouter>): PaletteItem[] => [
    {
        id: "action-autopilot", kind: "action", label: "Ir al Autopilot", description: "KDP Factory › Config",
        icon: <Bot size={14} />, accent: "text-violet-400",
        onSelect: () => router.push("/tareas/kdp-factory/aplicacion"),
    },
    {
        id: "action-pipeline", kind: "action", label: "Ver Pipeline", description: "Estado del pipeline de generación",
        icon: <Zap size={14} />, accent: "text-amber-400",
        onSelect: () => router.push("/tareas/kdp-factory/aplicacion"),
    },
];

// ── Fuzzy match ───────────────────────────────────────────────────────────────

function fuzzyMatch(query: string, target: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    if (t.includes(q)) return true;
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
        if (t[i] === q[qi]) qi++;
    }
    return qi === q.length;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
    open: boolean;
    onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [niches, setNiches] = useState<PaletteItem[]>([]);
    const [loadingNiches, setLoadingNiches] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Load niches when opened
    useEffect(() => {
        if (!open) return;
        setQuery("");
        setActiveIndex(0);
        inputRef.current?.focus();

        setLoadingNiches(true);
        fetch(`${API}/niches?limit=50&status=active`)
            .then(r => r.ok ? r.json() : { niches: [] })
            .then(data => {
                const list: PaletteItem[] = (data.niches ?? []).slice(0, 30).map((n: any) => ({
                    id: `niche-${n._id}`,
                    kind: "niche" as ItemKind,
                    label: n.name,
                    description: `${n.phase ?? "found"} · ${n.styleCategory ?? "generic"}`,
                    icon: <span className="text-[10px]">🎨</span>,
                    accent: "text-violet-300",
                    onSelect: () => {
                        router.push(`/tareas/kdp-factory/aplicacion`);
                        onClose();
                    },
                }));
                setNiches(list);
            })
            .catch(() => {})
            .finally(() => setLoadingNiches(false));
    }, [open]); // eslint-disable-line

    const allItems = useCallback((): PaletteItem[] => [
        ...NAV_ITEMS(router),
        ...ACTION_ITEMS(router),
        ...niches,
    ], [router, niches]);

    const filtered = useCallback((): { group: string; items: PaletteItem[] }[] => {
        const items = allItems().filter(
            item => fuzzyMatch(query, item.label) || fuzzyMatch(query, item.description ?? "")
        );
        const nav    = items.filter(i => i.kind === "nav");
        const action = items.filter(i => i.kind === "action");
        const niche  = items.filter(i => i.kind === "niche");
        const groups: { group: string; items: PaletteItem[] }[] = [];
        if (nav.length)    groups.push({ group: "Navegación", items: nav });
        if (action.length) groups.push({ group: "Acciones", items: action });
        if (niche.length)  groups.push({ group: "Nichos activos", items: niche });
        return groups;
    }, [query, allItems]);

    const flatFiltered = useCallback(() => filtered().flatMap(g => g.items), [filtered]);

    // Keyboard navigation
    useEffect(() => {
        if (!open) return;
        const flat = flatFiltered();
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flat.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); flat[activeIndex]?.onSelect(); onClose(); }
            else if (e.key === "Escape") { onClose(); }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, activeIndex, flatFiltered, onClose]);

    // Reset active index on query change
    useEffect(() => { setActiveIndex(0); }, [query]);

    // Scroll active item into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-active="true"]`);
        el?.scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    if (!open) return null;

    const groups = filtered();
    const flat   = flatFiltered();
    let globalIdx = -1;

    return createPortal(
        <div
            className="fixed inset-0 z-[999] flex items-start justify-center pt-[15vh]"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

            {/* Panel */}
            <div className="relative w-full max-w-[620px] mx-4 rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[60vh]">

                {/* Glow accent */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

                {/* Search input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
                    <Search size={16} className="text-neutral-500 shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar páginas, nichos, acciones…"
                        className="flex-1 bg-transparent text-white text-sm placeholder:text-neutral-600 focus:outline-none"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {loadingNiches && <Loader2 size={13} className="text-neutral-600 animate-spin shrink-0" />}
                    {query && (
                        <button onClick={() => setQuery("")} className="text-neutral-600 hover:text-neutral-400 transition-colors shrink-0">
                            <X size={13} />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="shrink-0 w-6 h-6 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X size={11} />
                    </button>
                </div>

                {/* Results */}
                <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain py-2">
                    {groups.length === 0 && !loadingNiches && (
                        <div className="flex flex-col items-center gap-2 py-10 text-neutral-700">
                            <Search size={20} />
                            <p className="text-[11px]">Sin resultados para &ldquo;{query}&rdquo;</p>
                        </div>
                    )}
                    {groups.map(({ group, items }) => (
                        <div key={group} className="mb-1">
                            <p className="px-5 py-1.5 text-[9px] font-black uppercase tracking-widest text-neutral-700">
                                {group}
                            </p>
                            {items.map(item => {
                                globalIdx++;
                                const idx = globalIdx;
                                const isActive = idx === activeIndex;
                                return (
                                    <button
                                        key={item.id}
                                        data-active={isActive}
                                        onClick={() => { item.onSelect(); onClose(); }}
                                        onMouseEnter={() => setActiveIndex(idx)}
                                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-all ${
                                            isActive
                                                ? "bg-white/[0.05]"
                                                : "hover:bg-white/[0.025]"
                                        }`}
                                    >
                                        {/* Active indicator */}
                                        <div className={`absolute left-0 w-0.5 h-6 rounded-r transition-all ${isActive ? "bg-violet-500" : "bg-transparent"}`} />

                                        <div className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                                            isActive
                                                ? "bg-violet-500/15 border border-violet-500/25"
                                                : "bg-white/[0.03] border border-white/6"
                                        } ${item.accent ?? "text-neutral-400"}`}>
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-bold leading-tight transition-colors ${isActive ? "text-white" : "text-neutral-300"}`}>
                                                {item.label}
                                            </p>
                                            {item.description && (
                                                <p className="text-[10px] text-neutral-600 leading-tight mt-0.5 truncate">
                                                    {item.description}
                                                </p>
                                            )}
                                        </div>
                                        {item.shortcut && (
                                            <div className="hidden sm:flex items-center gap-1 shrink-0">
                                                {item.shortcut.split(" ").map((k, i) => (
                                                    <kbd key={i} className="h-5 min-w-[20px] px-1.5 rounded border border-white/10 bg-white/[0.03] text-[9px] text-neutral-600 font-mono flex items-center justify-center">
                                                        {k}
                                                    </kbd>
                                                ))}
                                            </div>
                                        )}
                                        {isActive && (
                                            <ArrowRight size={12} className="text-violet-400 shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-4 text-[9px] text-neutral-700 font-mono">
                        <span className="flex items-center gap-1"><kbd className="border border-white/10 bg-white/[0.03] rounded px-1">↑↓</kbd> navegar</span>
                        <span className="flex items-center gap-1"><kbd className="border border-white/10 bg-white/[0.03] rounded px-1">⏎</kbd> abrir</span>
                        <span className="flex items-center gap-1"><kbd className="border border-white/10 bg-white/[0.03] rounded px-1">esc</kbd> cerrar</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-neutral-700">
                        <Command size={9} />
                        <span className="font-mono">K</span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ── Trigger hint for header ───────────────────────────────────────────────────

export function CommandPaletteTrigger({ onClick }: { onClick: () => void }) {
    const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
    return (
        <button
            onClick={onClick}
            className="hidden md:flex items-center gap-2 h-8 px-3 rounded-xl border border-white/8 bg-white/[0.025] text-neutral-600 hover:text-neutral-400 hover:border-white/15 transition-all text-[10px] font-mono"
        >
            <Search size={11} />
            <span className="text-[10px]">Buscar</span>
            <div className="flex items-center gap-0.5 ml-1">
                <kbd className="text-[9px] font-mono">{isMac ? "⌘" : "Ctrl"}</kbd>
                <kbd className="text-[9px] font-mono">K</kbd>
            </div>
        </button>
    );
}
