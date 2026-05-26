"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Sparkles, Download, RefreshCw, Grid, Copy, Trash2,
    ChevronDown, Loader2, Check, Layers, Save,
    ExternalLink, Info, Palette, Wand2, ImageIcon,
    BarChart2, Plug, Activity, Store, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { AI_MODELS, groupModelsByProvider, generateImageBlobUrl, type AIModel } from "./shared/ai-constants";
import { AppTabNav, type AppTab } from "./shared/app-tab-nav";
import { EarningsStats, type EarningsProduct } from "./shared/earnings-stats";
import { DigitalProductsTable, DEFAULT_PRODUCT_TYPES } from "./shared/digital-products-table";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabID = "insights" | "galeria" | "motor" | "integraciones";

interface SavedPattern {
    _id: string;
    publicId: string;
    url: string;
    prompt: string;
    style: string;
    styleLabel: string;
    palette: string;
    paletteLabel: string;
    modelName: string;
    seed: number;
    width: number;
    height: number;
    bytes: number;
    createdAt: string;
}

type TileMode = "1x1" | "2x2" | "3x3";

// ── Constants ─────────────────────────────────────────────────────────────────

const PATTERN_STYLES = [
    { id: "floral",       label: "Floral",       emoji: "🌸", prompt: "seamless floral repeat pattern, delicate flowers and leaves, botanical illustration, flat design", neg: "text, watermark, border, frame, seams" },
    { id: "geometric",    label: "Geométrico",   emoji: "◆",  prompt: "seamless geometric repeat pattern, abstract shapes, hexagons, triangles, clean vector art, flat design", neg: "text, watermark, organic shapes, seams" },
    { id: "botanical",    label: "Botánico",     emoji: "🌿", prompt: "seamless botanical repeat pattern, tropical leaves, plants and herbs, realistic botanical illustration, flat design", neg: "text, watermark, flowers, seams, border" },
    { id: "kawaii",       label: "Kawaii",        emoji: "🐾", prompt: "seamless kawaii cute repeat pattern, adorable chibi characters, animals and food, pastel flat illustration", neg: "text, watermark, realistic, seams" },
    { id: "animal-print", label: "Animal Print", emoji: "🐆", prompt: "seamless animal print repeat pattern, leopard spots, abstract organic texture, fashion surface design", neg: "text, watermark, seams, border, animals" },
    { id: "abstract",     label: "Abstracto",    emoji: "🎨", prompt: "seamless abstract repeat pattern, watercolor splashes, paint brush strokes, artistic surface design", neg: "text, watermark, geometric, seams" },
    { id: "vintage",      label: "Vintage",      emoji: "🏺", prompt: "seamless vintage retro repeat pattern, art nouveau inspired, ornamental decorative motifs, antique illustration", neg: "text, watermark, modern, seams" },
    { id: "celestial",   label: "Celestial",     emoji: "✨", prompt: "seamless celestial repeat pattern, stars, moons, planets, mystical night sky, flat illustration", neg: "text, watermark, seams, border, daytime" },
    { id: "food",         label: "Comida",        emoji: "🍓", prompt: "seamless food repeat pattern, fruits vegetables and kitchen elements, cute flat illustration, surface design", neg: "text, watermark, people, seams" },
    { id: "festive",      label: "Festivo",       emoji: "🎄", prompt: "seamless festive holiday repeat pattern, Christmas elements, decorative ornaments, flat illustration", neg: "text, watermark, seams, letters" },
    { id: "mandala",      label: "Mandala",       emoji: "🔮", prompt: "seamless mandala tile pattern, intricate symmetric ornamental design, zentangle inspired, detailed line art", neg: "text, watermark, asymmetric, seams" },
    { id: "custom",       label: "Custom",        emoji: "✏️", prompt: "", neg: "" },
];

