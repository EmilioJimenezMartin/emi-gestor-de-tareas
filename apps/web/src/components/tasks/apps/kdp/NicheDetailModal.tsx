"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
    X, Play, Loader2, ZoomIn, Trash2, Check, Sparkles, ChevronDown, ChevronLeft, ChevronRight,
    ImageIcon, BookOpen, FileText, Tag, Globe, Star, Eye, Copy, Save, Pencil, AlertTriangle,
    TrendingUp, Target, Bot, RotateCcw, ChevronUp, ExternalLink, Package, Plus,
    Grid3x3, Library, Wand2, CheckCircle2, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import type { NicheFE, IACatalogFE, CatalogImageFE, CloudinaryImage, BookPage, BookDraft, PageTextStyle } from "./types";
import { ListingCardFields } from "./ListingCardFields";

type LightboxUrl = {
    url: string;
    catalogId?: string;
    publicId?: string;
    filename?: string;
    urls?: string[];
    meta?: { catalogId?: string; publicId?: string }[];
    index?: number;
} | null;

type AllImg = { publicId: string; url: string; width?: number; height?: number; catalogId?: string | null };

interface NicheDetailModalProps {
    nicheDetailId: string;
    niches: NicheFE[];
    iaCatalogs: IACatalogFE[];
    cloudinaryImages: CloudinaryImage[];
    nicheDetailTab: string;
    setNicheDetailTab: (tab: string) => void;
    nicheDetailSelectMode: boolean;
    setNicheDetailSelectMode: (v: boolean | ((p: boolean) => boolean)) => void;
    nicheDetailSelectedPids: Set<string>;
    setNicheDetailSelectedPids: (v: Set<string> | ((p: Set<string>) => Set<string>)) => void;
    isDeletingNicheImages: boolean;
    previewSpreadIdx: number;
    setPreviewSpreadIdx: (idx: number) => void;
    seoAnnotation: string;
    setSeoAnnotation: (s: string) => void;
    editingListingId: string | null;
    setEditingListingId: (id: string | null) => void;
    editListingDraft: any | null;
    setEditListingDraft: (d: any) => void;
    discoveryPromptEditing: boolean;
    setDiscoveryPromptEditing: (v: boolean) => void;
    discoveryPromptDraft: string;
    setDiscoveryPromptDraft: (s: string) => void;
    savingListingId: string | null;
    deletingListingId: string | null;
    pipelineSeoLoading: Record<string, boolean>;
    pipelineRunningId: string | null;
    pipelineQueueIds: string[];
    bookDrafts: BookDraft[];
    setNicheDetailId: (id: string | null) => void;
    setNiches: React.Dispatch<React.SetStateAction<NicheFE[]>>;
    setBookDrafts: React.Dispatch<React.SetStateAction<BookDraft[]>>;
    setLightboxUrl: (url: LightboxUrl) => void;
    setConfirmDeleteImageInfo: (info: { catalogId: string; publicId: string } | null) => void;
    setSelectedCoverNicheId: (id: string | null) => void;
    setCoverTitle: (title: string) => void;
    runNichePipeline: (niche: NicheFE) => Promise<void>;
    deleteFromCloudinary: (publicId: string) => Promise<void>;
    bulkDeleteNicheImages: (allImgs: AllImg[]) => Promise<void>;
    launchPipelineSeo: (nicheId: string, annotation?: string) => Promise<void>;
    saveListingEdit: (nicheId: string, listingId: string) => Promise<void>;
    deleteNicheListing: (nicheId: string, listingId: string) => Promise<void>;
    fetchNiches: () => Promise<void>;
    guardedLoadBookDraft: (draft: BookDraft) => Promise<void>;
    changeTab: (tab: string) => void;
    defaultTextStyle: () => PageTextStyle;
    apiBaseUrl: string;
    nd: (n: Pick<NicheFE, "name" | "nickname">) => string;
    setExplodeNicheId: (id: string | null) => void;
}

