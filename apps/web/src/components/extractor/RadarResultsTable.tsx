"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    CheckCircle2, Download, RefreshCw, Flame, TrendingUp, Lightbulb,
    Star, ShoppingCart, ArrowUpDown, Plus, Loader2, Trash2, Calendar, X,
} from "lucide-react";
import { createApiSocket } from "@/lib/socket";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface EtsyListing {
    titulo_producto: string;
    precio: string;
    bestseller: boolean;
    personas_carrito: number;
    total_reseñas: number;
    sub_nicho_estimado: string;
    url_producto?: string;
    fecha_detectado?: string;
    fuente?: string;
    _nichoCreado?: boolean;
}

export interface EtsyNicheResult {
    nichos_detectados: EtsyListing[];
}

export interface RowAction {
    label: string;
    colorScheme?: "violet" | "indigo" | "amber" | "sky";
    isCreated: (row: EtsyListing) => boolean;
    onCreate: (row: EtsyListing) => Promise<void>;
}

interface Props {
    apiUrl: string;
    /** Clave única de esta app en Settings. Cada app tiene la suya. */
    storageKey: string;
    /** Nichos del usuario para detectar checkmarks persistidos (KDP). */
    niches?: { _id: string; name: string; sourceTitulo?: string }[];
    onNicheCreated?: () => void;
    /** Acción personalizada del botón de fila. Si no se pasa, usa la lógica de creación de nicho por defecto. */
    rowAction?: RowAction;
    /** Acción de pipeline adicional (segundo botón por fila). */
    pipelineAction?: RowAction;
}

type SortKey = keyof EtsyListing | "score";

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowScore(row: EtsyListing): number {
    return (
        (row.bestseller ? 3 : 0) +
        (row.personas_carrito >= 20 ? 3 : row.personas_carrito >= 10 ? 2 : row.personas_carrito > 0 ? 1 : 0) +
        (row.total_reseñas >= 1000 ? 3 : row.total_reseñas >= 100 ? 2 : row.total_reseñas > 0 ? 1 : 0)
    );
}

function demandSignal(row: EtsyListing): { label: string; cls: string; icon: "hot" | "mid" | "new" } {
    const score = rowScore(row);
    if (score >= 5) return { label: "Alta", cls: "text-rose-400 bg-rose-500/10 border-rose-500/20", icon: "hot" };
    if (score >= 2) return { label: "Media", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: "mid" };
    return { label: "Nueva", cls: "text-sky-400 bg-sky-500/10 border-sky-500/15", icon: "new" };
}

