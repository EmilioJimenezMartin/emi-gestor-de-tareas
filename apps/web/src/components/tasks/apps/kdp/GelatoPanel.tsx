"use client";

import React from "react";
import {
    ExternalLink, BookOpen, Plus, Type, ImageIcon, Layers, FileText, Tag,
    ChevronDown, Lightbulb, Trash2, Archive, FolderArchive, Box, Cloud,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NicheSelect } from "./selects";
import type { NicheFE, IACatalogFE, CloudinaryImage, BookDraft } from "./types";

type VaultImage = { url: string; model: string; dim: string; seed?: number };

interface GelatoPanelProps {
    bookDrafts: BookDraft[];
    activeDraftId: string | null;
    niches: NicheFE[];
    vaultImages: VaultImage[];
    iaCatalogs: IACatalogFE[];
    cloudinaryImages: CloudinaryImage[];
    showKdpTips: boolean;
    setShowKdpTips: (v: boolean) => void;
    setZipFactoryOpen: (v: boolean) => void;
    setConfirmDeleteDraftId: (id: string) => void;
    setNiches: React.Dispatch<React.SetStateAction<NicheFE[]>>;
    setBookDrafts: React.Dispatch<React.SetStateAction<BookDraft[]>>;
    openKdpTemplateSelector: () => void;
    newBookDraft: () => void;
    guardedLoadBookDraft: (draft: BookDraft) => Promise<void>;
    apiBaseUrl: string;
}

