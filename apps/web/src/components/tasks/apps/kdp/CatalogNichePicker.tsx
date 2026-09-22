"use client";
// Lista de checkboxes para vincular un catálogo entero a uno o varios nichos a la vez
// (mantenerlo en ambos, o "moverlo" desvinculando el viejo y marcando el nuevo).
// Extraído de kdp-catalog-card.tsx para reusarlo también en NicheDetailModal — ver
// feedback_components_first (CRÍTICO): nunca duplicar esta UI inline.
import { Check } from "lucide-react";

// Formas mínimas estructurales (no importadas de ./types) a propósito: kdp-catalog-card.tsx
// mantiene su propio mirror local de NicheFE/IACatalogFE más ligero que el de ./types, y
// este componente lo usan ambos — con un import nominal, uno de los dos dejaría de encajar.
type MinimalNiche = { _id: string; name: string; nickname?: string; status?: string };
type MinimalCatalog = { nicheIds?: string[] };

export interface CatalogNichePickerProps {
    catalogId: string;
    linkedNicheIds: string[];
    niches: MinimalNiche[];
    allCatalogs: MinimalCatalog[];
    onToggleNiche: (catalogId: string, nicheId: string, assigned: boolean) => void;
    nd: (n: Pick<MinimalNiche, "name" | "nickname">) => string;
    className?: string;
}

export function CatalogNichePicker({ catalogId, linkedNicheIds, niches, allCatalogs, onToggleNiche, nd, className }: CatalogNichePickerProps) {
    return (
        <div className={`rounded-2xl border border-white/8 bg-white/[0.015] overflow-hidden max-h-48 overflow-y-auto ${className ?? ""}`}>
            {niches.map((n, ni) => {
                const assigned = linkedNicheIds.includes(n._id);
                const catCount = allCatalogs.filter(c => (c.nicheIds ?? []).includes(n._id)).length;
                return (
                    <button key={n._id}
                        onClick={() => onToggleNiche(catalogId, n._id, assigned)}
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
    );
}