function exportCSV(rows: EtsyListing[]) {
    const headers = ["Título", "Precio", "Bestseller", "En carrito", "Reseñas", "Sub-nicho"];
    const lines = [
        headers.join(";"),
        ...rows.map(r => [
            `"${r.titulo_producto.replace(/"/g, '""')}"`,
            r.precio,
            r.bestseller ? "Sí" : "No",
            r.personas_carrito,
            r.total_reseñas,
            `"${r.sub_nicho_estimado.replace(/"/g, '""')}"`,
        ].join(";")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `radar-${Date.now()}.csv`;
    a.click();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RadarResultsTable({ apiUrl, storageKey, niches = [], onNicheCreated, rowAction, pipelineAction }: Props) {
    const [etsyResult, setEtsyResult] = useState<EtsyNicheResult | null>(null);
    const [createdNicheRows, setCreatedNicheRows] = useState<Set<string>>(new Set());
    const [omittedRows, setOmittedRows] = useState<Set<string>>(new Set());
    const [creatingRowTitle, setCreatingRowTitle] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>("personas_carrito");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
    const etsyResultRef = useRef<EtsyNicheResult | null>(null);

    // Keep ref in sync
    useEffect(() => { etsyResultRef.current = etsyResult; }, [etsyResult]);

    // ── Load persisted results on mount ───────────────────────────────────────
    useEffect(() => {
        fetch(`${apiUrl}/radar/saved-etsy-result?key=${storageKey}`)
            .then(r => r.json())
            .then(({ result }: any) => {
                if (result?.nichos_detectados?.length) {
                    setEtsyResult(result);
                    const created = new Set<string>(
                        (result.nichos_detectados as EtsyListing[])
                            .filter((r: EtsyListing) => r._nichoCreado)
                            .map((r: EtsyListing) => r.titulo_producto)
                    );
                    if (created.size > 0) setCreatedNicheRows(created);
                }
            })
            .catch(() => {});
    }, [apiUrl, storageKey]);

    // ── Socket: listen only to results for this storageKey ───────────────────
    useEffect(() => {
        const socket = createApiSocket(apiUrl);

        socket.on("radar:result", (data: any) => {
            // Only process results that belong to this table's storageKey
            if (data.storageKey !== storageKey) return;
            if (data.mode !== "etsy-niches" && data.mode !== "amazon-niches" && data.mode !== "trends-niches" && !data.data?.nichos_detectados) return;

            const incoming: EtsyListing[] = data.data?.nichos_detectados ?? [];
            const existing: EtsyListing[] = etsyResultRef.current?.nichos_detectados ?? [];
            const existingMap = new Map(existing.map(r => [r.titulo_producto, r]));

            const newRows = incoming.map(r => ({
                ...r,
                _nichoCreado: existingMap.get(r.titulo_producto)?._nichoCreado ?? r._nichoCreado,
            }));
            const appendedRows = existing.filter(r => !incoming.some(nr => nr.titulo_producto === r.titulo_producto));
            const merged: EtsyNicheResult = { ...data.data, nichos_detectados: [...newRows, ...appendedRows] };

            setEtsyResult(merged);

            // Persist immediately — this is the authoritative save for this app
            fetch(`${apiUrl}/radar/saved-etsy-result?key=${storageKey}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ result: merged }),
            }).catch(() => {});
        });

        // Niche rejected from Telegram — remove its row immediately without waiting for a reload
        socket.on("radar:row-deleted", (data: { storageKey: string; titulo_producto: string }) => {
            if (data.storageKey !== storageKey) return;
            setEtsyResult(prev => {
                if (!prev) return prev;
                return { ...prev, nichos_detectados: prev.nichos_detectados.filter(r => r.titulo_producto !== data.titulo_producto) };
            });
        });

        return () => { socket.disconnect(); };
    }, [apiUrl, storageKey]);

    // ── Actions ───────────────────────────────────────────────────────────────

    const persistResult = useCallback((result: EtsyNicheResult | null) => {
        fetch(`${apiUrl}/radar/saved-etsy-result?key=${storageKey}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ result }),
        }).catch(() => {});
    }, [apiUrl, storageKey]);

    const deleteRow = (row: EtsyListing) => {
        setConfirmModal({
            title: "Eliminar producto",
            message: `¿Eliminar "${row.titulo_producto.slice(0, 60)}${row.titulo_producto.length > 60 ? "…" : ""}" de la tabla?`,
            onConfirm: () => {
                const current = etsyResultRef.current;
                const updated = current
                    ? { ...current, nichos_detectados: current.nichos_detectados.filter(r => r.titulo_producto !== row.titulo_producto) }
                    : null;
                setEtsyResult(updated);
                fetch(`${apiUrl}/radar/etsy-row`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ titulo_producto: row.titulo_producto, key: storageKey }),
                }).catch(() => {});
                setConfirmModal(null);
            },
        });
    };

    const createNicheFromRow = async (row: EtsyListing) => {
        if (createdNicheRows.has(row.titulo_producto) || niches.some(n => n.sourceTitulo === row.titulo_producto)) return;
        setCreatedNicheRows(prev => new Set([...prev, row.titulo_producto]));
        try {
            const res = await fetch(`${apiUrl}/niches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: row.sub_nicho_estimado,
                    description: row.titulo_producto,
                    tags: row.sub_nicho_estimado.split(/[\s,]+/).filter(Boolean).slice(0, 5),
                    status: "found",
                    etsyUrl: row.url_producto || `https://www.etsy.com/search?q=${encodeURIComponent(row.sub_nicho_estimado)}`,
                    _sourceTitulo: row.titulo_producto,
                }),
            });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            onNicheCreated?.();
            toast.success(`Nicho "${row.sub_nicho_estimado}" creado`);
        } catch (e: any) {
            setCreatedNicheRows(prev => { const next = new Set(prev); next.delete(row.titulo_producto); return next; });
            toast.error(e.message ?? "Error creando nicho");
        }
    };

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("desc"); }
        setPage(0);
    };

    const sortedRows = etsyResult ? [...etsyResult.nichos_detectados].sort((a, b) => {
        // m=1 → asc (smaller first), m=-1 → desc (larger first)
        const m = sortDir === "asc" ? 1 : -1;
        if (sortKey === "score") return m * (rowScore(a) - rowScore(b));
        if (sortKey === "fecha_detectado") {
            const da = a.fecha_detectado ? new Date(a.fecha_detectado).getTime() : 0;
            const db = b.fecha_detectado ? new Date(b.fecha_detectado).getTime() : 0;
            return m * (da - db);
        }
        if (sortKey === "precio") {
            const pa = parseFloat(String(a.precio).replace(/[^0-9.]/g, "")) || 0;
            const pb = parseFloat(String(b.precio).replace(/[^0-9.]/g, "")) || 0;
            return m * (pa - pb);
        }
        if (sortKey === "bestseller") return m * ((a.bestseller ? 1 : 0) - (b.bestseller ? 1 : 0));
        const av = a[sortKey as keyof EtsyListing];
        const bv = b[sortKey as keyof EtsyListing];
        if (typeof av === "number" && typeof bv === "number") return m * (av - bv);
        return m * String(av ?? "").localeCompare(String(bv ?? ""));
    }) : [];

    const totalPages = pageSize === 0 ? 1 : Math.ceil(sortedRows.length / pageSize);
    const safePage = Math.min(page, Math.max(0, totalPages - 1));
    const pagedRows = pageSize === 0 ? sortedRows : sortedRows.slice(safePage * pageSize, (safePage + 1) * pageSize);
    const PAGE_SIZES = [10, 25, 50, 0] as const;

    const SortBtn = ({ k, label }: { k: SortKey; label: string }) => {
        const active = sortKey === k;
        return (
            <button onClick={() => toggleSort(k)}
                className={`flex items-center gap-1 h-6 px-2 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${active ? "bg-sky-500/10 border-sky-500/25 text-sky-400" : "border-transparent text-neutral-600 hover:text-neutral-300 hover:border-white/10"}`}>
                {label}
                {active
                    ? <span className="text-[9px] leading-none">{sortDir === "desc" ? "↓" : "↑"}</span>
                    : <ArrowUpDown size={7} className="text-neutral-700" />
                }
            </button>
        );
    };

    if (!etsyResult) return null;

    return (
        <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] overflow-hidden">
                <div className="h-px w-full bg-gradient-to-r from-sky-500/60 via-cyan-400/30 to-transparent" />
                <div className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-sky-400" />
                            <span className="text-[11px] font-black text-white">{etsyResult.nichos_detectados.length} productos detectados</span>
                            {etsyResult.nichos_detectados.filter(r => r.bestseller).length > 0 && (
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-400">
                                    {etsyResult.nichos_detectados.filter(r => r.bestseller).length} bestsellers
                                </span>
                            )}
                            {etsyResult.nichos_detectados.filter(r => demandSignal(r).icon === "hot").length > 0 && (
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/20 text-rose-400 flex items-center gap-1">
                                    <Flame size={8} />
                                    {etsyResult.nichos_detectados.filter(r => demandSignal(r).icon === "hot").length} señal alta
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => exportCSV(sortedRows)}
                                className="flex items-center gap-1.5 h-7 px-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[9px] font-black uppercase hover:bg-sky-500/20 transition-all">
                                <Download size={10} /> CSV
                            </button>
                            <button
                                onClick={() => { setEtsyResult(null); persistResult(null); }}
                                className="flex items-center gap-1.5 h-7 px-3 rounded-xl bg-white/5 border border-white/8 text-[9px] font-black uppercase text-neutral-400 hover:text-white hover:border-white/15 transition-all">
                                <RefreshCw size={10} /> Limpiar
                            </button>
                        </div>
                    </div>

                    {/* Sort controls */}
                    <div className="flex items-center gap-1.5 pb-2 border-b border-white/5 flex-wrap">
                        <span className="text-[8px] uppercase tracking-widest text-neutral-600 font-black mr-1">Ordenar</span>
                        <SortBtn k="score" label="Score" />
                        <SortBtn k="personas_carrito" label="Carrito" />
                        <SortBtn k="total_reseñas" label="Reseñas" />
                        <SortBtn k="bestseller" label="Bestseller" />
                        <SortBtn k="precio" label="Precio" />
                        <SortBtn k="fecha_detectado" label="Fecha" />
                        <SortBtn k="fuente" label="Fuente" />
                        <SortBtn k="sub_nicho_estimado" label="Sub-nicho" />
                        {(sortKey !== "personas_carrito" || sortDir !== "desc") && (
                            <button
                                onClick={() => { setSortKey("personas_carrito"); setSortDir("desc"); setPage(0); }}
                                className="flex items-center gap-1 h-6 px-2 rounded-lg border border-white/10 text-[8px] font-black uppercase tracking-widest text-neutral-500 hover:text-white hover:border-white/20 transition-all ml-1">
                                <X size={8} /> Limpiar
                            </button>
                        )}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-white/8">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white/[0.03] border-b border-white/8">
                                    <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600">#</th>
                                    <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600">Título</th>
                                    <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600 text-right">Precio</th>
                                    <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600 text-center">BS</th>
                                    <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600 text-right">Carrito</th>
                                    <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600 text-right">Reseñas</th>
                                    <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600">Sub-nicho</th>
                                    <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600 text-center">Señal</th>
                                    <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-600 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedRows.map((row, i) => {
                                const globalIndex = safePage * (pageSize || sortedRows.length) + i;
                                    const sig = demandSignal(row);
                                    return (
                                        <tr key={i} className={`border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.02] ${row.bestseller ? "bg-amber-500/[0.03]" : ""}`}>
                                            <td className="px-3 py-2.5 text-[9px] text-neutral-700 tabular-nums font-black">{globalIndex + 1}</td>
                                            <td className="px-3 py-2.5 max-w-[220px]">
                                                <p className="text-[10px] text-white font-semibold line-clamp-2 leading-snug">{row.titulo_producto}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                    {row.fuente && (
                                                        <span className={`inline-flex items-center gap-0.5 text-[7px] font-black px-1.5 py-0.5 rounded-md border ${
                                                            row.fuente === "amazon"
                                                                ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
                                                                : row.fuente === "etsy"
                                                                ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                                                : row.fuente === "trends"
                                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                                : "bg-neutral-500/10 border-neutral-500/20 text-neutral-500"
                                                        }`}>
                                                            {row.fuente === "amazon" ? "🛒" : row.fuente === "etsy" ? "🏪" : row.fuente === "trends" ? "📈" : "🌐"} {row.fuente}
                                                        </span>
                                                    )}
                                                    <span className="inline-flex items-center gap-1 text-[7px] text-neutral-500">
                                                        <Calendar size={7} />
                                                        {row.fecha_detectado
                                                            ? new Date(row.fecha_detectado).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })
                                                            : "—"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className="text-[10px] font-black text-emerald-400 tabular-nums">{row.precio}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                {row.bestseller
                                                    ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30"><Star size={9} className="text-amber-400 fill-amber-400" /></span>
                                                    : <span className="text-neutral-800 text-[9px]">—</span>
                                                }
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                {row.personas_carrito > 0
                                                    ? <span className={`text-[10px] font-black tabular-nums ${row.personas_carrito >= 20 ? "text-sky-400" : row.personas_carrito >= 10 ? "text-sky-400/70" : "text-neutral-400"}`}>{row.personas_carrito >= 20 ? "20+" : row.personas_carrito}</span>
                                                    : <span className="text-neutral-800 text-[9px]">—</span>
                                                }
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                {row.total_reseñas > 0
                                                    ? <span className={`text-[10px] font-black tabular-nums ${row.total_reseñas >= 1000 ? "text-emerald-400" : row.total_reseñas >= 100 ? "text-emerald-400/70" : "text-neutral-400"}`}>{row.total_reseñas >= 1000 ? `${(row.total_reseñas / 1000).toFixed(1)}k` : row.total_reseñas}</span>
                                                    : <span className="text-neutral-800 text-[9px]">—</span>
                                                }
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/15 text-sky-400 max-w-[180px] break-words whitespace-normal leading-tight inline-block">{row.sub_nicho_estimado}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-md border ${sig.cls}`}>
                                                    {sig.icon === "hot" ? <Flame size={8} /> : sig.icon === "mid" ? <TrendingUp size={8} /> : <Lightbulb size={8} />}
                                                    {sig.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {(() => {
                                                    const key = row.titulo_producto;
                                                    const omitted = omittedRows.has(key);
                                                    const accepted = createdNicheRows.has(key) || niches.some(n => n.sourceTitulo === key) || (rowAction ? rowAction.isCreated(row) : false);
                                                    const busy = creatingRowTitle === key || creatingRowTitle === `pipeline::${key}`;

                                                    if (omitted) {
                                                        return (
                                                            <div className="flex items-center justify-center">
                                                                <span className="inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[8px] font-black uppercase border border-neutral-700/40 bg-neutral-800/30 text-neutral-600">
                                                                    ⏭ Omitido
                                                                </span>
                                                            </div>
                                                        );
                                                    }

                                                    if (accepted) {
                                                        return (
                                                            <div className="flex items-center justify-center">
                                                                <span className="inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[8px] font-black uppercase border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                                                                    <CheckCircle2 size={8} /> Lanzado
                                                                </span>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="flex items-center gap-1 justify-center">
                                                            {/* Descartar */}
                                                            <button
                                                                onClick={() => deleteRow(row)}
                                                                title="Descartar y eliminar de la tabla"
                                                                className="inline-flex items-center gap-1 h-6 px-1.5 rounded-lg text-[8px] font-black uppercase border border-rose-500/20 bg-rose-500/5 text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/30 transition-all">
                                                                <Trash2 size={8} /> <span className="hidden sm:inline">Descartar</span>
                                                            </button>
                                                            {/* Omitir */}
                                                            <button
                                                                onClick={() => setOmittedRows(prev => new Set([...prev, key]))}
                                                                title="Omitir — marcar sin hacer nada"
                                                                className="inline-flex items-center gap-1 h-6 px-1.5 rounded-lg text-[8px] font-black uppercase border border-white/8 bg-white/[0.02] text-neutral-600 hover:text-neutral-300 hover:border-white/20 transition-all">
                                                                ⏭ <span className="hidden sm:inline">Omitir</span>
                                                            </button>
                                                            {/* Continuar */}
                                                            <button
                                                                onClick={async () => {
                                                                    setCreatingRowTitle(key);
                                                                    try {
                                                                        if (rowAction) {
                                                                            await rowAction.onCreate(row);
                                                                        } else {
                                                                            await createNicheFromRow(row);
                                                                        }
                                                                        if (pipelineAction) {
                                                                            setCreatingRowTitle(`pipeline::${key}`);
                                                                            await pipelineAction.onCreate(row);
                                                                        }
                                                                        setCreatedNicheRows(prev => new Set([...prev, key]));
                                                                    } catch (e: any) {
                                                                        toast.error(e.message ?? "Error");
                                                                    } finally {
                                                                        setCreatingRowTitle(null);
                                                                    }
                                                                }}
                                                                disabled={busy}
                                                                title="Continuar — crear nicho y lanzar pipeline"
                                                                className="inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[8px] font-black uppercase border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                                                {busy ? <Loader2 size={8} className="animate-spin" /> : <span>▶</span>}
                                                                {busy ? "…" : "Continuar"}
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                        {/* Page size selector */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600">Mostrar</span>
                            {PAGE_SIZES.map(s => (
                                <button key={s} onClick={() => { setPageSize(s); setPage(0); }}
                                    className={`h-6 px-2.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${pageSize === s ? "bg-sky-500/15 border-sky-500/30 text-sky-300" : "border-white/8 text-neutral-600 hover:text-neutral-300 hover:border-white/15"}`}>
                                    {s === 0 ? "Todos" : s}
                                </button>
                            ))}
                        </div>

                        {/* Page info + prev/next */}
                        {pageSize !== 0 && totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] text-neutral-600 tabular-nums">
                                    {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sortedRows.length)} de {sortedRows.length}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setPage(0)} disabled={safePage === 0}
                                        className="w-6 h-6 rounded-lg border border-white/8 text-[9px] text-neutral-600 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                        «
                                    </button>
                                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                                        className="w-6 h-6 rounded-lg border border-white/8 text-[9px] text-neutral-600 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                        ‹
                                    </button>
                                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                        const idx = totalPages <= 7 ? i : Math.max(0, Math.min(safePage - 3, totalPages - 7)) + i;
                                        return (
                                            <button key={idx} onClick={() => setPage(idx)}
                                                className={`w-6 h-6 rounded-lg border text-[8px] font-black transition-all ${idx === safePage ? "bg-sky-500/20 border-sky-500/35 text-sky-300" : "border-white/8 text-neutral-600 hover:text-neutral-300 hover:border-white/20"}`}>
                                                {idx + 1}
                                            </button>
                                        );
                                    })}
                                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1}
                                        className="w-6 h-6 rounded-lg border border-white/8 text-[9px] text-neutral-600 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                        ›
                                    </button>
                                    <button onClick={() => setPage(totalPages - 1)} disabled={safePage === totalPages - 1}
                                        className="w-6 h-6 rounded-lg border border-white/8 text-[9px] text-neutral-600 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                        »
                                    </button>
                                </div>
                            </div>
                        )}
                        {pageSize !== 0 && totalPages <= 1 && (
                            <span className="text-[8px] text-neutral-700 tabular-nums">{sortedRows.length} resultados</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirm delete modal */}
            <Modal open={!!confirmModal} onClose={() => setConfirmModal(null)} maxWidth="max-w-sm" showClose={false} zIndex={300}>
                <div className="p-6 space-y-5">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0 mt-0.5">
                            <Trash2 size={16} className="text-rose-400" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-black text-white">{confirmModal?.title}</p>
                            <p className="text-[11px] text-neutral-500 leading-relaxed">{confirmModal?.message}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setConfirmModal(null)}
                            className="h-9 px-4 rounded-xl bg-white/5 border border-white/8 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white hover:border-white/15 transition-all">
                            Cancelar
                        </button>
                        <button onClick={() => confirmModal?.onConfirm()}
                            className="h-9 px-5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[10px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/25 hover:border-rose-500/40 transition-all">
                            Eliminar
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