const COLOR_PALETTES = [
    { id: "pastel",     label: "Pastel",    colors: ["#FFB3BA","#FFDFBA","#FFFFBA","#BAFFC9","#BAE1FF"], prompt: "soft pastel color palette" },
    { id: "vibrant",    label: "Vibrante",  colors: ["#FF006E","#FB5607","#FFBE0B","#3A86FF","#8338EC"], prompt: "vibrant bold color palette" },
    { id: "earth",      label: "Tierra",    colors: ["#8B4513","#D2691E","#F4A460","#DEB887","#FAEBD7"], prompt: "warm earthy terracotta tones" },
    { id: "nordic",     label: "Nórdico",   colors: ["#2E3440","#3B4252","#81A1C1","#ECEFF4","#BF616A"], prompt: "nordic cool muted tones, navy and cream" },
    { id: "tropical",   label: "Tropical",  colors: ["#FF6B6B","#FFE66D","#4ECDC4","#45B7D1","#96E6A1"], prompt: "tropical bright warm colors" },
    { id: "monochrome", label: "Mono",      colors: ["#F8F8F8","#C0C0C0","#808080","#404040","#101010"], prompt: "black and white monochrome" },
    { id: "gold",       label: "Gold",      colors: ["#1A1A2E","#16213E","#0F3460","#E94560","#F5A623"], prompt: "luxury gold and deep navy" },
    { id: "spring",     label: "Primavera", colors: ["#FF9AA2","#FFB7B2","#FFDAC1","#E2F0CB","#B5EAD7"], prompt: "spring fresh light colors, pink and mint" },
];

