"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Sparkles, Download, RefreshCw, Grid, LayoutTemplate, Copy,
    ChevronDown, Loader2, X, Plus, Check, Star, Layers,
    ExternalLink, Info, Palette, Wand2, ImageIcon
} from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Types ────────────────────────────────────────────────────────────────────

interface GeneratedPattern {
    id: string;
    url: string;
    prompt: string;
    style: string;
    palette: string;
    createdAt: string;
}

type TileMode = "1x1" | "2x2" | "3x3";

// ── Pattern styles ────────────────────────────────────────────────────────────

const PATTERN_STYLES = [
    {
        id: "floral",
        label: "Floral",
        emoji: "🌸",
        prompt: "seamless floral repeat pattern, delicate flowers and leaves, botanical illustration, flat design",
        negativePrompt: "text, watermark, border, frame, seams, harsh lines",
    },
    {
        id: "geometric",
        label: "Geométrico",
        emoji: "◆",
        prompt: "seamless geometric repeat pattern, abstract shapes, hexagons, triangles, clean vector art, flat design",
        negativePrompt: "text, watermark, organic shapes, seams",
    },
    {
        id: "botanical",
        label: "Botánico",
        emoji: "🌿",
        prompt: "seamless botanical repeat pattern, tropical leaves, plants and herbs, realistic botanical illustration, flat design",
        negativePrompt: "text, watermark, flowers, seams, border",
    },
    {
        id: "kawaii",
        label: "Kawaii",
        emoji: "🐾",
        prompt: "seamless kawaii cute repeat pattern, adorable chibi characters, animals and food, pastel flat illustration",
        negativePrompt: "text, watermark, realistic, dark, seams",
    },
    {
        id: "animal-print",
        label: "Animal Print",
        emoji: "🐆",
        prompt: "seamless animal print repeat pattern, leopard spots, abstract organic texture, fashion surface design",
        negativePrompt: "text, watermark, seams, border, animals",
    },
    {
        id: "abstract",
        label: "Abstracto",
        emoji: "🎨",
        prompt: "seamless abstract repeat pattern, watercolor splashes, paint brush strokes, artistic surface design",
        negativePrompt: "text, watermark, geometric, seams, border",
    },
    {
        id: "vintage",
        label: "Vintage",
        emoji: "🏺",
        prompt: "seamless vintage retro repeat pattern, art nouveau inspired, ornamental decorative motifs, antique illustration",
        negativePrompt: "text, watermark, modern, flat, seams",
    },
    {
        id: "celestial",
        label: "Celestial",
        emoji: "✨",
        prompt: "seamless celestial repeat pattern, stars, moons, planets, mystical night sky, flat illustration",
        negativePrompt: "text, watermark, seams, border, daytime",
    },
    {
        id: "food",
        label: "Comida",
        emoji: "🍓",
        prompt: "seamless food repeat pattern, fruits vegetables and kitchen elements, cute flat illustration, surface design",
        negativePrompt: "text, watermark, people, seams, border",
    },
    {
        id: "festive",
        label: "Festivo",
        emoji: "🎄",
        prompt: "seamless festive holiday repeat pattern, Christmas elements, decorative ornaments, flat illustration",
        negativePrompt: "text, watermark, seams, border, letters",
    },
    {
        id: "mandala",
        label: "Mandala",
        emoji: "🔮",
        prompt: "seamless mandala tile pattern, intricate symmetric ornamental design, zentangle inspired, detailed line art",
        negativePrompt: "text, watermark, asymmetric, seams",
    },
    {
        id: "custom",
        label: "Custom",
        emoji: "✏️",
        prompt: "",
        negativePrompt: "",
    },
];