export function GelatoPanel({
    bookDrafts, activeDraftId, niches, vaultImages, iaCatalogs, cloudinaryImages,
    showKdpTips, setShowKdpTips, setZipFactoryOpen, setConfirmDeleteDraftId,
    setNiches, setBookDrafts, openKdpTemplateSelector, newBookDraft,
    guardedLoadBookDraft, apiBaseUrl,
}: GelatoPanelProps) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Factory</span>
                    </h2>
                    <p className="text-sm text-neutral-500 mt-1">Herramientas de producción · libros, zips, contenido y print-on-demand</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <a
                        href="https://dashboard.gelato.com/price-navigator/prices"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-black text-neutral-500 hover:text-white hover:border-white/20 transition-all"
                    >
                        <ExternalLink size={12} /> Mis productos
                    </a>
                    <a
                        href="https://dashboard.gelato.com/price-navigator/prices"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-500/30 text-orange-300 font-bold text-sm transition-all shadow-lg shadow-orange-500/10"
                    >
                        <ExternalLink size={14} /> Gelato Dashboard
                    </a>
                </div>
            </div>

            {/* ── Factories ── */}
            <div className="space-y-4 pt-4 border-t border-white/8">
                <p className="text-sm font-black uppercase tracking-widest text-neutral-600">Herramientas de Producción</p>

                {/* Book Factory */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <Card variant="outline" className="relative overflow-hidden border-white/8 bg-gradient-to-br from-white/[0.02] to-transparent">
                        <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/8 blur-[60px] pointer-events-none" />
                        <div className="p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10 shrink-0">
                                    <BookOpen size={19} className="text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-black text-white tracking-tight italic leading-tight">Book Factory</h4>
                                    <p className="text-sm text-neutral-500 font-medium">
                                        {bookDrafts.length === 0 ? "Sin borradores" : `${bookDrafts.length} borrador${bookDrafts.length !== 1 ? "es" : ""}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => openKdpTemplateSelector()}
                                        className="h-8 px-3 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-all text-sm font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95"
                                    >
                                        <BookOpen size={11} /> Plantilla
                                    </button>
                                    <button
                                        onClick={newBookDraft}
                                        className="h-8 px-3 rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-all text-sm font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(245,158,11,0.25)] active:scale-95"
                                    >
                                        <Plus size={11} /> Nuevo
                                    </button>
                                </div>
                            </div>
                            {bookDrafts.length === 0 ? (
                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/6">
                                    <div className="flex gap-1.5">
                                        {[0, 1, 2, 3].map(i => (
                                            <div key={i} className="w-8 h-11 rounded-md bg-white/5 border border-dashed border-white/10" style={{ opacity: 1 - i * 0.2 }} />
                                        ))}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-widest text-neutral-600">Sin borradores</p>
                                        <p className="text-sm text-neutral-700">Pulsa "Nuevo" para crear tu primer libro</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {bookDrafts.map(draft => (
                                        <div key={draft.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${activeDraftId === draft.id ? "border-amber-500/30 bg-amber-500/5" : "border-white/8 bg-white/[0.02] hover:border-white/14"}`}>
                                            <div className="flex gap-1 shrink-0">
                                                {draft.pages.slice(0, 4).map((page, idx) => (
                                                    <div key={page.id} className="w-7 h-9 rounded-md overflow-hidden bg-white/5 border border-white/10 relative">
                                                        {page.image
                                                            ? <img src={page.image.url} alt="" className="w-full h-full object-cover" />
                                                            : <div className="w-full h-full flex items-center justify-center"><Type size={8} className="text-neutral-700" /></div>}
                                                        <span className="absolute bottom-0 right-0.5 text-[4px] font-mono text-white/40">{idx + 1}</span>
                                                    </div>
                                                ))}
                                                {draft.pages.length > 4 && (
                                                    <div className="w-7 h-9 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-sm font-black text-neutral-600">+{draft.pages.length - 4}</div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-white truncate">{draft.fileName || "libro-kdp"}</p>
                                                <p className="text-xs text-neutral-600">{draft.pages.length} pág · {new Date(draft.savedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                                                <NicheSelect
                                                    niches={niches}
                                                    selectedId={draft.nicheId ?? null}
                                                    placeholder="— Sin nicho —"
                                                    className="mt-1"
                                                    onChange={async (niche: NicheFE | null) => {
                                                        const newNicheId = niche?._id;
                                                        await fetch(`${apiBaseUrl}/book-drafts/${draft.id}`, {
                                                            method: "PATCH",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ nicheId: newNicheId ?? null }),
                                                        }).catch(() => {});
                                                        if (newNicheId) {
                                                            await fetch(`${apiBaseUrl}/niches/${newNicheId}`, {
                                                                method: "PATCH",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({ pipelineHasPdf: true }),
                                                            }).catch(() => {});
                                                            setNiches(prev => prev.map(n => n._id === newNicheId ? { ...n, pipelineHasPdf: true } : n));
                                                        }
                                                        if (draft.nicheId && draft.nicheId !== newNicheId) {
                                                            const otherLinked = bookDrafts.some(d => d.id !== draft.id && d.nicheId === draft.nicheId);
                                                            if (!otherLinked) {
                                                                await fetch(`${apiBaseUrl}/niches/${draft.nicheId}`, {
                                                                    method: "PATCH",
                                                                    headers: { "Content-Type": "application/json" },
                                                                    body: JSON.stringify({ pipelineHasPdf: false }),
                                                                }).catch(() => {});
                                                                setNiches(prev => prev.map(n => n._id === draft.nicheId ? { ...n, pipelineHasPdf: false } : n));
                                                            }
                                                        }
                                                        setBookDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, nicheId: newNicheId } : d));
                                                    }}
                                                />
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => void guardedLoadBookDraft(draft)}
                                                    className="h-7 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black transition-all text-sm font-black uppercase tracking-widest">
                                                    {activeDraftId === draft.id ? "Editando" : "Abrir"}
                                                </button>
                                                <button onClick={() => setConfirmDeleteDraftId(draft.id)}
                                                    className="h-7 w-7 rounded-lg text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all flex items-center justify-center">
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Consejos KDP */}
                            <div className="border border-white/[0.06] rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setShowKdpTips(!showKdpTips)}
                                    className="w-full flex items-center gap-2.5 px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left"
                                >
                                    <Lightbulb size={12} className="text-amber-400 shrink-0" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex-1">Consejos Amazon KDP</span>
                                    <ChevronDown size={12} className={`text-neutral-600 transition-transform duration-300 ${showKdpTips ? "rotate-180" : ""}`} />
                                </button>
                                {showKdpTips && (
                                    <div className="px-4 pb-4 pt-2 space-y-3 border-t border-white/[0.05]">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            {[
                                                { label: "Tamaño", value: "8,5 × 11 pulgadas", icon: <FileText size={11} />, color: "text-blue-400 bg-blue-500/10" },
                                                { label: "Máx. ilustraciones", value: "~50 por libro", icon: <ImageIcon size={11} />, color: "text-violet-400 bg-violet-500/10" },
                                                { label: "Interior", value: "Color estándar · Papel blanco", icon: <Layers size={11} />, color: "text-emerald-400 bg-emerald-500/10" },
                                            ].map(({ label, value, icon, color }) => (
                                                <div key={label} className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                                    <div className={`mt-0.5 p-1 rounded-md ${color} shrink-0`}>{icon}</div>
                                                    <div>
                                                        <p className="text-sm font-black uppercase tracking-widest text-neutral-600 mb-0.5">{label}</p>
                                                        <p className="text-sm font-bold text-white leading-tight">{value}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-widest text-neutral-600 mb-1.5 flex items-center gap-1.5"><Tag size={9} />Categorías activas</p>
                                            <div className="space-y-1">
                                                {[
                                                    "Libros para Colorear para Adultos › Fantasía y Ciencia Ficción",
                                                    "Libros para Colorear para Adultos › Ciudades y Arquitectura",
                                                    "Libros para Colorear para Adultos › General",
                                                ].map(cat => (
                                                    <div key={cat} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.025] border border-white/[0.05]">
                                                        <div className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                                                        <span className="text-sm text-neutral-400 leading-snug">Libros › … › Manualidades › <span className="text-white font-semibold">{cat}</span></span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Zip Factory */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <Card variant="outline" className="relative overflow-hidden border-white/8 bg-gradient-to-br from-white/[0.02] to-transparent">
                        <div className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-500/8 blur-[60px] pointer-events-none" />
                        <div className="p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10 shrink-0">
                                    <Archive size={19} className="text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-black text-white tracking-tight italic leading-tight">Zip Factory</h4>
                                    <p className="text-sm text-neutral-500 font-medium">Selecciona imágenes y descárgalas comprimidas</p>
                                </div>
                                <Button
                                    onClick={() => setZipFactoryOpen(true)}
                                    className="h-9 px-4 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-all text-sm font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(16,185,129,0.3)] active:scale-95 shrink-0"
                                >
                                    <FolderArchive size={13} />
                                    Abrir
                                </Button>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-neutral-600">
                                <span className="flex items-center gap-1"><Box size={10} className="text-emerald-600" />{vaultImages.length} vault</span>
                                <span className="flex items-center gap-1"><Layers size={10} className="text-emerald-600" />{iaCatalogs.reduce((s, c) => s + c.images.length, 0)} catálogos</span>
                                <span className="flex items-center gap-1"><Cloud size={10} className="text-emerald-600" />{cloudinaryImages.length} cloud</span>
                            </div>
                        </div>
                    </Card>
                </div>

            </div>
        </div>
    );
}
