"use client";
import { useState } from "react";
import { Bot, DollarSign, RotateCcw, CheckCircle2 } from "lucide-react";
import type { NicheFE } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const ACTION_ICONS: Record<string, typeof Bot> = {
    "price-increase": DollarSign,
    "metadata-rotation": RotateCcw,
};

export function AutopilotPanel({ niche, onUpdate }: {
    niche: NicheFE;
    onUpdate: (patch: Partial<NicheFE>) => Promise<void> | void;
}) {
    const [saving, setSaving] = useState(false);

    const toggle = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API}/niches/${niche._id}/autopilot`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: !niche.autoPilotEnabled }),
            });
            if (res.ok) {
                const { niche: updated } = await res.json();
                await onUpdate({ autoPilotEnabled: updated.autoPilotEnabled });
            }
        } finally {
            setSaving(false);
        }
    };

    const setPrice = async (price: number) => {
        setSaving(true);
        try {
            const res = await fetch(`${API}/niches/${niche._id}/autopilot`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPrice: price }),
            });
            if (res.ok) {
                const { niche: updated } = await res.json();
                await onUpdate({ currentPrice: updated.currentPrice });
            }
        } finally {
            setSaving(false);
        }
    };

    const log = (niche as any).autopilotLog as Array<{ type: string; details: string; suggestedPrice?: number; executedAt: string }> | undefined;
    const lastActions = (log ?? []).slice(-3).reverse();

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.07] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Bot size={11} className="text-cyan-400/80 shrink-0" />
                    <span className="text-[9px] uppercase tracking-wider text-neutral-600 font-black">Autopilot</span>
                </div>
                <button
                    disabled={saving || niche.lifecycleStage !== "published"}
                    onClick={() => void toggle()}
                    title={niche.lifecycleStage !== "published" ? "Solo activo en fase Publicado" : ""}
                    className={`relative h-5 w-9 rounded-full border transition-all disabled:opacity-40 ${
                        niche.autoPilotEnabled
                            ? "bg-cyan-500/30 border-cyan-500/40"
                            : "bg-white/[0.04] border-white/10"
                    }`}
                >
                    <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
                        niche.autoPilotEnabled
                            ? "left-[18px] bg-cyan-400"
                            : "left-0.5 bg-neutral-600"
                    }`} />
                </button>
            </div>

            {niche.autoPilotEnabled && (
                <p className="text-[9px] text-cyan-400/70 leading-snug">
                    Activo — en el Día 30/60 el sistema rotará keywords o sugerirá precio automáticamente.
                </p>
            )}

            {/* Price tracker */}
            <div className="flex items-center gap-2">
                <span className="text-[9px] text-neutral-600 uppercase font-black shrink-0">Precio actual</span>
                <div className="flex items-center gap-1 flex-1">
                    <span className="text-[10px] text-neutral-600">$</span>
                    <input
                        type="number" step="0.01" min="0.99" max="99"
                        value={(niche as any).currentPrice ?? ""}
                        placeholder="6.99"
                        onChange={e => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v)) void setPrice(v);
                        }}
                        className="w-16 h-7 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 text-[11px] text-white focus:outline-none focus:border-cyan-500/40 transition-all"
                    />
                </div>
                {(niche as any).suggestedPrice && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[8px] text-emerald-400 font-black">SUGERIDO</span>
                        <span className="text-[9px] text-emerald-300 font-black">${(niche as any).suggestedPrice}</span>
                    </div>
                )}
            </div>

            {/* Action log */}
            {lastActions.length > 0 && (
                <div className="space-y-1">
                    <span className="text-[8px] uppercase tracking-wider text-neutral-700 font-black">Historial autopilot</span>
                    {lastActions.map((a, i) => {
                        const Icon = ACTION_ICONS[a.type] ?? CheckCircle2;
                        const date = new Date(a.executedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
                        return (
                            <div key={i} className="flex items-start gap-1.5 py-1 border-b border-white/[0.04] last:border-0">
                                <Icon size={9} className="text-cyan-400/60 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9px] text-neutral-400 leading-snug">{a.details}</p>
                                </div>
                                <span className="text-[8px] text-neutral-700 shrink-0">{date}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {!niche.autoPilotEnabled && lastActions.length === 0 && (
                <p className="text-[9px] text-neutral-700 italic">
                    Activa el autopilot en nichos publicados para que el sistema tome decisiones en los hitos clave.
                </p>
            )}
        </div>
    );
}
