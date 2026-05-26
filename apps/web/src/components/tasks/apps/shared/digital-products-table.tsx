"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Plus, Trash2, Copy, Check, X, Search, Download,
    ExternalLink, Pencil, Loader2, AlertTriangle, RefreshCw, ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductPlatform {
    name: string;
    earnings: number;
    url: string;
    date?: string;
}

export interface EarningsSnapshot {
    date: string | Date;
    total: number;
}

export interface DigitalProduct {
    id: string;
    _id?: string;
    type: string;
    title: string;
    description: string;
    status: "activo" | "pausado" | "borrador";
    platforms: ProductPlatform[];
    totalEarnings: number;
    earningsHistory?: EarningsSnapshot[];
    createdAt: string;
}

export interface ProductType {
    id: string;
    name: string;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_PRODUCT_TYPES: ProductType[] = [
    { id: "kdp-color-book",   name: "KDP Color Book" },
    { id: "seamless-pattern", name: "Seamless Pattern" },
    { id: "poster-digital",   name: "Poster Digital" },
    { id: "ai-dataset",       name: "AI Dataset" },
    { id: "etsy-product",     name: "Producto Etsy" },
    { id: "clothing",         name: "Ropa / Apparel" },
    { id: "other",            name: "Otro" },
];

interface EtsySyncItem {
    listingId: string;
    title: string;
    sales: number;
    revenue: number;
}

interface DigitalProductsTableProps {
    apiBase: string;
    productTypes?: ProductType[];
    defaultPlatform?: string;
    /** When set, only products whose type matches one of these type IDs are shown */
    filterTypes?: string[];
    onProductsChange?: (products: DigitalProduct[]) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DigitalProductsTable({
    apiBase,
    productTypes = DEFAULT_PRODUCT_TYPES,
    defaultPlatform = "Plataforma",
    filterTypes,
    onProductsChange,
}: DigitalProductsTableProps) {

    const [products, setProducts]           = useState<DigitalProduct[]>([]);
    const [isLoading, setIsLoading]         = useState(true);

    // Etsy sync state
    const [showEtsySync, setShowEtsySync]   = useState(false);
    const [etsySyncData, setEtsySyncData]   = useState<EtsySyncItem[] | null>(null);
    const [etsySyncTotal, setEtsySyncTotal] = useState(0);
    const [isSyncing, setIsSyncing]         = useState(false);
    const [applyingId, setApplyingId]       = useState<string | null>(null);
    const [editingId, setEditingId]         = useState<string | null>(null);
    const [editDraft, setEditDraft]         = useState<DigitalProduct | null>(null);
    const [search, setSearch]               = useState("");
    const [typeFilter, setTypeFilter]       = useState("all");
    const [sort, setSort]                   = useState<"earnings" | "date" | "status">("earnings");
    const [viewMode, setViewMode]           = useState<"list" | "compact">("list");
    const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isBulkDeleting, setIsBulkDeleting]   = useState(false);
    const [quickEdit, setQuickEdit] = useState<{ productId: string; platIdx: number; value: string } | null>(null);

