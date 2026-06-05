"use client";
import React from "react";
import {
    Loader2, GripVertical, Copy, FileText, Download, RefreshCw, Target, StopCircle,
    Trash2, SkipForward, CheckCheck, X, Check, Heart, ArrowUpRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Shared types (mirror of kdp-factory-app.tsx) ────────────────────────────
export interface CatalogImageFE {
    publicId: string; url: string; width: number; height: number; bytes: number; createdAt: string;
}
export interface IACatalogFE {
    _id: string; name: string; prompt: string;
    promptParts?: { theme: string; specs: string; details: string; particulars: string };
    productType?: "coloring-book" | "printable-poster" | "seamless-pattern" | "other";
    creativity?: number; negativePrompt?: string;
    aiModel: { id: string; name: string; provider: string; modelId: string };
    width: number; height: number; totalImages: number;
    images: CatalogImageFE[];
    status: "queued" | "pending" | "running" | "completed" | "failed" | "cancelled";
    lastError?: string; skippedImages?: number; nicheIds?: string[];
    currentPrompt?: string; createdAt: string; imageStartedAt?: number;
}
export interface NicheFE {
    _id: string; name: string; nickname?: string;
    status: "found" | "active" | "research" | "archived";
    catalogIds?: string[];
}

// ── Context (stable callbacks from parent) ───────────────────────────────────
export interface KdpCardActions {
    setDraggingId: (id: string | null) => void;
    setDragOverId: (id: string | null) => void;
    handleQueueReorder: (fromId: string, toId: string) => Promise<void>;
    onReuseConfig: (catalog: IACatalogFE) => void;
    onOpenEditor: (catalog: IACatalogFE) => void;
    onDownloadPdf: (catalog: IACatalogFE) => void;
    onExportDataset: (catalog: IACatalogFE) => void;
    retryFailedSlots: (catalogId: string) => Promise<void>;
    skipCatalogImage: (catalogId: string) => void;
    forceCompleteCatalog: (catalogId: string) => void;
    setConfirmStopCatalogId: (id: string | null) => void;
    setConfirmDeleteCatalogId: (id: string | null) => void;
    setCatalogNichePickerId: (id: string | null) => void;
    onToggleNiche: (catalogId: string, nicheId: string, assigned: boolean) => void;
    setBulkDeleteCatalogId: (id: string | null) => void;
    setBulkDeleteSelection: React.Dispatch<React.SetStateAction<Set<string>>>;
    onBulkDeleteImages: (catalogId: string) => Promise<void>;
    toggleImageSelect: (url: string) => void;
    openCatalogImagePreview: (images: CatalogImageFE[], index: number, catalogId?: string) => void;
    toggleFavorite: (url: string, meta?: { label: string; source: "vault" | "catalog" | "cloudinary" | "generated" }) => void;
    upscaleImage: (url: string, publicId: string) => Promise<void>;
    statusBadge: (status: IACatalogFE["status"]) => React.ReactNode;
}

export const KdpCardCtx = React.createContext<KdpCardActions | null>(null);

// ── Props ────────────────────────────────────────────────────────────────────
export interface CatalogCardProps {
    catalog: IACatalogFE;
    tick: number;
    niches: NicheFE[];
    allCatalogs: IACatalogFE[];
    isDragOver: boolean;
    isDragging: boolean;
    isNichePickerOpen: boolean;
    isBulkMode: boolean;
    bulkSelection: Set<string>;
    draggingId: string | null;
    isVaultSelectMode: boolean;
    selectedUrls: Set<string>;
    favorites: { has: (url: string) => boolean };
    upscalingId: string | null;
    isRetrying: boolean;
    isDeleting: boolean;
    isForceCompleting: boolean;
    isSkippingImage: boolean;
    isDirectPdf: boolean;
    isBulkDeleting: boolean;
}

const nd = (n: { name: string; nickname?: string }) => n.nickname?.trim() || n.name;

// ── Component ────────────────────────────────────────────────────────────────
export const CatalogCard = React.memo(function CatalogCard({
    catalog, tick, niches, allCatalogs,
    isDragOver, isDragging, draggingId, isNichePickerOpen,
    isBulkMode, bulkSelection, isVaultSelectMode, selectedUrls,
    favorites, upscalingId, isRetrying, isDeleting, isForceCompleting, isSkippingImage, isDirectPdf, isBulkDeleting,
}: CatalogCardProps) {
    const actions = React.useContext(KdpCardCtx)!;

    const progress = catalog.totalImages > 0 ? (catalog.images.length / catalog.totalImages) * 100 : 0;
    const isActive = catalog.status === "running" || catalog.status === "pending" || catalog.status === "queued";
    const queuedList = allCatalogs.filter(c => c.status === "queued");
    const queuePos = catalog.status === "queued" ? queuedList.indexOf(catalog) + 1 : 0;
    const remainingImages = Math.max(0, catalog.totalImages - catalog.images.length - (catalog.skippedImages ?? 0));
    const estMin = Math.round(remainingImages * 1.5);
    const timeStr = estMin > 60 ? `~${Math.floor(estMin / 60)}h ${estMin % 60}m` : estMin > 0 ? `~${estMin}m` : "";

    // Image elapsed time (tick prop drives re-render for running catalogs)
    void tick;
    const imgElapsedMs = catalog.status === "running" && catalog.imageStartedAt
        ? Date.now() - catalog.imageStartedAt : 0;
    const imgElapsedSec = Math.floor(imgElapsedMs / 1000);
    const imgElapsedStr = imgElapsedMs > 0
        ? `${Math.floor(imgElapsedSec / 60)}:${String(imgElapsedSec % 60).padStart(2, "0")}`
        : null;
    const imgHeatLevel = imgElapsedMs <= 0 ? 0
        : imgElapsedMs < 2 * 60_000 ? 0
        : imgElapsedMs < 4 * 60_000 ? 1
        : imgElapsedMs < 6 * 60_000 ? 2 : 3;
    const heatBorderCls = imgHeatLevel === 1 ? "border-yellow-500/40"
        : imgHeatLevel === 2 ? "border-orange-500/50"
        : imgHeatLevel === 3 ? "border-red-500/60 animate-pulse" : "";
    const heatBarColor = imgHeatLevel === 1 ? "#eab308"
        : imgHeatLevel === 2 ? "#f97316"
        : imgHeatLevel === 3 ? "#ef4444" : null;

    const providerColor = catalog.aiModel?.provider === "Google"
        ? { bar: "bg-blue-500/50", gradient: "from-blue-500 via-blue-400 to-cyan-400", border: "hover:border-blue-500/20", glow: "hover:shadow-[0_0_28px_rgba(59,130,246,0.10)]", blob: "bg-blue-500/8", badge: "bg-blue-500/10 border-blue-500/20 text-blue-300", dot: "bg-blue-400" }
        : catalog.aiModel?.provider === "Leonardo"
        ? { bar: "bg-amber-500/50", gradient: "from-amber-500 via-orange-400 to-amber-300", border: "hover:border-amber-500/20", glow: "hover:shadow-[0_0_28px_rgba(245,158,11,0.10)]", blob: "bg-amber-500/8", badge: "bg-amber-500/10 border-amber-500/20 text-amber-300", dot: "bg-amber-400" }
        : catalog.aiModel?.provider === "Segmind"
        ? { bar: "bg-green-500/50", gradient: "from-green-500 via-emerald-400 to-teal-400", border: "hover:border-green-500/20", glow: "hover:shadow-[0_0_28px_rgba(34,197,94,0.10)]", blob: "bg-green-500/8", badge: "bg-green-500/10 border-green-500/20 text-green-300", dot: "bg-green-400" }
        : catalog.aiModel?.provider === "Pollinations"
        ? { bar: "bg-emerald-500/50", gradient: "from-emerald-500 via-emerald-400 to-cyan-400", border: "hover:border-emerald-500/20", glow: "hover:shadow-[0_0_28px_rgba(16,185,129,0.10)]", blob: "bg-emerald-500/8", badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300", dot: "bg-emerald-400" }
        : catalog.aiModel?.provider === "Stable Horde"
        ? { bar: "bg-sky-500/50", gradient: "from-sky-500 via-sky-400 to-blue-400", border: "hover:border-sky-500/20", glow: "hover:shadow-[0_0_28px_rgba(14,165,233,0.10)]", blob: "bg-sky-500/8", badge: "bg-sky-500/10 border-sky-500/20 text-sky-300", dot: "bg-sky-400" }
        : { bar: "bg-sky-500/50", gradient: "from-sky-500 via-sky-400 to-cyan-400", border: "hover:border-sky-500/20", glow: "hover:shadow-[0_0_28px_rgba(14,165,233,0.10)]", blob: "bg-sky-500/8", badge: "bg-sky-500/10 border-sky-500/20 text-sky-300", dot: "bg-sky-400" };

    const isDraggable = catalog.status === "queued";

    return (
        <Card
            key={catalog._id}
            variant="outline"
            draggable={isDraggable}
            onDragStart={() => isDraggable && actions.setDraggingId(catalog._id)}
            onDragEnd={() => { actions.setDraggingId(null); actions.setDragOverId(null); }}
            onDragOver={(e: React.DragEvent) => { if (isDraggable && draggingId) { e.preventDefault(); actions.setDragOverId(catalog._id); } }}
            onDrop={(e: React.DragEvent) => { e.preventDefault(); if (draggingId && isDraggable) void actions.handleQueueReorder(draggingId, catalog._id); actions.setDraggingId(null); actions.setDragOverId(null); }}
            className={`group relative bg-white/[0.01] overflow-hidden transition-all duration-300 ${imgHeatLevel > 0 ? heatBorderCls : `border-white/5 ${providerColor.border} ${providerColor.glow}`} ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragOver ? "ring-1 ring-orange-500/50 border-orange-500/30" : ""} ${isDragging ? "opacity-50" : ""}`}
        >
            <div className={`absolute -right-4 -top-4 w-16 h-16 ${providerColor.blob} blur-2xl rounded-full opacity-50 transition-all duration-500 group-hover:scale-[2] group-hover:opacity-80`} />
            <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${providerColor.gradient} opacity-40 group-hover:opacity-100 transition-all duration-300`} />
            {heatBarColor && imgElapsedMs > 0 ? (
                <div className="h-[3px] w-full bg-white/5 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 transition-all duration-1000"
                        style={{ width: `${Math.min(100, (imgElapsedMs / (8 * 60_000)) * 100)}%`, background: heatBarColor, boxShadow: `0 0 6px ${heatBarColor}` }} />
                </div>
            ) : (
                <div className={`h-px w-full ${providerColor.bar} opacity-60`} />
            )}
            <div className="p-4 pl-5 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            {isDraggable && <GripVertical size={12} className="text-neutral-700 shrink-0" />}
                            <h4 className="font-black text-white text-lg leading-tight truncate">{catalog.name}</h4>
                        </div>
                        <p className="text-sm text-neutral-500 line-clamp-1 leading-relaxed pl-0.5 italic">{catalog.prompt}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {actions.statusBadge(catalog.status)}
                        <span className="text-sm text-neutral-600 font-mono">{new Date(catalog.createdAt).toLocaleDateString("es-ES")}</span>
                    </div>
                </div>
                {/* Model badge + meta */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 backdrop-blur-sm">
                        <div className={`w-1.5 h-1.5 rounded-full ${providerColor.dot} shrink-0`} />
                        <span className={`text-sm font-black uppercase tracking-wider ${providerColor.badge.split(" ").find(c => c.startsWith("text-")) ?? "text-neutral-400"}`}>{catalog.aiModel?.provider}</span>
                        <span className="text-neutral-700 text-sm">·</span>
                        <span className="text-sm font-mono text-neutral-400 truncate max-w-[160px]">{catalog.aiModel?.name.split(" ").slice(0, 3).join(" ")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-mono text-neutral-600 flex-wrap">
                        <span>{catalog.width}×{catalog.height}</span>
                        <span className="text-neutral-700">·</span>
                        <span className="font-black text-neutral-400">{catalog.images.length}/{catalog.totalImages}</span>
                        {isActive && catalog.status !== "queued" && <Loader2 size={9} className="text-blue-400 animate-spin" />}
                        {(catalog.skippedImages ?? 0) > 0 && <span className="text-amber-500/70 not-mono">· {catalog.skippedImages} omit.</span>}
                        {isActive && catalog.status === "running" && timeStr && <span className="text-sky-400/70 not-mono">· {timeStr}</span>}
                        {imgElapsedStr && (
                            <span className={`not-mono font-black px-1.5 py-0.5 rounded-md text-[10px] ${
                                imgHeatLevel === 0 ? "text-neutral-600" :
                                imgHeatLevel === 1 ? "text-yellow-400 bg-yellow-500/10" :
                                imgHeatLevel === 2 ? "text-orange-400 bg-orange-500/10" :
                                "text-red-400 bg-red-500/10"
                            }`}>
                                {imgHeatLevel === 3 ? "⚠ " : imgHeatLevel === 2 ? "● " : ""}{imgElapsedStr}
                            </span>
                        )}
                    </div>
                </div>
                {/* Niche tags */}
                {(catalog.nicheIds?.length ?? 0) > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                        {catalog.nicheIds!.map(nid => {
                            const n = niches.find(n => n._id === nid);
                            return n ? (
                                <span key={nid} className="flex items-center gap-1 px-2 h-5 rounded-full bg-sky-500/10 border border-sky-500/20 text-xs font-bold text-sky-400">
                                    <Target size={7} /> {nd(n)}
                                </span>
                            ) : null;
                        })}
                    </div>
                )}
                {/* Error */}
                {catalog.lastError && (
                    <p className="text-sm text-red-400/70 font-mono break-all leading-relaxed bg-red-500/5 border border-red-500/10 rounded-lg px-2 py-1.5">
                        {catalog.lastError}
                    </p>
                )}
                {/* Action buttons */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            onClick={() => actions.onReuseConfig(catalog)}
                            title="Cargar prompt, modelo y resolución"
                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white transition-all border border-white/10 text-sm font-black uppercase tracking-widest"
                        >
                            <Copy size={11} /> Reusar
                        </button>
                        {catalog.images.length > 0 && (
                            <>
                                <button
                                    onClick={() => actions.onOpenEditor(catalog)}
                                    title="Editar PDF en editor"
                                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/20 text-sm font-black uppercase tracking-widest"
                                >
                                    <FileText size={11} /> Editor
                                </button>
                                <button
                                    onClick={() => actions.onDownloadPdf(catalog)}
                                    disabled={isDirectPdf}
                                    title={`Descargar PDF directo · ${catalog.images.length} páginas`}
                                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-all border border-sky-500/20 text-sm font-black uppercase tracking-widest disabled:opacity-50"
                                >
                                    {isDirectPdf ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                    PDF
                                </button>
                                <button
                                    onClick={() => actions.onExportDataset(catalog)}
                                    title="Exportar como dataset HuggingFace (.jsonl)"
                                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-all border border-violet-500/20 text-sm font-black uppercase tracking-widest"
                                >
                                    <Download size={11} /> Dataset
                                </button>
                            </>
                        )}
                        {(catalog.skippedImages ?? 0) > 0 && !isActive && (
                            <button
                                onClick={() => void actions.retryFailedSlots(catalog._id)}
                                disabled={isRetrying}
                                title={`Reintentar ${catalog.skippedImages} fallados`}
                                className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/20 text-sm font-black uppercase tracking-widest disabled:opacity-50"
                            >
                                {isRetrying ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                                {catalog.skippedImages} fallidos
                            </button>
                        )}
                        {/* Niche picker toggle */}
                        {(() => {
                            const linkedNiches = niches.filter(n => (catalog.nicheIds ?? []).includes(n._id));
                            const hasNiches = niches.length > 0;
                            return (
                                <button
                                    onClick={() => hasNiches && actions.setCatalogNichePickerId(isNichePickerOpen ? null : catalog._id)}
                                    title={hasNiches ? "Vincular nicho" : "No hay nichos — créalos primero en la pestaña Nichos"}
                                    disabled={!hasNiches}
                                    className={`flex items-center gap-1.5 h-8 px-2.5 rounded-xl border transition-all text-sm font-black uppercase tracking-wider shrink-0 disabled:opacity-40 disabled:cursor-not-allowed
                                        ${linkedNiches.length > 0
                                            ? isNichePickerOpen
                                                ? "bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.2)]"
                                                : "bg-sky-500/10 border-sky-500/25 text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/40"
                                            : isNichePickerOpen
                                                ? "bg-violet-500/15 border-violet-500/35 text-violet-300"
                                                : "border-dashed border-white/15 text-neutral-500 hover:border-sky-500/30 hover:text-sky-400 hover:bg-sky-500/[0.06]"
                                        }`}
                                >
                                    <Target size={11} className="shrink-0" />
                                    {linkedNiches.length > 0
                                        ? <span className="max-w-[80px] truncate">{linkedNiches.length === 1 ? linkedNiches[0].name : `${linkedNiches.length} nichos`}</span>
                                        : "Nicho"
                                    }
                                </button>
                            );
                        })()}
                    </div>
                    {/* Right: destructive actions */}
                    <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-white/[0.06]">
                        {isActive && (
                            <button
                                onClick={() => actions.setConfirmStopCatalogId(catalog._id)}
                                className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-sm font-black uppercase tracking-widest"
                            >
                                <StopCircle size={11} /> Detener
                            </button>
                        )}
                        <button
                            onClick={() => actions.setConfirmDeleteCatalogId(catalog._id)}
                            disabled={isDeleting}
                            title="Eliminar catálogo"
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20 disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            {isActive && (
                <div className="px-4 pb-3 space-y-1.5 border-t border-white/5 pt-3">
                    <div className="flex justify-between text-sm uppercase tracking-widest text-neutral-600">
                        <span className="flex items-center gap-1.5"><Loader2 size={8} className="animate-spin text-blue-400" />{catalog.status === "queued" ? `En cola · posición ${queuePos}` : catalog.status === "pending" ? "Iniciando..." : "Generando"}</span>
                        {catalog.status !== "queued" && <span className="font-black text-neutral-400">{Math.round(progress)}% {timeStr && <span className="text-sky-400/80 normal-case">{timeStr}</span>}</span>}
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        {catalog.status === "queued"
                            ? <div className="h-full w-1/3 bg-gradient-to-r from-orange-500/30 to-orange-400/60 rounded-full animate-pulse" />
                            : <div className="h-full bg-gradient-to-r from-sky-500 to-blue-400 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                        }
                    </div>
                </div>
            )}

            {/* Niche picker inline */}
            {isNichePickerOpen && (
                <div className="px-4 pb-4 border-t border-sky-500/10 pt-3 space-y-3 bg-gradient-to-b from-sky-500/[0.04] to-transparent">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
                                <Target size={10} className="text-sky-400" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-widest text-sky-400/80">Vincular nichos</span>
                        </div>
                        <button onClick={() => actions.setCatalogNichePickerId(null)} className="w-5 h-5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-600 hover:text-white hover:bg-white/10 transition-all">
                            <X size={9} />
                        </button>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.015] overflow-hidden max-h-48 overflow-y-auto">
                        {niches.map((n, ni) => {
                            const assigned = (catalog.nicheIds ?? []).includes(n._id);
                            const catCount = allCatalogs.filter(c => (c.nicheIds ?? []).includes(n._id)).length;
                            return (
                                <button key={n._id}
                                    onClick={() => actions.onToggleNiche(catalog._id, n._id, assigned)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${ni > 0 ? "border-t border-white/[0.05]" : ""} ${assigned ? "bg-sky-500/[0.07]" : "hover:bg-white/[0.03]"}`}
                                >
                                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${assigned ? "bg-sky-500 border-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.4)]" : "border-neutral-700 bg-transparent"}`}>
                                        {assigned && <Check size={8} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <span className={`text-sm font-bold flex-1 truncate ${assigned ? "text-white" : "text-neutral-400"}`}>{nd(n)}</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {catCount > 0 && <span className="text-sm font-black text-sky-400/60 bg-sky-500/10 border border-sky-500/15 px-1.5 py-0.5 rounded-full">{catCount} cat</span>}
                                        {n.status && <span className={`text-sm font-black uppercase px-1.5 py-0.5 rounded-full ${n.status === "active" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/15" : "text-neutral-600 bg-white/5 border border-white/8"}`}>{n.status}</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Image grid */}
            {catalog.images.length > 0 && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-neutral-700 font-mono">{catalog.images.length} imgs</span>
                        <div className="flex items-center gap-1.5">
                            {isBulkMode && (
                                <button
                                    onClick={() => {
                                        const allIds = catalog.images.map(i => i.publicId);
                                        const allSelected = allIds.every(id => bulkSelection.has(id));
                                        actions.setBulkDeleteSelection(allSelected ? new Set() : new Set(allIds));
                                    }}
                                    className="h-6 px-2 rounded-lg bg-white/5 border border-white/10 text-sm text-neutral-500 hover:text-white transition-all">
                                    {catalog.images.every(i => bulkSelection.has(i.publicId)) ? "Desel. todo" : "Sel. todo"}
                                </button>
                            )}
                            {isBulkMode && bulkSelection.size > 0 && (
                                <button
                                    onClick={() => void actions.onBulkDeleteImages(catalog._id)}
                                    disabled={isBulkDeleting}
                                    className="flex items-center gap-1 h-6 px-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-black uppercase hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                                >
                                    {isBulkDeleting ? <Loader2 size={9} className="animate-spin" /> : <Trash2 size={9} />}
                                    Borrar {bulkSelection.size}
                                </button>
                            )}
                            {isBulkMode && bulkSelection.size > 0 && (
                                <button onClick={() => actions.setBulkDeleteSelection(new Set())}
                                    className="h-6 px-2 rounded-lg bg-white/5 border border-white/10 text-sm text-neutral-500 hover:text-white transition-all">
                                    Limpiar
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (isBulkMode) {
                                        actions.setBulkDeleteCatalogId(null);
                                        actions.setBulkDeleteSelection(new Set());
                                    } else {
                                        actions.setBulkDeleteCatalogId(catalog._id);
                                        actions.setBulkDeleteSelection(new Set());
                                    }
                                }}
                                className={`h-6 px-2.5 rounded-lg text-sm font-black uppercase transition-all border ${isBulkMode ? "bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25" : "bg-white/5 border-white/10 text-neutral-500 hover:text-white"}`}
                            >
                                {isBulkMode ? "✕ Cancelar" : "Seleccionar"}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                        {catalog.images.map((img, imgIdx) => {
                            const isCatSelected = selectedUrls.has(img.url);
                            const isBulkSel = isBulkMode && bulkSelection.has(img.publicId);
                            return (
                                <div
                                    key={img.publicId}
                                    className={`aspect-square rounded-lg overflow-hidden bg-white/5 border transition-all relative group ${isBulkMode ? (isBulkSel ? "border-red-500 ring-1 ring-red-500/50 cursor-pointer" : "border-white/10 hover:border-red-500/50 cursor-pointer") : isVaultSelectMode ? (isCatSelected ? "border-sky-500 ring-1 ring-sky-500/50 cursor-pointer" : "border-white/10 hover:border-sky-500/50 cursor-pointer") : "border-white/5 cursor-zoom-in hover:border-sky-500/40"}`}
                                    onClick={() => {
                                        if (isBulkMode) {
                                            actions.setBulkDeleteSelection(prev => { const next = new Set(prev); isBulkSel ? next.delete(img.publicId) : next.add(img.publicId); return next; });
                                        } else if (isVaultSelectMode) {
                                            actions.toggleImageSelect(img.url);
                                        } else {
                                            actions.openCatalogImagePreview(catalog.images, imgIdx, catalog._id);
                                        }
                                    }}
                                >
                                    <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                    {isBulkMode && (
                                        <div className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isBulkSel ? "bg-red-500 border-red-500" : "bg-black/50 border-white/30 backdrop-blur-sm"}`}>
                                            {isBulkSel && <Check size={9} className="text-white" strokeWidth={3} />}
                                        </div>
                                    )}
                                    {!isBulkMode && isVaultSelectMode && (
                                        <div className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isCatSelected ? "bg-sky-500 border-sky-500" : "bg-black/50 border-white/30 backdrop-blur-sm"}`}>
                                            {isCatSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                                        </div>
                                    )}
                                    {!isBulkMode && !isVaultSelectMode && (
                                        <>
                                            <button
                                                onClick={e => { e.stopPropagation(); actions.toggleFavorite(img.url, { label: `${catalog.name} #${imgIdx + 1}`, source: "catalog" }); }}
                                                className={`absolute top-0.5 left-0.5 p-0.5 rounded-md backdrop-blur-sm transition-all ${favorites.has(img.url) ? "bg-rose-500/80 text-white opacity-100" : "bg-black/50 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-rose-400"}`}
                                            >
                                                <Heart size={8} className={favorites.has(img.url) ? "fill-white" : ""} />
                                            </button>
                                            <button
                                                onClick={e => { e.stopPropagation(); void actions.upscaleImage(img.url, img.publicId); }}
                                                disabled={upscalingId === img.publicId}
                                                title="Upscale 4×"
                                                className="absolute bottom-0.5 right-0.5 p-0.5 rounded-md bg-black/50 backdrop-blur-sm text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-sky-400 transition-all disabled:opacity-100"
                                            >
                                                {upscalingId === img.publicId
                                                    ? <Loader2 size={8} className="animate-spin text-sky-400" />
                                                    : <ArrowUpRight size={8} />}
                                            </button>
                                        </>
                                    )}
                                    {isBulkSel && <div className="absolute inset-0 bg-red-500/10 pointer-events-none" />}
                                </div>
                            );
                        })}
                        {isActive && Array.from({ length: catalog.totalImages - catalog.images.length }).map((_, i) => (
                            <div key={`ph-${i}`} className="aspect-square rounded-lg bg-white/[0.02] border border-dashed border-white/10 flex items-center justify-center">
                                <Loader2 size={10} className="text-neutral-700 animate-spin" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
});