const COLOR_PALETTES = [
    { id: "pastel", label: "Pastel", colors: ["#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF"], prompt: "soft pastel color palette" },
    { id: "vibrant", label: "Vibrante", colors: ["#FF006E", "#FB5607", "#FFBE0B", "#3A86FF", "#8338EC"], prompt: "vibrant bold color palette" },
    { id: "earth", label: "Tierra", colors: ["#8B4513", "#D2691E", "#F4A460", "#DEB887", "#FAEBD7"], prompt: "warm earthy terracotta tones" },
    { id: "nordic", label: "Nórdico", colors: ["#2E3440", "#3B4252", "#81A1C1", "#ECEFF4", "#BF616A"], prompt: "nordic cool muted tones, navy and cream" },
    { id: "tropical", label: "Tropical", colors: ["#FF6B6B", "#FFE66D", "#4ECDC4", "#45B7D1", "#96E6A1"], prompt: "tropical bright warm colors" },
    { id: "monochrome", label: "Mono", colors: ["#F8F8F8", "#C0C0C0", "#808080", "#404040", "#101010"], prompt: "black and white monochrome" },
    { id: "gold", label: "Gold", colors: ["#1A1A2E", "#16213E", "#0F3460", "#E94560", "#F5A623"], prompt: "luxury gold and deep navy" },
    { id: "spring", label: "Primavera", colors: ["#FF9AA2", "#FFB7B2", "#FFDAC1", "#E2F0CB", "#B5EAD7"], prompt: "spring fresh light colors, pink and mint" },
];

const PLATFORM_SPECS = [
    {
        name: "Redbubble",
        color: "text-red-400",
        specs: "PNG · 7632×6480 px (300dpi) · sRGB",
        tip: "Usa el archivo 2048×2048 y Redbubble lo escala. Para calidad máxima, sube directamente a 7632×6480.",
        url: "https://help.redbubble.com/hc/en-us/articles/202270799",
    },
    {
        name: "Spoonflower",
        color: "text-emerald-400",
        specs: "PNG/JPG · 150dpi mínimo · sRGB · tile cuadrado",
        tip: "El tile debe ser perfectamente cuadrado. Spoonflower acepta el patrón y lo repite automáticamente.",
        url: "https://support.spoonflower.com/hc/en-us",
    },
    {
        name: "Society6",
        color: "text-purple-400",
        specs: "PNG · 6500×6500 px mínimo · 300dpi",
        tip: "Society6 tiene templates por producto. Para art print usa 5000×7000, para tela usa cuadrado.",
        url: "https://society6.com/",
    },
    {
        name: "Merch by Amazon",
        color: "text-amber-400",
        specs: "PNG · 4500×5400 px (all-over-print) · 300dpi",
        tip: "Para all-over-print shirts, el diseño debe cubrir toda la superficie. El patrón repetido funciona perfecto.",
        url: "https://merch.amazon.com",
    },
];

// ── Component ────────────────────────────────────────────────────────────────

