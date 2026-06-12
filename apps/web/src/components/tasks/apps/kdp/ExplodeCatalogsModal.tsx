"use client";
// Explosión multi-catálogo: la IA detecta N situaciones visuales distintas del
// nicho y lanza un catálogo por cada una (encolados en serie).
import { useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Loader2, X, Layers } from "lucide-react";
import { AI_MODELS } from "../shared/ai-constants";
import type { NicheFE } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Modelos usables para catálogos (excluye los bloqueados)
const USABLE_MODELS = AI_MODELS.filter(m => m.status !== "blocked");

export function ExplodeCatalogsModal({ niche, onClose, onLaunched }: {
    niche: NicheFE;
    onClose: () => void;
    onLaunched: (catalogs: any[], situations: string[]) => void;
}) {
    const [count, setCount] = useState(5);
    const [imagesPer, setImagesPer] = useState(5);
    const [modelId, setModelId] = useState<string>("default");
    const [launching, setLaunching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const launch = async () => {
        setLaunching(true);
        setError(null);
        try {
            const model = modelId === "default" ? undefined : (() => {
                const m = USABLE_MODELS.find(x => x.id === modelId);
                return m ? { id: m.id, name: m.name, provider: m.provider, modelId: m.modelId } : undefined;
            })();
            const res = await fetch(`${API}/niches/${niche._id}/explode-catalogs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ count, imagesPerCatalog: imagesPer, ...(model ? { model } : {}) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al lanzar la explosión");
            onLaunched(data.catalogs ?? [], data.situations ?? []);
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLaunching(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true"
            onClick={e => { if (e.target === e.currentTarget && !launching) onClose(); }}>
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a0a0a] p-6 space-y-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                            <Layers size={18} className="text-violet-400" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-white">Explosión multi-catálogo</p>
                            <p className="text-[11px] text-neutral-500">{niche.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={launching} className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-white/8 transition-all disabled:opacity-40">
                        <X size={15} />
                    </button>
                </div>

                <p className="text-[11px] text-neutral-500 leading-relaxed">
                    La IA detecta <span className="text-violet-400 font-black">{count} situaciones visuales distintas</span> dentro
                    del nicho (p. ej. para mandalas: animales, flores, figuras zen, templos, patrones) y lanza un catálogo por cada
                    una con su propio prompt. Se encolan en serie automáticamente.
                </p>

                {/* Nº catálogos */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Catálogos a generar</label>
                    <div className="flex gap-1.5">
                        {[3, 5, 7].map(v => (
                            <button key={v} onClick={() => setCount(v)}
                                className={`flex-1 h-9 rounded-xl text-sm font-black border transition-all ${count === v ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-white/[0.03] border-white/8 text-neutral-600 hover:text-neutral-400"}`}>
                                {v}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Imágenes por catálogo */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Imágenes por catálogo</label>
                    <div className="flex gap-1.5">
                        {[3, 5, 10, 15].map(v => (
                            <button key={v} onClick={() => setImagesPer(v)}
                                className={`flex-1 h-9 rounded-xl text-sm font-black border transition-all ${imagesPer === v ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-white/[0.03] border-white/8 text-neutral-600 hover:text-neutral-400"}`}>
                                {v}
                            </button>
                        ))}
                    </div>
                    <p className="text-[9px] text-neutral-700">{count * imagesPer} imágenes en total</p>
                </div>

                {/* Modelo */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Modelo de imagen</label>
                    <select value={modelId} onChange={e => setModelId(e.target.value)}
                        className="w-full h-10 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 text-[12px] text-white focus:outline-none focus:border-violet-500/40 transition-all appearance-none">
                        <option value="default">Por defecto — FLUX (Pollinations)</option>
                        {USABLE_MODELS.map(m => (
                            <option key={m.id} value={m.id}>{m.name} · {m.provider}</option>
                        ))}
                    </select>
                </div>

                {error && (
                    <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</p>
                )}

                <button onClick={() => void launch()} disabled={launching}
                    className="w-full h-11 rounded-2xl bg-violet-500 text-white text-sm font-black hover:bg-violet-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {launching ? <><Loader2 size={14} className="animate-spin" /> Detectando situaciones…</> : <><Sparkles size={14} /> Lanzar {count} catálogos</>}
                </button>
            </div>
        </div>,
        document.body
    );
}
