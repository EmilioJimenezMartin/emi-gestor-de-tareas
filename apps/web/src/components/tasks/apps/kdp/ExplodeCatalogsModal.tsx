"use client";
// Explosión multi-catálogo: la IA detecta N situaciones visuales distintas del
// nicho y lanza un catálogo por cada una (encolados en serie).
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Loader2, X, Layers, Check, Plus } from "lucide-react";
import { AI_MODELS } from "../shared/ai-constants";
import type { NicheFE } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const USABLE_MODELS = AI_MODELS.filter(m => m.status !== "blocked");
const STATUS_DOT: Record<string, string> = {
    ok: "bg-emerald-400", limited: "bg-amber-400", paid: "bg-orange-400", blocked: "bg-red-400",
};

function Stepper({ value, onChange, min = 1, max = 99, presets }: {
    value: number; onChange: (v: number) => void; min?: number; max?: number; presets: number[];
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const clamp = (v: number) => Math.max(min, Math.min(max, v));

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => onChange(clamp(value - 1))}
                    className="w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-neutral-400 hover:text-white hover:border-white/20 transition-all flex items-center justify-center text-lg font-black shrink-0">
                    −
                </button>
                <input
                    ref={inputRef}
                    type="number"
                    value={value}
                    min={min}
                    max={max}
                    onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v)) onChange(clamp(v));
                    }}
                    className="w-14 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-white text-center text-base font-black focus:outline-none focus:border-violet-500/40 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                    onClick={() => onChange(clamp(value + 1))}
                    className="w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-neutral-400 hover:text-white hover:border-white/20 transition-all flex items-center justify-center text-lg font-black shrink-0">
                    +
                </button>
                <div className="flex gap-1.5 ml-1">
                    {presets.map(p => (
                        <button key={p} onClick={() => onChange(p)}
                            className={`h-8 px-3 rounded-lg text-xs font-black border transition-all ${value === p ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-white/[0.03] border-white/8 text-neutral-600 hover:text-neutral-400"}`}>
                            {p}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ExplodeCatalogsModal({ niche, onClose, onLaunched }: {
    niche: NicheFE;
    onClose: () => void;
    onLaunched: (catalogs: any[], situations: string[]) => void;
}) {
    const [count, setCount] = useState(5);
    const [imagesPer, setImagesPer] = useState(5);
    const [modelId, setModelId] = useState<string>("default");
    const [imagination, setImagination] = useState(50);
    const [variation, setVariation] = useState(50);
    const [launching, setLaunching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hints, setHints] = useState<string[]>([]);

    const addHint = () => {
        setHints(prev => [...prev, ""]);
        setCount(c => Math.max(c, hints.length + 1));
    };
    const updateHint = (i: number, val: string) => setHints(prev => prev.map((h, idx) => idx === i ? val : h));
    const removeHint = (i: number) => setHints(prev => prev.filter((_, idx) => idx !== i));

    // Load configured autopilot model as default
    useEffect(() => {
        fetch(`${API}/settings/AUTOPILOT_IMAGE_MODEL`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                const saved = data?.value ? JSON.parse(data.value) : null;
                if (saved?.id && USABLE_MODELS.find(m => m.id === saved.id)) {
                    setModelId(saved.id);
                }
            })
            .catch(() => {});
    }, []);

    const selectedModel = modelId === "default" ? null : USABLE_MODELS.find(m => m.id === modelId) ?? null;
    const providerGroups = USABLE_MODELS.reduce<Record<string, typeof USABLE_MODELS>>((acc, m) => {
        (acc[m.provider] ??= []).push(m); return acc;
    }, {});

    const launch = async () => {
        setLaunching(true);
        setError(null);
        try {
            const model = selectedModel
                ? { id: selectedModel.id, name: selectedModel.name, provider: selectedModel.provider, modelId: selectedModel.modelId }
                : undefined;
            const validHints = hints.map(h => h.trim()).filter(Boolean);
            const res = await fetch(`${API}/niches/${niche._id}/explode-catalogs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ count, imagesPerCatalog: imagesPer, imagination, variation, ...(model ? { model } : {}), ...(validHints.length > 0 ? { hints: validHints } : {}) }),
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
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-white/8 flex items-start justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                            <Layers size={18} className="text-violet-400" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-white">Explosión multi-catálogo</p>
                            <p className="text-[11px] text-neutral-500 truncate max-w-[220px]">{niche.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={launching} className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-white/8 transition-all disabled:opacity-40">
                        <X size={15} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    <p className="text-[11px] text-neutral-500 leading-relaxed">
                        La IA detecta <span className="text-violet-400 font-black">{count} situaciones visuales distintas</span> dentro
                        del nicho y lanza un catálogo por cada una con su propio prompt.
                    </p>

                    {/* Nº catálogos */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Catálogos a generar</label>
                        <Stepper value={count} onChange={setCount} min={1} max={20} presets={[3, 5, 7, 10]} />
                    </div>

                    {/* Sugerencias específicas */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Sugerencias específicas <span className="normal-case text-neutral-700 font-normal">(opcional)</span></label>
                            {hints.length < count && (
                                <button onClick={addHint}
                                    className="flex items-center gap-1 h-6 px-2 rounded-lg bg-violet-500/15 border border-violet-500/25 text-[9px] font-black text-violet-400 hover:bg-violet-500/25 transition-all">
                                    <Plus size={9} /> Añadir
                                </button>
                            )}
                        </div>
                        {hints.length === 0 ? (
                            <p className="text-[10px] text-neutral-700 leading-relaxed">
                                Sugiere sub-temas concretos — p.ej. <span className="text-neutral-500">"Superman"</span>, <span className="text-neutral-500">"escena de batalla nocturna"</span>. La IA aplica todas las sugerencias en <span className="text-neutral-500">todos</span> los catálogos generados, no solo en el primero.
                            </p>
                        ) : (
                            <div className="space-y-1.5">
                                {hints.map((h, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                                            <span className="text-[9px] font-black text-violet-400">{i + 1}</span>
                                        </div>
                                        <input
                                            autoFocus={i === hints.length - 1}
                                            value={h}
                                            onChange={e => updateHint(i, e.target.value)}
                                            placeholder={`Sub-tema ${i + 1}…`}
                                            className="flex-1 h-8 px-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-black text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/30 transition-all"
                                        />
                                        <button onClick={() => removeHint(i)}
                                            className="w-6 h-6 rounded-lg text-neutral-600 hover:text-rose-400 transition-all flex items-center justify-center shrink-0">
                                            <X size={11} />
                                        </button>
                                    </div>
                                ))}
                                {hints.length < count && (
                                    <button onClick={addHint}
                                        className="w-full h-7 rounded-xl border border-dashed border-white/10 text-[9px] font-black text-neutral-700 hover:text-violet-400 hover:border-violet-500/30 transition-all flex items-center justify-center gap-1">
                                        <Plus size={9} /> Otro sub-tema
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Imaginación + Variación */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Imaginación</label>
                                <span className="text-[11px] font-bold text-violet-400">
                                    {imagination <= 25 ? "🎯 Típico" : imagination <= 50 ? "🖼 Equilibrado" : imagination <= 75 ? "✨ Creativo" : "🌀 Surrealista"}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-neutral-700 shrink-0">Convencional</span>
                                <input type="range" min={0} max={100} step={5} value={imagination}
                                    onChange={e => setImagination(Number(e.target.value))}
                                    className="flex-1 accent-violet-500 h-1 cursor-pointer" />
                                <span className="text-[9px] text-neutral-700 shrink-0">Experimental</span>
                            </div>
                        </div>
                        <div className="h-px bg-white/[0.06]" />
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Variación respecto al prompt</label>
                                <span className="text-[11px] font-bold text-violet-400">
                                    {variation <= 20 ? "✏️ Mínima" : variation <= 45 ? "🔄 Leve" : variation <= 70 ? "🔀 Moderada" : variation <= 85 ? "🌊 Alta" : "💥 Total"}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-neutral-700 shrink-0">Cambiar poco</span>
                                <input type="range" min={0} max={100} step={5} value={variation}
                                    onChange={e => setVariation(Number(e.target.value))}
                                    className="flex-1 accent-violet-500 h-1 cursor-pointer" />
                                <span className="text-[9px] text-neutral-700 shrink-0">Prompts nuevos</span>
                            </div>
                            <p className="text-[9px] text-neutral-700">
                                {variation <= 20
                                    ? "Solo cambia 1-2 palabras clave del prompt original"
                                    : variation <= 45
                                    ? "Misma base, ligeras variaciones de sujeto o detalle"
                                    : variation <= 70
                                    ? "Sujetos distintos del mismo nicho, estilo conservado"
                                    : variation <= 85
                                    ? "Situaciones muy distintas, libre dentro del nicho"
                                    : "Prompts completamente nuevos, máxima diversidad"}
                            </p>
                        </div>
                    </div>

                    {/* Imágenes por catálogo */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Imágenes por catálogo</label>
                        <Stepper value={imagesPer} onChange={setImagesPer} min={1} max={30} presets={[3, 5, 10, 15]} />
                        <p className="text-[9px] text-neutral-700">{count * imagesPer} imágenes en total</p>
                    </div>

                    {/* Modelo — lista scrollable con radio style */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Modelo de imagen</label>
                        <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                            {/* Default option */}
                            <button type="button" onClick={() => setModelId("default")}
                                className={`w-full px-3 py-2.5 rounded-xl border flex items-center gap-3 text-left transition-all ${modelId === "default" ? "border-violet-500/40 bg-violet-500/10" : "border-white/6 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
                                <div className="w-2 h-2 rounded-full shrink-0 bg-neutral-500" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white leading-tight">Por defecto</p>
                                    <p className="text-xs text-neutral-600 leading-tight mt-0.5">Modelo configurado en Ajustes</p>
                                </div>
                                {modelId === "default" && <Check size={13} className="text-violet-400 shrink-0" />}
                            </button>
                            {Object.entries(providerGroups).map(([provider, models]) => (
                                <div key={provider} className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-700 px-1">{provider}</p>
                                    {models.map(m => (
                                        <button key={m.id} type="button" onClick={() => setModelId(m.id)}
                                            className={`w-full px-3 py-2.5 rounded-xl border flex items-center gap-3 text-left transition-all ${modelId === m.id ? "border-violet-500/40 bg-violet-500/10" : "border-white/6 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[m.status] ?? "bg-neutral-500"}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white leading-tight">{m.name}</p>
                                                <p className="text-xs text-neutral-600 leading-tight mt-0.5 truncate">{m.type}</p>
                                            </div>
                                            {modelId === m.id && <Check size={13} className="text-violet-400 shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 pt-4 border-t border-white/8 space-y-3 shrink-0">
                    {selectedModel && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/8 border border-violet-500/20">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[selectedModel.status] ?? "bg-neutral-500"}`} />
                            <p className="text-xs font-black text-violet-300 truncate">{selectedModel.name}</p>
                            <span className="text-xs text-neutral-600 ml-auto shrink-0">{count} × {imagesPer} = {count * imagesPer} imgs</span>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button onClick={onClose} disabled={launching}
                            className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all disabled:opacity-40">
                            Cancelar
                        </button>
                        <button onClick={() => void launch()} disabled={launching}
                            className="flex-1 h-11 rounded-2xl bg-violet-500 text-white text-sm font-black hover:bg-violet-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {launching
                                ? <><Loader2 size={14} className="animate-spin" /> Detectando…</>
                                : <><Sparkles size={14} /> Lanzar {count} catálogos</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
