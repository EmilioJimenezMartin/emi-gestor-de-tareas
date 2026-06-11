// Campos copiables de un listing KDP/Etsy con separación visual por plataforma.
import { Copy, ShoppingBag, BookOpen } from "lucide-react";
import { useState } from "react";

type ListingPlatform = "kdp" | "etsy" | "both";

interface Listing {
    _id: string;
    title: string;
    subtitle: string;
    description: string;
    keywords: string[];
    etsyTags?: string[];
    categories?: string[];
    seoNotes?: string;
    platform?: ListingPlatform;
}

const PLATFORM_META: Record<ListingPlatform, { label: string; color: string; icon: typeof BookOpen }> = {
    kdp:  { label: "KDP",  color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/25",  icon: BookOpen },
    etsy: { label: "Etsy", color: "text-orange-400 bg-orange-500/10 border-orange-500/25",  icon: ShoppingBag },
    both: { label: "KDP + Etsy", color: "text-purple-400 bg-purple-500/10 border-purple-500/25", icon: BookOpen },
};

export function ListingCardFields({
    listing, onCopy, onExpand, expandedId,
}: {
    listing: Listing;
    onCopy: (text: string) => void;
    onExpand: (id: string | null) => void;
    expandedId: string | null;
}) {
    const platform: ListingPlatform = listing.platform ?? "both";
    const meta = PLATFORM_META[platform];
    const [activeTab, setActiveTab] = useState<"kdp" | "etsy">("kdp");

    const showKdp  = platform === "kdp" || platform === "both";
    const showEtsy = platform === "etsy" || platform === "both";
    const hasBoth  = showKdp && showEtsy;

    const KWField = ({ label, value }: { label: string; value: string }) => (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600">{label}</span>
                <button onClick={() => onCopy(value)} className="text-[9px] text-neutral-700 hover:text-indigo-400 flex items-center gap-0.5 transition-colors">
                    <Copy size={7} /> Copiar
                </button>
            </div>
            <p className="text-[11px] text-neutral-300 leading-relaxed bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-2">{value || <span className="italic text-neutral-700">—</span>}</p>
        </div>
    );

    const KdpSection = () => (
        <div className="space-y-2">
            {listing.title && <KWField label="Título KDP" value={listing.title} />}
            {listing.subtitle && <KWField label="Subtítulo KDP" value={listing.subtitle} />}
            {listing.keywords.length > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                            Keywords backend ({listing.keywords.length}/7)
                        </span>
                        <button onClick={() => onCopy(listing.keywords.join(", "))} className="text-[9px] text-neutral-700 hover:text-indigo-400 flex items-center gap-0.5 transition-colors">
                            <Copy size={7} /> Todas
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {listing.keywords.map((kw, i) => (
                            <button key={i} onClick={() => onCopy(kw)} title={`${kw.length}/50 chars`}
                                className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-[10px] text-indigo-300 hover:bg-indigo-500/20 transition-all font-mono">
                                {kw}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {listing.description && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Descripción KDP (HTML)</span>
                        <button onClick={() => onCopy(listing.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())} className="text-[9px] text-neutral-700 hover:text-indigo-400 flex items-center gap-0.5 transition-colors">
                            <Copy size={7} /> Copiar
                        </button>
                    </div>
                    {/<[a-z][\s\S]*>/i.test(listing.description)
                        ? <div className="text-[11px] text-neutral-300 leading-relaxed bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-2 [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-3 [&_li]:mb-0.5 [&_strong]:text-amber-300" dangerouslySetInnerHTML={{ __html: listing.description }} />
                        : <p className="text-[11px] text-neutral-300 leading-relaxed bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-2">{listing.description}</p>
                    }
                </div>
            )}
        </div>
    );

    const EtsySection = () => (
        <div className="space-y-2">
            {/* Etsy title is longer & emotion-first — show separately if different from KDP title */}
            {listing.title && <KWField label="Título Etsy (emoción primero)" value={listing.title} />}
            {(listing.etsyTags?.length ?? 0) > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Tags ({listing.etsyTags!.length}/13)</span>
                            <div className="flex gap-1 text-[8px] text-neutral-700">
                                <span className="px-1 bg-orange-500/10 rounded text-orange-400/70">ocasión</span>
                                <span className="px-1 bg-purple-500/10 rounded text-purple-400/70">mood</span>
                                <span className="px-1 bg-emerald-500/10 rounded text-emerald-400/70">audiencia</span>
                            </div>
                        </div>
                        <button onClick={() => onCopy(listing.etsyTags!.join(", "))} className="text-[9px] text-neutral-700 hover:text-orange-400 flex items-center gap-0.5 transition-colors">
                            <Copy size={7} /> Todas
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {listing.etsyTags!.map((tag, i) => (
                            <button key={i} onClick={() => onCopy(tag)} title={`${tag.length}/20 chars`}
                                className="px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-md text-[10px] text-orange-300 hover:bg-orange-500/20 transition-all font-mono">
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {listing.description && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Descripción Etsy (historia)</span>
                        <button onClick={() => onCopy(listing.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())} className="text-[9px] text-neutral-700 hover:text-orange-400 flex items-center gap-0.5 transition-colors">
                            <Copy size={7} /> Copiar
                        </button>
                    </div>
                    {/<[a-z][\s\S]*>/i.test(listing.description)
                        ? <div className="text-[11px] text-neutral-300 leading-relaxed bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-2 [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-3 [&_li]:mb-0.5 [&_strong]:text-amber-300" dangerouslySetInnerHTML={{ __html: listing.description }} />
                        : <p className="text-[11px] text-neutral-300 leading-relaxed bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-2">{listing.description}</p>
                    }
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-2">
            {/* Platform badge */}
            <div className="flex items-center justify-between">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black ${meta.color}`}>
                    <meta.icon size={8} /> {meta.label}
                </div>
                {listing.seoNotes && (
                    <p className="text-[9px] text-neutral-700 italic truncate max-w-[60%]" title={listing.seoNotes}>{listing.seoNotes}</p>
                )}
            </div>

            {/* Tab switcher for "both" platform */}
            {hasBoth && (
                <div className="flex p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg gap-0.5">
                    <button onClick={() => setActiveTab("kdp")}
                        className={`flex-1 h-6 rounded-[7px] flex items-center justify-center gap-1 text-[9px] font-black transition-all ${activeTab === "kdp" ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/25" : "text-neutral-600 hover:text-neutral-400"}`}>
                        <BookOpen size={8} /> KDP / Amazon
                    </button>
                    <button onClick={() => setActiveTab("etsy")}
                        className={`flex-1 h-6 rounded-[7px] flex items-center justify-center gap-1 text-[9px] font-black transition-all ${activeTab === "etsy" ? "bg-orange-500/15 text-orange-300 border border-orange-500/25" : "text-neutral-600 hover:text-neutral-400"}`}>
                        <ShoppingBag size={8} /> Etsy
                    </button>
                </div>
            )}

            {/* Content */}
            {!hasBoth && showKdp  && <KdpSection />}
            {!hasBoth && showEtsy && <EtsySection />}
            {hasBoth && activeTab === "kdp"  && <KdpSection />}
            {hasBoth && activeTab === "etsy" && <EtsySection />}

            {/* Categories (shared) */}
            {(listing.categories?.length ?? 0) > 0 && (
                <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                        Categorías {activeTab === "etsy" ? "Etsy" : "KDP"}
                    </span>
                    <div className="space-y-1">
                        {listing.categories!.map((cat, i) => (
                            <button key={i} onClick={() => onCopy(cat)}
                                className="w-full text-left px-2.5 py-1.5 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg text-[11px] text-emerald-300/90 hover:bg-emerald-500/15 transition-all">
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Copy full listing */}
            <button
                onClick={() => onCopy([
                    listing.title,
                    listing.subtitle,
                    listing.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
                    listing.keywords.length > 0 ? `Keywords KDP: ${listing.keywords.join(", ")}` : "",
                    listing.etsyTags?.length ? `Etsy Tags: ${listing.etsyTags.join(", ")}` : "",
                ].filter(Boolean).join("\n\n"))}
                className="w-full flex items-center justify-center gap-1 h-6 rounded-lg bg-white/[0.04] border border-white/8 text-[10px] text-neutral-500 hover:text-white hover:bg-white/8 transition-all"
            >
                <Copy size={8} /> Copiar listing completo
            </button>
        </div>
    );
}

// ── Gelato Upload Modal ───────────────────────────────────────────────────────
