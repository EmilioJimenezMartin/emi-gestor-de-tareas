// Ciclo de vida comercial del nicho (gestión manual):
// Pre-publicado → Publicado (con fecha) → Fin de vida.
// Muestra el consejo de actuación vigente según los días desde publicación
// (misma fuente de hitos que las alertas Telegram del backend).
"use client";
import { useState } from "react";
import { CalendarDays, Skull, Rocket, Hourglass } from "lucide-react";
import type { NicheFE } from "./types";

export type LifecycleStage = NonNullable<NicheFE["lifecycleStage"]>;

const STAGES: Array<{ id: LifecycleStage; label: string; icon: typeof Rocket; active: string; idle: string }> = [
    { id: "pre-published", label: "Pre-publicado", icon: Hourglass, active: "bg-amber-500/20 border-amber-500/40 text-amber-300", idle: "text-neutral-600 hover:text-amber-400/70" },
    { id: "published", label: "Publicado", icon: Rocket, active: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300", idle: "text-neutral-600 hover:text-emerald-400/70" },
    { id: "end-of-life", label: "Fin de vida", icon: Skull, active: "bg-neutral-500/20 border-neutral-500/40 text-neutral-300", idle: "text-neutral-600 hover:text-neutral-400" },
];

// Réplica cliente de LIFECYCLE_MILESTONES (apps/api/src/lib/lifecycle.ts) — mantener en sync
const MILESTONES: Array<{ fromDay: number; toDay: number | null; title: string; advice: string }> = [
    { fromDay: 0, toDay: 2, title: "Día 0 — Lanzamiento", advice: "Precio bajo ($6.99): la velocidad inicial activa la luna de miel del algoritmo (~30 días)" },
    { fromDay: 3, toDay: 13, title: "Día 3-13 — Primeras reviews", advice: "Pide reviews a conocidos QUE COMPREN (Verified Purchase). Objetivo: 3-5 esta semana" },
    { fromDay: 14, toDay: 29, title: "Día 14 — Re-validar", advice: "Otro Market Scan + añade el ASIN para activar el rank tracker semanal" },
    { fromDay: 30, toDay: 59, title: "Día 30 — Decisión", advice: "Con ventas: sube a $8.99 · Sin ventas: rota metadatos (2ª keyword del intel) y/o portada" },
    { fromDay: 60, toDay: 89, title: "Día 60 — Consolidar o pivotar", advice: "Con ventas: $10.99 + lanza Vol. 2 · Sin ventas: última rotación o Fin de vida" },
    { fromDay: 90, toDay: null, title: "Día 90 — Veredicto", advice: "Si vende es catálogo permanente; si no, márcalo Fin de vida y reinvierte en un nicho gold" },
];

export function LifecyclePanel({ niche, onUpdate }: {
    niche: NicheFE;
    onUpdate: (patch: { lifecycleStage?: LifecycleStage | null; publishedAt?: string | null }) => Promise<void> | void;
}) {
    const [saving, setSaving] = useState(false);
    const stage = niche.lifecycleStage;
    const day = niche.publishedAt ? Math.floor((Date.now() - new Date(niche.publishedAt).getTime()) / 86_400_000) : null;
    const current = day !== null ? MILESTONES.find(m => day >= m.fromDay && (m.toDay === null || day <= m.toDay)) : null;

    const apply = async (patch: { lifecycleStage?: LifecycleStage | null; publishedAt?: string | null }) => {
        setSaving(true);
        try { await onUpdate(patch); } finally { setSaving(false); }
    };

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.07] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <CalendarDays size={11} className="text-emerald-400/80 shrink-0" />
                    <span className="text-[9px] uppercase tracking-wider text-neutral-600 font-black">Ciclo de vida</span>
                </div>
                {stage === "published" && day !== null && (
                    <span className="text-[10px] font-black text-emerald-400 tabular-nums">Día {day}</span>
                )}
            </div>

            {/* Fases (gestión manual) */}
            <div className="flex p-0.5 bg-white/[0.03] border border-white/8 rounded-xl gap-0.5">
                {STAGES.map(s => {
                    const Icon = s.icon;
                    const act = stage === s.id;
                    return (
                        <button key={s.id} disabled={saving}
                            onClick={() => void apply({ lifecycleStage: act ? null : s.id })}
                            title={act ? "Click para quitar la fase" : `Marcar como ${s.label}`}
                            className={`flex-1 h-8 rounded-[10px] border text-[9px] font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1 disabled:opacity-50 ${act ? s.active : `border-transparent ${s.idle}`}`}>
                            <Icon size={9} /> {s.label}
                        </button>
                    );
                })}
            </div>

            {/* Fecha de publicación (manual) */}
            {(stage === "published" || niche.publishedAt) && (
                <div className="flex items-center gap-2">
                    <span className="text-[9px] text-neutral-600 uppercase font-black shrink-0">Publicado el</span>
                    <input type="date" disabled={saving}
                        value={niche.publishedAt ? new Date(niche.publishedAt).toISOString().slice(0, 10) : ""}
                        onChange={e => void apply({ publishedAt: e.target.value || null })}
                        className="flex-1 h-8 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 text-[11px] text-white focus:outline-none focus:border-emerald-500/40 transition-all [color-scheme:dark]"
                    />
                </div>
            )}

            {/* Consejo vigente según el día */}
            {stage === "published" && current && (
                <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 px-2.5 py-2">
                    <p className="text-[10px] font-black text-emerald-300">{current.title}</p>
                    <p className="text-[10px] text-neutral-400 leading-snug mt-0.5">{current.advice}</p>
                </div>
            )}
            {stage === "published" && !niche.publishedAt && (
                <p className="text-[9px] text-neutral-600 italic">Pon la fecha de publicación para activar los consejos y las alertas de Telegram</p>
            )}
            {stage === "end-of-life" && (
                <p className="text-[9px] text-neutral-600 italic">Sin alertas — el catálogo queda pasivo. Si revive en ventas, el digest semanal lo detectará.</p>
            )}
        </div>
    );
}
