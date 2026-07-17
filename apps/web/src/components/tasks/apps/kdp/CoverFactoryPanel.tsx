"use client";

import React from "react";
import {
    ImageIcon, Plus, Search, ArrowDownNarrowWide, ArrowUpNarrowWide,
    ZoomIn, Download, Star, Pencil, Trash2, Clipboard,
} from "lucide-react";
import { toast } from "sonner";
import type { NicheFE, NicheStyle } from "./types";

type LightboxUrlType = {
    url: string;
    catalogId?: string;
    publicId?: string;
    filename?: string;
    urls?: string[];
    meta?: { catalogId?: string; publicId?: string }[];
    index?: number;
} | null;

interface CoverFactoryPanelProps {
    niches: NicheFE[];
    coverFactorySearch: string;
    coverFactoryNicheId: string;
    coverFactorySort: "newest" | "oldest";
    setCoverFactorySearch: (s: string) => void;
    setCoverFactoryNicheId: (id: string) => void;
    setCoverFactorySort: (v: "newest" | "oldest") => void;
    setSelectedCoverNicheId: (id: string | null) => void;
    setGeneratedCoverUrl: (url: string | null) => void;
    setGeneratedBackCoverUrl: (url: string | null) => void;
    setShowCoverModal: (v: boolean) => void;
    setCoverTextLayers: (layers: any[]) => void;
    setCoverTitle: (title: string) => void;
    setCoverSubtitle: (sub: string) => void;
    setCoverStyle: (style: string) => void;
    setCoverColorTheme: (theme: string) => void;
    setCoverModelId: (id: string) => void;
    setCoverDescription: (desc: string) => void;
    setCoverStep: (step: number) => void;
    setCoverModalTab: (tab: string) => void;
    setNiches: React.Dispatch<React.SetStateAction<NicheFE[]>>;
    setLightboxUrl: (url: LightboxUrlType) => void;
    setConfirmDeleteCandGallery: (info: { nicheId: string; candUrl: string } | null) => void;
    downloadFile: (url: string, filename: string) => Promise<void>;
    nicheStyleToCover: Record<NicheStyle, { style: string; colorTheme: string }>;
    nicheStyleModel: Record<NicheStyle, string>;
    apiBaseUrl: string;
}

