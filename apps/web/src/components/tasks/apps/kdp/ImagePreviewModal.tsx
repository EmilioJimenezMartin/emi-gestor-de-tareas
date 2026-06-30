"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
    ChevronLeft, ChevronRight, Heart, Download, UploadCloud, Trash2, Plus, ImagePlus, X, Loader2,
} from "lucide-react";
import { AI_MODELS, AI_DIMENSIONS } from "../shared/ai-constants";
import type { CatalogImageFE, FavoriteImage } from "./types";

type PreviewContext = {
    urls: string[];
    index: number;
    catalogCtx?: { id: string; images: CatalogImageFE[] };
    vaultCtx?: true;
    cloudinaryCtx?: true;
} | null;

type VaultImage = { url: string; model: string; dim: string; seed?: number };
type CloudinaryImage = { publicId: string; url: string; width?: number; height?: number };

interface ImagePreviewModalProps {
    previewImage: string;
    previewContext: PreviewContext;
    vaultImages: VaultImage[];
    cloudinaryImages: CloudinaryImage[];
    previewImgRef: React.RefObject<HTMLImageElement | null>;
    previewLensRef: React.RefObject<HTMLDivElement | null>;
    previewMagnifier: boolean;
    setPreviewMagnifier: (v: boolean) => void;
    previewZoom: number;
    setPreviewZoom: (z: number) => void;
    navigatePreview: (dir: -1 | 1) => void;
    closePreview: () => void;
    favorites: Map<string, FavoriteImage>;
    toggleFavorite: (url: string, meta?: Pick<FavoriteImage, "label" | "source"> & { catalogId?: string }) => void;
    downloadPng: (url: string, filenameBase: string) => void;
    uploadToCloudinary: (vaultIndex: number) => Promise<void>;
    uploadingToCloud: number | null;
    setConfirmDeleteVaultIndex: (idx: number | null) => void;
    setVaultImages: (updater: (prev: VaultImage[]) => VaultImage[]) => void;
    setConfirmDeleteCloudinaryId: (id: string | null) => void;
    deletingFromCloud: string | null;
    addCatalogImageToVault: (img: CatalogImageFE) => void;
    setConfirmDeleteImageInfo: (info: { catalogId: string; publicId: string } | null) => void;
    selectedModel: string;
    selectedDim: string;
}

