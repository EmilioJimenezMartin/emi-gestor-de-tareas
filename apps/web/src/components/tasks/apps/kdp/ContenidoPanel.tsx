"use client";

import React from "react";
import {
    Sparkles, BookOpen, Filter, FileText, Target, Eye, Copy, Loader2,
    Trash2, ChevronDown, Save, ListOrdered, Type, Tag, BookText, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { NicheSelect, KdpSelect } from "./selects";
import { ListingCardFields } from "./ListingCardFields";
import type { NicheFE, NicheKDPListing } from "./types";

type ContentType = "kdp-physical-book" | "full-listing" | "titles" | "description" | "keywords" | "back-cover" | "series";
type ContentPlatform = "kdp" | "etsy" | "both";
type ContentLanguage = "es" | "en";

interface ContenidoPanelProps {
    niches: NicheFE[];
    contentSaveNicheId: string;
    contentType: ContentType;
    contentResult: any | null;
    contentNiche: string;
    contentProductType: string;
    contentLanguage: ContentLanguage;
    contentExtras: string;
    contentPlatform: ContentPlatform;
    isGeneratingContent: boolean;
    savingContentListing: boolean;
    expandedListingId: string | null;
    deletingListingId: string | null;
    setContentSaveNicheId: (v: string) => void;
    setContentNiche: (v: string) => void;
    setContentType: (v: ContentType) => void;
    setContentResult: (v: null) => void;
    setContentLanguage: (v: ContentLanguage) => void;
    setContentProductType: (v: string) => void;
    setContentExtras: (v: string) => void;
    setContentPlatform: (v: ContentPlatform) => void;
    setExpandedListingId: (v: string | null) => void;
    setNicheDetailId: (v: string | null) => void;
    setNicheDetailTab: (tab: string) => void;
    generateContent: () => Promise<void>;
    saveContentToNiche: () => Promise<void>;
    deleteNicheListing: (nicheId: string, listingId: string) => Promise<void>;
    nd: (n: Pick<NicheFE, "name" | "nickname">) => string;
}

const CONTENT_PRODUCT_TYPES = ["Coloring Book", "Activity Book", "Journal", "Planner", "Wall Art", "Sticker Sheet", "Template Pack", "Workbook", "Puzzle Book", "Notebook", "Low Content Book", "Printable Set"];

const CONTENT_TYPES_SECONDARY = [
    { id: "full-listing",  label: "Listing Completo", icon: <ListOrdered size={12} /> },
    { id: "titles",        label: "Títulos",          icon: <Type size={12} /> },
    { id: "description",   label: "Descripción",      icon: <FileText size={12} /> },
    { id: "keywords",      label: "Keywords",         icon: <Tag size={12} /> },
    { id: "back-cover",    label: "Contraportada",    icon: <BookText size={12} /> },
    { id: "series",        label: "Serie",            icon: <Layers size={12} /> },
] as const;

function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
}