export function SeamlessPatternApp() {
    const [selectedStyle, setSelectedStyle] = useState(PATTERN_STYLES[0]);
    const [selectedPalette, setSelectedPalette] = useState(COLOR_PALETTES[0]);
    const [customPrompt, setCustomPrompt] = useState("");
    const [customNegative, setCustomNegative] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [tileMode, setTileMode] = useState<TileMode>("2x2");
    const [showTiled, setShowTiled] = useState(false);
    const [history, setHistory] = useState<GeneratedPattern[]>([]);
    const [showSpecs, setShowSpecs] = useState(false);
    const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 999999));
    const [currentPromptUsed, setCurrentPromptUsed] = useState("");

    // Load history from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem("seamless-pattern-history");
            if (stored) setHistory(JSON.parse(stored));
        } catch { /* ignore */ }
    }, []);

    const saveToHistory = useCallback((pattern: GeneratedPattern) => {
        setHistory(prev => {
            const updated = [pattern, ...prev].slice(0, 24);
            try { localStorage.setItem("seamless-pattern-history", JSON.stringify(updated)); } catch { /* ignore */ }
            return updated;
        });
    }, []);

    const buildPrompt = (): { prompt: string; negativePrompt: string } => {
        const base = selectedStyle.id === "custom"
            ? customPrompt
            : selectedStyle.prompt;
        const prompt = [
            base,
            selectedPalette.prompt,
            "seamless tileable repeat pattern tile, no borders, no frame, surface design, professional textile pattern",
        ].filter(Boolean).join(", ");

        const negativePrompt = [
            selectedStyle.id === "custom" ? customNegative : selectedStyle.negativePrompt,
            "text, watermark, seams visible, border, frame, signature, low quality",
        ].filter(Boolean).join(", ");

        return { prompt, negativePrompt };
    };

    const generate = async (newSeed?: number) => {
        const { prompt, negativePrompt } = buildPrompt();
        if (!prompt.trim()) { toast.error("Define un estilo o escribe un prompt personalizado"); return; }

        const usedSeed = newSeed ?? seed;
        setIsGenerating(true);
        setGeneratedUrl(null);
        setCurrentPromptUsed(prompt);

        try {
            const res = await fetch(`${API_BASE_URL}/ai/generate-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    modelId: "flux",
                    provider: "Pollinations",
                    width: 1024,
                    height: 1024,
                    advancedParams: { negativePrompt, seed: usedSeed },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Error generando imagen");
            const url: string = data.url ?? data.imageUrl ?? data.image?.url ?? "";
            if (!url) throw new Error("No se recibió URL de imagen");
            setGeneratedUrl(url);
            setShowTiled(false);
            const pattern: GeneratedPattern = {
                id: `${Date.now()}`,
                url,
                prompt,
                style: selectedStyle.label,
                palette: selectedPalette.label,
                createdAt: new Date().toISOString(),
            };
            saveToHistory(pattern);
        } catch (e: any) {
            toast.error(e.message ?? "Error generando patrón");
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadImage = async (url: string, filename: string) => {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 10000);
            toast.success("Imagen descargada");
        } catch {
            window.open(url, "_blank");
        }
    };

    const tileSizes: TileMode[] = ["1x1", "2x2", "3x3"];
    const tileCount = tileMode === "1x1" ? 1 : tileMode === "2x2" ? 4 : 9;
    const tileCols = tileMode === "1x1" ? 1 : tileMode === "2x2" ? 2 : 3;

    return (
        <div className="space-y-6">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── Left: Controls ── */}
                <div className="space-y-4">

                    {/* Style picker */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                            <Palette size={13} className="text-violet-400" />
                            <span className="text-[11px] font-black text-white uppercase tracking-widest">Estilo</span>
                        </div>
                        <div className="p-3 grid grid-cols-3 gap-1.5">
                            {PATTERN_STYLES.map(style => (
                                <button key={style.id}
                                    onClick={() => setSelectedStyle(style)}
                                    className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all ${selectedStyle.id === style.id ? "border-violet-500/50 bg-violet-500/15 text-violet-300" : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-white hover:bg-white/6"}`}>
                                    <span className="text-base leading-none">{style.emoji}</span>
                                    <span className="text-[8px] font-black truncate w-full text-center">{style.label}</span>
                                </button>
                            ))}
                        </div>
                        {selectedStyle.id === "custom" && (
                            <div className="px-4 pb-4 space-y-2">
                                <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                                    placeholder="Describe el patrón en inglés: e.g. seamless watercolor mushroom pattern..."
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 resize-none leading-relaxed" />
                                <input value={customNegative} onChange={e => setCustomNegative(e.target.value)}
                                    placeholder="Negative prompt (opcional)"
                                    className="w-full h-8 px-3 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                            </div>
                        )}
                    </div>

                    {/* Color palette */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                            <Wand2 size={13} className="text-pink-400" />
                            <span className="text-[11px] font-black text-white uppercase tracking-widest">Paleta de color</span>
                        </div>
                        <div className="p-3 space-y-1.5">
                            {COLOR_PALETTES.map(palette => (
                                <button key={palette.id}
                                    onClick={() => setSelectedPalette(palette)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${selectedPalette.id === palette.id ? "border-pink-500/40 bg-pink-500/10" : "border-white/8 bg-white/[0.02] hover:bg-white/5"}`}>
                                    <div className="flex gap-0.5 shrink-0">
                                        {palette.colors.map((c, i) => (
                                            <div key={i} className="w-4 h-4 rounded-sm first:rounded-l-lg last:rounded-r-lg" style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                    <span className={`text-[10px] font-black ${selectedPalette.id === palette.id ? "text-pink-300" : "text-neutral-500"}`}>{palette.label}</span>
                                    {selectedPalette.id === palette.id && <Check size={10} className="text-pink-400 ml-auto" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Seed */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Seed</span>
                        <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))}
                            className="flex-1 h-7 px-2 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white focus:outline-none focus:border-violet-500/30 font-mono" />
                        <button onClick={() => setSeed(Math.floor(Math.random() * 999999))}
                            className="h-7 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-[9px] text-neutral-500 hover:text-white transition-all">
                            <RefreshCw size={10} />
                        </button>
                    </div>

                    {/* Generate button */}
                    <button onClick={() => void generate()}
                        disabled={isGenerating}
                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-[0_4px_20px_rgba(139,92,246,0.35)]">
                        {isGenerating
                            ? <><Loader2 size={14} className="animate-spin" />Generando patrón...</>
                            : <><Sparkles size={14} />Generar patrón</>}
                    </button>

                    {/* Platform specs */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                        <button onClick={() => setShowSpecs(v => !v)}
                            className="w-full flex items-center gap-2 px-4 py-3">
                            <Info size={12} className="text-sky-400 shrink-0" />
                            <span className="text-[10px] font-black text-white flex-1 text-left">Specs por plataforma</span>
                            <ChevronDown size={12} className={`text-neutral-600 transition-transform ${showSpecs ? "rotate-180" : ""}`} />
                        </button>
                        {showSpecs && (
                            <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
                                {PLATFORM_SPECS.map(p => (
                                    <div key={p.name} className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className={`text-[10px] font-black ${p.color}`}>{p.name}</p>
                                            <a href={p.url} target="_blank" rel="noreferrer"
                                                className="text-neutral-700 hover:text-neutral-400 transition-colors">
                                                <ExternalLink size={9} />
                                            </a>
                                        </div>
                                        <p className="text-[9px] font-mono text-neutral-500 bg-white/[0.03] px-2 py-1 rounded-lg">{p.specs}</p>
                                        <p className="text-[9px] text-neutral-600 leading-relaxed">{p.tip}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Preview ── */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Preview area */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                            <ImageIcon size={13} className="text-sky-400" />
                            <span className="text-[11px] font-black text-white uppercase tracking-widest">
                                {showTiled ? "Vista tileada" : "Vista individual"}
                            </span>
                            {generatedUrl && (
                                <div className="ml-auto flex items-center gap-2">
                                    {/* Tile mode selector */}
                                    <div className="flex gap-1">
                                        {tileSizes.map(t => (
                                            <button key={t}
                                                onClick={() => { setTileMode(t); setShowTiled(true); }}
                                                className={`h-6 px-2 rounded-lg border text-[8px] font-black transition-all ${showTiled && tileMode === t ? "border-violet-500/50 bg-violet-500/15 text-violet-300" : "border-white/10 bg-white/[0.03] text-neutral-600 hover:text-white"}`}>
                                                {t}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setShowTiled(false)}
                                            className={`h-6 px-2 rounded-lg border text-[8px] font-black transition-all ${!showTiled ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-white/10 bg-white/[0.03] text-neutral-600 hover:text-white"}`}>
                                            1×
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => void downloadImage(generatedUrl, `pattern-${selectedStyle.id}-${selectedPalette.id}-${seed}.jpg`)}
                                        className="flex items-center gap-1 h-6 px-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-black text-emerald-300 hover:bg-emerald-500/20 transition-all">
                                        <Download size={9} />PNG
                                    </button>
                                    <button
                                        onClick={() => { setSeed(Math.floor(Math.random() * 999999)); void generate(Math.floor(Math.random() * 999999)); }}
                                        className="flex items-center gap-1 h-6 px-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-[9px] font-black text-neutral-500 hover:text-white transition-all">
                                        <RefreshCw size={9} />Variar
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="relative min-h-[360px] flex items-center justify-center" style={{ background: "repeating-conic-gradient(#0a0a0a 0% 25%, #111 0% 50%) 0 0 / 20px 20px" }}>
                            {isGenerating ? (
                                <div className="flex flex-col items-center gap-3 py-16">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/30 flex items-center justify-center">
                                            <Loader2 size={28} className="text-violet-400 animate-spin" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] font-black text-neutral-500">Generando patrón seamless...</p>
                                    <p className="text-[9px] text-neutral-700">{selectedStyle.label} · {selectedPalette.label}</p>
                                </div>
                            ) : generatedUrl ? (
                                !showTiled ? (
                                    <img src={generatedUrl} alt="Generated pattern" className="w-full max-h-[500px] object-contain" />
                                ) : (
                                    <div
                                        className="w-full"
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: `repeat(${tileCols}, 1fr)`,
                                        }}
                                    >
                                        {[...Array(tileCount)].map((_, i) => (
                                            <img key={i} src={generatedUrl} alt="" className="w-full aspect-square object-cover" />
                                        ))}
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col items-center gap-3 py-16">
                                    <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
                                        <Grid size={28} className="text-neutral-700" />
                                    </div>
                                    <p className="text-[11px] font-black text-neutral-600">Configura el estilo y genera tu patrón</p>
                                    <p className="text-[9px] text-neutral-700">El resultado se puede tilear en 2×2 ó 3×3</p>
                                </div>
                            )}
                        </div>

                        {/* Prompt used */}
                        {currentPromptUsed && (
                            <div className="border-t border-white/[0.05] px-4 py-2.5 flex items-start gap-2">
                                <p className="text-[8px] font-black uppercase tracking-widest text-neutral-700 shrink-0 mt-0.5">Prompt</p>
                                <p className="text-[9px] text-neutral-600 leading-relaxed line-clamp-2 flex-1">{currentPromptUsed}</p>
                                <button onClick={() => { navigator.clipboard.writeText(currentPromptUsed); toast.success("Prompt copiado"); }}
                                    className="shrink-0 text-neutral-700 hover:text-neutral-400 transition-colors">
                                    <Copy size={10} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* History */}
                    {history.length > 0 && (
                        <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Layers size={13} className="text-amber-400" />
                                    <span className="text-[11px] font-black text-white uppercase tracking-widest">Historial</span>
                                </div>
                                <button onClick={() => { setHistory([]); localStorage.removeItem("seamless-pattern-history"); }}
                                    className="text-[9px] text-neutral-700 hover:text-neutral-400 transition-colors">
                                    Limpiar
                                </button>
                            </div>
                            <div className="p-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                                {history.map(p => (
                                    <div key={p.id} className="group relative">
                                        <button
                                            onClick={() => { setGeneratedUrl(p.url); setCurrentPromptUsed(p.prompt); setShowTiled(false); }}
                                            className="w-full aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-violet-500/40 transition-all">
                                            <img src={p.url} alt="" className="w-full h-full object-cover" />
                                        </button>
                                        <button
                                            onClick={() => void downloadImage(p.url, `pattern-${p.style}-${p.id}.jpg`)}
                                            className="absolute bottom-1 right-1 w-5 h-5 rounded-lg bg-black/70 border border-white/20 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Download size={8} />
                                        </button>
                                        <p className="text-[7px] text-neutral-700 text-center mt-0.5 truncate">{p.style}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