export function ImagePreviewModal({
    previewImage, previewContext, vaultImages, cloudinaryImages,
    previewImgRef, previewLensRef, previewMagnifier, setPreviewMagnifier,
    previewZoom, setPreviewZoom, navigatePreview, closePreview,
    favorites, toggleFavorite, downloadPng, uploadToCloudinary, uploadingToCloud,
    setConfirmDeleteVaultIndex, setVaultImages, setConfirmDeleteCloudinaryId, deletingFromCloud,
    addCatalogImageToVault, setConfirmDeleteImageInfo, selectedModel, selectedDim,
}: ImagePreviewModalProps) {
    const favLabel = previewContext?.vaultCtx
        ? (vaultImages[previewContext.index]?.model ?? "")
        : previewContext?.cloudinaryCtx
            ? (cloudinaryImages[previewContext.index]?.publicId?.split("/").pop() ?? "")
            : previewContext?.catalogCtx
                ? (previewContext.catalogCtx.images[previewContext.index]?.publicId?.split("/").pop() ?? "")
                : "";
    const favSource: FavoriteImage["source"] = previewContext?.vaultCtx ? "vault"
        : previewContext?.cloudinaryCtx ? "cloudinary"
            : previewContext?.catalogCtx ? "catalog"
                : "generated";
    const vaultIdx = previewContext?.vaultCtx ? previewContext.index : -1;
    const vaultImg = vaultIdx >= 0 ? vaultImages[vaultIdx] : null;
    const cldImg = previewContext?.cloudinaryCtx ? cloudinaryImages[previewContext.index] : null;
    const catalogImg = previewContext?.catalogCtx?.images[previewContext.index] ?? null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9000] bg-black/80"
            onClick={closePreview}
            role="dialog"
            aria-modal="true"
        >
            {/* Image — centering div stops at toolbar top, 16px breathing room at top */}
            <div
                className="absolute left-0 right-0 flex items-center justify-center"
                style={{ top: "16px", bottom: "130px" }}
                onClick={closePreview}
            >
                <div
                    style={{
                        width: "calc(100vw - 160px)",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseMove={e => {
                        const img = previewImgRef.current;
                        const lens = previewLensRef.current;
                        if (!img || !lens || !previewMagnifier) return;
                        const rect = img.getBoundingClientRect();
                        const LENS = 180;
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        if (x < 0 || y < 0 || x > rect.width || y > rect.height) { lens.style.display = "none"; return; }
                        lens.style.display = "block";
                        lens.style.left = `${Math.min(Math.max(x - LENS / 2, 0), rect.width - LENS)}px`;
                        lens.style.top = `${Math.min(Math.max(y - LENS / 2, 0), rect.height - LENS)}px`;
                        lens.style.backgroundPosition = `${-(x * previewZoom - LENS / 2)}px ${-(y * previewZoom - LENS / 2)}px`;
                        lens.style.backgroundSize = `${rect.width * previewZoom}px ${rect.height * previewZoom}px`;
                        lens.style.backgroundImage = `url(${previewImage})`;
                    }}
                    onMouseLeave={() => { if (previewLensRef.current) previewLensRef.current.style.display = "none"; }}
                >
                    <img
                        key={previewImage}
                        ref={previewImgRef}
                        src={previewImage}
                        alt="Vista previa"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            display: "block",
                            maxWidth: "100%",
                            maxHeight: "100%",
                            width: "auto",
                            height: "auto",
                            borderRadius: "16px",
                            cursor: previewMagnifier ? "crosshair" : "default",
                        }}
                    />
                    {/* Magnifier lens */}
                    <div
                        ref={previewLensRef}
                        className="absolute pointer-events-none rounded-2xl border-2 border-white/40 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.9)]"
                        style={{ width: 180, height: 180, display: "none", backgroundRepeat: "no-repeat" }}
                    />
                </div>
            </div>

            {/* Nav arrows */}
            {previewContext && previewContext.index > 0 && (
                <button onClick={(e) => { e.stopPropagation(); navigatePreview(-1); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 backdrop-blur-md text-white border border-white/10 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center z-10">
                    <ChevronLeft size={20} />
                </button>
            )}
            {previewContext && previewContext.index < previewContext.urls.length - 1 && (
                <button onClick={(e) => { e.stopPropagation(); navigatePreview(1); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 backdrop-blur-md text-white border border-white/10 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center z-10">
                    <ChevronRight size={20} />
                </button>
            )}

            {/* Toolbar */}
            <div
                className="absolute left-0 right-0 bottom-0 flex flex-col items-center gap-2.5 py-3"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3">
                    {previewContext && (
                        <span className="text-sm font-black text-neutral-500 uppercase tracking-widest">
                            {previewContext.index + 1} / {previewContext.urls.length}
                        </span>
                    )}
                    {/* Magnifier toggle + zoom selector */}
                    <div className="flex items-center gap-0.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-1">
                        <button onClick={() => { setPreviewMagnifier(false); if (previewLensRef.current) previewLensRef.current.style.display = "none"; }}
                            className={`h-6 px-2.5 rounded-xl text-sm font-black transition-all ${!previewMagnifier ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}>
                            Off
                        </button>
                        {([1.5, 2, 3, 4] as const).map(z => (
                            <button key={z} onClick={() => { setPreviewZoom(z); setPreviewMagnifier(true); }}
                                className={`h-6 px-2.5 rounded-xl text-sm font-black transition-all ${previewMagnifier && previewZoom === z ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}>
                                {z}×
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center px-4">
                    {/* Favorite */}
                    <button
                        onClick={() => toggleFavorite(previewImage, { label: favLabel, source: favSource, catalogId: previewContext?.catalogCtx?.id })}
                        className={`p-2.5 rounded-2xl backdrop-blur-md transition-all active:scale-90 border ${favorites.has(previewImage) ? "text-rose-400 border-rose-500/40 bg-rose-500/15" : "text-white border-white/15 bg-black/50"}`}
                        title={favorites.has(previewImage) ? "Quitar de favoritos" : "Marcar como favorita"}
                    >
                        <Heart size={18} className={favorites.has(previewImage) ? "fill-rose-400" : ""} />
                    </button>
                    {/* Download */}
                    <button
                        onClick={() => {
                            let fname = "imagen-kdp";
                            if (vaultImg) fname = `vault-${vaultImg.model || "image"}`.replaceAll(" ", "_");
                            else if (cldImg) fname = cldImg.publicId?.split("/").pop() ?? "cloudinary-image";
                            else if (catalogImg) fname = catalogImg.publicId?.split("/").pop() ?? "catalog-image";
                            else {
                                const modelName = AI_MODELS.find(m => m.id === selectedModel)?.name || "ai-image";
                                const dimName = AI_DIMENSIONS.find(d => d.id === selectedDim)?.ratio || "1x1";
                                fname = `${modelName}-${dimName}`.replaceAll(" ", "_");
                            }
                            downloadPng(previewImage, fname);
                        }}
                        className="p-2.5 rounded-2xl bg-black/50 backdrop-blur-md text-white active:scale-90 transition-all border border-white/15"
                        title="Descargar"
                    >
                        <Download size={18} />
                    </button>
                    {/* Vault-specific */}
                    {vaultImg && (
                        <>
                            <button
                                onClick={() => void uploadToCloudinary(vaultIdx)}
                                disabled={uploadingToCloud === vaultIdx}
                                className="p-2.5 rounded-2xl bg-cyan-500/15 backdrop-blur-md text-cyan-400 active:scale-90 transition-all border border-cyan-500/25 disabled:opacity-40"
                                title="Guardar en Cloudinary"
                            >
                                {uploadingToCloud === vaultIdx ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                            </button>
                            <button
                                onClick={() => setConfirmDeleteVaultIndex(vaultIdx)}
                                className="p-2.5 rounded-2xl bg-rose-500/15 backdrop-blur-md text-rose-400 active:scale-90 transition-all border border-rose-500/25"
                                title="Eliminar del vault"
                            >
                                <Trash2 size={18} />
                            </button>
                        </>
                    )}
                    {/* Cloudinary-specific */}
                    {cldImg && (
                        <>
                            <button
                                onClick={() => {
                                    const ratio = cldImg.width && cldImg.height ? `${cldImg.width}×${cldImg.height}` : "1:1";
                                    setVaultImages(prev => [{ url: cldImg.url, model: "Cloudinary", dim: ratio }, ...prev]);
                                }}
                                className="p-2.5 rounded-2xl bg-amber-500/15 backdrop-blur-md text-amber-400 active:scale-90 transition-all border border-amber-500/25"
                                title="Añadir al Vault"
                            >
                                <Plus size={18} />
                            </button>
                            <button
                                onClick={() => setConfirmDeleteCloudinaryId(cldImg.publicId)}
                                disabled={deletingFromCloud === cldImg.publicId}
                                className="p-2.5 rounded-2xl bg-rose-500/15 backdrop-blur-md text-rose-400 active:scale-90 transition-all border border-rose-500/25 disabled:opacity-40"
                                title="Eliminar de Cloudinary"
                            >
                                {deletingFromCloud === cldImg.publicId ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            </button>
                        </>
                    )}
                    {/* Catalog-specific */}
                    {catalogImg && (
                        <>
                            <button
                                onClick={() => addCatalogImageToVault(catalogImg)}
                                className="p-2.5 rounded-2xl bg-emerald-500/15 backdrop-blur-md text-emerald-400 active:scale-90 transition-all border border-emerald-500/25"
                                title="Añadir al Vault"
                            >
                                <ImagePlus size={18} />
                            </button>
                            <button
                                onClick={() => setConfirmDeleteImageInfo({ catalogId: previewContext!.catalogCtx!.id, publicId: catalogImg.publicId })}
                                className="p-2.5 rounded-2xl bg-rose-500/15 backdrop-blur-md text-rose-400 active:scale-90 transition-all border border-rose-500/25"
                                title="Eliminar imagen del catálogo"
                            >
                                <Trash2 size={18} />
                            </button>
                        </>
                    )}
                    {/* Close */}
                    <button
                        onClick={closePreview}
                        className="p-2.5 rounded-2xl bg-black/50 backdrop-blur-md text-neutral-400 hover:text-white hover:bg-rose-500/80 active:scale-90 transition-all border border-white/15"
                        title="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