    // ── Load ──────────────────────────────────────────────────────────────────

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const res  = await fetch(`${apiBase}/digital-products`);
            const data = await res.json();
            const list = (data.products ?? []).map((p: any) => ({ ...p, id: p._id }));
            setProducts(list);
            onProductsChange?.(list);
        } catch { toast.error("Error cargando productos"); }
        finally { setIsLoading(false); }
    }, [apiBase, onProductsChange]);

    useEffect(() => { void fetchProducts(); }, [fetchProducts]);

    // ── Derived ───────────────────────────────────────────────────────────────

    const filtered = useMemo(() => {
        // Start with optional app-level type filter
        let list = filterTypes
            ? products.filter(p => filterTypes.some(fid => productTypes.find(t => t.id === fid)?.name === p.type))
            : products;
        // Then apply user's dropdown type filter
        if (typeFilter !== "all") {
            list = list.filter(p => p.type === (productTypes.find(t => t.id === typeFilter)?.name ?? ""));
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p => p.title.toLowerCase().includes(q) || p.type.toLowerCase().includes(q));
        }
        return [...list].sort((a, b) => {
            if (sort === "earnings") return b.totalEarnings - a.totalEarnings;
            if (sort === "date")     return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            return a.status.localeCompare(b.status);
        });
    }, [products, filterTypes, typeFilter, search, sort, productTypes]);

    // ── Mutations ─────────────────────────────────────────────────────────────

    const saveProduct = async (draft: DigitalProduct) => {
        const body = {
            type: draft.type, title: draft.title, description: draft.description,
            status: draft.status, platforms: draft.platforms,
            totalEarnings: draft.platforms.reduce((s, p) => s + (p.earnings || 0), 0),
        };
        try {
            if (draft._id) {
                const res = await fetch(`${apiBase}/digital-products/${draft._id}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
                });
                if (res.ok) {
                    const d = await res.json();
                    const updated = { ...d.product, id: d.product._id };
                    setProducts(ps => { const next = ps.map(p => p.id === draft.id ? updated : p); onProductsChange?.(next); return next; });
                }
            } else {
                const res = await fetch(`${apiBase}/digital-products`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
                });
                if (res.ok) {
                    const d = await res.json();
                    const saved = { ...d.product, id: d.product._id };
                    setProducts(ps => { const next = [saved, ...ps.filter(p => p.id !== draft.id)]; onProductsChange?.(next); return next; });
                }
            }
        } catch { toast.error("Error guardando producto"); }
    };

    const deleteProduct = async (id: string) => {
        const product = products.find(p => p.id === id);
        if (!product?._id) { setProducts(ps => { const next = ps.filter(p => p.id !== id); onProductsChange?.(next); return next; }); setConfirmDeleteId(null); return; }
        try {
            await fetch(`${apiBase}/digital-products/${product._id}`, { method: "DELETE" });
            setProducts(ps => { const next = ps.filter(p => p.id !== id); onProductsChange?.(next); return next; });
            setConfirmDeleteId(null);
            toast.success("Producto eliminado");
        } catch { toast.error("Error eliminando producto"); }
    };

    const duplicateProduct = async (product: DigitalProduct) => {
        const body = {
            type: product.type, title: `${product.title} (copia)`,
            description: product.description, status: "borrador" as const,
            platforms: product.platforms.map(p => ({ ...p, earnings: 0 })), totalEarnings: 0,
        };
        try {
            const res = await fetch(`${apiBase}/digital-products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (res.ok) {
                const d = await res.json();
                const saved = { ...d.product, id: d.product._id };
                setProducts(ps => { const next = [saved, ...ps]; onProductsChange?.(next); return next; });
                toast.success("Producto duplicado");
            }
        } catch { toast.error("Error duplicando"); }
    };

    const bulkDelete = async () => {
        setIsBulkDeleting(true);
        try {
            await Promise.all([...selectedIds].map(id => {
                const p = products.find(pr => pr.id === id);
                return p?._id ? fetch(`${apiBase}/digital-products/${p._id}`, { method: "DELETE" }).catch(() => {}) : Promise.resolve();
            }));
            setProducts(ps => { const next = ps.filter(p => !selectedIds.has(p.id)); onProductsChange?.(next); return next; });
            setSelectedIds(new Set());
        } catch { toast.error("Error en borrado masivo"); }
        finally { setIsBulkDeleting(false); }
    };

    const fetchEtsySync = async () => {
        setIsSyncing(true);
        setShowEtsySync(true);
        setEtsySyncData(null);
        try {
            const res  = await fetch(`${apiBase}/etsy/receipts-summary`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Error en sync Etsy");
            setEtsySyncData(data.summary ?? []);
            setEtsySyncTotal(data.totalRevenue ?? 0);
        } catch (e: any) {
            toast.error(e.message ?? "Error conectando con Etsy");
            setShowEtsySync(false);
        } finally { setIsSyncing(false); }
    };

    const applyEtsyRevenue = async (item: EtsySyncItem) => {
        // Try to find matching product (by title fuzzy match), then add/update Etsy platform earnings
        const match = products.find(p =>
            p.title.toLowerCase().includes(item.title.toLowerCase().slice(0, 20)) ||
            item.title.toLowerCase().includes(p.title.toLowerCase().slice(0, 20))
        );
        if (!match) {
            toast.error(`No se encontró producto para "${item.title.slice(0, 40)}"…`);
            return;
        }
        setApplyingId(item.listingId);
        const platforms = [...match.platforms];
        const etsyIdx   = platforms.findIndex(p => p.name === "Etsy");
        if (etsyIdx >= 0) {
            platforms[etsyIdx] = { ...platforms[etsyIdx], earnings: item.revenue };
        } else {
            platforms.push({ name: "Etsy", earnings: item.revenue, url: "" });
        }
        const body = { platforms, totalEarnings: platforms.reduce((s, p) => s + p.earnings, 0) };
        try {
            const res = await fetch(`${apiBase}/digital-products/${match._id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            if (res.ok) {
                const d = await res.json();
                const updated = { ...d.product, id: d.product._id };
                setProducts(ps => { const next = ps.map(p => p.id === match.id ? updated : p); onProductsChange?.(next); return next; });
                toast.success(`Aplicado ${item.revenue.toFixed(2)}€ a "${match.title}"`);
            }
        } catch { toast.error("Error aplicando ganancias"); }
        finally { setApplyingId(null); }
    };

    const createNew = async () => {
        const tempId = `temp_${Date.now()}`;
        const typeName = productTypes[0]?.name ?? "Otro";
        const newP: DigitalProduct = {
            id: tempId, type: typeName, title: "Nuevo producto",
            description: "", status: "borrador",
            platforms: [{ name: defaultPlatform, earnings: 0, url: "", date: "" }],
            totalEarnings: 0, createdAt: new Date().toISOString(),
        };
        try {
            const res = await fetch(`${apiBase}/digital-products`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: newP.type, title: newP.title, description: newP.description, status: newP.status, platforms: newP.platforms }),
            });
            if (res.ok) {
                const d = await res.json();
                const saved = { ...d.product, id: d.product._id };
                setProducts(ps => { const next = [saved, ...ps]; onProductsChange?.(next); return next; });
                setEditingId(saved.id);
                setEditDraft({ ...saved, platforms: saved.platforms.map((p: any) => ({ ...p })) });
                return;
            }
        } catch { /* fall through */ }
        setProducts(ps => { const next = [newP, ...ps]; onProductsChange?.(next); return next; });
        setEditingId(tempId);
        setEditDraft({ ...newP, platforms: [{ ...newP.platforms[0] }] });
    };

    const exportCsv = () => {
        const header = "Título,Tipo,Estado,Plataforma,Ganancias";
        const rows = products.flatMap(p =>
            p.platforms.map(pl => `"${p.title}","${p.type}","${p.status}","${pl.name}",${pl.earnings}`)
        );
        const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a"); a.href = url; a.download = "productos.csv"; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast.success("CSV exportado");
    };

    // ── Render helpers ────────────────────────────────────────────────────────

    const statusColors: Record<string, string> = {
        activo:   "bg-emerald-500/15 border-emerald-500/20 text-emerald-400",
        pausado:  "bg-amber-500/15 border-amber-500/20 text-amber-400",
        borrador: "bg-neutral-500/15 border-neutral-500/20 text-neutral-500",
    };

    return (
        <div className="space-y-4">
            {/* Header toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 mr-1">Productos</p>
                {products.length > 0 && (
                    <button onClick={exportCsv}
                        className="h-8 px-3 rounded-xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:border-white/20 flex items-center gap-1.5 transition-all text-[10px] font-black uppercase">
                        <Download size={11} /> CSV
                    </button>
                )}
                <div className="flex p-1 bg-white/[0.04] border border-white/8 rounded-xl gap-0.5 ml-auto">
                    <button onClick={() => setViewMode("list")} title="Vista lista"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${viewMode === "list" ? "bg-white/15 text-white" : "text-neutral-600 hover:text-neutral-400"}`}>
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="0" y="1" width="11" height="2" rx="1" fill="currentColor"/><rect x="0" y="5" width="11" height="2" rx="1" fill="currentColor"/><rect x="0" y="9" width="11" height="2" rx="1" fill="currentColor"/></svg>
                    </button>
                    <button onClick={() => setViewMode("compact")} title="Vista compacta"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${viewMode === "compact" ? "bg-white/15 text-white" : "text-neutral-600 hover:text-neutral-400"}`}>
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="0" y="0" width="11" height="1.5" rx="0.75" fill="currentColor"/><rect x="0" y="3.5" width="11" height="1.5" rx="0.75" fill="currentColor"/><rect x="0" y="7" width="11" height="1.5" rx="0.75" fill="currentColor"/><rect x="0" y="10" width="11" height="1.5" rx="0.75" fill="currentColor"/></svg>
                    </button>
                </div>
                <button onClick={() => void fetchEtsySync()} disabled={isSyncing}
                    className="h-8 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-[10px] font-black uppercase flex items-center gap-1.5 transition-all disabled:opacity-50"
                    title="Sincronizar ventas desde Etsy">
                    {isSyncing ? <Loader2 size={11} className="animate-spin" /> : <ShoppingBag size={11} />}
                    Etsy
                </button>
                <button onClick={() => void createNew()}
                    className="h-8 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all">
                    <Plus size={11} /> Añadir
                </button>
            </div>

            {/* Bulk bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <span className="text-[11px] font-black text-indigo-300 mr-auto">{selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}</span>
                    <button onClick={() => void bulkDelete()} disabled={isBulkDeleting}
                        className="h-7 px-3 rounded-xl bg-rose-500/15 border border-rose-500/20 text-[9px] font-black uppercase text-rose-400 hover:bg-rose-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50">
                        {isBulkDeleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />} Eliminar
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} className="h-7 px-2 rounded-xl text-neutral-600 hover:text-white transition-all">
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[150px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" size={12} />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar producto…"
                        className="h-8 w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-3 text-[11px] text-white placeholder:text-neutral-700 outline-none focus:border-indigo-500/40 transition-all" />
                    {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white"><X size={10} /></button>}
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                    className="h-8 rounded-xl bg-white/[0.04] border border-white/8 px-3 text-[11px] text-white outline-none [color-scheme:dark] cursor-pointer hover:border-white/15 transition-all">
                    <option value="all">Todos los tipos</option>
                    {productTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div className="flex p-1 bg-white/[0.03] border border-white/8 rounded-xl gap-0.5">
                    {(["earnings", "date", "status"] as const).map((val) => (
                        <button key={val} onClick={() => setSort(val)}
                            className={`h-6 px-2.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${sort === val ? "bg-indigo-500/20 text-indigo-300" : "text-neutral-600 hover:text-neutral-400"}`}>
                            {val === "earnings" ? "€" : val === "date" ? "Fecha" : "Estado"}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/[0.03] animate-pulse border border-white/5" />)}
                </div>
            ) : filtered.length === 0 && products.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-indigo-500/20 bg-indigo-500/[0.02] p-12 flex flex-col items-center gap-4 text-center">
                    <div className="p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-400"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    </div>
                    <div>
                        <p className="text-[14px] font-black text-white italic">Sin productos todavía</p>
                        <p className="text-[11px] text-neutral-600 mt-1">Registra tu primer activo digital para seguir sus ganancias</p>
                    </div>
                    <button onClick={() => void createNew()}
                        className="h-10 px-5 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all">
                        <Plus size={13} /> Añadir primer producto
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/8 p-10 flex flex-col items-center gap-3 text-center">
                    <Search size={24} className="text-neutral-700" />
                    <p className="text-[12px] font-black text-neutral-500 italic">Sin resultados</p>
                    <button onClick={() => { setSearch(""); setTypeFilter("all"); }} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-all">Limpiar filtros</button>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(product => {
                        const isSel = selectedIds.has(product.id);

                        if (viewMode === "compact") return (
                            <div key={product.id}
                                onClick={() => setSelectedIds(prev => { const n = new Set(prev); isSel ? n.delete(product.id) : n.add(product.id); return n; })}
                                className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all cursor-pointer ${isSel ? "border-indigo-500/40 bg-indigo-500/8" : "border-white/5 bg-white/[0.01] hover:border-white/12 hover:bg-white/[0.02]"}`}>
                                <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSel ? "border-indigo-400 bg-indigo-500" : "border-white/15 group-hover:border-white/30"}`}>
                                    {isSel && <Check size={8} className="text-white" />}
                                </div>
                                <span className="text-[9px] text-neutral-600 shrink-0 font-mono w-20 truncate">{product.type}</span>
                                <span className="flex-1 text-[12px] font-black text-white truncate">{product.title}</span>
                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border shrink-0 ${statusColors[product.status] ?? ""}`}>{product.status}</span>
                                <span className="text-[11px] font-black text-white tabular-nums shrink-0 w-20 text-right">{product.totalEarnings.toFixed(2)}€</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => { setEditingId(product.id); setEditDraft({ ...product, platforms: product.platforms.map(p => ({ ...p })) }); }}
                                        className="w-6 h-6 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-neutral-600 hover:text-indigo-400 transition-all"><Pencil size={9} /></button>
                                    <button onClick={() => void duplicateProduct(product)} className="w-6 h-6 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-neutral-600 hover:text-sky-400 transition-all"><Copy size={9} /></button>
                                    <button onClick={() => setConfirmDeleteId(product.id)} className="w-6 h-6 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-neutral-600 hover:text-rose-400 transition-all"><Trash2 size={9} /></button>
                                </div>
                            </div>
                        );

                        return (
                            <div key={product.id} className={`group relative rounded-2xl border bg-white/[0.01] hover:border-white/20 transition-all duration-300 overflow-hidden ${isSel ? "ring-1 ring-indigo-500/40 border-indigo-500/20" : "border-white/5"}`}>
                                {/* Checkbox */}
                                <div className={`absolute top-3 left-3 z-10 transition-opacity ${isSel ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                    onClick={() => setSelectedIds(prev => { const n = new Set(prev); isSel ? n.delete(product.id) : n.add(product.id); return n; })}>
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${isSel ? "border-indigo-400 bg-indigo-500" : "border-white/30 bg-black/40 backdrop-blur"}`}>
                                        {isSel && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><polyline points="1.5,4.5 3.8,7 7.5,1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                    </div>
                                </div>
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-blue-500 to-cyan-500 opacity-30 group-hover:opacity-100 transition-opacity" />

                                <div className="p-6">
                                    {editingId === product.id && editDraft ? (
                                        /* ── EDIT MODE ── */
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">{product.type}</span>
                                                <span className="text-[10px] text-neutral-700 font-mono">#{product.id.slice(-6)}</span>
                                            </div>
                                            <input value={editDraft.title} onChange={e => setEditDraft(d => d && ({ ...d, title: e.target.value }))}
                                                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white font-black text-lg italic outline-none focus:border-indigo-500/50"
                                                placeholder="Título del producto" />
                                            <textarea value={editDraft.description} onChange={e => setEditDraft(d => d && ({ ...d, description: e.target.value }))} rows={2}
                                                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-neutral-300 text-sm outline-none focus:border-indigo-500/50 resize-none"
                                                placeholder="Descripción / subtítulo" />
                                            {/* Type */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {productTypes.map(t => (
                                                    <button key={t.id} onClick={() => setEditDraft(d => d && ({ ...d, type: t.name }))}
                                                        className={`h-7 px-3 rounded-xl border text-[9px] font-black transition-all ${editDraft.type === t.name ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-300" : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-white"}`}>
                                                        {t.name}
                                                    </button>
                                                ))}
                                            </div>
                                            {/* Platforms */}
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Plataformas</p>
                                                {editDraft.platforms.map((plat, pi) => (
                                                    <div key={pi} className="flex flex-wrap gap-2 items-center p-3 rounded-xl bg-white/[0.02] border border-white/8">
                                                        <input value={plat.name}
                                                            onChange={e => setEditDraft(d => { if (!d) return d; const p = [...d.platforms]; p[pi] = { ...p[pi], name: e.target.value }; return { ...d, platforms: p }; })}
                                                            className="w-28 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-[11px] font-black text-white outline-none focus:border-indigo-500/40"
                                                            placeholder="Plataforma" />
                                                        <div className="flex items-center gap-1">
                                                            <input type="number" value={plat.earnings}
                                                                onChange={e => setEditDraft(d => { if (!d) return d; const p = [...d.platforms]; p[pi] = { ...p[pi], earnings: parseFloat(e.target.value) || 0 }; return { ...d, platforms: p, totalEarnings: p.reduce((s, x) => s + (x.earnings || 0), 0) }; })}
                                                                className="w-24 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-[11px] font-black text-emerald-400 outline-none focus:border-emerald-500/40"
                                                                placeholder="0.00" />
                                                            <span className="text-[10px] text-neutral-600">€</span>
                                                        </div>
                                                        <input type="date" value={plat.date ?? ""}
                                                            onChange={e => setEditDraft(d => { if (!d) return d; const p = [...d.platforms]; p[pi] = { ...p[pi], date: e.target.value }; return { ...d, platforms: p }; })}
                                                            className="bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-neutral-400 outline-none focus:border-indigo-500/40 [color-scheme:dark]" />
                                                        <input value={plat.url ?? ""}
                                                            onChange={e => setEditDraft(d => { if (!d) return d; const p = [...d.platforms]; p[pi] = { ...p[pi], url: e.target.value }; return { ...d, platforms: p }; })}
                                                            className="flex-1 min-w-[120px] bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-neutral-500 outline-none focus:border-indigo-500/40"
                                                            placeholder="https://… (URL)" />
                                                        <button onClick={() => setEditDraft(d => { if (!d) return d; const p = d.platforms.filter((_, i) => i !== pi); return { ...d, platforms: p, totalEarnings: p.reduce((s, x) => s + x.earnings, 0) }; })}
                                                            className="w-6 h-6 rounded-md text-neutral-600 hover:text-rose-400 flex items-center justify-center transition-all"><X size={11} /></button>
                                                    </div>
                                                ))}
                                                <button onClick={() => setEditDraft(d => d && ({ ...d, platforms: [...d.platforms, { name: "", earnings: 0, url: "", date: "" }] }))}
                                                    className="flex items-center gap-1.5 text-[10px] font-black text-neutral-600 hover:text-neutral-300 transition-all px-1">
                                                    <Plus size={11} /> Añadir plataforma
                                                </button>
                                            </div>
                                            {/* Status */}
                                            <div className="flex items-center gap-3">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 shrink-0">Estado</p>
                                                <div className="flex gap-2">
                                                    {(["activo", "pausado", "borrador"] as const).map(s => (
                                                        <button key={s} onClick={() => setEditDraft(d => d && ({ ...d, status: s }))}
                                                            className={`h-7 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${editDraft?.status === s ? statusColors[s] : "border-white/8 text-neutral-600 hover:text-neutral-400"}`}>
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end gap-2 pt-1">
                                                <button onClick={() => { setEditingId(null); setEditDraft(null); }}
                                                    className="h-8 px-3 rounded-xl border border-white/10 text-[10px] font-black text-neutral-400 hover:text-white transition-all">
                                                    Cancelar
                                                </button>
                                                <button onClick={async () => { if (!editDraft) return; await saveProduct(editDraft); setEditingId(null); setEditDraft(null); }}
                                                    className="h-8 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-black transition-all flex items-center gap-1.5">
                                                    <Check size={11} /> Guardar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── VIEW MODE ── */
                                        <div className="flex flex-col md:flex-row gap-5">
                                            <div className="flex-1 space-y-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${statusColors[product.status] ?? ""}`}>{product.status}</span>
                                                        <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">{product.type}</span>
                                                        <span className="text-[10px] text-neutral-700 font-mono">#{product.id.slice(-6)}</span>
                                                    </div>
                                                    <h3 className="text-xl font-black text-white italic tracking-tight">{product.title}</h3>
                                                    {product.description && <p className="text-sm text-neutral-500 leading-relaxed">{product.description}</p>}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {product.platforms.map((plat, platIdx) => {
                                                        const isQE = quickEdit?.productId === product.id && quickEdit.platIdx === platIdx;
                                                        return (
                                                            <div key={plat.name + platIdx} className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
                                                                <div className="flex items-center gap-2">
                                                                    {plat.url ? (
                                                                        <a href={plat.url} target="_blank" rel="noopener noreferrer"
                                                                            className="text-[10px] font-black uppercase text-neutral-500 hover:text-indigo-400 tracking-tighter transition-colors flex items-center gap-1">
                                                                            {plat.name} <ExternalLink size={9} />
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-[10px] font-black uppercase text-neutral-600 tracking-tighter">{plat.name}</span>
                                                                    )}
                                                                    <div className="w-px h-2.5 bg-white/10" />
                                                                    {isQE ? (
                                                                        <form onSubmit={async e => {
                                                                            e.preventDefault();
                                                                            const val = parseFloat(quickEdit!.value) || 0;
                                                                            const updated = { ...product, platforms: product.platforms.map((p, i) => i === platIdx ? { ...p, earnings: val } : p) };
                                                                            updated.totalEarnings = updated.platforms.reduce((s, p) => s + p.earnings, 0);
                                                                            await saveProduct(updated);
                                                                            setQuickEdit(null);
                                                                        }} className="flex items-center gap-1">
                                                                            <input autoFocus type="number" step="0.01" value={quickEdit!.value}
                                                                                onChange={e => setQuickEdit(q => q && ({ ...q, value: e.target.value }))}
                                                                                onKeyDown={e => e.key === "Escape" && setQuickEdit(null)}
                                                                                className="w-20 bg-white/[0.08] border border-emerald-500/40 rounded-lg px-2 py-0.5 text-[11px] font-black text-emerald-400 outline-none tabular-nums" />
                                                                            <button type="submit" className="text-emerald-400 hover:text-emerald-300"><Check size={11} /></button>
                                                                            <button type="button" onClick={() => setQuickEdit(null)} className="text-neutral-600 hover:text-white"><X size={11} /></button>
                                                                        </form>
                                                                    ) : (
                                                                        <button onClick={() => setQuickEdit({ productId: product.id, platIdx, value: String(plat.earnings) })}
                                                                            className="text-[11px] font-black italic text-emerald-400 tabular-nums hover:text-emerald-300 transition-colors" title="Click para editar">
                                                                            {plat.earnings.toFixed(2)}€
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {plat.date && <span className="text-[9px] text-neutral-700 font-mono">{new Date(plat.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex md:flex-col justify-between items-end md:w-40 md:border-l border-white/5 md:pl-6 pt-4 md:pt-0 border-t md:border-t-0 gap-3">
                                                <div className="text-right">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.05em] text-neutral-600 block">Total Profit</span>
                                                    <span className="text-2xl font-black italic text-white tabular-nums">{product.totalEarnings.toFixed(2)}€</span>
                                                </div>
                                                <div className="flex items-center gap-1 md:w-full">
                                                    <button onClick={() => { setEditingId(product.id); setEditDraft({ ...product, platforms: product.platforms.map(p => ({ ...p })) }); }}
                                                        className="flex-1 h-8 rounded-xl border border-white/8 text-neutral-600 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase">
                                                        <Pencil size={11} /> Editar
                                                    </button>
                                                    <button onClick={() => void duplicateProduct(product)}
                                                        className="h-8 w-8 rounded-xl border border-white/8 text-neutral-600 hover:text-sky-400 hover:border-sky-500/30 hover:bg-sky-500/5 transition-all flex items-center justify-center"><Copy size={12} /></button>
                                                    <button onClick={() => setConfirmDeleteId(product.id)}
                                                        className="h-8 w-8 rounded-xl border border-white/8 text-neutral-600 hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all flex items-center justify-center"><Trash2 size={12} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Etsy sync modal */}
            {showEtsySync && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowEtsySync(false)} />
                    <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-[28px] p-6 shadow-2xl animate-in zoom-in-95 duration-300 space-y-4 max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
                                    <ShoppingBag size={14} className="text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-black text-white">Sync desde Etsy</p>
                                    <p className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">
                                        {isSyncing ? "Cargando…" : `${etsySyncData?.length ?? 0} listings · ${etsySyncTotal.toFixed(2)}€ total`}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowEtsySync(false)} className="w-7 h-7 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white transition-all">
                                <X size={12} />
                            </button>
                        </div>

                        {isSyncing ? (
                            <div className="flex-1 flex items-center justify-center py-12">
                                <Loader2 size={28} className="animate-spin text-amber-400" />
                            </div>
                        ) : etsySyncData && etsySyncData.length === 0 ? (
                            <p className="text-[11px] text-neutral-600 italic text-center py-8">No se encontraron receipts pagados</p>
                        ) : (
                            <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
                                <p className="text-[9px] text-neutral-600 font-black uppercase tracking-widest mb-2">
                                    Haz clic en "Aplicar" para actualizar las ganancias del producto coincidente
                                </p>
                                {(etsySyncData ?? []).map(item => {
                                    const match = products.find(p =>
                                        p.title.toLowerCase().includes(item.title.toLowerCase().slice(0, 20)) ||
                                        item.title.toLowerCase().includes(p.title.toLowerCase().slice(0, 20))
                                    );
                                    return (
                                        <div key={item.listingId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-black text-white truncate">{item.title}</p>
                                                <p className="text-[9px] text-neutral-600">
                                                    {item.sales} ventas · {item.revenue.toFixed(2)}€
                                                    {match && <span className="ml-2 text-emerald-500">→ {match.title.slice(0, 25)}</span>}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => void applyEtsyRevenue(item)}
                                                disabled={!match || applyingId === item.listingId}
                                                className="shrink-0 h-7 px-3 rounded-xl bg-amber-500/15 border border-amber-500/20 text-[9px] font-black text-amber-300 hover:bg-amber-500/25 transition-all disabled:opacity-30 flex items-center gap-1">
                                                {applyingId === item.listingId ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
                                                Aplicar
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete confirm modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setConfirmDeleteId(null)} />
                    <div className="relative w-full max-w-sm bg-black border border-white/10 rounded-[28px] p-7 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col items-center gap-5 text-center">
                        <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                            <AlertTriangle size={28} />
                        </div>
                        <div>
                            <p className="text-[16px] font-black text-white italic">¿Eliminar producto?</p>
                            <p className="text-[11px] text-neutral-400 mt-1">Esta acción no se puede deshacer.</p>
                        </div>
                        <div className="flex gap-3 w-full">
                            <button onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 h-10 rounded-xl border border-white/10 text-[10px] font-black text-neutral-400 hover:text-white transition-all">Cancelar</button>
                            <button onClick={() => void deleteProduct(confirmDeleteId)}
                                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black transition-all">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