const PLATFORM_SPECS = [
    { name: "Redbubble",       color: "text-red-400",    specs: "PNG · 7632×6480 px · 300 dpi · sRGB",                  tip: "Sube el tile 1024×1024 y Redbubble repite. Para calidad máxima exporta 7632×6480.",          url: "https://help.redbubble.com/hc/en-us/articles/202270799" },
    { name: "Spoonflower",     color: "text-emerald-400", specs: "PNG/JPG · 150 dpi mín · sRGB · tile cuadrado",        tip: "El tile debe ser cuadrado. Spoonflower repite automáticamente.",                            url: "https://support.spoonflower.com" },
    { name: "Society6",        color: "text-purple-400",  specs: "PNG · 6500×6500 px mín · 300 dpi",                   tip: "Para tela usa el tile cuadrado. Para art print necesitas 5000×7000.",                       url: "https://society6.com" },
    { name: "Merch by Amazon", color: "text-amber-400",   specs: "PNG · 4500×5400 px · 300 dpi (all-over-print)",      tip: "El patrón repetido funciona perfecto para all-over-print shirts.",                          url: "https://merch.amazon.com" },
    { name: "Printify",        color: "text-sky-400",     specs: "PNG · 4500×5400 px para camisetas · sRGB",           tip: "Usa el tile directamente — Printify lo adapta al producto seleccionado.",                  url: "https://printify.com" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
    const res = await fetch(blobUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SeamlessPatternApp() {
    const [activeTab, setActiveTab] = useState<TabID>(() => {
        try { return (localStorage.getItem("seamless-tab") ?? "insights") as TabID; } catch { return "insights"; }
    });

    // Motor state
    const [selectedStyle, setSelectedStyle] = useState(PATTERN_STYLES[0]);
    const [selectedPalette, setSelectedPalette] = useState(COLOR_PALETTES[0]);
    const [customPrompt, setCustomPrompt] = useState("");
    const [customNeg, setCustomNeg] = useState("");
    const [selectedModelId, setSelectedModelId] = useState("pollinations-flux");
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [tileMode, setTileMode] = useState<TileMode>("2x2");
    const [showTiled, setShowTiled] = useState(false);
    const [seed, setSeed] = useState(() => Math.floor(Math.random() * 999999));
    const [promptUsed, setPromptUsed] = useState("");

    // Products state (for EarningsStats — populated by DigitalProductsTable callback)
    const [insightsProducts, setInsightsProducts] = useState<EarningsProduct[]>([]);

    // Gallery state
    const [patterns, setPatterns] = useState<SavedPattern[]>([]);
    const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
    const [galleryStyle, setGalleryStyle] = useState<string>("all");
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [tilePreviewId, setTilePreviewId] = useState<string | null>(null);
    const [tilePreviewMode, setTilePreviewMode] = useState<TileMode>("2x2");

    const currentModel: AIModel = AI_MODELS.find(m => m.id === selectedModelId) ?? AI_MODELS.find(m => m.id === "pollinations-flux")!;
    const modelsByProvider = groupModelsByProvider(AI_MODELS);

    const tabs: AppTab[] = [
        { id: "insights",      name: "Insights",      icon: <BarChart2 size={15} /> },
        { id: "galeria",       name: "Galería",       icon: <Grid size={15} />, badge: patterns.length || undefined },
        { id: "motor",         name: "Motor",         icon: <Sparkles size={15} /> },
        { id: "integraciones", name: "Integraciones", icon: <Plug size={15} /> },
    ];

    const changeTab = (tab: string) => {
        localStorage.setItem("seamless-tab", tab);
        setActiveTab(tab as TabID);
    };

    // Load patterns when entering gallery/insights
    const loadPatterns = useCallback(async () => {
        setIsLoadingPatterns(true);
        try {
            const res = await fetch(`${API_BASE_URL}/patterns`);
            const data = await res.json();
            setPatterns(data.patterns ?? []);
        } catch { toast.error("Error cargando patrones"); }
        finally { setIsLoadingPatterns(false); }
    }, []);

    useEffect(() => {
        if (activeTab === "insights" || activeTab === "galeria") void loadPatterns();
    }, [activeTab, loadPatterns]);

    // Build prompt
    const buildPrompt = () => {
        const base = selectedStyle.id === "custom" ? customPrompt : selectedStyle.prompt;
        const prompt = [base, selectedPalette.prompt, "seamless tileable repeat pattern tile, no borders, no frame, professional surface design"].filter(Boolean).join(", ");
        const neg = [selectedStyle.id === "custom" ? customNeg : selectedStyle.neg, "text, watermark, seams visible, border, frame, low quality"].filter(Boolean).join(", ");
        return { prompt, neg };
    };

    const generate = async (overrideSeed?: number) => {
        const { prompt, neg } = buildPrompt();
        if (!prompt.trim()) { toast.error("Define un estilo o escribe un prompt"); return; }
        const usedSeed = overrideSeed ?? seed;
        setIsGenerating(true);
        setGeneratedUrl(null);
        setPromptUsed(prompt);
        try {
            const url = await generateImageBlobUrl(API_BASE_URL, {
                prompt, modelId: currentModel.modelId, provider: currentModel.provider,
                width: 1024, height: 1024, negativePrompt: neg, seed: usedSeed,
                onRetry: (wait, attempt) => toast.info(`Reintentando en ${wait}s (${attempt}/2)…`),
            });
            setGeneratedUrl(url);
            setShowTiled(false);
            toast.success("Patrón generado");
        } catch (e: any) {
            toast.error(e.message ?? "Error generando patrón");
        } finally { setIsGenerating(false); }
    };

    const vary = () => {
        const ns = Math.floor(Math.random() * 999999);
        setSeed(ns);
        void generate(ns);
    };

    const savePattern = async () => {
        if (!generatedUrl) return;
        setIsSaving(true);
        try {
            const dataUrl = await blobUrlToDataUrl(generatedUrl);
            const res = await fetch(`${API_BASE_URL}/patterns`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dataUrl,
                    prompt: promptUsed,
                    style: selectedStyle.id,
                    styleLabel: selectedStyle.label,
                    palette: selectedPalette.id,
                    paletteLabel: selectedPalette.label,
                    modelName: currentModel.name,
                    seed,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Error guardando");
            setPatterns(prev => [data.pattern, ...prev]);
            toast.success(`Patrón guardado en Galería · ${selectedStyle.label}`);
        } catch (e: any) {
            toast.error(e.message ?? "Error guardando patrón");
        } finally { setIsSaving(false); }
    };

    const deletePattern = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/patterns/${id}`, { method: "DELETE" });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setPatterns(prev => prev.filter(p => p._id !== id));
            setDeleteConfirmId(null);
            toast.success("Patrón eliminado");
        } catch (e: any) {
            toast.error(e.message ?? "Error eliminando");
        }
    };

    const downloadPattern = (url: string, filename: string) => {
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        toast.success("Descargando…");
    };

    // ── Render Motor ──────────────────────────────────────────────────────────

    const renderMotor = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls */}
            <div className="space-y-4">
                {/* Style picker */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                        <Palette size={13} className="text-violet-400" />
                        <span className="text-[11px] font-black text-white uppercase tracking-widest">Estilo</span>
                    </div>
                    <div className="p-3 grid grid-cols-3 gap-1.5">
                        {PATTERN_STYLES.map(s => (
                            <button key={s.id} onClick={() => setSelectedStyle(s)}
                                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all ${selectedStyle.id === s.id ? "border-violet-500/50 bg-violet-500/15 text-violet-300" : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-white hover:bg-white/6"}`}>
                                <span className="text-base leading-none">{s.emoji}</span>
                                <span className="text-[8px] font-black truncate w-full text-center">{s.label}</span>
                            </button>
                        ))}
                    </div>
                    {selectedStyle.id === "custom" && (
                        <div className="px-4 pb-4 space-y-2">
                            <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                                placeholder="Describe el patrón en inglés…" rows={3}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 resize-none leading-relaxed" />
                            <input value={customNeg} onChange={e => setCustomNeg(e.target.value)}
                                placeholder="Negative prompt (opcional)"
                                className="w-full h-8 px-3 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                        </div>
                    )}
                </div>

                {/* Palette */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                        <Wand2 size={13} className="text-pink-400" />
                        <span className="text-[11px] font-black text-white uppercase tracking-widest">Paleta</span>
                    </div>
                    <div className="p-3 space-y-1.5">
                        {COLOR_PALETTES.map(p => (
                            <button key={p.id} onClick={() => setSelectedPalette(p)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${selectedPalette.id === p.id ? "border-pink-500/40 bg-pink-500/10" : "border-white/8 bg-white/[0.02] hover:bg-white/5"}`}>
                                <div className="flex gap-0.5 shrink-0">
                                    {p.colors.map((c, i) => <div key={i} className="w-4 h-4 rounded-sm first:rounded-l-lg last:rounded-r-lg" style={{ backgroundColor: c }} />)}
                                </div>
                                <span className={`text-[10px] font-black ${selectedPalette.id === p.id ? "text-pink-300" : "text-neutral-500"}`}>{p.label}</span>
                                {selectedPalette.id === p.id && <Check size={10} className="text-pink-400 ml-auto" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Model */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                    <button onClick={() => setShowModelPicker(v => !v)} className="w-full flex items-center gap-2 px-4 py-3">
                        <ImageIcon size={13} className="text-sky-400 shrink-0" />
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Modelo IA</p>
                            <p className="text-[10px] font-black text-white truncate">{currentModel.name}</p>
                            <p className="text-[8px] text-neutral-600">{currentModel.type}</p>
                        </div>
                        <ChevronDown size={12} className={`text-neutral-600 shrink-0 transition-transform ${showModelPicker ? "rotate-180" : ""}`} />
                    </button>
                    {showModelPicker && (
                        <div className="border-t border-white/[0.05] max-h-64 overflow-y-auto">
                            {Object.entries(modelsByProvider).map(([provider, models]) => (
                                <div key={provider}>
                                    <p className="px-4 py-1.5 text-[8px] font-black uppercase tracking-widest text-neutral-700 bg-white/[0.02] sticky top-0">{provider}</p>
                                    {models.map(m => (
                                        <button key={m.id} onClick={() => { setSelectedModelId(m.id); setShowModelPicker(false); }}
                                            className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-all border-b border-white/[0.03] last:border-0 ${selectedModelId === m.id ? "bg-sky-500/10 text-sky-300" : "hover:bg-white/[0.04] text-neutral-400"}`}>
                                            <div>
                                                <p className="text-[10px] font-black">{m.name}</p>
                                                <p className="text-[8px] text-neutral-600">{m.type}</p>
                                            </div>
                                            {selectedModelId === m.id && <Check size={10} className="text-sky-400 shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Seed */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Seed</span>
                    <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))}
                        className="flex-1 h-7 px-2 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white focus:outline-none focus:border-violet-500/30 font-mono" />
                    <button onClick={() => setSeed(Math.floor(Math.random() * 999999))}
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-neutral-500 hover:text-white transition-all">
                        <RefreshCw size={10} />
                    </button>
                </div>

                <button onClick={() => void generate()} disabled={isGenerating}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-[0_4px_20px_rgba(139,92,246,0.35)]">
                    {isGenerating ? <><Loader2 size={14} className="animate-spin" />Generando…</> : <><Sparkles size={14} />Generar patrón</>}
                </button>
            </div>

            {/* Preview */}
            <div className="lg:col-span-2 space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2 flex-wrap">
                        <Grid size={13} className="text-sky-400" />
                        <span className="text-[11px] font-black text-white uppercase tracking-widest">{showTiled ? `Tileado (${tileMode})` : "Individual"}</span>
                        {generatedUrl && (
                            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                                {(["1x1","2x2","3x3"] as TileMode[]).map(t => (
                                    <button key={t} onClick={() => { setTileMode(t); setShowTiled(true); }}
                                        className={`h-6 px-2 rounded-lg border text-[8px] font-black transition-all ${showTiled && tileMode === t ? "border-violet-500/50 bg-violet-500/15 text-violet-300" : "border-white/10 bg-white/[0.03] text-neutral-600 hover:text-white"}`}>{t}</button>
                                ))}
                                <button onClick={() => setShowTiled(false)}
                                    className={`h-6 px-2 rounded-lg border text-[8px] font-black transition-all ${!showTiled ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-white/10 bg-white/[0.03] text-neutral-600 hover:text-white"}`}>1×</button>
                                <button onClick={() => downloadPattern(generatedUrl, `pattern-${selectedStyle.id}-${seed}.png`)}
                                    className="flex items-center gap-1 h-6 px-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-black text-emerald-300 hover:bg-emerald-500/20 transition-all">
                                    <Download size={9} />PNG
                                </button>
                                <button onClick={vary}
                                    className="flex items-center gap-1 h-6 px-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-[9px] font-black text-neutral-500 hover:text-white transition-all">
                                    <RefreshCw size={9} />Variar
                                </button>
                                <button onClick={() => void savePattern()} disabled={isSaving}
                                    className="flex items-center gap-1 h-6 px-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[9px] font-black text-amber-300 hover:bg-amber-500/20 transition-all disabled:opacity-40">
                                    {isSaving ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />}
                                    Guardar
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="relative min-h-[360px] flex items-center justify-center"
                        style={{ background: "repeating-conic-gradient(#0a0a0a 0% 25%, #111 0% 50%) 0 0 / 20px 20px" }}>
                        {isGenerating ? (
                            <div className="flex flex-col items-center gap-3 py-16">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/30 flex items-center justify-center">
                                    <Loader2 size={28} className="text-violet-400 animate-spin" />
                                </div>
                                <p className="text-[11px] font-black text-neutral-500">Generando patrón seamless…</p>
                                <p className="text-[9px] text-neutral-700">{selectedStyle.label} · {selectedPalette.label} · {currentModel.name}</p>
                            </div>
                        ) : generatedUrl ? (
                            !showTiled
                                ? <img src={generatedUrl} alt="Generated pattern" className="w-full max-h-[500px] object-contain" />
                                : (
                                    <div className="w-full" style={{ display: "grid", gridTemplateColumns: `repeat(${tileMode === "1x1" ? 1 : tileMode === "2x2" ? 2 : 3}, 1fr)` }}>
                                        {[...Array((tileMode === "1x1" ? 1 : tileMode === "2x2" ? 2 : 3) ** 2)].map((_, i) => (
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
                                <p className="text-[9px] text-neutral-700">Usa 2×2 o 3×3 para ver cómo repite · Guarda en Galería para persistirlo</p>
                            </div>
                        )}
                    </div>

                    {promptUsed && (
                        <div className="border-t border-white/[0.05] px-4 py-2.5 flex items-start gap-2">
                            <p className="text-[8px] font-black uppercase tracking-widest text-neutral-700 shrink-0 mt-0.5">Prompt</p>
                            <p className="text-[9px] text-neutral-600 leading-relaxed line-clamp-2 flex-1">{promptUsed}</p>
                            <button onClick={() => { navigator.clipboard.writeText(promptUsed); toast.success("Copiado"); }}
                                className="shrink-0 text-neutral-700 hover:text-neutral-400 transition-colors"><Copy size={10} /></button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // ── Render Galería ────────────────────────────────────────────────────────

    const galleryStyles = ["all", ...Array.from(new Set(patterns.map(p => p.style).filter(Boolean)))];
    const filteredPatterns = galleryStyle === "all" ? patterns : patterns.filter(p => p.style === galleryStyle);

    const renderGaleria = () => (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
                {galleryStyles.map(s => {
                    const styleObj = PATTERN_STYLES.find(ps => ps.id === s);
                    return (
                        <button key={s} onClick={() => setGalleryStyle(s)}
                            className={`flex items-center gap-1.5 h-7 px-3 rounded-xl border text-[9px] font-black transition-all ${galleryStyle === s ? "border-violet-500/50 bg-violet-500/15 text-violet-300" : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-white"}`}>
                            {styleObj ? <>{styleObj.emoji} {styleObj.label}</> : "Todos"}
                            {s !== "all" && <span className="text-[8px] opacity-60">({patterns.filter(p => p.style === s).length})</span>}
                        </button>
                    );
                })}
                <button onClick={() => void loadPatterns()}
                    className="ml-auto flex items-center gap-1 h-7 px-2.5 rounded-xl border border-white/8 bg-white/[0.02] text-[9px] text-neutral-600 hover:text-white transition-all">
                    <RefreshCw size={9} />
                </button>
            </div>

            {isLoadingPatterns ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-white/[0.03] animate-pulse" />)}
                </div>
            ) : filteredPatterns.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-16 flex flex-col items-center gap-3 text-center">
                    <Grid size={36} className="text-neutral-700" />
                    <p className="text-[12px] font-black text-neutral-600">No hay patrones guardados aún</p>
                    <p className="text-[10px] text-neutral-700">Genera un patrón en el Motor y haz clic en "Guardar"</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredPatterns.map(p => {
                        const tileCols = tilePreviewId === p._id ? (tilePreviewMode === "2x2" ? 2 : tilePreviewMode === "3x3" ? 3 : 1) : 1;
                        return (
                            <div key={p._id} className="group relative rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
                                {/* Image */}
                                <div className="relative aspect-square overflow-hidden cursor-pointer"
                                    onClick={() => setTilePreviewId(prev => prev === p._id ? null : p._id)}>
                                    {tilePreviewId === p._id ? (
                                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${tileCols}, 1fr)` }} className="w-full h-full">
                                            {[...Array(tileCols * tileCols)].map((_, i) => (
                                                <img key={i} src={p.url} alt="" className="w-full aspect-square object-cover" />
                                            ))}
                                        </div>
                                    ) : (
                                        <img src={p.url} alt={p.styleLabel} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                                    )}

                                    {/* Hover actions overlay */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button onClick={e => { e.stopPropagation(); downloadPattern(p.url, `pattern-${p.style}-${p._id}.png`); }}
                                            className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all">
                                            <Download size={13} />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(p._id); }}
                                            className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center hover:bg-rose-500/30 transition-all">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Tile toggle */}
                                {tilePreviewId === p._id && (
                                    <div className="absolute top-2 left-2 flex gap-1">
                                        {(["1x1","2x2","3x3"] as TileMode[]).map(t => (
                                            <button key={t} onClick={e => { e.stopPropagation(); setTilePreviewMode(t); }}
                                                className={`h-5 px-1.5 rounded-md text-[7px] font-black transition-all ${tilePreviewMode === t ? "bg-violet-500 text-white" : "bg-black/70 text-neutral-400"}`}>{t}</button>
                                        ))}
                                    </div>
                                )}

                                {/* Meta */}
                                <div className="px-2.5 py-2 space-y-0.5">
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="text-[9px] font-black text-white truncate">
                                            {PATTERN_STYLES.find(s => s.id === p.style)?.emoji} {p.styleLabel || p.style}
                                        </span>
                                        <span className="text-[7px] text-neutral-700 shrink-0">
                                            {new Date(p.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                                        </span>
                                    </div>
                                    <p className="text-[8px] text-neutral-600 truncate">{p.paletteLabel} · {p.modelName}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Delete confirm modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setDeleteConfirmId(null)} />
                    <div className="relative w-full max-w-sm bg-black border border-white/10 rounded-[28px] p-7 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col items-center gap-5 text-center">
                        <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                            <AlertTriangle size={28} />
                        </div>
                        <div>
                            <p className="text-[16px] font-black text-white italic">¿Eliminar patrón?</p>
                            <p className="text-[11px] text-neutral-400 mt-1">Se eliminará de Cloudinary y no podrá recuperarse.</p>
                        </div>
                        <div className="flex gap-3 w-full">
                            <button onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 h-10 rounded-xl border border-white/10 text-[10px] font-black text-neutral-400 hover:text-white transition-all">Cancelar</button>
                            <button onClick={() => void deletePattern(deleteConfirmId)}
                                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black transition-all">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // ── Render Insights ───────────────────────────────────────────────────────

    const SEAMLESS_PRODUCT_TYPES = DEFAULT_PRODUCT_TYPES.filter(t =>
        ["seamless-pattern", "poster-digital", "etsy-product", "other"].includes(t.id)
    );

    const renderInsights = () => {
        const total = patterns.length;
        const byStyle = PATTERN_STYLES.filter(s => s.id !== "custom").map(s => ({
            ...s, count: patterns.filter(p => p.style === s.id).length,
        })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);
        const byPalette = COLOR_PALETTES.map(p => ({
            ...p, count: patterns.filter(pt => pt.palette === p.id).length,
        })).filter(p => p.count > 0).sort((a, b) => b.count - a.count);
        const byModel = [...new Set(patterns.map(p => p.modelName))].map(m => ({
            name: m, count: patterns.filter(p => p.modelName === m).length,
        })).sort((a, b) => b.count - a.count);

        return (
            <div className="space-y-6">
                {/* Earnings stats */}
                <EarningsStats products={insightsProducts} />

                {/* Pattern generation stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 flex flex-col gap-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Total patrones</p>
                        <p className="text-4xl font-black text-violet-400 tabular-nums">{total}</p>
                        <p className="text-[9px] text-neutral-700">guardados en Cloudinary</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 space-y-3 sm:col-span-2 lg:col-span-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Por estilo</p>
                        {byStyle.length === 0 ? <p className="text-[10px] text-neutral-700 italic">Sin datos</p> : byStyle.map(s => (
                            <div key={s.id} className="flex items-center gap-2">
                                <span className="text-sm">{s.emoji}</span>
                                <span className="text-[10px] font-black text-neutral-400 flex-1 truncate">{s.label}</span>
                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-violet-500/60 rounded-full" style={{ width: `${(s.count / total) * 100}%` }} />
                                </div>
                                <span className="text-[9px] font-black text-neutral-500 tabular-nums w-4 text-right">{s.count}</span>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 space-y-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Por paleta</p>
                        {byPalette.length === 0 ? <p className="text-[10px] text-neutral-700 italic">Sin datos</p> : byPalette.map(p => (
                            <div key={p.id} className="flex items-center gap-2">
                                <div className="flex gap-0.5 shrink-0">
                                    {p.colors.slice(0,3).map((c,i) => <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />)}
                                </div>
                                <span className="text-[10px] font-black text-neutral-400 flex-1 truncate">{p.label}</span>
                                <span className="text-[9px] font-black text-neutral-500 tabular-nums">{p.count}</span>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 space-y-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Por modelo</p>
                        {byModel.length === 0 ? <p className="text-[10px] text-neutral-700 italic">Sin datos</p> : byModel.map(m => (
                            <div key={m.name} className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-neutral-400 flex-1 truncate">{m.name}</span>
                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-pink-500/60 rounded-full" style={{ width: `${(m.count / total) * 100}%` }} />
                                </div>
                                <span className="text-[9px] font-black text-neutral-500 tabular-nums w-4 text-right">{m.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Digital products table */}
                <DigitalProductsTable
                    apiBase={API_BASE_URL}
                    productTypes={SEAMLESS_PRODUCT_TYPES}
                    defaultPlatform="Redbubble"
                    onProductsChange={setInsightsProducts}
                />
            </div>
        );
    };

    // ── Render Integraciones ──────────────────────────────────────────────────

    const renderIntegraciones = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PLATFORM_SPECS.map(p => (
                    <div key={p.name} className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className={`text-[14px] font-black ${p.color}`}>{p.name}</p>
                            <a href={p.url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-[9px] text-neutral-600 hover:text-neutral-300 transition-colors">
                                <ExternalLink size={10} />Abrir
                            </a>
                        </div>
                        <p className="text-[9px] font-mono text-neutral-400 bg-white/[0.04] border border-white/8 px-3 py-2 rounded-xl">{p.specs}</p>
                        <p className="text-[10px] text-neutral-500 leading-relaxed">{p.tip}</p>
                    </div>
                ))}
            </div>
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5 space-y-2">
                <div className="flex items-center gap-2">
                    <Info size={13} className="text-amber-400 shrink-0" />
                    <p className="text-[11px] font-black text-amber-300">Tip: exporta siempre como PNG sin fondo para mejor compatibilidad</p>
                </div>
                <p className="text-[10px] text-amber-200/60 leading-relaxed">Los patrones generados son 1024×1024 px. Para resoluciones mayores, usa modelos de alta calidad (FLUX Schnell, SDXL) o escala con Upscaler antes de subir a las plataformas.</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-12 pb-24">
            <AppTabNav tabs={tabs} activeTab={activeTab} onChange={changeTab} storageKey="seamless-tab" />
            <div className="relative pt-6">
                {activeTab === "motor"         && renderMotor()}
                {activeTab === "galeria"       && renderGaleria()}
                {activeTab === "insights"      && renderInsights()}
                {activeTab === "integraciones" && renderIntegraciones()}
            </div>
        </div>
    );
}