export function NicheDetailModal(props: NicheDetailModalProps) {
    const {
        nicheDetailId, niches, iaCatalogs, cloudinaryImages, nicheDetailTab, setNicheDetailTab,
        nicheDetailSelectMode, setNicheDetailSelectMode, nicheDetailSelectedPids, setNicheDetailSelectedPids,
        isDeletingNicheImages, previewSpreadIdx, setPreviewSpreadIdx, seoAnnotation, setSeoAnnotation,
        editingListingId, setEditingListingId, editListingDraft, setEditListingDraft,
        discoveryPromptEditing, setDiscoveryPromptEditing, discoveryPromptDraft, setDiscoveryPromptDraft,
        savingListingId, deletingListingId, pipelineSeoLoading, pipelineRunningId, pipelineQueueIds,
        bookDrafts, setNicheDetailId, setNiches, setBookDrafts, setLightboxUrl, setConfirmDeleteImageInfo,
        setSelectedCoverNicheId, setCoverTitle, runNichePipeline, deleteFromCloudinary,
        bulkDeleteNicheImages, launchPipelineSeo, saveListingEdit, deleteNicheListing,
        fetchNiches, guardedLoadBookDraft, changeTab, defaultTextStyle, apiBaseUrl, nd,
        setExplodeNicheId,
    } = props;

    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

const detailNiche = niches.find(n => n._id === nicheDetailId);
if (!detailNiche) return null;
// Bidirectional: catalog has the niche in nicheIds OR niche has the catalog in catalogIds
const linkedCats = iaCatalogs.filter(c =>
    (c.nicheIds ?? []).includes(nicheDetailId) ||
    (detailNiche.catalogIds ?? []).includes(c._id)
);
const linkedCloudImgs = cloudinaryImages.filter(img => img.nicheId === nicheDetailId || (img.nicheIds ?? []).includes(nicheDetailId ?? ""));
// Index ALL iaCatalogs images by URL so fallback images resolve to real publicId+catalogId
const urlToCatalogImg = new Map<string, { publicId: string; catalogId: string; width?: number; height?: number }>();
for (const cat of iaCatalogs) {
    for (const img of cat.images) {
        if (img.url && !urlToCatalogImg.has(img.url)) {
            urlToCatalogImg.set(img.url, { publicId: img.publicId, catalogId: cat._id, width: (img as any).width, height: (img as any).height });
        }
    }
}
const allImgs: { publicId: string; url: string; width?: number; height?: number; catalogId?: string }[] = (() => {
    const seen = new Set<string>();
    const catImgs = linkedCats.flatMap(c => c.images.map(img => ({ ...img, catalogId: c._id })));
    // Fallback: when no catalog images are linked, use catalogImageOrder stored on the niche
    // Resolve each URL to the real publicId+catalogId via the global catalog index
    const fallbackImgs = catImgs.length === 0
        ? (detailNiche.catalogImageOrder ?? []).map(url => {
            const resolved = urlToCatalogImg.get(url);
            return resolved
                ? { publicId: resolved.publicId, url, catalogId: resolved.catalogId, width: resolved.width, height: resolved.height }
                : { publicId: url, url, catalogId: undefined as string | undefined };
        })
        : [];
    return [
        ...catImgs,
        ...fallbackImgs,
        ...linkedCloudImgs.map(img => ({ publicId: img.publicId, url: img.url, width: img.width, height: img.height })),
    ].filter(img => { if (seen.has(img.publicId)) return false; seen.add(img.publicId); return true; });
})();
const pipelineDraft = bookDrafts.find(d => d.id.startsWith(`pipeline-${nicheDetailId}`) || d.nicheId === nicheDetailId);
const TABS = [
    { id: "images" as const, label: "Imágenes", icon: <ImageIcon size={11} />, count: allImgs.length },
    { id: "catalogs" as const, label: "Catálogos", icon: <Grid3x3 size={11} />, count: linkedCats.length },
    { id: "book" as const, label: "Libro KDP", icon: <Library size={11} />, count: pipelineDraft ? 1 : 0 },
    { id: "seo" as const, label: "SEO / Listing", icon: <FileText size={11} />, count: detailNiche.listings?.length ?? 0 },
    { id: "preview" as const, label: "Preview", icon: <BookOpen size={11} />, count: 0 },
];
const modalPortal = createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) setNicheDetailId(null); }}>
        <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="relative p-6 border-b border-white/8">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-500/60 via-blue-400/20 to-transparent" />
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-black text-white">{nd(detailNiche)}</h2>
                            <span className="text-sm font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300">{detailNiche.phase ?? "niche"}</span>
                            <span className="text-sm font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10 text-neutral-500">{detailNiche.status}</span>
                        </div>
                        {detailNiche.description && <p className="text-sm text-neutral-500 max-w-xl leading-relaxed">{detailNiche.description}</p>}
                        <div className="flex items-center gap-3 text-sm text-neutral-600 pt-1">
                            <span>{allImgs.length} imágenes</span>
                            <span>·</span>
                            <span>{linkedCats.length} catálogos</span>
                            <span>·</span>
                            <span>{detailNiche.listings?.length ?? 0} listings SEO</span>
                            {(detailNiche.discoveryImagePrompt || detailNiche.generatedPrompt) && <><span>·</span><span>prompt generado</span></>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Pipeline launcher */}
                        <button
                            onClick={() => { void runNichePipeline(detailNiche); setNicheDetailId(null); }}
                            disabled={pipelineRunningId === detailNiche._id || pipelineQueueIds.includes(detailNiche._id)}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-violet-500/15 border border-violet-500/30 text-sm font-black text-violet-300 hover:bg-violet-500/25 transition-all disabled:opacity-40"
                        >
                            {pipelineRunningId === detailNiche._id
                                ? <><Loader2 size={10} className="animate-spin" />Ejecutando…</>
                                : pipelineQueueIds.includes(detailNiche._id)
                                    ? <><Loader2 size={10} className="animate-spin opacity-50" />Cola ({pipelineQueueIds.indexOf(detailNiche._id) + 1})</>
                                    : <><Play size={10} />Pipeline</>}
                        </button>
                        <button onClick={() => setNicheDetailId(null)} className="p-2 rounded-xl text-neutral-600 hover:text-white hover:bg-white/10 transition-all"><X size={16} /></button>
                    </div>
                </div>
                {/* Tabs + bulk actions row */}
                <div className="flex items-center gap-2 mt-4 overflow-x-auto no-scrollbar">
                    {!nicheDetailSelectMode && TABS.map(tab => (
                        <button key={tab.id} onClick={() => setNicheDetailTab(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-black transition-all shrink-0 ${nicheDetailTab === tab.id ? "border-violet-500/40 bg-violet-500/10 text-violet-300" : "border-white/8 bg-transparent text-neutral-600 hover:text-neutral-400"}`}>
                            {tab.icon}{tab.label}
                            {tab.count > 0 && <span className="bg-white/10 rounded-full px-1 text-sm">{tab.count}</span>}
                        </button>
                    ))}
                    {/* Bulk select actions — shown in header when select mode is active */}
                    {nicheDetailSelectMode && (
                        <>
                            <button
                                onClick={() => { setNicheDetailSelectMode(false); setNicheDetailSelectedPids(new Set()); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-sm font-black text-neutral-400 hover:text-white hover:bg-white/10 transition-all shrink-0"
                            >
                                <X size={11} /> Cancelar
                            </button>
                            <span className="text-sm font-black text-rose-300 shrink-0">
                                {nicheDetailSelectedPids.size} seleccionada{nicheDetailSelectedPids.size !== 1 ? "s" : ""}
                            </span>
                            <div className="flex-1" />
                            <button
                                onClick={() => setNicheDetailSelectedPids(new Set(allImgs.map(i => i.publicId)))}
                                className="text-xs font-black text-neutral-400 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/10 transition-all shrink-0"
                            >
                                Todas
                            </button>
                            <button
                                onClick={() => setShowBulkDeleteConfirm(true)}
                                disabled={isDeletingNicheImages || nicheDetailSelectedPids.size === 0}
                                className="flex items-center gap-1.5 text-xs font-black text-white bg-rose-500 hover:bg-rose-400 disabled:opacity-40 px-4 py-1.5 rounded-xl transition-all shrink-0"
                            >
                                {isDeletingNicheImages ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                Eliminar {nicheDetailSelectedPids.size > 0 ? nicheDetailSelectedPids.size : ""}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Sub-header: stats bar — fixed, only in images tab */}
            {nicheDetailTab === "images" && allImgs.length > 0 && (() => {
                const catCount = allImgs.filter(img => img.catalogId).length;
                const cloudCount = allImgs.filter(img => !img.catalogId).length;
                return (
                    <div className="flex items-center gap-3 px-6 py-2.5 border-b border-white/[0.06] bg-gradient-to-r from-violet-500/[0.04] via-transparent to-cyan-500/[0.03]">
                        <div className="flex items-center gap-2 text-xs flex-1">
                            <ImageIcon size={11} className="text-violet-400/70" />
                            <span className="font-black text-white">{allImgs.length}</span>
                            <span className="text-neutral-500">imagen{allImgs.length !== 1 ? "es" : ""}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {catCount > 0 && (
                                <span className="text-[10px] font-black text-violet-300 bg-violet-500/15 px-2.5 py-1 rounded-full border border-violet-500/25">
                                    {catCount} catálogo{catCount !== 1 ? "s" : ""}
                                </span>
                            )}
                            {cloudCount > 0 && (
                                <span className="text-[10px] font-black text-cyan-300 bg-cyan-500/15 px-2.5 py-1 rounded-full border border-cyan-500/25">
                                    {cloudCount} cloud
                                </span>
                            )}
                            {!nicheDetailSelectMode && (
                                <>
                                    <button
                                        onClick={() => { setNicheDetailId(null); setExplodeNicheId(nicheDetailId); }}
                                        className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 transition-all"
                                        title="Explosión IA: genera catálogos con situaciones distintas"
                                    >
                                        <Layers size={9} /> Explosión IA
                                    </button>
                                    <button
                                        onClick={() => { setNicheDetailSelectMode(true); setNicheDetailSelectedPids(new Set()); }}
                                        className="text-[10px] font-black px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                                    >
                                        Seleccionar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Tab content — scrollable */}
            <div className="p-6 overflow-y-auto flex-1">
                {nicheDetailTab === "images" && (
                    <div className="space-y-4">

                        {/* Grid or empty state */}
                        {allImgs.length === 0 ? (
                            <EmptyState
                                icon={<ImageIcon size={28} strokeWidth={1} />}
                                title="Sin imágenes aún"
                                description="Lanza el pipeline para comenzar a generar imágenes para este nicho."
                                size="md"
                            />
                        ) : (
                            <div className="relative">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {allImgs.map((img, idx) => {
                                        const catName = img.catalogId
                                            ? linkedCats.find(c => c._id === img.catalogId)?.name ?? null
                                            : null;
                                        const isCloud = !img.catalogId;
                                        const isSelected = nicheDetailSelectedPids.has(img.publicId);
                                        return (
                                            <div
                                                key={img.publicId || idx}
                                                onClick={() => {
                                                    if (nicheDetailSelectMode) {
                                                        setNicheDetailSelectedPids(prev => {
                                                            const next = new Set(prev);
                                                            next.has(img.publicId) ? next.delete(img.publicId) : next.add(img.publicId);
                                                            return next;
                                                        });
                                                    }
                                                }}
                                                className={`group relative aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${nicheDetailSelectMode ? "hover:scale-[1.02]" : "hover:scale-[1.02] hover:z-10"} ${isSelected ? "ring-2 ring-rose-400 ring-offset-2 ring-offset-neutral-950" : ""}`}
                                                style={{
                                                    boxShadow: "0 0 0 1px rgba(255,255,255,0.07)",
                                                }}
                                            >
                                                <img
                                                    src={img.url}
                                                    alt=""
                                                    className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isSelected ? "brightness-75" : ""}`}
                                                />

                                                {/* Always-visible bottom fade */}
                                                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

                                                {/* Hover overlay */}
                                                {!nicheDetailSelectMode && <div className="absolute inset-0 bg-gradient-to-t from-violet-900/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />}

                                                {/* Selection overlay */}
                                                {nicheDetailSelectMode && (
                                                    <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${isSelected ? "bg-rose-500/20" : "bg-black/0 group-hover:bg-black/20"}`}>
                                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${isSelected ? "bg-rose-500 border-rose-400" : "bg-black/50 border-white/40 group-hover:border-white/70"}`}>
                                                            {isSelected && <Check size={13} className="text-white" strokeWidth={3} />}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Source badge — always visible */}
                                                <div className="absolute bottom-2 left-2 pointer-events-none">
                                                    {catName ? (
                                                        <span className="text-[9px] font-bold text-white/80 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-full border border-violet-400/20 truncate block max-w-[120px]">
                                                            {catName}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-cyan-300/80 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-full border border-cyan-500/25">
                                                            Cloud
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Action buttons — slide in on hover (hidden in select mode) */}
                                                {!nicheDetailSelectMode && (
                                                    <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-y-1 group-hover:translate-y-0">
                                                        <button
                                                            onClick={e => { e.stopPropagation(); setLightboxUrl({ url: img.url, catalogId: img.catalogId, publicId: img.publicId, urls: allImgs.map(i => i.url), meta: allImgs.map(i => ({ catalogId: i.catalogId, publicId: i.publicId })), index: idx }); }}
                                                            className="p-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 text-white hover:bg-white/20 hover:border-white/30 hover:scale-110 transition-all"
                                                            title="Ampliar"
                                                        >
                                                            <ZoomIn size={11} />
                                                        </button>
                                                        <button
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                img.catalogId
                                                                    ? setConfirmDeleteImageInfo({ catalogId: img.catalogId, publicId: img.publicId })
                                                                    : void deleteFromCloudinary(img.publicId);
                                                            }}
                                                            className="p-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-rose-500/30 text-rose-400 hover:bg-rose-500/30 hover:border-rose-400/50 hover:scale-110 transition-all"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={11} />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Glow border on hover */}
                                                {!nicheDetailSelectMode && <div className={`absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100 ${isCloud ? "ring-1 ring-cyan-400/30" : "ring-1 ring-violet-400/30"}`} />}

                                                {/* Click capture for lightbox (only when not in select mode) */}
                                                {!nicheDetailSelectMode && (
                                                    <button
                                                        onClick={() => setLightboxUrl({ url: img.url, catalogId: img.catalogId, publicId: img.publicId, urls: allImgs.map(i => i.url), meta: allImgs.map(i => ({ catalogId: i.catalogId, publicId: i.publicId })), index: idx })}
                                                        className="absolute inset-0"
                                                        aria-label="Ver imagen"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                            </div>
                        )}
                    </div>
                )}
                {nicheDetailTab === "catalogs" && (
                    <div className="space-y-3">
                        {linkedCats.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-30">
                                <Grid3x3 size={32} strokeWidth={1} className="text-neutral-600" />
                                <p className="text-sm font-black uppercase tracking-widest text-neutral-600">Sin catálogos vinculados</p>
                            </div>
                        ) : linkedCats.map(cat => (
                            <div key={cat._id} className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/[0.02]">
                                {cat.images[0] && <img src={cat.images[0].url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{cat.name}</p>
                                    <p className="text-sm text-neutral-600 truncate">{cat.prompt}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-sm text-neutral-600">{cat.images.length} imgs</span>
                                    <span className={`text-sm font-black uppercase px-1.5 py-0.5 rounded-full ${cat.status === "completed" ? "bg-emerald-500/15 text-emerald-400" : cat.status === "running" ? "bg-blue-500/15 text-blue-400" : "bg-neutral-500/15 text-neutral-500"}`}>{cat.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {nicheDetailTab === "seo" && (
                    <div className="space-y-3">
                        {/* Anotaciones — siempre visible en el tab SEO */}
                        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                                <Pencil size={9} />
                                Anotaciones para la IA
                            </label>
                            <textarea
                                value={seoAnnotation}
                                onChange={e => setSeoAnnotation(e.target.value)}
                                rows={2}
                                placeholder="Ej: enfócate en regalos navideños, evita la palabra 'mindfulness', incluye el término 'colouring book'…"
                                className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2 text-xs text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-amber-500/30 resize-none leading-relaxed"
                            />
                            {seoAnnotation.trim() && (
                                <p className="text-[9px] text-amber-400/70">Se aplicará en la próxima generación</p>
                            )}
                        </div>
                        {/* ── SEO Audit panel ── */}
                        {(detailNiche.listings?.length ?? 0) > 0 && (() => {
                            const l = detailNiche.listings![0];
                            const title = l.title ?? "";
                            const subtitle = l.subtitle ?? "";
                            const description = l.description ?? "";
                            const kwRaw = Array.isArray(l.keywords) ? l.keywords : String(l.keywords ?? "").split(/[,\n]/).map((k: string) => k.trim()).filter(Boolean);
                            const kwPhrases = kwRaw.slice(0, 7);

                            const checks = [
                                {
                                    label: "Título",
                                    ok: title.length >= 30 && title.length <= 200,
                                    warn: title.length > 0 && (title.length < 30 || title.length > 200),
                                    detail: title.length === 0 ? "Falta" : `${title.length} chars ${title.length < 30 ? "— muy corto" : title.length > 200 ? "— demasiado largo" : "✓"}`,
                                },
                                {
                                    label: "Keyword al inicio",
                                    ok: title.length > 0 && !/^(el|la|los|las|un|una|a|an|the)\s/i.test(title),
                                    warn: false,
                                    detail: title.length > 0 ? `"${title.split(/[\s:–-]/)[0]}"` : "—",
                                },
                                {
                                    label: "Subtítulo",
                                    ok: subtitle.length > 0,
                                    warn: false,
                                    detail: subtitle.length > 0 ? `${subtitle.length} chars` : "Falta",
                                },
                                {
                                    label: "Keywords (7 frases)",
                                    ok: kwPhrases.length === 7,
                                    warn: kwPhrases.length > 0 && kwPhrases.length !== 7,
                                    detail: `${kwPhrases.length}/7 frases`,
                                },
                                {
                                    label: "Long. keywords ≤49",
                                    ok: kwPhrases.every(k => k.length <= 49),
                                    warn: kwPhrases.some(k => k.length > 49),
                                    detail: (() => {
                                        const over = kwPhrases.filter(k => k.length > 49);
                                        return over.length > 0 ? `${over.length} frase${over.length > 1 ? "s" : ""} larga${over.length > 1 ? "s" : ""}` : "Todas ≤49 ✓";
                                    })(),
                                },
                                {
                                    label: "Sin duplicados",
                                    ok: (() => {
                                        const seen = new Map<string, number>();
                                        kwPhrases.forEach((phrase, i) => {
                                            String(phrase).toLowerCase().split(/\s+/).filter(w => w.length > 2).forEach(w => {
                                                if (!seen.has(w)) seen.set(w, i);
                                            });
                                        });
                                        const dups = new Set<string>();
                                        kwPhrases.forEach((phrase, i) => {
                                            String(phrase).toLowerCase().split(/\s+/).filter(w => w.length > 2).forEach(w => {
                                                if (seen.get(w) !== i) dups.add(w);
                                            });
                                        });
                                        return dups.size === 0;
                                    })(),
                                    warn: false,
                                    detail: (() => {
                                        const seen = new Map<string, number>();
                                        kwPhrases.forEach((phrase, i) => {
                                            String(phrase).toLowerCase().split(/\s+/).filter(w => w.length > 2).forEach(w => {
                                                if (!seen.has(w)) seen.set(w, i);
                                            });
                                        });
                                        const dups = new Set<string>();
                                        kwPhrases.forEach((phrase, i) => {
                                            String(phrase).toLowerCase().split(/\s+/).filter(w => w.length > 2).forEach(w => {
                                                if (seen.get(w) !== i) dups.add(w);
                                            });
                                        });
                                        return dups.size === 0 ? "Sin repeticiones ✓" : `Repetidas: ${[...dups].join(", ")}`;
                                    })(),
                                },
                                {
                                    label: "Descripción",
                                    ok: description.length >= 100,
                                    warn: description.length > 0 && description.length < 100,
                                    detail: description.length === 0 ? "Falta" : `${description.length} chars`,
                                },
                            ];

                            const score = Math.round((checks.filter(c => c.ok).length / checks.length) * 100);
                            const scoreColor = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400";
                            const scoreBg = score >= 80 ? "border-emerald-500/25 bg-emerald-500/[0.05]" : score >= 50 ? "border-amber-500/25 bg-amber-500/[0.05]" : "border-rose-500/25 bg-rose-500/[0.05]";

                            const auditFixes = checks
                                .filter(c => !c.ok)
                                .map(c => {
                                    if (c.label === "Título") return title.length < 30 ? "el título es muy corto (menos de 30 chars), hazlo más largo y descriptivo" : "el título supera 200 chars, acórtalo";
                                    if (c.label === "Keyword al inicio") return "pon la keyword principal (no artículo) en las primeras palabras del título";
                                    if (c.label === "Subtítulo") return "falta subtítulo: añade una cadena de keywords secundarias · audiencia · beneficio emocional";
                                    if (c.label === "Keywords (7 frases)") return kwPhrases.length < 7 ? `solo hay ${kwPhrases.length} frases de keywords, genera exactamente 7` : `hay ${kwPhrases.length} frases, reduce a exactamente 7`;
                                    if (c.label === "Long. keywords ≤49") { const over = kwPhrases.filter(k => k.length > 49); return `acorta estas keywords que superan 49 chars: ${over.map(k => `"${k}" (${k.length})`).join(", ")}`; }
                                    if (c.label === "Sin duplicados") {
                                        const seen = new Map<string, number>();
                                        kwPhrases.forEach((phrase, i) => String(phrase).toLowerCase().split(/\s+/).filter(w => w.length > 2).forEach(w => { if (!seen.has(w)) seen.set(w, i); }));
                                        const dups = new Set<string>();
                                        kwPhrases.forEach((phrase, i) => String(phrase).toLowerCase().split(/\s+/).filter(w => w.length > 2).forEach(w => { if (seen.get(w) !== i) dups.add(w); }));
                                        return `elimina palabras repetidas entre frases de keywords: ${[...dups].join(", ")} — Amazon ignora duplicados y desperdicias slots`;
                                    }
                                    if (c.label === "Descripción") return "falta descripción HTML, genera una con hook emocional + beneficios + CTA";
                                    return c.label;
                                });

                            return (
                                <div className={`rounded-xl border p-3 space-y-2 ${scoreBg}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                                            <Sparkles size={9} /> Auditoría SEO
                                        </span>
                                        <span className={`text-sm font-black ${scoreColor}`}>{score}%</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {checks.map(c => (
                                            <div key={c.label} className="flex items-start gap-1.5">
                                                <span className={`text-[10px] mt-0.5 shrink-0 ${c.ok ? "text-emerald-400" : c.warn ? "text-amber-400" : "text-rose-400"}`}>
                                                    {c.ok ? "✓" : c.warn ? "⚠" : "✗"}
                                                </span>
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">{c.label}</p>
                                                    <p className={`text-[10px] ${c.ok ? "text-neutral-400" : c.warn ? "text-amber-300/80" : "text-rose-300/80"}`}>{c.detail}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {kwPhrases.length > 0 && (
                                        <div className="pt-1 space-y-1">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Frases de keywords</p>
                                            {kwPhrases.map((k, i) => (
                                                <div key={i} className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10px] ${k.length > 49 ? "bg-rose-500/10 border border-rose-500/20 text-rose-300" : "bg-white/[0.02] border border-white/[0.05] text-neutral-400"}`}>
                                                    <span className="truncate flex-1">{k}</span>
                                                    <span className={`ml-2 shrink-0 font-mono ${k.length > 49 ? "text-rose-400" : "text-neutral-600"}`}>{k.length}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {auditFixes.length > 0 && (
                                        <button
                                            onClick={() => {
                                                const fixNote = `CORRECCIONES OBLIGATORIAS según auditoría SEO: ${auditFixes.join("; ")}.`;
                                                void launchPipelineSeo(detailNiche._id, fixNote);
                                            }}
                                            disabled={!!pipelineSeoLoading[detailNiche._id]}
                                            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[11px] font-black hover:bg-rose-500/20 transition-all disabled:opacity-50"
                                        >
                                            {pipelineSeoLoading[detailNiche._id] ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                            Regenerar corrigiendo {auditFixes.length} problema{auditFixes.length > 1 ? "s" : ""}
                                        </button>
                                    )}
                                    {score === 100 && (
                                        <p className="text-[10px] text-emerald-400/70 text-center font-bold">✓ Listing optimizado al 100%</p>
                                    )}
                                </div>
                            );
                        })()}

                        {(detailNiche.listings?.length ?? 0) === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-4">
                                <FileText size={32} strokeWidth={1} className="text-neutral-600 opacity-30" />
                                <p className="text-sm text-neutral-600 opacity-30">Sin listings SEO todavía</p>
                                <button
                                    onClick={() => void launchPipelineSeo(detailNiche._id, seoAnnotation)}
                                    disabled={!!pipelineSeoLoading[detailNiche._id]}
                                    className="flex items-center gap-2 h-10 px-6 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-black hover:bg-amber-500/25 transition-all disabled:opacity-50"
                                >
                                    {pipelineSeoLoading[detailNiche._id] ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                    Generar SEO con IA
                                </button>
                            </div>
                        ) : (
                            <>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => void launchPipelineSeo(detailNiche._id, seoAnnotation)}
                                    disabled={!!pipelineSeoLoading[detailNiche._id]}
                                    className="flex items-center gap-1.5 h-8 px-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-black hover:bg-amber-500/20 transition-all disabled:opacity-50"
                                >
                                    {pipelineSeoLoading[detailNiche._id] ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                    Regenerar SEO
                                </button>
                            </div>
                            {detailNiche.listings!.map((listing, i) => {
                                const lid = listing._id ?? String(i);
                                const isEditing = editingListingId === lid;
                                return (
                                <div key={lid} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2.5">
                                    {isEditing ? (
                                        /* ── EDIT MODE ── */
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Título</label>
                                                <input
                                                    value={editListingDraft.title}
                                                    onChange={e => setEditListingDraft((d: any) => ({ ...d, title: e.target.value }))}
                                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/40"
                                                    placeholder="Título SEO"
                                                />
                                                <p className="text-[10px] text-neutral-700 text-right">{editListingDraft.title.length}/200</p>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Subtítulo</label>
                                                <input
                                                    value={editListingDraft.subtitle}
                                                    onChange={e => setEditListingDraft((d: any) => ({ ...d, subtitle: e.target.value }))}
                                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/40"
                                                    placeholder="Subtítulo"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Descripción (HTML)</label>
                                                <textarea
                                                    value={editListingDraft.description}
                                                    onChange={e => setEditListingDraft((d: any) => ({ ...d, description: e.target.value }))}
                                                    rows={8}
                                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 font-mono resize-y"
                                                    placeholder="<p>Descripción HTML…</p>"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Keywords (separadas por coma o línea)</label>
                                                <textarea
                                                    value={editListingDraft.keywords}
                                                    onChange={e => setEditListingDraft((d: any) => ({ ...d, keywords: e.target.value }))}
                                                    rows={3}
                                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/40"
                                                    placeholder="keyword 1, keyword 2, …"
                                                />
                                            </div>
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={() => void saveListingEdit(detailNiche._id, lid)}
                                                    disabled={savingListingId === lid}
                                                    className="flex items-center gap-1.5 h-8 px-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-black hover:bg-amber-500/25 transition-all disabled:opacity-50">
                                                    {savingListingId === lid ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Guardar
                                                </button>
                                                <button
                                                    onClick={() => setEditingListingId(null)}
                                                    className="h-8 px-4 rounded-xl border border-white/10 text-neutral-500 text-[11px] font-black hover:text-white transition-all">
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── VIEW MODE ── */
                                        <>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <p className="text-sm font-black text-white leading-tight truncate">{listing.title}</p>
                                                {listing.language && <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${listing.language === "es" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-sky-500/10 border-sky-500/20 text-sky-400"}`}>{listing.language}</span>}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => {
                                                    setEditListingDraft({
                                                        title: listing.title ?? "",
                                                        subtitle: listing.subtitle ?? "",
                                                        description: listing.description ?? "",
                                                        keywords: (listing.keywords ?? []).join(", "),
                                                    });
                                                    setEditingListingId(lid);
                                                }} className="p-1.5 rounded-lg text-neutral-600 hover:text-amber-400 hover:bg-amber-500/10 transition-all" title="Editar"><Pencil size={11} /></button>
                                                <button onClick={() => { navigator.clipboard.writeText([listing.title, listing.subtitle, listing.description.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(), listing.keywords.join(", ")].filter(Boolean).join("\n\n")); toast.success("Copiado"); }} className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-white/8 transition-all"><Copy size={11} /></button>
                                                <button onClick={() => void deleteNicheListing(detailNiche._id, lid)} disabled={deletingListingId === lid} className="p-1.5 rounded-lg text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40" title="Eliminar"><Trash2 size={11} /></button>
                                            </div>
                                        </div>
                                        {listing.subtitle && <p className="text-sm text-neutral-500">{listing.subtitle}</p>}
                                        {listing.description && (
                                            <div className="text-sm text-neutral-400 leading-relaxed [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-3 [&_li]:mb-0.5 [&_strong]:text-amber-300"
                                                dangerouslySetInnerHTML={{ __html: listing.description }} />
                                        )}
                                        {listing.keywords.length > 0 && (
                                            <div className="flex flex-wrap gap-1 pt-1">
                                                {listing.keywords.map((kw, j) => (
                                                    <span key={j} className="text-sm px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">{kw}</span>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-sm text-neutral-700">{new Date(listing.generatedAt).toLocaleDateString("es-ES")}</p>
                                        </>
                                    )}
                                </div>
                                );
                            })}
                            </>
                        )}
                    </div>
                )}
                {nicheDetailTab === "book" && (
                    <div className="space-y-4">
                        {/* Cover section */}
                        {detailNiche.coverUrl ? (
                            <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.03] p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-black text-fuchsia-300">Portada principal</p>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => {
                                                setSelectedCoverNicheId(detailNiche._id);
                                                setCoverTitle(detailNiche.nickname?.trim() || detailNiche.name);
                                                setNicheDetailId(null);
                                                changeTab("gelato");
                                            }}
                                            className="h-7 px-3 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 text-xs font-black text-fuchsia-400 hover:bg-fuchsia-500/20 transition-all flex items-center gap-1.5">
                                            <Wand2 size={10} /> Cambiar
                                        </button>
                                        <button
                                            onClick={async () => {
                                                await fetch(`${apiBaseUrl}/niches/${detailNiche._id}`, {
                                                    method: "PATCH", headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ coverUrl: "", coverCandidates: [] }),
                                                }).catch(() => {});
                                                setNiches(prev => prev.map(n => n._id === detailNiche._id ? { ...n, coverUrl: undefined, coverCandidates: [], pipelineHasCover: false } : n));
                                                toast.success("Portada eliminada");
                                            }}
                                            className="h-7 w-7 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all flex items-center justify-center">
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-center">
                                    <div className="group/detailcover relative cursor-pointer rounded-xl overflow-hidden"
                                        onClick={() => setLightboxUrl({ url: detailNiche.coverUrl!, filename: `portada-${(detailNiche.nickname?.trim() || detailNiche.name).toLowerCase().replace(/\s+/g, "-")}.jpg` })}>
                                        <img src={detailNiche.coverUrl} alt="Portada" className="h-40 object-cover border border-fuchsia-500/20 shadow-lg" style={{ aspectRatio: "3/4" }} />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/detailcover:opacity-100 transition-opacity rounded-xl">
                                            <ZoomIn size={22} className="text-white drop-shadow" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex flex-col items-center gap-3">
                                <p className="text-sm font-black uppercase tracking-widest text-neutral-600">Sin portada</p>
                                <button
                                    onClick={() => {
                                        setSelectedCoverNicheId(detailNiche._id);
                                        setCoverTitle(detailNiche.nickname?.trim() || detailNiche.name);
                                        setNicheDetailId(null);
                                        changeTab("gelato");
                                    }}
                                    className="h-9 px-5 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 text-sm font-black text-fuchsia-400 hover:bg-fuchsia-500/25 transition-all flex items-center gap-2">
                                    <Wand2 size={12} /> Generar portada
                                </button>
                            </div>
                        )}
                        {/* Cover candidates (feature 8) */}
                        {(detailNiche.coverCandidates?.length ?? 0) > 0 && (
                            <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.03] p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-black text-fuchsia-300">Variantes de portada ({detailNiche.coverCandidates!.length})</p>
                                    <p className="text-[10px] text-neutral-500">Selecciona la portada principal</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {detailNiche.coverCandidates!.map((url, idx) => {
                                        const isActive = detailNiche.coverUrl === url;
                                        const total = detailNiche.coverCandidates!.length;
                                        // Heuristic: for coloring-books, first (total-2) are collage/half-colored, last 2 are AI
                                        const aiCount = detailNiche.productType === "coloring-book" ? 2 : total;
                                        const collageCount = total - aiCount;
                                        let typeLabel = `IA ${idx - collageCount + 1}`;
                                        if (idx < collageCount) {
                                            const collageLabels = ["Grid 2×2", "Triptych", "Hero", "½ Color"];
                                            typeLabel = collageLabels[idx] ?? `Collage ${idx + 1}`;
                                        }
                                        return (
                                            <div key={idx} className={`group/cand relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${isActive ? "border-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.3)]" : "border-transparent hover:border-white/20"}`}
                                                onClick={async () => {
                                                    await fetch(`${apiBaseUrl}/niches/${detailNiche._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coverUrl: url }) });
                                                    void fetchNiches();
                                                    toast.success(`"${typeLabel}" seleccionada`);
                                                }}>
                                                <img src={url} alt={`Variante ${idx + 1}`} className="w-full object-cover" style={{ aspectRatio: "3/4" }} />
                                                {isActive && (
                                                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-fuchsia-500 flex items-center justify-center">
                                                        <Check size={10} className="text-white" />
                                                    </div>
                                                )}
                                                <button
                                                    onClick={e => { e.stopPropagation(); setLightboxUrl({ url, filename: `portada-variante-${idx + 1}.jpg` }); }}
                                                    className="absolute top-1 left-1 w-5 h-5 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover/cand:opacity-100 transition-opacity hover:bg-black/80">
                                                    <ZoomIn size={9} className="text-white" />
                                                </button>
                                                <div className="absolute bottom-0 inset-x-0 bg-black/50 text-center text-[9px] font-black text-white/70 py-0.5">{typeLabel}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {!detailNiche.discoveryImagePrompt && detailNiche.generatedPrompt && (
                            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-black uppercase tracking-widest text-neutral-600">Prompt de generación</p>
                                    <button onClick={() => { navigator.clipboard.writeText(detailNiche.generatedPrompt!); toast.success("Copiado"); }} className="p-1 rounded text-neutral-700 hover:text-white transition-colors"><Copy size={9} /></button>
                                </div>
                                <p className="text-sm text-neutral-400 leading-relaxed">{detailNiche.generatedPrompt}</p>
                            </div>
                        )}
                        {detailNiche.discoveryImagePrompt && (
                            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-widest text-violet-400/80">Prompt de imagen</p>
                                        {detailNiche.pendingCatalogPrompts && detailNiche.pendingCatalogPrompts.length > 0 && (
                                            <p className="text-[9px] text-violet-500/60 mt-0.5">{detailNiche.pendingCatalogPrompts.length} prompts de catálogo pre-generados</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => { setDiscoveryPromptDraft(detailNiche.discoveryImagePrompt!); setDiscoveryPromptEditing(!discoveryPromptEditing); }} className="p-1 rounded text-neutral-700 hover:text-violet-400 transition-colors"><Pencil size={9} /></button>
                                        <button onClick={() => { navigator.clipboard.writeText(detailNiche.discoveryImagePrompt!); toast.success("Copiado"); }} className="p-1 rounded text-neutral-700 hover:text-white transition-colors"><Copy size={9} /></button>
                                    </div>
                                </div>
                                {discoveryPromptEditing ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={discoveryPromptDraft}
                                            onChange={e => setDiscoveryPromptDraft(e.target.value)}
                                            rows={4}
                                            className="w-full bg-white/[0.04] border border-violet-500/25 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/50 resize-none transition-all"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    const trimmed = discoveryPromptDraft.trim();
                                                    if (!trimmed) return;
                                                    await fetch(`${apiBaseUrl}/niches/${detailNiche._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ discoveryImagePrompt: trimmed, pendingCatalogPrompts: [] }) }).catch(() => {});
                                                    setNiches(prev => prev.map(n => n._id === detailNiche._id ? { ...n, discoveryImagePrompt: trimmed, pendingCatalogPrompts: [] } : n));
                                                    setDiscoveryPromptEditing(false);
                                                    toast.success("Prompt guardado — los prompts de catálogo se regenerarán al aprobar");
                                                }}
                                                className="flex-1 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 text-sm font-black text-violet-300 hover:bg-violet-500/30 transition-all">
                                                Guardar
                                            </button>
                                            <button onClick={() => setDiscoveryPromptEditing(false)} className="h-8 px-3 rounded-xl bg-white/[0.04] border border-white/8 text-sm text-neutral-500 hover:text-white transition-all">Cancelar</button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-violet-300/60 leading-relaxed">{detailNiche.discoveryImagePrompt}</p>
                                )}
                            </div>
                        )}
                        {pipelineDraft ? (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                    <div>
                                        <p className="text-sm font-black text-emerald-300">{pipelineDraft.fileName}</p>
                                        <p className="text-sm text-neutral-600">{pipelineDraft.pages.length} páginas · {new Date(pipelineDraft.savedAt).toLocaleDateString("es-ES")}</p>
                                    </div>
                                </div>
                                <button onClick={() => { void guardedLoadBookDraft(pipelineDraft); setNicheDetailId(null); changeTab("creation"); toast.success("Borrador cargado en el editor PDF"); }}
                                    className="w-full h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-sm font-black text-emerald-400 hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-2">
                                    <Library size={11} /> Abrir en editor PDF
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Link an existing draft */}
                                {bookDrafts.filter(d => !d.nicheId && d.pages.length > 0).length > 0 && (
                                    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Vincular borrador existente</p>
                                        <p className="text-[11px] text-neutral-600">Selecciona un libro ya creado para asociarlo a este nicho</p>
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {bookDrafts.filter(d => !d.nicheId && d.pages.length > 0).map(d => (
                                                <button key={d.id}
                                                    onClick={async () => {
                                                        const linked = { ...d, nicheId: nicheDetailId! };
                                                        const updatedDrafts = bookDrafts.map(x => x.id === d.id ? linked : x);
                                                        setBookDrafts(updatedDrafts);
                                                        await Promise.all([
                                                            fetch(`${apiBaseUrl}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ key: "kdp-book-drafts", value: updatedDrafts }]) }),
                                                            fetch(`${apiBaseUrl}/niches/${nicheDetailId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phase: "libro", pipelineHasPdf: true }) }),
                                                        ]).catch(() => {});
                                                        setNiches(prev => prev.map(n => n._id === nicheDetailId ? { ...n, phase: "libro", pipelineHasPdf: true } : n));
                                                        toast.success(`Borrador "${d.fileName}" vinculado`);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all text-left group">
                                                    <Library size={12} className="text-neutral-600 group-hover:text-indigo-400 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black text-white truncate">{d.fileName}</p>
                                                        <p className="text-[10px] text-neutral-600">{d.pages.length} páginas · {new Date(d.savedAt).toLocaleDateString("es-ES")}</p>
                                                    </div>
                                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest opacity-0 group-hover:opacity-100">Vincular</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col items-center justify-center py-6 gap-4">
                                    <Library size={28} strokeWidth={1} className="text-neutral-700 opacity-40" />
                                    <p className="text-sm font-black uppercase tracking-widest text-neutral-600 text-center">Sin borrador de libro</p>
                                    <div className="flex flex-col gap-2 w-full max-w-xs">
                                        {(() => {
                                            const catImgs = linkedCats.flatMap(c => c.images.map(img => ({ url: img.url, publicId: img.publicId })));
                                            const cloudImgsSrc = linkedCloudImgs.map(img => ({ url: img.url, publicId: img.publicId }));
                                            const nicheImgs = [...catImgs, ...cloudImgsSrc];
                                            if (nicheImgs.length === 0) return null;
                                            return (
                                                <button
                                                    onClick={async () => {
                                                        const ts = Date.now();
                                                        const shuffled = [...nicheImgs].sort(() => Math.random() - 0.5);
                                                        const pages: BookPage[] = [];
                                                        pages.push({ id: `pipe-owner-${ts}`, type: "owner", text: defaultTextStyle() });
                                                        pages.push({ id: `pipe-ownerback-${ts}`, type: "text", text: defaultTextStyle() });
                                                        const titleStyle = defaultTextStyle();
                                                        titleStyle.content = detailNiche.name || "Mi Libro de Colorear";
                                                        titleStyle.fontSize = 24; titleStyle.bold = true; titleStyle.verticalAlign = "middle"; titleStyle.align = "center";
                                                        pages.push({ id: `pipe-title-${ts}`, type: "text", text: titleStyle });
                                                        pages.push({ id: `pipe-titleback-${ts}`, type: "text", text: defaultTextStyle() });
                                                        shuffled.forEach((img, i) => {
                                                            pages.push({ id: `pipe-img-${i}-${ts}`, type: "image", image: { url: img.url, scale: 1, label: `${detailNiche.name} #${i + 1}` }, text: defaultTextStyle() });
                                                            pages.push({ id: `pipe-blank-${i}-${ts}`, type: "text", text: defaultTextStyle() });
                                                        });
                                                        const draftId = `pipeline-${nicheDetailId}-${ts}`;
                                                        const newDraft = { id: draftId, fileName: `${detailNiche.name} — Libro`, pages, savedAt: new Date().toISOString(), nicheId: nicheDetailId! };
                                                        const updatedDrafts = [newDraft, ...bookDrafts.filter(d => !d.id.startsWith(`pipeline-${nicheDetailId}`) && d.nicheId !== nicheDetailId)];
                                                        setBookDrafts(updatedDrafts);
                                                        await Promise.all([
                                                            fetch(`${apiBaseUrl}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ key: "kdp-book-drafts", value: updatedDrafts }]) }),
                                                            fetch(`${apiBaseUrl}/niches/${nicheDetailId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phase: "libro", pipelineHasPdf: true }) }),
                                                        ]).catch(() => {});
                                                        setNiches(prev => prev.map(n => n._id === nicheDetailId ? { ...n, phase: "libro", pipelineHasPdf: true } : n));
                                                        toast.success(`Libro creado · ${shuffled.length} imágenes (${catImgs.length} catálogo + ${cloudImgsSrc.length} almacén)`);
                                                    }}
                                                    className="h-9 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-sm font-black text-emerald-400 hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-2">
                                                    <Library size={11} /> Crear libro ({nicheImgs.length} imágenes)
                                                </button>
                                            );
                                        })()}
                                        <button onClick={() => { setNicheDetailId(null); void runNichePipeline(detailNiche); }}
                                            disabled={pipelineRunningId === nicheDetailId || pipelineQueueIds.includes(nicheDetailId ?? "")}
                                            className="h-9 px-6 rounded-xl bg-violet-500/15 border border-violet-500/30 text-sm font-black text-violet-300 hover:bg-violet-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                                            {pipelineQueueIds.includes(nicheDetailId ?? "")
                                                ? <><Loader2 size={10} className="animate-spin opacity-50" />En cola ({pipelineQueueIds.indexOf(nicheDetailId ?? "") + 1})</>
                                                : <><Play size={10} /> Lanzar pipeline completo</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {nicheDetailTab === "preview" && (() => {
                    type SpreadSlot =
                        | { kind: "cover"; url: string }
                        | { kind: "backCover"; url: string }
                        | { kind: "owner" }
                        | { kind: "bookImage"; url: string; label: string }
                        | { kind: "titleText"; content: string }
                        | { kind: "blank" };

                    const spreads: [SpreadSlot, SpreadSlot][] = [];

                    if (detailNiche.coverUrl) {
                        spreads.push([
                            detailNiche.backCoverUrl ? { kind: "backCover", url: detailNiche.backCoverUrl } : { kind: "blank" },
                            { kind: "cover", url: detailNiche.coverUrl },
                        ]);
                    }

                    if (pipelineDraft) {
                        for (const page of pipelineDraft.pages) {
                            if (page.type === "owner") {
                                spreads.push([{ kind: "blank" }, { kind: "owner" }]);
                            } else if (page.type === "image" && page.image?.url) {
                                spreads.push([{ kind: "blank" }, { kind: "bookImage", url: page.image.url, label: page.image.label ?? "" }]);
                            } else if ((page.type === "text" || page.type === "both") && page.text.content?.trim()) {
                                spreads.push([{ kind: "blank" }, { kind: "titleText", content: page.text.content }]);
                            }
                        }
                    }

                    if (spreads.length === 0) {
                        return (
                            <div className="flex flex-col items-center gap-4 py-16 text-neutral-600">
                                <BookOpen size={32} strokeWidth={1} className="opacity-40" />
                                <p className="text-sm font-black uppercase tracking-widest opacity-60">Sin contenido para previsualizar</p>
                                <p className="text-xs text-neutral-700 text-center max-w-xs">Genera una portada y crea el libro en la pestaña Libro KDP para ver el simulador</p>
                            </div>
                        );
                    }

                    const clampedIdx = Math.min(previewSpreadIdx, spreads.length - 1);
                    const [leftSlot, rightSlot] = spreads[clampedIdx];

                    const pageWrapCls = (side: "left" | "right") =>
                        `relative w-[170px] shrink-0 shadow-[2px_4px_24px_rgba(0,0,0,0.5)] overflow-hidden ${side === "left" ? "rounded-l-sm" : "rounded-r-sm"}`;
                    const PAGE_RATIO = "2/3";

                    const renderSlot = (slot: SpreadSlot, side: "left" | "right") => {
                        if (slot.kind === "blank") {
                            return (
                                <div className={pageWrapCls(side)} style={{ aspectRatio: PAGE_RATIO }}>
                                    <div className="absolute inset-0 bg-neutral-50 flex items-center justify-center">
                                        <span className="text-neutral-300 text-[8px] font-mono uppercase tracking-wider">dorso</span>
                                    </div>
                                </div>
                            );
                        }
                        if (slot.kind === "cover" || slot.kind === "backCover") {
                            return (
                                <div className={pageWrapCls(side)} style={{ aspectRatio: PAGE_RATIO }}>
                                    <img src={slot.url} alt={slot.kind === "cover" ? "Portada" : "Contraportada"} className="absolute inset-0 w-full h-full object-cover" />
                                </div>
                            );
                        }
                        if (slot.kind === "owner") {
                            return (
                                <div className={pageWrapCls(side)} style={{ aspectRatio: PAGE_RATIO }}>
                                    <div className="absolute inset-0 bg-white flex flex-col items-center justify-between px-[8%] py-[6%]">
                                        <div className="w-full flex-1 flex flex-col items-center justify-center gap-[4%]">
                                            <p className="text-[8px] font-semibold text-neutral-500 text-center leading-tight">Este libro pertenece a:</p>
                                            <p className="text-[7px] text-neutral-400 text-center leading-tight">This book belongs to:</p>
                                            <div className="w-4/5 border-b border-dashed border-neutral-300 mt-1" />
                                        </div>
                                        <div className="w-full flex flex-col items-center gap-1">
                                            <p className="text-[5px] text-neutral-400 text-center">Prueba tus colores aquí · Test your colors here</p>
                                            <div className="flex gap-[2px] border border-neutral-200 p-[2px] rounded-[1px]">
                                                {Array.from({ length: 6 }).map((_, i) => (
                                                    <div key={i} className="w-[8px] h-[8px] border border-neutral-200 rounded-[1px] bg-white" />
                                                ))}
                                            </div>
                                            <p className="text-[4px] text-neutral-300 text-center mt-0.5">© {new Date().getFullYear()} Emilio Jiménez. Todos los derechos reservados.</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        if (slot.kind === "titleText") {
                            return (
                                <div className={pageWrapCls(side)} style={{ aspectRatio: PAGE_RATIO }}>
                                    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center px-[10%] gap-2">
                                        <p className="text-center font-black text-neutral-800 text-[9px] leading-snug">{slot.content}</p>
                                        <p className="text-center text-neutral-400 text-[6px] mt-1">Emilio Jimenez</p>
                                    </div>
                                </div>
                            );
                        }
                        if (slot.kind === "bookImage") {
                            return (
                                <div className={pageWrapCls(side)} style={{ aspectRatio: PAGE_RATIO }}>
                                    <div className="absolute inset-0 bg-white p-[4%] flex items-center justify-center">
                                        <img src={slot.url} alt={slot.label} className="max-w-full max-h-full object-contain" />
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div className={pageWrapCls(side)} style={{ aspectRatio: PAGE_RATIO }}>
                                <div className="absolute inset-0 bg-neutral-100" />
                            </div>
                        );
                    };

                    return (
                        <div className="space-y-6">
                            {/* Book spread */}
                            <div className="flex items-center justify-center">
                                <div className="flex items-stretch gap-0 drop-shadow-2xl">
                                    {renderSlot(leftSlot, "left")}
                                    {/* Spine */}
                                    <div className="w-1.5 bg-gradient-to-b from-neutral-700 via-neutral-500 to-neutral-700 shrink-0 self-stretch" />
                                    {renderSlot(rightSlot, "right")}
                                </div>
                            </div>

                            {/* Spread label */}
                            <p className="text-center text-[10px] font-black uppercase tracking-widest text-neutral-600">
                                {clampedIdx === 0 && detailNiche.coverUrl ? "Portada" :
                                    leftSlot.kind === "blank" && rightSlot.kind === "owner" ? "Página del propietario" :
                                    leftSlot.kind === "blank" && rightSlot.kind === "titleText" ? "Portadilla" :
                                    leftSlot.kind === "blank" && rightSlot.kind === "bookImage" ? `Imagen ${spreads.slice(1).filter(([, r]) => r.kind === "bookImage").findIndex(([, r]) => r === rightSlot) + 1}` :
                                    `Página ${clampedIdx + 1}`}
                            </p>

                            {/* Navigation */}
                            <div className="flex items-center gap-3">
                                <button
                                    disabled={clampedIdx === 0}
                                    onClick={() => setPreviewSpreadIdx(Math.max(0, previewSpreadIdx - 1))}
                                    className="w-9 h-9 shrink-0 rounded-full border border-white/10 bg-white/[0.04] text-neutral-400 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed text-lg flex items-center justify-center">
                                    ‹
                                </button>
                                <div className="flex-1 flex flex-col gap-1.5 items-center">
                                    <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-violet-400 rounded-full transition-all duration-300"
                                            style={{ width: `${((clampedIdx + 1) / spreads.length) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-neutral-600 tabular-nums">{clampedIdx + 1} / {spreads.length}</span>
                                </div>
                                <button
                                    disabled={clampedIdx >= spreads.length - 1}
                                    onClick={() => setPreviewSpreadIdx(Math.min(spreads.length - 1, previewSpreadIdx + 1))}
                                    className="w-9 h-9 shrink-0 rounded-full border border-white/10 bg-white/[0.04] text-neutral-400 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed text-lg flex items-center justify-center">
                                    ›
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    </div>,
    document.body
);
return (
    <>
        {modalPortal}
        <ConfirmModal
            open={showBulkDeleteConfirm}
            onClose={() => setShowBulkDeleteConfirm(false)}
            onConfirm={() => { setShowBulkDeleteConfirm(false); void bulkDeleteNicheImages(allImgs); }}
            title={`¿Eliminar ${nicheDetailSelectedPids.size} imagen${nicheDetailSelectedPids.size !== 1 ? "es" : ""}?`}
            description="Se eliminarán de Cloudinary y de sus catálogos permanentemente. Esta acción no se puede deshacer."
            confirmLabel={`Eliminar ${nicheDetailSelectedPids.size}`}
            variant="danger"
            icon={<Trash2 size={24} className="text-red-400" />}
            zIndex={9200}
        />
    </>
);
}
