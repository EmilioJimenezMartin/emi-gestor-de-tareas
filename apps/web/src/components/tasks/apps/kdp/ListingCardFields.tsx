// Campos copiables de un listing KDP/Etsy (título, keywords, tags, categorías).
// Extraído de kdp-factory-app.tsx sin cambios de lógica.
import { Copy } from "lucide-react";

export function ListingCardFields({
    listing, onCopy, onExpand, expandedId,
}: {
    listing: { _id: string; title: string; subtitle: string; description: string; keywords: string[]; etsyTags?: string[]; categories?: string[]; seoNotes?: string };
    onCopy: (text: string) => void;
    onExpand: (id: string | null) => void;
    expandedId: string | null;
}) {
    const KWField = ({ label, value }: { label: string; value: string }) => (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-sm font-black uppercase tracking-widest text-neutral-600">{label}</span>
                <button onClick={() => onCopy(value)} className="text-sm text-neutral-700 hover:text-indigo-400 flex items-center gap-0.5 transition-colors">
                    <Copy size={7} /> Copiar
                </button>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-2">{value || <span className="italic text-neutral-700">—</span>}</p>
        </div>
    );
    return (
        <div className="space-y-2">
            {listing.title && <KWField label="Título" value={listing.title} />}
            {listing.subtitle && <KWField label="Subtítulo" value={listing.subtitle} />}
            {listing.keywords.length > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-black uppercase tracking-widest text-neutral-600">Keywords KDP ({listing.keywords.length}/7)</span>
                        <button onClick={() => onCopy(listing.keywords.join(", "))} className="text-sm text-neutral-700 hover:text-indigo-400 flex items-center gap-0.5 transition-colors"><Copy size={7} /> Todas</button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {listing.keywords.map((kw, i) => (
                            <button key={i} onClick={() => onCopy(kw)} title={`${kw.length}/50 chars — click para copiar`}
                                className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-sm text-indigo-300 hover:bg-indigo-500/20 transition-all font-mono">
                                {kw}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {(listing.etsyTags?.length ?? 0) > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-black uppercase tracking-widest text-neutral-600">Etsy Tags ({listing.etsyTags!.length}/13)</span>
                        <button onClick={() => onCopy(listing.etsyTags!.join(", "))} className="text-sm text-neutral-700 hover:text-orange-400 flex items-center gap-0.5 transition-colors"><Copy size={7} /> Todas</button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {listing.etsyTags!.map((tag, i) => (
                            <button key={i} onClick={() => onCopy(tag)} title={`${tag.length}/20 chars — click para copiar`}
                                className="px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-md text-sm text-orange-300 hover:bg-orange-500/20 transition-all font-mono">
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {(listing.categories?.length ?? 0) > 0 && (
                <div className="space-y-1">
                    <span className="text-sm font-black uppercase tracking-widest text-neutral-600">Categorías sugeridas</span>
                    <div className="space-y-1">
                        {listing.categories!.map((cat, i) => (
                            <button key={i} onClick={() => onCopy(cat)}
                                className="w-full text-left px-2.5 py-1.5 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg text-sm text-emerald-300/90 hover:bg-emerald-500/15 transition-all">
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {listing.seoNotes && (
                <p className="text-[10px] text-neutral-600 italic leading-relaxed border-l-2 border-white/10 pl-2">{listing.seoNotes}</p>
            )}
            {listing.description && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-black uppercase tracking-widest text-neutral-600">Descripción</span>
                        <button onClick={() => onCopy(listing.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())} className="text-sm text-neutral-700 hover:text-indigo-400 flex items-center gap-0.5 transition-colors"><Copy size={7} /> Copiar</button>
                    </div>
                    {/<[a-z][\s\S]*>/i.test(listing.description)
                        ? <div className="text-sm text-neutral-300 leading-relaxed bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-2 [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-3 [&_li]:mb-0.5 [&_strong]:text-amber-300" dangerouslySetInnerHTML={{ __html: listing.description }} />
                        : <p className="text-sm text-neutral-300 leading-relaxed bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-2">{listing.description}</p>
                    }
                </div>
            )}
            <button
                onClick={() => onCopy([listing.title, listing.subtitle, listing.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), listing.keywords.length > 0 ? `Keywords: ${listing.keywords.join(", ")}` : ""].filter(Boolean).join("\n\n"))}
                className="w-full flex items-center justify-center gap-1 h-6 rounded-lg bg-white/[0.04] border border-white/8 text-sm text-neutral-500 hover:text-white hover:bg-white/8 transition-all"
            >
                <Copy size={8} /> Copiar listing completo
            </button>
        </div>
    );
}

// ── Gelato Upload Modal ───────────────────────────────────────────────────────