export function ContenidoPanel({
    niches, contentSaveNicheId, contentType, contentResult, contentNiche,
    contentProductType, contentLanguage, contentExtras, contentPlatform,
    isGeneratingContent, savingContentListing, expandedListingId, deletingListingId,
    setContentSaveNicheId, setContentNiche, setContentType, setContentResult,
    setContentLanguage, setContentProductType, setContentExtras, setContentPlatform,
    setExpandedListingId, setNicheDetailId, setNicheDetailTab,
    generateContent, saveContentToNiche, deleteNicheListing, nd,
}: ContenidoPanelProps) {
    const allListings = niches.flatMap(n =>
        (n.listings ?? []).map(l => ({ ...l, nicheName: n.name, nicheId: n._id }))
    ).sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    const nichesWithListings = niches.filter(n => (n.listings?.length ?? 0) > 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 items-start mt-12 pt-8 border-t border-white/[0.06]">
            {/* ─ LEFT: Inline content generator ─ */}
            <div className="lg:sticky lg:top-6 rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
                <div className="h-px w-full bg-gradient-to-r from-amber-500/60 via-orange-400/20 to-transparent" />
                <div className="p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                            <Sparkles size={16} className="text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">Generador de Contenido</h2>
                            <p className="text-sm text-neutral-600">Metadatos KDP y Etsy con IA</p>
                        </div>
                    </div>

                    <NicheSelect
                        niches={niches}
                        selectedId={contentSaveNicheId || null}
                        placeholder="Vincular a nicho (opcional)"
                        onChange={(n) => {
                            setContentSaveNicheId(n?._id ?? "");
                            if (n) { const parts = [n.nickname?.trim(), n.name].filter(Boolean); setContentNiche(parts.join(" · ")); }
                        }}
                    />

                    <div className="space-y-2">
                        <button onClick={() => { setContentType("kdp-physical-book"); setContentResult(null); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left ${contentType === "kdp-physical-book" ? "border-amber-500/40 bg-amber-500/[0.07]" : "border-white/8 bg-white/[0.02] hover:border-white/12"}`}>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${contentType === "kdp-physical-book" ? "bg-amber-500/20" : "bg-white/5"}`}>
                                <BookOpen size={14} className={contentType === "kdp-physical-book" ? "text-amber-400" : "text-neutral-600"} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-black leading-tight ${contentType === "kdp-physical-book" ? "text-amber-300" : "text-neutral-400"}`}>Libro físico KDP</p>
                                <p className="text-sm text-neutral-700 mt-0.5">Título · Subtítulo · Descripción HTML · 7 keywords</p>
                            </div>
                            {contentType === "kdp-physical-book" && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                        </button>
                        <div className="flex gap-1.5 flex-wrap">
                            {CONTENT_TYPES_SECONDARY.map(ct => (
                                <button key={ct.id} onClick={() => { setContentType(ct.id as ContentType); setContentResult(null); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${contentType === ct.id ? "border-white/25 bg-white/10 text-white" : "border-white/8 bg-white/[0.02] text-neutral-600 hover:border-white/15 hover:text-neutral-400"}`}>
                                    {ct.icon}<span className="text-sm font-bold whitespace-nowrap">{ct.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {contentType === "kdp-physical-book" ? (
                        <div className="space-y-3">
                            <textarea value={contentNiche} onChange={e => setContentNiche(e.target.value)} rows={3}
                                placeholder="Describe tu libro: temática, género, público…&#10;ej: libro de colorear de mandalas zen para adultos"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/40 resize-none leading-relaxed transition-all" />

                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Plataforma destino</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {([
                                        { id: "kdp"  as const, label: "Amazon KDP", icon: "📦", desc: "Keywords backend A9, título técnico" },
                                        { id: "etsy" as const, label: "Etsy",       icon: "🛍️", desc: "Tags ocasión/mood, título emocional" },
                                        { id: "both" as const, label: "Ambas",      icon: "✦",  desc: "Genera para KDP + Etsy en un click" },
                                    ]).map(p => (
                                        <button key={p.id} onClick={() => setContentPlatform(p.id)}
                                            title={p.desc}
                                            className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-center transition-all ${
                                                contentPlatform === p.id
                                                    ? p.id === "kdp"  ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                                                    : p.id === "etsy" ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                                                    :                   "border-purple-500/40 bg-purple-500/10 text-purple-300"
                                                    : "border-white/8 bg-white/[0.02] text-neutral-600 hover:text-neutral-400 hover:border-white/15"
                                            }`}>
                                            <span className="text-base leading-none">{p.icon}</span>
                                            <span className="text-[9px] font-black uppercase tracking-wide leading-none">{p.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[9px] text-neutral-700 italic">
                                    {contentPlatform === "kdp"  && "Generará: título técnico, 7 keywords backend (A9), descripción HTML para KDP"}
                                    {contentPlatform === "etsy" && "Generará: título emocional, 13 tags ocasión/mood, descripción narrativa para Etsy"}
                                    {contentPlatform === "both" && "Generará ambos: listing KDP + listing Etsy diferenciados en un solo click"}
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <p className="text-sm font-black uppercase tracking-widest text-neutral-600 shrink-0">Idioma</p>
                                <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl">
                                    {(["en", "es"] as const).map(lang => (
                                        <button key={lang} onClick={() => setContentLanguage(lang)}
                                            className={`px-4 py-1 rounded-lg text-sm font-black uppercase transition-all ${contentLanguage === lang ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}>
                                            {lang === "en" ? "🇬🇧 EN" : "🇪🇸 ES"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <input value={contentNiche} onChange={e => setContentNiche(e.target.value)}
                                placeholder="Nicho / Tema — ej: zen mandalas, cats for beginners..."
                                onKeyDown={e => { if (e.key === "Enter") void generateContent(); }}
                                className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/40 transition-all" />
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <p className="text-sm font-black uppercase tracking-widest text-neutral-500">Tipo</p>
                                    <KdpSelect accent="amber" value={contentProductType} onChange={setContentProductType} options={CONTENT_PRODUCT_TYPES.map(pt => ({ value: pt, label: pt }))} />
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-sm font-black uppercase tracking-widest text-neutral-500">Idioma</p>
                                    <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl h-[38px]">
                                        {(["en", "es"] as const).map(lang => (
                                            <button key={lang} onClick={() => setContentLanguage(lang)}
                                                className={`flex-1 rounded-lg text-sm font-black uppercase transition-all ${contentLanguage === lang ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}>
                                                {lang === "en" ? "🇬🇧" : "🇪🇸"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <textarea value={contentExtras} onChange={e => setContentExtras(e.target.value)} rows={2}
                                placeholder="Contexto adicional: estilo, audiencia, ocasión... (opcional)"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/40 resize-none transition-all" />
                        </div>
                    )}

                    <button onClick={() => void generateContent()} disabled={isGeneratingContent || !contentNiche.trim()}
                        className="w-full h-11 rounded-xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-40 bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500">
                        {isGeneratingContent ? <><Loader2 size={13} className="animate-spin" /> Generando...</> : <><Sparkles size={13} /> Generar con IA</>}
                    </button>

                    {isGeneratingContent && (
                        <div className="flex items-center justify-center py-8 gap-2">
                            <Loader2 size={18} className="animate-spin text-amber-400" />
                            <p className="text-sm font-black uppercase tracking-widest text-neutral-600">Generando...</p>
                        </div>
                    )}
                    {contentResult && !isGeneratingContent && contentType === "kdp-physical-book" && typeof contentResult === "object" && (
                        <div className="space-y-2.5 border-t border-white/[0.05] pt-4">
                            {contentResult.title && (
                                <div className="bg-amber-500/[0.04] border border-amber-500/15 rounded-2xl p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-black uppercase tracking-widest text-amber-400/80">Título</p>
                                        <button onClick={() => copyText(contentResult.title)} className="text-neutral-600 hover:text-white transition-colors"><Copy size={10} /></button>
                                    </div>
                                    <p className="text-[13px] font-black text-white leading-tight">{contentResult.title}</p>
                                    {contentResult.subtitle && <p className="text-sm text-amber-200/60 leading-snug border-t border-amber-500/10 pt-2">{contentResult.subtitle}</p>}
                                </div>
                            )}
                            {contentResult.description && (
                                <div className="bg-white/[0.02] border border-white/6 rounded-2xl p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-black uppercase tracking-widest text-amber-400/80">Descripción</p>
                                        <button onClick={() => copyText(typeof contentResult.description === "string" ? contentResult.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : contentResult.description)} className="text-neutral-600 hover:text-white transition-colors"><Copy size={10} /></button>
                                    </div>
                                    {typeof contentResult.description === "string" && /<[a-z]/i.test(contentResult.description)
                                        ? <div className="text-sm text-neutral-300 leading-relaxed [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_strong]:text-amber-300" dangerouslySetInnerHTML={{ __html: contentResult.description }} />
                                        : <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">{contentResult.description}</p>
                                    }
                                </div>
                            )}
                            {Array.isArray(contentResult.keywords) && contentResult.keywords.length > 0 && (
                                <div className="bg-white/[0.02] border border-white/6 rounded-2xl p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-black uppercase tracking-widest text-amber-400/80">{contentResult.keywords.length} Keywords</p>
                                        <button onClick={() => copyText(contentResult.keywords.join("\n"))} className="text-neutral-600 hover:text-white transition-colors"><Copy size={10} /></button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {contentResult.keywords.map((k: string, i: number) => (
                                            <button key={i} onClick={() => copyText(k)} className="text-sm px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors">{k}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="border-t border-white/[0.05] pt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-black uppercase tracking-widest text-neutral-600">Guardar en nicho</p>
                                    {contentSaveNicheId && (niches.find(n => n._id === contentSaveNicheId)?.listings?.length ?? 0) > 0 && (
                                        <button onClick={() => { setNicheDetailId(contentSaveNicheId); setNicheDetailTab("seo"); }}
                                            title="Ver listings del nicho" className="h-6 w-6 rounded-lg bg-white/[0.04] border border-white/10 text-neutral-600 hover:text-white transition-all flex items-center justify-center">
                                            <Eye size={10} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-1.5">
                                    <NicheSelect
                                        niches={niches}
                                        selectedId={contentSaveNicheId || null}
                                        placeholder="— Seleccionar nicho —"
                                        className="flex-1"
                                        onChange={(n) => setContentSaveNicheId(n?._id ?? "")}
                                    />
                                    <button onClick={() => void saveContentToNiche()} disabled={!contentSaveNicheId || savingContentListing}
                                        className="h-8 px-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-sm font-black text-amber-400 hover:bg-amber-500/25 transition-all disabled:opacity-40 flex items-center gap-1">
                                        {savingContentListing ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />} Guardar
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => void generateContent()} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-sm font-black uppercase tracking-widest text-neutral-700 hover:text-neutral-400 transition-colors">
                                <Sparkles size={9} /> Regenerar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ─ RIGHT: Listings archive ─ */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-white">Listings guardados</h2>
                        <p className="text-sm text-neutral-600">{allListings.length} en total · {nichesWithListings.length} nichos</p>
                    </div>
                    {allListings.length > 0 && (
                        <button onClick={() => { setNicheDetailId(null); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-black text-neutral-500 hover:text-white transition-all">
                            <Filter size={10} /> Filtrar
                        </button>
                    )}
                </div>

                {allListings.length === 0 ? (
                    <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-16 flex flex-col items-center gap-4 text-center">
                        <FileText size={40} strokeWidth={1} className="text-neutral-700" />
                        <div>
                            <p className="text-sm font-black text-neutral-600">Sin listings guardados aún</p>
                            <p className="text-sm text-neutral-700 mt-1">Genera contenido con el generador de la izquierda y vincúlalo a un nicho</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {nichesWithListings.map(n => (
                            <div key={n._id} className="rounded-3xl border border-white/8 bg-white/[0.025] overflow-hidden">
                                <div className="h-px w-full bg-gradient-to-r from-amber-500/30 via-amber-400/10 to-transparent" />
                                <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.05]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                            <Target size={14} className="text-amber-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white">{nd(n)}</p>
                                            <p className="text-sm text-neutral-600">{n.listings!.length} listing{n.listings!.length !== 1 ? "s" : ""}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => { setNicheDetailId(n._id); setNicheDetailTab("seo"); }}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-sm font-black text-neutral-600 hover:text-white hover:border-white/20 transition-all">
                                        <Eye size={10} /> Ver nicho
                                    </button>
                                </div>
                                <div className="divide-y divide-white/[0.04]">
                                    {n.listings!.map((listing: NicheKDPListing, i: number) => {
                                        const lid = listing._id ?? `${n._id}-${i}`;
                                        const isOpen = expandedListingId === lid;
                                        return (
                                            <div key={lid} className="group">
                                                <div className="flex items-center gap-2 px-4 py-3">
                                                    <button
                                                        onClick={() => setExpandedListingId(isOpen ? null : lid)}
                                                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                                    >
                                                        <ChevronDown size={12} className={`shrink-0 text-neutral-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                                        <span className="text-sm font-black text-white truncate leading-tight">{listing.title || "Sin título"}</span>
                                                        {listing.language && <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${listing.language === "es" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-sky-500/10 border-sky-500/20 text-sky-400"}`}>{listing.language}</span>}
                                                        <span className="text-xs text-neutral-700 shrink-0 ml-auto pl-2">
                                                            {new Date(listing.generatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                                                        </span>
                                                    </button>
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                        <button onClick={() => { navigator.clipboard.writeText([listing.title, listing.subtitle, listing.description.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(), listing.keywords.join(", ")].filter(Boolean).join("\n\n")); toast.success("Copiado"); }}
                                                            className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-white/8 transition-all"><Copy size={11} /></button>
                                                        <button onClick={() => listing._id && void deleteNicheListing(n._id, listing._id)}
                                                            disabled={deletingListingId === listing._id}
                                                            className="p-1.5 rounded-lg text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40">
                                                            {deletingListingId === listing._id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                                        </button>
                                                    </div>
                                                </div>
                                                {isOpen && (
                                                    <div className="px-4 pb-4 border-t border-white/[0.04] pt-3">
                                                        <ListingCardFields
                                                            listing={{ ...listing, _id: lid }}
                                                            onCopy={copyText}
                                                            onExpand={setExpandedListingId}
                                                            expandedId={expandedListingId}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
