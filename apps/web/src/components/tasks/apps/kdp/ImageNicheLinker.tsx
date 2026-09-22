"use client";
// Selector de nicho por imagen individual — un nicho "principal" (Cloudinary context)
// más N nichos "extra" (Cloudinary tags). Permite que UNA imagen (no todo el catálogo)
// se reutilice en varios nichos/libros a la vez, o se mueva de uno a otro.
// Extraído de kdp-factory-app.tsx (vista Cloudinary vault) para reusarlo también en
// NicheDetailModal — ver feedback_components_first (CRÍTICO): nunca duplicar esta UI inline.
import { Loader2 } from "lucide-react";
import type { NicheFE } from "./types";

export interface ImageNicheLinkerProps {
    publicId: string;
    primaryNicheId: string | null;
    extraNicheIds: string[];
    niches: NicheFE[];
    isLinkingPrimary: boolean;
    isAddingExtra: boolean;
    removingExtraKey: string | null; // `${publicId}:${nicheId}` en curso de borrado
    onSetPrimary: (publicId: string, nicheId: string | null) => void;
    onStartAddExtra: (publicId: string) => void;
    onStopAddExtra: () => void;
    onAddExtra: (publicId: string, nicheId: string) => void;
    onRemoveExtra: (publicId: string, nicheId: string) => void;
    nd: (n: Pick<NicheFE, "name" | "nickname">) => string;
    className?: string;
}

export function ImageNicheLinker({
    publicId, primaryNicheId, extraNicheIds, niches,
    isLinkingPrimary, isAddingExtra, removingExtraKey,
    onSetPrimary, onStartAddExtra, onStopAddExtra, onAddExtra, onRemoveExtra, nd, className,
}: ImageNicheLinkerProps) {
    const linkedPrimaryNiche = primaryNicheId ? niches.find(n => n._id === primaryNicheId) : null;
    const extras = extraNicheIds.filter(id => id !== primaryNicheId);
    const availableNiches = niches.filter(n => n.status !== "archived" && n._id !== primaryNicheId && !extras.includes(n._id));

    return (
        <div className={`space-y-1 ${className ?? ""}`} onClick={e => e.stopPropagation()}>
            {isLinkingPrimary ? (
                <div className="flex items-center gap-1.5 px-2 py-1">
                    <Loader2 size={11} className="animate-spin text-cyan-400" />
                    <span className="text-xs text-cyan-400">Vinculando…</span>
                </div>
            ) : (
                <select
                    value={primaryNicheId ?? ""}
                    disabled={niches.length === 0}
                    onChange={e => {
                        const val = e.target.value;
                        if (val === primaryNicheId) return;
                        onSetPrimary(publicId, val || null);
                    }}
                    className="w-full h-7 bg-black/70 backdrop-blur-sm border border-white/20 rounded-xl px-2 text-xs text-white focus:outline-none focus:border-cyan-500/60 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                    title="Vincular a nicho principal"
                >
                    <option value="">— Sin nicho</option>
                    {niches.filter(n => n.status !== "archived").map(n => (
                        <option key={n._id} value={n._id}>{nd(n)}</option>
                    ))}
                    {primaryNicheId && !niches.find(n => n._id === primaryNicheId && n.status !== "archived") && linkedPrimaryNiche && (
                        <option key={linkedPrimaryNiche._id} value={linkedPrimaryNiche._id}>{nd(linkedPrimaryNiche)} (archivado)</option>
                    )}
                </select>
            )}
            {/* Nichos extra — misma imagen reutilizada en más de un nicho/libro */}
            <div className="flex items-center gap-1 flex-wrap">
                {extras.map(id => {
                    const n = niches.find(n => n._id === id);
                    const isRemoving = removingExtraKey === `${publicId}:${id}`;
                    return (
                        <span key={id} className="flex items-center gap-1 bg-violet-500/20 border border-violet-500/30 rounded-full px-1.5 py-0.5 text-xs text-violet-300 max-w-[100px]">
                            <span className="truncate">{n ? nd(n) : id.slice(-4)}</span>
                            {isRemoving ? (
                                <Loader2 size={9} className="animate-spin shrink-0" />
                            ) : (
                                <button onClick={() => onRemoveExtra(publicId, id)} className="shrink-0 hover:text-rose-400 ml-0.5">×</button>
                            )}
                        </span>
                    );
                })}
                {isAddingExtra ? (
                    availableNiches.length > 0 ? (
                        <select
                            autoFocus
                            defaultValue=""
                            onBlur={onStopAddExtra}
                            onChange={e => { if (e.target.value) onAddExtra(publicId, e.target.value); }}
                            className="h-6 bg-black/80 border border-violet-500/40 rounded-lg px-1 text-xs text-white focus:outline-none cursor-pointer max-w-[110px]"
                        >
                            <option value="">Elegir…</option>
                            {availableNiches.map(n => (
                                <option key={n._id} value={n._id}>{nd(n)}</option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-xs text-neutral-600">Sin más nichos</span>
                    )
                ) : (
                    availableNiches.length > 0 && (
                        <button
                            onClick={() => onStartAddExtra(publicId)}
                            className="w-5 h-5 rounded-full bg-white/10 border border-white/20 text-neutral-400 hover:text-white hover:bg-violet-500/20 hover:border-violet-500/40 transition-all text-xs flex items-center justify-center shrink-0"
                            title="Añadir a otro nicho"
                        >+</button>
                    )
                )}
            </div>
        </div>
    );
}