export function CoverFactoryPanel({
    niches, coverFactorySearch, coverFactoryNicheId, coverFactorySort,
    setCoverFactorySearch, setCoverFactoryNicheId, setCoverFactorySort,
    setSelectedCoverNicheId, setGeneratedCoverUrl, setGeneratedBackCoverUrl,
    setShowCoverModal, setCoverTextLayers, setCoverTitle, setCoverSubtitle,
    setCoverStyle, setCoverColorTheme, setCoverModelId, setCoverDescription,
    setCoverStep, setCoverModalTab, setNiches, setLightboxUrl,
    setConfirmDeleteCandGallery, downloadFile, nicheStyleToCover, nicheStyleModel, apiBaseUrl,
}: CoverFactoryPanelProps) {
    const [pastingNicheId, setPastingNicheId] = React.useState<string | null>(null);

    const pasteCoverForNiche = async (nicheId: string, currentCandidates: string[]) => {
        try {
            setPastingNicheId(nicheId);
            const clipItems = await navigator.clipboard.read();
            let blob: Blob | null = null;
            for (const item of clipItems) {
                const imageType = item.types.find(t => t.startsWith("image/"));
                if (imageType) { blob = await item.getType(imageType); break; }
            }
            if (!blob) { toast.error("No hay imagen en el portapapeles"); return; }

            const dataUrl = await new Promise<string>((res, rej) => {
                const reader = new FileReader();
                reader.onload = () => res(reader.result as string);
                reader.onerror = rej;
                reader.readAsDataURL(blob!);
            });

            const resp = await fetch(`${apiBaseUrl}/cloudinary/upload`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataUrl }),
            });
            if (!resp.ok) throw new Error("Error subiendo imagen");
            const { image } = await resp.json();

            const newCandidates = [...currentCandidates, image.url];
            await fetch(`${apiBaseUrl}/niches/${nicheId}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ coverCandidates: newCandidates, coverUrl: image.url, pipelineHasCover: true }),
            });
            setNiches(prev => prev.map(x => x._id === nicheId ? { ...x, coverCandidates: newCandidates, coverUrl: image.url, pipelineHasCover: true } : x));
            toast.success("Portada pegada y guardada");
        } catch (e: any) {
            toast.error(e?.message ?? "Error al pegar portada");
        } finally {
            setPastingNicheId(null);
        }
    };

    const allWithCovers = niches.filter(n => n.coverUrl || (n.coverCandidates?.length ?? 0) > 0 || n.backCoverUrl);

    const q = coverFactorySearch.trim().toLowerCase();
    const nichesWithCovers = allWithCovers
        .filter(n => {
            if (q && !(n.nickname ?? n.name).toLowerCase().includes(q)) return false;
            if (coverFactoryNicheId !== "all" && n._id !== coverFactoryNicheId) return false;
            return true;
        })
        .sort((a, b) => {
            const da = new Date(a.updatedAt ?? a.createdAt).getTime();
            const db = new Date(b.updatedAt ?? b.createdAt).getTime();
            return coverFactorySort === "newest" ? db - da : da - db;
        });

    return (
    <div className="mt-8 pt-8 border-t border-white/[0.06]">
        <div className="rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="h-px w-full bg-gradient-to-r from-fuchsia-500/60 via-violet-400/20 to-transparent" />
            <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-fuchsia-500/15 flex items-center justify-center">
                        <ImageIcon size={16} className="text-fuchsia-400" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-black text-white">Cover Factory</h2>
                        <p className="text-sm text-neutral-600">{allWithCovers.length > 0 ? `${nichesWithCovers.length} de ${allWithCovers.length} portada${allWithCovers.length !== 1 ? "s" : ""}` : "Portadas KDP por nicho"}</p>
                    </div>
                    <button
                        onClick={() => { setSelectedCoverNicheId(null); setGeneratedCoverUrl(null); setGeneratedBackCoverUrl(null); setShowCoverModal(true); }}
                        className="h-9 px-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(192,38,211,0.25)] transition-all active:scale-95 shrink-0"
                    >
                        <Plus size={12} /> Nueva
                    </button>
                </div>

                {/* Search + filters + sort */}
                {allWithCovers.length > 0 && (
                <div className="flex flex-col gap-2">
                    {/* Search + niche selector + sort row */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
                            <input
                                value={coverFactorySearch}
                                onChange={e => setCoverFactorySearch(e.target.value)}
                                placeholder="Buscar por nombre…"
                                className="w-full h-8 pl-8 pr-3 rounded-xl bg-white/[0.04] border border-white/8 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-fuchsia-500/40 transition-colors"
                            />
                        </div>
                        <select
                            value={coverFactoryNicheId}
                            onChange={e => setCoverFactoryNicheId(e.target.value)}
                            className="h-8 px-2 rounded-xl bg-white/[0.04] border border-white/8 hover:border-white/15 text-xs text-neutral-400 focus:outline-none focus:border-fuchsia-500/40 transition-colors shrink-0 max-w-[140px] cursor-pointer"
                        >
                            <option value="all">Todos los nichos</option>
                            {allWithCovers.map(n => (
                                <option key={n._id} value={n._id}>{n.nickname?.trim() || n.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setCoverFactorySort(coverFactorySort === "newest" ? "oldest" : "newest")}
                            className="h-8 px-3 rounded-xl bg-white/[0.04] border border-white/8 hover:border-white/15 text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors shrink-0"
                            title={coverFactorySort === "newest" ? "Más reciente primero" : "Más antiguo primero"}
                        >
                            {coverFactorySort === "newest" ? <ArrowDownNarrowWide size={12} /> : <ArrowUpNarrowWide size={12} />}
                            <span className="hidden sm:inline">{coverFactorySort === "newest" ? "Reciente" : "Antiguo"}</span>
                        </button>
                    </div>
                </div>
                )}

                {allWithCovers.length === 0 ? (
                    <div className="flex items-center gap-3 py-6 justify-center text-center">
                        <div className="space-y-1">
                            <p className="text-sm font-black uppercase tracking-widest text-neutral-700">Sin portadas</p>
                            <p className="text-xs text-neutral-700">Pulsa "Nueva" para generar tu primera portada</p>
                        </div>
                    </div>
                ) : nichesWithCovers.length === 0 ? (
                    <div className="py-6 text-center">
                        <p className="text-sm text-neutral-600">Sin resultados para esta búsqueda</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {nichesWithCovers.map(n => {
                            const slug = (n.nickname?.trim() || n.name).toLowerCase().replace(/\s+/g, "-");
                            const openEdit = () => {
                                setSelectedCoverNicheId(n._id);
                                const coverMap = nicheStyleToCover[n.styleCategory] ?? nicheStyleToCover.generic;
                                const savedData = n.coverUrl ? n.coverCandidatesData?.[n.coverUrl] : undefined;
                                if (savedData) {
                                    setGeneratedCoverUrl(savedData.rawUrl);
                                    setCoverTextLayers(savedData.layers as any[]);
                                } else {
                                    setGeneratedCoverUrl(n.coverUrl ?? null);
                                    setCoverTextLayers([]);
                                }
                                setGeneratedBackCoverUrl(n.backCoverUrl ?? null);
                                setCoverTitle(n.nickname?.trim() || n.name);
                                setCoverSubtitle(n.productType === "coloring-book" ? "Coloring Book for Adults" : "");
                                setCoverStyle(coverMap.style);
                                setCoverColorTheme(coverMap.colorTheme);
                                setCoverModelId(nicheStyleModel[n.styleCategory] ?? "pollinations-flux");
                                if (n.description) setCoverDescription(n.description);
                                setShowCoverModal(true);
                                setCoverStep(2);
                            };
                            return (
                            <div key={n._id} className="group rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden hover:border-fuchsia-500/20 transition-all flex flex-col">
                                {/* Covers row */}
                                <div className="flex gap-1 p-1">
                                    {/* Front cover */}
                                    <div className="group/cover relative flex-1 rounded-xl overflow-hidden bg-white/[0.02] cursor-pointer" style={{ aspectRatio: "1600/2560" }}
                                        onClick={() => n.coverUrl && setLightboxUrl({ url: n.coverUrl, filename: `portada-${slug}.jpg` })}>
                                        {n.coverUrl
                                            ? <img src={n.coverUrl} alt="Portada" className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-white/10" /></div>
                                        }
                                        {/* Candidates badge */}
                                        {(n.coverCandidates?.length ?? 0) > 1 && (
                                            <div className="absolute top-1 left-1 h-4 px-1.5 rounded bg-black/60 text-[9px] font-black text-white/70 flex items-center">
                                                {n.coverCandidates!.length}
                                            </div>
                                        )}
                                        {/* Zoom overlay */}
                                        {n.coverUrl && (
                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
                                                <ZoomIn size={20} className="text-white drop-shadow" />
                                            </div>
                                        )}
                                        {/* Label + download */}
                                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1.5 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[9px] font-black text-white/60 uppercase tracking-wide">Portada</span>
                                            {n.coverUrl && (
                                                <button onClick={e => { e.stopPropagation(); void downloadFile(n.coverUrl!, `portada-${slug}.jpg`); }}
                                                    className="h-5 w-5 rounded bg-fuchsia-500/80 hover:bg-fuchsia-500 text-white flex items-center justify-center transition-all">
                                                    <Download size={9} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {/* Back cover — same flex-1 so both covers share equal width */}
                                    {n.backCoverUrl && (
                                        <div className="group/backcover relative flex-1 rounded-xl overflow-hidden bg-white/[0.02] cursor-pointer" style={{ aspectRatio: "1600/2560" }}
                                            onClick={() => setLightboxUrl({ url: n.backCoverUrl!, filename: `contraportada-${slug}.jpg` })}>
                                            <img src={n.backCoverUrl} alt="Contraportada" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/backcover:opacity-100 transition-opacity">
                                                <ZoomIn size={20} className="text-white drop-shadow" />
                                            </div>
                                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-1.5 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[8px] font-black text-white/60 uppercase tracking-wide leading-none">Contra</span>
                                                <button onClick={e => { e.stopPropagation(); void downloadFile(n.backCoverUrl!, `contraportada-${slug}.jpg`); }}
                                                    className="h-5 w-5 rounded bg-violet-500/80 hover:bg-violet-500 text-white flex items-center justify-center transition-all shrink-0">
                                                    <Download size={9} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Candidates strip */}
                                {(n.coverCandidates?.length ?? 0) > 0 && (() => {
                                    const candidates = n.coverCandidates ?? [];
                                    const coverMap = nicheStyleToCover[n.styleCategory] ?? nicheStyleToCover.generic;
                                    const openWithUrl = (url: string) => {
                                        setSelectedCoverNicheId(n._id);
                                        const savedData = n.coverCandidatesData?.[url];
                                        if (savedData) {
                                            setGeneratedCoverUrl(savedData.rawUrl);
                                            setCoverTextLayers(savedData.layers as any[]);
                                        } else {
                                            setGeneratedCoverUrl(url);
                                            setCoverTextLayers([]);
                                        }
                                        setGeneratedBackCoverUrl(n.backCoverUrl ?? null);
                                        setCoverTitle(n.nickname?.trim() || n.name);
                                        setCoverSubtitle(n.productType === "coloring-book" ? "Coloring Book for Adults" : "");
                                        setCoverStyle(coverMap.style);
                                        setCoverColorTheme(coverMap.colorTheme);
                                        setCoverModelId(nicheStyleModel[n.styleCategory] ?? "pollinations-flux");
                                        if (n.description) setCoverDescription(n.description);
                                        setShowCoverModal(true);
                                        setCoverStep(2);
                                    };
                                    const setAsMain = async (url: string) => {
                                        await fetch(`${apiBaseUrl}/niches/${n._id}`, {
                                            method: "PATCH", headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ coverUrl: url, pipelineHasCover: true }),
                                        }).catch(() => {});
                                        setNiches(prev => prev.map(x => x._id === n._id ? { ...x, coverUrl: url, pipelineHasCover: true } : x));
                                        toast.success("Portada principal actualizada");
                                    };
                                    return (
                                    <div className="px-1 pb-1">
                                        <div className="flex gap-1 overflow-x-auto no-scrollbar">
                                            {candidates.map((url, idx) => {
                                                const isMain = url === n.coverUrl;
                                                return (
                                                <div key={idx} className="group/cand relative shrink-0 rounded-lg overflow-hidden bg-white/[0.02] border border-white/6 hover:border-fuchsia-500/30 transition-all cursor-pointer"
                                                    style={{ width: 44, aspectRatio: "1600/2560" }}
                                                    onClick={() => setLightboxUrl({ url, filename: `portada-${slug}-${idx + 1}.jpg` })}>
                                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                                    {isMain && (
                                                        <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded bg-fuchsia-500/90 flex items-center justify-center">
                                                            <Star size={7} className="text-white fill-white" />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover/cand:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5">
                                                        {!isMain && (
                                                            <button onClick={e => { e.stopPropagation(); void setAsMain(url); }}
                                                                className="w-6 h-6 rounded bg-fuchsia-500/80 hover:bg-fuchsia-500 text-white flex items-center justify-center transition-all"
                                                                title="Usar como principal">
                                                                <Star size={9} />
                                                            </button>
                                                        )}
                                                        <button onClick={e => { e.stopPropagation(); openWithUrl(url); }}
                                                            className="w-6 h-6 rounded bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all"
                                                            title="Editar">
                                                            <Pencil size={9} />
                                                        </button>
                                                        <button onClick={e => { e.stopPropagation(); void downloadFile(url, `portada-${slug}-${idx + 1}.jpg`); }}
                                                            className="w-6 h-6 rounded bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all"
                                                            title="Descargar">
                                                            <Download size={9} />
                                                        </button>
                                                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteCandGallery({ nicheId: n._id, candUrl: url }); }}
                                                            className="w-6 h-6 rounded bg-rose-500/60 hover:bg-rose-500/80 text-white flex items-center justify-center transition-all"
                                                            title="Eliminar">
                                                            <Trash2 size={9} />
                                                        </button>
                                                    </div>
                                                </div>
                                                );
                                            })}
                                            {/* Nueva portada */}
                                            <button
                                                onClick={() => { setSelectedCoverNicheId(n._id); setGeneratedCoverUrl(null); setGeneratedBackCoverUrl(n.backCoverUrl ?? null); setCoverTitle(n.nickname?.trim() || n.name); setCoverSubtitle(n.productType === "coloring-book" ? "Coloring Book for Adults" : ""); setCoverStyle(coverMap.style); setCoverColorTheme(coverMap.colorTheme); setCoverModelId(nicheStyleModel[n.styleCategory] ?? "pollinations-flux"); if (n.description) setCoverDescription(n.description); setCoverStep(1); setShowCoverModal(true); }}
                                                className="shrink-0 rounded-lg border border-dashed border-white/15 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5 text-white/30 hover:text-fuchsia-400 flex items-center justify-center transition-all"
                                                style={{ width: 44, aspectRatio: "1600/2560" }}
                                                title="Nueva portada">
                                                <Plus size={12} />
                                            </button>
                                            {/* Pegar desde portapapeles */}
                                            <button
                                                onClick={() => void pasteCoverForNiche(n._id, candidates)}
                                                disabled={pastingNicheId === n._id}
                                                className="shrink-0 rounded-lg border border-dashed border-white/15 hover:border-cyan-500/40 hover:bg-cyan-500/5 text-white/30 hover:text-cyan-400 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-wait"
                                                style={{ width: 44, aspectRatio: "1600/2560" }}
                                                title="Pegar imagen del portapapeles">
                                                <Clipboard size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    );
                                })()}

                                {/* Footer */}
                                <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                                    <p className="text-xs font-black text-white truncate flex-1">{n.nickname?.trim() || n.name}</p>
                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => void pasteCoverForNiche(n._id, n.coverCandidates ?? [])}
                                            disabled={pastingNicheId === n._id}
                                            className="h-6 w-6 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-400 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-wait"
                                            title="Pegar portada del portapapeles">
                                            <Clipboard size={10} />
                                        </button>
                                        <button onClick={openEdit}
                                            className="h-6 w-6 rounded-lg bg-fuchsia-500/15 hover:bg-fuchsia-500/30 text-fuchsia-400 flex items-center justify-center transition-all"
                                            title="Editar">
                                            <Pencil size={10} />
                                        </button>
                                        <button onClick={() => {
                                            setSelectedCoverNicheId(n._id);
                                            setGeneratedCoverUrl(n.coverUrl ?? null);
                                            setGeneratedBackCoverUrl(n.backCoverUrl ?? null);
                                            const coverMap = nicheStyleToCover[n.styleCategory] ?? nicheStyleToCover.generic;
                                            setCoverTitle(n.nickname?.trim() || n.name);
                                            setCoverStyle(coverMap.style);
                                            setCoverColorTheme(coverMap.colorTheme);
                                            setShowCoverModal(true);
                                            setCoverModalTab("front");
                                        }}
                                            className="h-6 w-6 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 flex items-center justify-center transition-all"
                                            title="Gestionar portadas">
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    </div>
    );
}
