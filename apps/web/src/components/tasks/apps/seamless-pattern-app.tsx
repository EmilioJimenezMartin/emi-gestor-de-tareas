"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Sparkles, Download, RefreshCw, Grid, Copy, Trash2,
    ChevronDown, Loader2, Check, Save,
    ExternalLink, Info, Palette, Wand2, ImageIcon,
    BarChart2, TrendingUp, AlertTriangle, Plus, X
} from "lucide-react";
import { toast } from "sonner";
import { AI_MODELS, groupModelsByProvider, type AIModel } from "./shared/ai-constants";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { setSelectedModelId as setReduxModelId } from "@/store/image-model-slice";
import { createApiSocket } from "@/lib/socket";
import { AppTabNav, type AppTab } from "./shared/app-tab-nav";
import { EarningsStats, type EarningsProduct } from "./shared/earnings-stats";
import { DigitalProductsTable, DEFAULT_PRODUCT_TYPES } from "./shared/digital-products-table";
import { NicheRadar, type EtsyListing } from "@/components/extractor/NicheRadar";
import { RadarResultsTable } from "@/components/extractor/RadarResultsTable";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabID = "insights" | "galeria" | "motor" | "tendencias";

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

interface CustomPatternStyle {
    id: string;
    label: string;
    emoji: string;
    prompt: string;
    neg: string;
}

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
    { id: "matrix",       label: "Matrix",        emoji: "💻", prompt: "seamless matrix digital code rain repeat pattern, cascading green glowing katakana and ASCII characters on deep black background, cyberpunk digital rain aesthetic, neon green typography symbols falling vertically, dark tech surface design", neg: "readable words, faces, objects, seams, border, frame, white background, colorful" },
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
    { id: "matrix",     label: "Matrix",    colors: ["#0a0a0a","#003300","#006600","#00ff41","#39ff14"], prompt: "matrix neon green on pure black, digital rain green palette" },
];

const PLATFORM_SPECS = [
    { name: "Redbubble",       color: "text-red-400",     specs: "PNG · 7632×6480 px · 300 dpi",  exportW: 7632, exportH: 6480, tip: "Sube el tile 1024×1024 y Redbubble repite. Para calidad máxima exporta 7632×6480." },
    { name: "Spoonflower",     color: "text-emerald-400", specs: "PNG · 3000×3000 px · 150 dpi",  exportW: 3000, exportH: 3000, tip: "Tile cuadrado — Spoonflower repite automáticamente. Mínimo 3000×3000." },
    { name: "Society6",        color: "text-purple-400",  specs: "PNG · 6500×6500 px · 300 dpi",  exportW: 6500, exportH: 6500, tip: "Para tela usa el tile cuadrado. Para art print necesitas 5000×7000." },
    { name: "Merch by Amazon", color: "text-amber-400",   specs: "PNG · 4500×5400 px · 300 dpi",  exportW: 4500, exportH: 5400, tip: "All-over-print shirts — el patrón se repite en el canvas completo." },
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

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function applyOffsetWrap(dataUrl: string): Promise<string> {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const ox = Math.floor(w / 2);
    const oy = Math.floor(h / 2);
    // Draw 4 quadrants shifted by 50% with wrapping
    ctx.drawImage(img, w - ox, h - oy);        // TL chunk → BL quadrant
    ctx.drawImage(img, -ox, h - oy);            // TR chunk → BR quadrant
    ctx.drawImage(img, w - ox, -oy);            // BL chunk → TR quadrant
    ctx.drawImage(img, -ox, -oy);               // BR chunk → TL quadrant
    return canvas.toDataURL("image/png");
}

async function fixSeamCanvas(dataUrl: string): Promise<string> {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    // Create source canvas
    const src = document.createElement("canvas");
    src.width = w; src.height = h;
    const srcCtx = src.getContext("2d")!;
    srcCtx.drawImage(img, 0, 0);

    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    // Seam band width: ~8% of dimension, min 24px
    const bw = Math.max(24, Math.round(w * 0.08));
    const bh = Math.max(24, Math.round(h * 0.08));
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);

    // Render blurred version on a temp canvas, then composite into seam area
    const blurLevel = Math.max(8, Math.round(Math.min(w, h) * 0.025));

    const blurCanvas = document.createElement("canvas");
    blurCanvas.width = w; blurCanvas.height = h;
    const blurCtx = blurCanvas.getContext("2d")!;
    blurCtx.filter = `blur(${blurLevel}px)`;
    blurCtx.drawImage(img, 0, 0);
    blurCtx.filter = "none";

    // Horizontal seam band
    ctx.drawImage(blurCanvas, 0, cy - bh / 2, w, bh, 0, cy - bh / 2, w, bh);
    // Vertical seam band
    ctx.drawImage(blurCanvas, cx - bw / 2, 0, bw, h, cx - bw / 2, 0, bw, h);

    return out.toDataURL("image/png");
}

async function resizeForPOD(dataUrl: string, targetW: number, targetH: number): Promise<string> {
    const img = await loadImage(dataUrl);
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    const canvas = document.createElement("canvas");
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext("2d")!;
    // Tile the source pattern to fill the target canvas
    const cols = Math.ceil(targetW / sw);
    const rows = Math.ceil(targetH / sh);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            ctx.drawImage(img, c * sw, r * sh);
        }
    }
    return canvas.toDataURL("image/png");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SeamlessPatternApp() {
    const [activeTab, setActiveTab] = useState<TabID>(() => {
        try {
            const saved = localStorage.getItem("seamless-tab") ?? "insights";
            return (["insights", "galeria", "motor", "tendencias"].includes(saved) ? saved : "tendencias") as TabID;
        } catch { return "insights"; }
    });

    // Motor state
    const [selectedStyle, setSelectedStyle] = useState(PATTERN_STYLES[0]);
    const [selectedPalette, setSelectedPalette] = useState(COLOR_PALETTES[0]);
    const [customPrompt, setCustomPrompt] = useState("");
    const [customNeg, setCustomNeg] = useState("");
    const selectedModelId = useAppSelector(s => s.imageModel.selectedModelId);
    const _dispatch = useAppDispatch();
    const setSelectedModelId = (id: string) => _dispatch(setReduxModelId(id));
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [generationJobId, setGenerationJobId] = useState<string | null>(null);
    const [generationLogs, setGenerationLogs] = useState<Array<{ level: string; message: string; timestamp: string }>>([]);
    const patternSocketRef = useRef<ReturnType<typeof createApiSocket> | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const [tileMode, setTileMode] = useState<TileMode>("2x2");
    const [showTiled, setShowTiled] = useState(false);
    const [seed, setSeed] = useState(() => Math.floor(Math.random() * 999999));
    const [promptUsed, setPromptUsed] = useState("");
    const [isDraftLoaded, setIsDraftLoaded] = useState(false);
    // Style/palette captured at generation time — used by savePattern() to avoid stale-closure bugs
    const generatedStyleRef = useRef(PATTERN_STYLES[0]);
    const generatedPaletteRef = useRef(COLOR_PALETTES[0]);

    // Tileable processing pipeline
    const [offsetUrl, setOffsetUrl] = useState<string | null>(null);
    const [tileableUrl, setTileableUrl] = useState<string | null>(null);
    const [isApplyingOffset, setIsApplyingOffset] = useState(false);
    const [isFixingSeam, setIsFixingSeam] = useState(false);
    const [isExportingPOD, setIsExportingPOD] = useState<string | null>(null);

    // Custom palettes
    const [customPalettes, setCustomPalettes] = useState<typeof COLOR_PALETTES>([]);
    const [isGeneratingPalette, setIsGeneratingPalette] = useState(false);
    const [showNewPaletteForm, setShowNewPaletteForm] = useState(false);
    const [newPaletteLabel, setNewPaletteLabel] = useState("");
    const [newPaletteColors, setNewPaletteColors] = useState(["#FF6B6B", "#FFE66D", "#4ECDC4", "#45B7D1", "#96E6A1"]);
    const [isSavingPalette, setIsSavingPalette] = useState(false);

    // Custom styles
    const [customStyles, setCustomStyles] = useState<CustomPatternStyle[]>([]);
    const [showNewStyleForm, setShowNewStyleForm] = useState(false);
    const [newStyleLabel, setNewStyleLabel] = useState("");
    const [newStyleEmoji, setNewStyleEmoji] = useState("🎨");
    const [newStylePrompt, setNewStylePrompt] = useState("");
    const [newStyleNeg, setNewStyleNeg] = useState("");
    const [isSavingStyle, setIsSavingStyle] = useState(false);

    // Products state (for EarningsStats — populated by DigitalProductsTable callback)
    const [insightsProducts, setInsightsProducts] = useState<EarningsProduct[]>([]);

    // Gallery state
    const [patterns, setPatterns] = useState<SavedPattern[]>([]);
    const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
    const [galleryStyle, setGalleryStyle] = useState<string>("all");
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [tilePreviewId, setTilePreviewId] = useState<string | null>(null);
    const [tilePreviewMode, setTilePreviewMode] = useState<TileMode>("2x2");

    // Lightbox
    const [lightboxPattern, setLightboxPattern] = useState<SavedPattern | null>(null);
    const [lightboxTile, setLightboxTile] = useState<TileMode>("2x2");

    const currentModel: AIModel = AI_MODELS.find(m => m.id === selectedModelId) ?? AI_MODELS.find(m => m.id === "stable-horde-sdxl")!;
    const modelsByProvider = groupModelsByProvider(AI_MODELS);

    const tabs: AppTab[] = [
        { id: "tendencias", name: "Tendencias", icon: <TrendingUp size={15} /> },
        { id: "motor",      name: "Motor",      icon: <Sparkles size={15} /> },
        { id: "galeria",    name: "Galería",    icon: <Grid size={15} />, badge: patterns.length || undefined },
        { id: "insights",   name: "Insights",   icon: <BarChart2 size={15} /> },
    ];

    const changeTab = (tab: string) => {
        localStorage.setItem("seamless-tab", tab);
        setActiveTab(tab as TabID);
    };

    const saveCustomPalette = async () => {
        if (!newPaletteLabel.trim()) { toast.error("Nombre requerido"); return; }
        setIsSavingPalette(true);
        const newPalette = { id: `custom-${Date.now()}`, label: newPaletteLabel.trim(), colors: [...newPaletteColors], prompt: newPaletteColors.join(", ") };
        const updated = [...customPalettes, newPalette];
        try {
            const res = await fetch(`${API_BASE_URL}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{ key: "SEAMLESS_CUSTOM_PALETTES", value: JSON.stringify(updated) }]),
            });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            setCustomPalettes(updated);
            setSelectedPalette(newPalette as any);
            setShowNewPaletteForm(false);
            setNewPaletteLabel("");
            setNewPaletteColors(["#FF6B6B", "#FFE66D", "#4ECDC4", "#45B7D1", "#96E6A1"]);
            toast.success(`Paleta "${newPalette.label}" guardada`);
        } catch { toast.error("Error guardando paleta"); }
        finally { setIsSavingPalette(false); }
    };

    const loadCustomPalettes = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/settings`);
            const { settings } = await res.json();
            const row = (settings as any[]).find((s: any) => s.key === "SEAMLESS_CUSTOM_PALETTES");
            if (row?.value) setCustomPalettes(JSON.parse(row.value));
        } catch {}
    }, []);

    const generatePalette = async () => {
        const theme = selectedStyle.id === "custom" ? customPrompt : selectedStyle.label;
        if (!theme.trim()) { toast.error("Selecciona un estilo primero"); return; }
        setIsGeneratingPalette(true);
        try {
            const res = await fetch(`${API_BASE_URL}/ai/generate-palette`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ theme }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            const palette = await res.json();
            const newPalette = { id: `custom-${Date.now()}`, label: palette.name, colors: palette.colors, prompt: palette.prompt };
            const updated = [...customPalettes, newPalette];
            await fetch(`${API_BASE_URL}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{ key: "SEAMLESS_CUSTOM_PALETTES", value: JSON.stringify(updated) }]),
            });
            setCustomPalettes(updated);
            setSelectedPalette(newPalette as any);
            toast.success(`Paleta "${palette.name}" generada`);
        } catch (e: any) {
            toast.error(e.message ?? "Error generando paleta");
        } finally { setIsGeneratingPalette(false); }
    };

    const deleteCustomPalette = async (id: string) => {
        const updated = customPalettes.filter(p => p.id !== id);
        try {
            await fetch(`${API_BASE_URL}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{ key: "SEAMLESS_CUSTOM_PALETTES", value: JSON.stringify(updated) }]),
            });
            setCustomPalettes(updated);
            if (selectedPalette.id === id) setSelectedPalette(COLOR_PALETTES[0]);
        } catch { toast.error("Error eliminando paleta"); }
    };

    // Custom styles — load from backend
    const loadCustomStyles = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/settings`);
            const { settings } = await res.json();
            const row = (settings as any[]).find((s: any) => s.key === "SEAMLESS_CUSTOM_STYLES");
            if (row?.value) setCustomStyles(JSON.parse(row.value));
        } catch {}
    }, []);

    const saveCustomStyle = async () => {
        if (!newStyleLabel.trim() || !newStylePrompt.trim()) { toast.error("Nombre y prompt requeridos"); return; }
        setIsSavingStyle(true);
        const newStyle: CustomPatternStyle = {
            id: `custom-${Date.now()}`,
            label: newStyleLabel.trim(),
            emoji: newStyleEmoji.trim() || "🎨",
            prompt: newStylePrompt.trim(),
            neg: newStyleNeg.trim(),
        };
        const updated = [...customStyles, newStyle];
        try {
            const res = await fetch(`${API_BASE_URL}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{ key: "SEAMLESS_CUSTOM_STYLES", value: JSON.stringify(updated) }]),
            });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            setCustomStyles(updated);
            setSelectedStyle(newStyle as any);
            setShowNewStyleForm(false);
            setNewStyleLabel(""); setNewStyleEmoji("🎨"); setNewStylePrompt(""); setNewStyleNeg("");
            toast.success(`Estilo "${newStyle.label}" guardado`);
        } catch { toast.error("Error guardando estilo"); }
        finally { setIsSavingStyle(false); }
    };

    const deleteCustomStyle = async (id: string) => {
        const updated = customStyles.filter(s => s.id !== id);
        try {
            const res = await fetch(`${API_BASE_URL}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{ key: "SEAMLESS_CUSTOM_STYLES", value: JSON.stringify(updated) }]),
            });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            setCustomStyles(updated);
            if (selectedStyle.id === id) setSelectedStyle(PATTERN_STYLES[0]);
            toast.success("Estilo eliminado");
        } catch { toast.error("Error eliminando estilo"); }
    };

    const addStyleFromRow = async (row: EtsyListing) => {
        const slug = row.sub_nicho_estimado.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const id = `custom-${slug}-${Date.now()}`;
        const newStyle: CustomPatternStyle = {
            id,
            label: row.sub_nicho_estimado,
            emoji: "🎨",
            prompt: `seamless tileable repeat pattern, ${row.sub_nicho_estimado} style, inspired by "${row.titulo_producto}", surface design, flat illustration`,
            neg: "text, watermark, seams, border, frame",
        };
        const updated = [...customStyles, newStyle];
        const res = await fetch(`${API_BASE_URL}/settings`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([{ key: "SEAMLESS_CUSTOM_STYLES", value: JSON.stringify(updated) }]),
        });
        if (!res.ok) throw new Error(`Error guardando estilo: ${res.status}`);
        setCustomStyles(updated);
        toast.success(`Estilo "${newStyle.label}" creado · disponible en Motor`);
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

    useEffect(() => { void loadCustomStyles(); void loadCustomPalettes(); }, [loadCustomStyles, loadCustomPalettes]);

    // Socket — connect once for the lifetime of this component
    useEffect(() => {
        const socket = createApiSocket(API_BASE_URL);
        patternSocketRef.current = socket;

        socket.on("pattern:log", (data: { jobId: string; level: string; message: string; timestamp: string }) => {
            setGenerationLogs(prev => [...prev, { level: data.level, message: data.message, timestamp: data.timestamp ?? new Date().toISOString() }]);
        });

        socket.on("pattern:complete", () => {
            fetch(`${API_BASE_URL}/settings`)
                .then(r => r.json())
                .then(({ settings }: any) => {
                    const row = (settings as any[]).find((s: any) => s.key === "SEAMLESS_PATTERN_DRAFT");
                    if (row?.value && row.value !== "null") {
                        const d = JSON.parse(row.value);
                        if (d?.dataUrl) {
                            setGeneratedUrl(d.dataUrl);
                            setPromptUsed(d.promptUsed ?? "");
                            setSeed(d.seed ?? 0);
                            // Restore style/palette from draft so savePattern uses the correct association
                            if (d.styleId) {
                                const allStyles = [...PATTERN_STYLES, ...(patternSocketRef.current ? [] : [])];
                                const found = allStyles.find(s => s.id === d.styleId);
                                const restoredStyle = found ?? { id: d.styleId, label: d.styleLabel ?? d.styleId, prompt: "", neg: "", emoji: "🎨" };
                                generatedStyleRef.current = restoredStyle;
                            }
                            if (d.paletteId) {
                                const found = COLOR_PALETTES.find(p => p.id === d.paletteId);
                                const restoredPalette = found ?? { id: d.paletteId, label: d.paletteLabel ?? d.paletteId, colors: [], prompt: "" };
                                generatedPaletteRef.current = restoredPalette;
                            }
                        }
                    }
                })
                .catch(() => {})
                .finally(() => {
                    setIsGenerating(false);
                    setIsDraftLoaded(false);
                    toast.success("Patrón generado");
                });
        });

        socket.on("pattern:error", (data: { message: string }) => {
            setIsGenerating(false);
            toast.error(data.message ?? "Error generando patrón");
        });

        return () => {
            socket.disconnect();
            patternSocketRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-scroll logs terminal
    useEffect(() => {
        if (logsEndRef.current && generationLogs.length > 0) {
            const container = logsEndRef.current.parentElement;
            if (container) container.scrollTop = container.scrollHeight;
        }
    }, [generationLogs]);

    // Restore on mount: check for running job OR existing draft
    useEffect(() => {
        const restore = async () => {
            try {
                const jobRes = await fetch(`${API_BASE_URL}/patterns/gen-jobs/latest`);
                const { job } = await jobRes.json();
                if (job?.status === "running") {
                    setIsGenerating(true);
                    setGenerationJobId(job.jobId);
                    setGenerationLogs((job.logs ?? []).map((l: any) => ({
                        level: l.level, message: l.message, timestamp: new Date(l.timestamp).toISOString(),
                    })));
                    return; // socket will deliver completion
                }
                // Load existing draft (completed or older generation)
                const settingsRes = await fetch(`${API_BASE_URL}/settings`);
                const { settings } = await settingsRes.json();
                const modelRow = (settings as any[]).find((s: any) => s.key === "AUTOPILOT_IMAGE_MODEL");
                if (modelRow?.value) {
                    try {
                        const saved = JSON.parse(modelRow.value);
                        if (saved?.id && AI_MODELS.some(m => m.id === saved.id)) setSelectedModelId(saved.id);
                    } catch { /* ignore */ }
                }
                const row = (settings as any[]).find((s: any) => s.key === "SEAMLESS_PATTERN_DRAFT");
                if (row?.value && row.value !== "null") {
                    const d = JSON.parse(row.value);
                    if (d?.dataUrl) {
                        setGeneratedUrl(d.dataUrl);
                        setPromptUsed(d.promptUsed ?? "");
                        setSeed(d.seed ?? seed);
                        setIsDraftLoaded(true);
                        // Restore style/palette refs so savePattern uses the correct association
                        if (d.styleId) {
                            const found = PATTERN_STYLES.find(s => s.id === d.styleId);
                            generatedStyleRef.current = found ?? { id: d.styleId, label: d.styleLabel ?? d.styleId, prompt: "", neg: "", emoji: "🎨" };
                        }
                        if (d.paletteId) {
                            const found = COLOR_PALETTES.find(p => p.id === d.paletteId);
                            generatedPaletteRef.current = found ?? { id: d.paletteId, label: d.paletteLabel ?? d.paletteId, colors: [], prompt: "" };
                        }
                    }
                }
            } catch {}
        };
        void restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync selected image model to MongoDB on change (Redux persist handles localStorage)
    useEffect(() => {
        const model = AI_MODELS.find(m => m.id === selectedModelId);
        if (!model) return;
        fetch(`${API_BASE_URL}/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: "AUTOPILOT_IMAGE_MODEL", value: JSON.stringify({ id: model.id, name: model.name, provider: model.provider, modelId: model.modelId }) }),
        }).catch(() => {});
    }, [selectedModelId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (activeTab === "insights" || activeTab === "galeria") void loadPatterns();
    }, [activeTab, loadPatterns]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxPattern(null); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    // Build prompt
    const buildPrompt = () => {
        const isGenericCustom = selectedStyle.id === "custom";
        const base = isGenericCustom ? customPrompt : selectedStyle.prompt;
        const negBase = isGenericCustom ? customNeg : selectedStyle.neg;
        const prompt = [base, selectedPalette.prompt, "seamless tileable repeat pattern tile, no borders, no frame, professional surface design"].filter(Boolean).join(", ");
        const neg = [negBase, "text, watermark, seams visible, border, frame, low quality"].filter(Boolean).join(", ");
        return { prompt, neg };
    };

    const generate = async (overrideSeed?: number) => {
        const { prompt, neg } = buildPrompt();
        if (!prompt.trim()) { toast.error("Define un estilo o escribe un prompt"); return; }
        const usedSeed = overrideSeed ?? seed;
        // Capture style/palette at generation time so savePattern() always uses the correct values
        generatedStyleRef.current = selectedStyle;
        generatedPaletteRef.current = selectedPalette;
        setIsGenerating(true);
        setGeneratedUrl(null);
        setOffsetUrl(null);
        setTileableUrl(null);
        setPromptUsed(prompt);
        setGenerationLogs([]);
        try {
            const res = await fetch(`${API_BASE_URL}/patterns/generate-job`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt, negativePrompt: neg,
                    modelId: currentModel.modelId, provider: currentModel.provider,
                    seed: usedSeed, width: 1024, height: 1024,
                    styleId: selectedStyle.id, styleLabel: selectedStyle.label,
                    paletteId: selectedPalette.id, paletteLabel: selectedPalette.label,
                }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error iniciando generación"); }
            const { jobId } = await res.json();
            setGenerationJobId(jobId);
            setShowTiled(false);
            // result comes via pattern:complete socket event
        } catch (e: any) {
            toast.error(e.message ?? "Error generando patrón");
            setIsGenerating(false);
        }
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
            const dataUrl = generatedUrl.startsWith("data:") ? generatedUrl : await blobUrlToDataUrl(generatedUrl);
            // Use refs (captured at generate time) not current selection, to avoid wrong associations
            const saveStyle = generatedStyleRef.current;
            const savePalette = generatedPaletteRef.current;
            const res = await fetch(`${API_BASE_URL}/patterns`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dataUrl,
                    prompt: promptUsed,
                    style: saveStyle.id,
                    styleLabel: saveStyle.label,
                    palette: savePalette.id,
                    paletteLabel: savePalette.label,
                    modelName: currentModel.name,
                    seed,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Error guardando");
            setPatterns(prev => [data.pattern, ...prev]);
            toast.success(`Patrón guardado en Galería · ${saveStyle.label}`);
            // Clear the draft since it's now saved to gallery
            fetch(`${API_BASE_URL}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ key: "SEAMLESS_PATTERN_DRAFT", value: "null" }]) }).catch(() => {});
            setIsDraftLoaded(false);
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

    const handleApplyOffset = async () => {
        const src = generatedUrl;
        if (!src) return;
        setIsApplyingOffset(true);
        try {
            const dataUrl = src.startsWith("data:") ? src : await blobUrlToDataUrl(src);
            const result = await applyOffsetWrap(dataUrl);
            setOffsetUrl(result);
            setTileableUrl(null);
            toast.success("Offset aplicado · la costura está ahora en el centro");
        } catch { toast.error("Error aplicando offset"); }
        finally { setIsApplyingOffset(false); }
    };

    const handleFixSeam = async () => {
        const src = offsetUrl ?? (generatedUrl?.startsWith("data:") ? generatedUrl : null);
        if (!src) return;
        setIsFixingSeam(true);
        try {
            const result = await fixSeamCanvas(src);
            setTileableUrl(result);
            toast.success("Costura suavizada · patrón listo para exportar");
        } catch { toast.error("Error corrigiendo costura"); }
        finally { setIsFixingSeam(false); }
    };

    const handleExportPOD = async (platform: typeof PLATFORM_SPECS[number]) => {
        const src = tileableUrl ?? offsetUrl ?? (generatedUrl?.startsWith("data:") ? generatedUrl : null);
        if (!src) return;
        setIsExportingPOD(platform.name);
        try {
            const dataUrl = src.startsWith("data:") ? src : await blobUrlToDataUrl(src);
            const resized = await resizeForPOD(dataUrl, platform.exportW, platform.exportH);
            const a = document.createElement("a");
            a.href = resized;
            a.download = `pattern-${platform.name.toLowerCase().replace(/\s+/g, "-")}-${platform.exportW}x${platform.exportH}.png`;
            a.click();
            toast.success(`Exportado para ${platform.name} · ${platform.exportW}×${platform.exportH}px`);
        } catch { toast.error("Error exportando"); }
        finally { setIsExportingPOD(null); }
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
                        <span className="text-[11px] font-black text-white uppercase tracking-widest flex-1">Estilo</span>
                        <button onClick={() => setShowNewStyleForm(v => !v)}
                            title="Crear estilo propio"
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all border ${showNewStyleForm ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "border-white/10 bg-white/[0.04] text-neutral-500 hover:text-white"}`}>
                            {showNewStyleForm ? <X size={10} /> : <Plus size={10} />}
                        </button>
                    </div>

                    {/* New style form */}
                    {showNewStyleForm && (
                        <div className="px-4 py-3 border-b border-white/[0.06] space-y-2 bg-violet-500/[0.04]">
                            <p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Nuevo estilo</p>
                            <div className="flex gap-2">
                                <input value={newStyleEmoji} onChange={e => setNewStyleEmoji(e.target.value)}
                                    placeholder="🎨" maxLength={2}
                                    className="w-12 h-8 px-2 bg-white/5 border border-white/10 rounded-xl text-[14px] text-center text-white focus:outline-none focus:border-violet-500/40" />
                                <input value={newStyleLabel} onChange={e => setNewStyleLabel(e.target.value)}
                                    placeholder="Nombre del estilo"
                                    className="flex-1 h-8 px-3 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                            </div>
                            <textarea value={newStylePrompt} onChange={e => setNewStylePrompt(e.target.value)}
                                placeholder="Prompt en inglés: seamless ... repeat pattern..." rows={2}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 resize-none leading-relaxed" />
                            <input value={newStyleNeg} onChange={e => setNewStyleNeg(e.target.value)}
                                placeholder="Negative prompt (opcional)"
                                className="w-full h-8 px-3 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                            <button onClick={() => void saveCustomStyle()} disabled={isSavingStyle}
                                className="w-full h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 text-[9px] font-black text-violet-300 hover:bg-violet-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                                {isSavingStyle ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                Guardar estilo
                            </button>
                        </div>
                    )}

                    <div className="p-3 grid grid-cols-3 gap-1.5">
                        {PATTERN_STYLES.map(s => (
                            <button key={s.id} onClick={() => setSelectedStyle(s)}
                                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all ${selectedStyle.id === s.id ? "border-violet-500/50 bg-violet-500/15 text-violet-300" : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-white hover:bg-white/6"}`}>
                                <span className="text-base leading-none">{s.emoji}</span>
                                <span className="text-[8px] font-black truncate w-full text-center">{s.label}</span>
                            </button>
                        ))}
                        {/* User-defined custom styles */}
                        {customStyles.map(s => (
                            <div key={s.id} className="relative group/cs">
                                <button onClick={() => setSelectedStyle(s as any)}
                                    className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all ${selectedStyle.id === s.id ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-300" : "border-indigo-500/20 bg-indigo-500/[0.05] text-neutral-500 hover:text-white hover:bg-indigo-500/10"}`}>
                                    <span className="text-base leading-none">{s.emoji}</span>
                                    <span className="text-[8px] font-black truncate w-full text-center">{s.label}</span>
                                </button>
                                <button onClick={() => void deleteCustomStyle(s.id)}
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black border border-white/20 text-neutral-600 hover:text-rose-400 items-center justify-center hidden group-hover/cs:flex transition-colors">
                                    <X size={8} />
                                </button>
                            </div>
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
                        <span className="text-[11px] font-black text-white uppercase tracking-widest flex-1">Paleta</span>
                        <button
                            onClick={() => void generatePalette()}
                            disabled={isGeneratingPalette}
                            title="Generar paleta con IA basada en el estilo seleccionado"
                            className="flex items-center gap-1 h-6 px-2 rounded-lg border border-pink-500/25 bg-pink-500/10 text-[8px] font-black text-pink-300 hover:bg-pink-500/20 transition-all disabled:opacity-50">
                            {isGeneratingPalette ? <Loader2 size={9} className="animate-spin" /> : <Wand2 size={9} />}
                            IA
                        </button>
                        <button onClick={() => setShowNewPaletteForm(v => !v)}
                            title="Crear paleta personalizada"
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all border ${showNewPaletteForm ? "bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300" : "border-white/10 bg-white/[0.04] text-neutral-500 hover:text-white"}`}>
                            {showNewPaletteForm ? <X size={10} /> : <Plus size={10} />}
                        </button>
                    </div>

                    {/* New palette form */}
                    {showNewPaletteForm && (
                        <div className="px-4 py-3 border-b border-white/[0.06] space-y-3 bg-fuchsia-500/[0.04]">
                            <p className="text-[9px] font-black uppercase tracking-widest text-fuchsia-400">Nueva paleta</p>
                            <input value={newPaletteLabel} onChange={e => setNewPaletteLabel(e.target.value)}
                                placeholder="Nombre de la paleta"
                                className="w-full h-8 px-3 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-fuchsia-500/40" />
                            <div className="flex gap-2 items-center">
                                {newPaletteColors.map((c, i) => (
                                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                                        <label
                                            className="w-full h-8 rounded-lg cursor-pointer overflow-hidden border-2 border-white/20 hover:border-white/50 transition-all relative"
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        >
                                            <input
                                                type="color"
                                                value={c}
                                                onChange={e => setNewPaletteColors(prev => prev.map((col, j) => j === i ? e.target.value : col))}
                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                            />
                                        </label>
                                        <span className="text-[7px] font-mono text-neutral-600">{c}</span>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => void saveCustomPalette()} disabled={isSavingPalette}
                                className="w-full h-8 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 text-[9px] font-black text-fuchsia-300 hover:bg-fuchsia-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                                {isSavingPalette ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                Guardar paleta
                            </button>
                        </div>
                    )}

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
                        {/* Custom palettes generated by AI */}
                        {customPalettes.map(p => (
                            <div key={p.id} className="relative group/cp">
                                <button onClick={() => setSelectedPalette(p as any)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${selectedPalette.id === p.id ? "border-fuchsia-500/40 bg-fuchsia-500/10" : "border-fuchsia-500/15 bg-fuchsia-500/[0.04] hover:bg-fuchsia-500/10"}`}>
                                    <div className="flex gap-0.5 shrink-0">
                                        {p.colors.map((c, i) => <div key={i} className="w-4 h-4 rounded-sm first:rounded-l-lg last:rounded-r-lg" style={{ backgroundColor: c }} />)}
                                    </div>
                                    <span className={`text-[10px] font-black ${selectedPalette.id === p.id ? "text-fuchsia-300" : "text-neutral-500"}`}>{p.label}</span>
                                    {selectedPalette.id === p.id && <Check size={10} className="text-fuchsia-400 ml-auto" />}
                                </button>
                                <button onClick={() => void deleteCustomPalette(p.id)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-black border border-white/20 text-neutral-600 hover:text-rose-400 items-center justify-center hidden group-hover/cp:flex transition-colors">
                                    <X size={8} />
                                </button>
                            </div>
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
                                    {models.map(m => {
                                            const sDotCls = ({ ok: "bg-emerald-400", limited: "bg-amber-400", paid: "bg-orange-400", blocked: "bg-red-500" } as Record<string,string>)[m.status] ?? "bg-neutral-500";
                                            return (
                                            <button key={m.id} onClick={() => { setSelectedModelId(m.id); setShowModelPicker(false); }}
                                                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all border-b border-white/[0.03] last:border-0 ${selectedModelId === m.id ? "bg-sky-500/10 text-sky-300" : "hover:bg-white/[0.04] text-neutral-400"}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sDotCls}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black">{m.name}</p>
                                                    <p className="text-[8px] text-neutral-600">{m.type}</p>
                                                </div>
                                                {selectedModelId === m.id && <Check size={10} className="text-sky-400 shrink-0" />}
                                            </button>
                                            );
                                        })}
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
                        {isDraftLoaded && !isGenerating && (
                            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-400">
                                Borrador restaurado
                            </span>
                        )}
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
                            <div className="w-full flex flex-col gap-3 p-5">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                                        <Loader2 size={14} className="text-violet-400 animate-spin" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-white">Generando en segundo plano…</p>
                                        <p className="text-[8px] text-neutral-600">{selectedStyle.label} · {selectedPalette.label} · {currentModel.name}</p>
                                    </div>
                                </div>
                                <div className="w-full bg-black/80 rounded-xl border border-white/[0.06] overflow-y-auto max-h-[260px] p-3 font-mono text-[9px] space-y-0.5">
                                    {generationLogs.length === 0 ? (
                                        <p className="text-neutral-700 italic">Iniciando job…</p>
                                    ) : (
                                        generationLogs.map((log, i) => (
                                            <div key={i} className={`flex gap-2 leading-relaxed ${log.level === "error" ? "text-red-400" : log.level === "success" ? "text-emerald-400" : log.level === "warning" ? "text-amber-400" : "text-neutral-500"}`}>
                                                <span className="shrink-0 text-neutral-700">{new Date(log.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                                                <span className="break-all">{log.message}</span>
                                            </div>
                                        ))
                                    )}
                                    <div ref={logsEndRef} />
                                </div>
                                <p className="text-[8px] text-neutral-700 text-center">Puedes navegar — el motor sigue ejecutándose en segundo plano</p>
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

                {/* ── Tileable Pipeline ── */}
                {generatedUrl && !isGenerating && (
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] overflow-hidden">
                        <div className="px-4 py-3 border-b border-violet-500/10 flex items-center gap-2">
                            <Wand2 size={13} className="text-violet-400" />
                            <span className="text-[11px] font-black text-white uppercase tracking-widest flex-1">Tileable Profesional</span>
                            <span className="text-[8px] text-neutral-600 italic">Algoritmo Offset</span>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Steps */}
                            <div className="grid grid-cols-1 gap-3">

                                {/* Step 1: Offset */}
                                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 text-[9px] font-black text-violet-300 flex items-center justify-center shrink-0">1</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-white">Aplicar Offset 50%</p>
                                            <p className="text-[8px] text-neutral-600">Desplaza la imagen ½ horizontal + ½ vertical — la costura pasa al centro</p>
                                        </div>
                                        {offsetUrl && <Check size={12} className="text-emerald-400 shrink-0" />}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => void handleApplyOffset()}
                                            disabled={isApplyingOffset}
                                            className="flex items-center gap-1.5 h-7 px-3 rounded-xl bg-violet-500/15 border border-violet-500/25 text-[9px] font-black text-violet-300 hover:bg-violet-500/25 transition-all disabled:opacity-50">
                                            {isApplyingOffset ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
                                            {offsetUrl ? "Re-aplicar" : "Aplicar offset"}
                                        </button>
                                        {offsetUrl && (
                                            <span className="text-[8px] text-emerald-400 font-black">✓ Listo</span>
                                        )}
                                    </div>
                                    {offsetUrl && (
                                        <div className="rounded-lg overflow-hidden border border-white/[0.06]" style={{ background: "repeating-conic-gradient(#0a0a0a 0% 25%, #111 0% 50%) 0 0 / 12px 12px" }}>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)" }}>
                                                {[0,1,2,3].map(i => <img key={i} src={offsetUrl} alt="" className="w-full aspect-square object-cover" />)}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Seam Fix */}
                                <div className={`rounded-xl border p-3 space-y-2.5 transition-all ${offsetUrl ? "border-white/8 bg-white/[0.02]" : "border-white/4 bg-white/[0.01] opacity-50 pointer-events-none"}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 text-[9px] font-black text-sky-300 flex items-center justify-center shrink-0">2</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-white">Corregir Costura</p>
                                            <p className="text-[8px] text-neutral-600">Suaviza la zona central donde la unión es visible</p>
                                        </div>
                                        {tileableUrl && <Check size={12} className="text-emerald-400 shrink-0" />}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            onClick={() => void handleFixSeam()}
                                            disabled={!offsetUrl || isFixingSeam}
                                            className="flex items-center gap-1.5 h-7 px-3 rounded-xl bg-sky-500/15 border border-sky-500/25 text-[9px] font-black text-sky-300 hover:bg-sky-500/25 transition-all disabled:opacity-50">
                                            {isFixingSeam ? <Loader2 size={9} className="animate-spin" /> : <Wand2 size={9} />}
                                            Suavizar costura
                                        </button>
                                        {tileableUrl && (
                                            <button
                                                onClick={() => downloadPattern(tileableUrl, `pattern-tileable-${seed}.png`)}
                                                className="flex items-center gap-1.5 h-7 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-[9px] font-black text-emerald-300 hover:bg-emerald-500/25 transition-all">
                                                <Download size={9} /> Descargar tile
                                            </button>
                                        )}
                                    </div>
                                    {tileableUrl && (
                                        <div className="rounded-lg overflow-hidden border border-emerald-500/20" style={{ background: "repeating-conic-gradient(#0a0a0a 0% 25%, #111 0% 50%) 0 0 / 12px 12px" }}>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
                                                {[0,1,2,3,4,5,6,7,8].map(i => <img key={i} src={tileableUrl} alt="" className="w-full aspect-square object-cover" />)}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Step 3: POD Export */}
                                <div className={`rounded-xl border p-3 space-y-2.5 transition-all ${(tileableUrl ?? offsetUrl) ? "border-white/8 bg-white/[0.02]" : "border-white/4 bg-white/[0.01] opacity-50 pointer-events-none"}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[9px] font-black text-amber-300 flex items-center justify-center shrink-0">3</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-white">Exportar para POD</p>
                                            <p className="text-[8px] text-neutral-600">Escala al tamaño requerido por cada plataforma (tileado)</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {PLATFORM_SPECS.map(p => (
                                            <button key={p.name}
                                                onClick={() => void handleExportPOD(p)}
                                                disabled={!!isExportingPOD}
                                                title={p.tip}
                                                className="flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/15 transition-all disabled:opacity-50 text-left">
                                                {isExportingPOD === p.name
                                                    ? <Loader2 size={9} className="animate-spin text-neutral-500 mb-0.5" />
                                                    : <Download size={9} className={`mb-0.5 ${p.color}`} />}
                                                <span className={`text-[9px] font-black ${p.color}`}>{p.name}</span>
                                                <span className="text-[7px] text-neutral-700 font-mono leading-tight">{p.specs}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                )}
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
                    {filteredPatterns.map(p => (
                        <div key={p._id} className="group relative rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
                            {/* Image — click opens lightbox */}
                            <div className="relative aspect-square overflow-hidden cursor-zoom-in"
                                onClick={() => { setLightboxPattern(p); setLightboxTile("2x2"); }}>
                                <img src={p.url} alt={p.styleLabel} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />

                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex items-center gap-0.5 bg-white/10 border border-white/20 rounded-lg px-2 py-1">
                                            <Grid size={10} className="text-white" />
                                            <span className="text-[8px] font-black text-white ml-1">Ver</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button onClick={e => { e.stopPropagation(); downloadPattern(p.url, `pattern-${p.style}-${p._id}.png`); }}
                                            className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/25 transition-all">
                                            <Download size={11} />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(p._id); }}
                                            className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center hover:bg-rose-500/30 transition-all">
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                </div>
                            </div>

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
                    ))}
                </div>
            )}

            {/* ── Lightbox ── */}
            {lightboxPattern && (
                <div
                    className="fixed inset-0 z-[9999] flex flex-col"
                    style={{ background: "rgba(0,0,0,0.96)" }}
                    onClick={() => setLightboxPattern(null)}
                >
                    {/* Top bar */}
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] shrink-0"
                        onClick={e => e.stopPropagation()}>
                        {/* Tile mode chips */}
                        <div className="flex items-center gap-1.5">
                            {(["1x1","2x2","3x3"] as TileMode[]).map(t => (
                                <button key={t} onClick={() => setLightboxTile(t)}
                                    className={`h-7 px-3 rounded-xl border text-[9px] font-black transition-all ${lightboxTile === t ? "border-violet-500/50 bg-violet-500/20 text-violet-300" : "border-white/10 bg-white/[0.04] text-neutral-500 hover:text-white"}`}>
                                    {t}
                                </button>
                            ))}
                        </div>

                        {/* Meta */}
                        <div className="flex-1 min-w-0 px-2 hidden sm:block">
                            <p className="text-[11px] font-black text-white truncate">
                                {PATTERN_STYLES.find(s => s.id === lightboxPattern.style)?.emoji}{" "}
                                {lightboxPattern.styleLabel} · {lightboxPattern.paletteLabel}
                            </p>
                            <p className="text-[9px] text-neutral-600 truncate">{lightboxPattern.modelName} · seed {lightboxPattern.seed}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={() => downloadPattern(lightboxPattern.url, `pattern-${lightboxPattern.style}-${lightboxPattern._id}.png`)}
                                className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-[9px] font-black text-emerald-300 hover:bg-emerald-500/25 transition-all">
                                <Download size={11} /> Descargar
                            </button>
                            <button
                                onClick={() => { setDeleteConfirmId(lightboxPattern._id); setLightboxPattern(null); }}
                                className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 text-neutral-600 hover:text-rose-400 hover:border-rose-500/25 flex items-center justify-center transition-all">
                                <Trash2 size={13} />
                            </button>
                            <button onClick={() => setLightboxPattern(null)}
                                className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 text-neutral-500 hover:text-white flex items-center justify-center transition-all">
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Image area */}
                    <div
                        className="flex-1 overflow-auto flex items-start justify-center p-4"
                        style={{ background: "repeating-conic-gradient(#0d0d0d 0% 25%, #141414 0% 50%) 0 0 / 24px 24px" }}
                        onClick={e => e.stopPropagation()}
                    >
                        {(() => {
                            const cols = lightboxTile === "1x1" ? 1 : lightboxTile === "2x2" ? 2 : 3;
                            const count = cols * cols;
                            return (
                                <div
                                    className="w-full max-w-4xl mx-auto"
                                    style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                                >
                                    {[...Array(count)].map((_, i) => (
                                        <img key={i} src={lightboxPattern.url} alt="" className="w-full aspect-square object-cover" />
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Prompt strip */}
                    {lightboxPattern.prompt && (
                        <div className="px-5 py-2.5 border-t border-white/[0.05] flex items-center gap-3 shrink-0"
                            onClick={e => e.stopPropagation()}>
                            <p className="text-[8px] font-black uppercase tracking-widest text-neutral-700 shrink-0">Prompt</p>
                            <p className="text-[9px] text-neutral-600 leading-relaxed flex-1 truncate">{lightboxPattern.prompt}</p>
                            <button onClick={() => { navigator.clipboard.writeText(lightboxPattern.prompt); toast.success("Copiado"); }}
                                className="shrink-0 text-neutral-700 hover:text-neutral-400 transition-colors">
                                <Copy size={10} />
                            </button>
                        </div>
                    )}
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
        // Include custom styles in counts
        const allKnownStyles = [...PATTERN_STYLES.filter(s => s.id !== "custom"), ...customStyles.map(s => ({ ...s, emoji: s.emoji ?? "🎨" }))];
        // Also catch any style stored in patterns that isn't in either list (label fallback)
        const unknownStyleIds = [...new Set(patterns.map(p => p.style).filter(id => id && !allKnownStyles.some(s => s.id === id)))];
        const unknownStyles = unknownStyleIds.map(id => {
            const sample = patterns.find(p => p.style === id);
            return { id, label: sample?.styleLabel ?? id, emoji: "🎨", prompt: "", neg: "" };
        });
        const byStyle = [...allKnownStyles, ...unknownStyles].map(s => ({
            ...s, count: patterns.filter(p => p.style === s.id).length,
        })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

        // Include custom palettes in counts
        const allKnownPalettes = [...COLOR_PALETTES, ...customPalettes];
        const unknownPaletteIds = [...new Set(patterns.map(p => p.palette).filter(id => id && !allKnownPalettes.some(pl => pl.id === id)))];
        const unknownPalettes = unknownPaletteIds.map(id => {
            const sample = patterns.find(p => p.palette === id);
            return { id, label: sample?.paletteLabel ?? id, colors: [] as string[], prompt: "" };
        });
        const byPalette = [...allKnownPalettes, ...unknownPalettes].map(p => ({
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
                    filterTypes={SEAMLESS_PRODUCT_TYPES.map(t => t.id)}
                    onProductsChange={setInsightsProducts}
                />

                {/* ── Plataformas & Distribución (integrations moved here) ── */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-white/[0.05]">
                        <ExternalLink size={13} className="text-neutral-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Plataformas & Distribución</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {PLATFORM_SPECS.map(p => (
                            <div key={p.name} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className={`text-[13px] font-black ${p.color}`}>{p.name}</p>
                                    <span className="text-[8px] font-mono text-neutral-700">{p.exportW}×{p.exportH}</span>
                                </div>
                                <p className="text-[8px] font-mono text-neutral-500 bg-white/[0.04] border border-white/8 px-2 py-1.5 rounded-xl">{p.specs}</p>
                                <p className="text-[9px] text-neutral-600 leading-relaxed">{p.tip}</p>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4 flex items-start gap-2">
                        <Info size={12} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[9px] text-amber-200/60 leading-relaxed">Exporta siempre como PNG sin fondo. Los patrones generados son 1024×1024 px — usa FLUX Schnell o SDXL y escala con Upscaler para resoluciones mayores.</p>
                    </div>
                </div>
            </div>
        );
    };

    // ── Render Tendencias (NicheRadar adapted for pattern styles) ─────────────

    const SEAMLESS_ETSY_PRESETS = [
        { label: "Redbubble Patterns", url: "https://www.redbubble.com/shop/?query=seamless+pattern&sort=top+selling" },
        { label: "Society6 Surface", url: "https://society6.com/art/seamless-pattern" },
        { label: "Spoonflower", url: "https://www.spoonflower.com/designs?query=seamless+pattern" },
    ];

    const SEAMLESS_GENERAL_PRESETS = [
        { label: "Pinterest Patterns", url: "https://www.pinterest.com/search/pins/?q=seamless+pattern+trending" },
        { label: "Etsy Fabric", url: "https://www.etsy.com/search?q=seamless+pattern+fabric+design" },
        { label: "Creative Market", url: "https://creativemarket.com/search?q=seamless+pattern" },
    ];

    const renderTendencias = () => (
        <div className="space-y-6">
            <NicheRadar
                apiUrl={API_BASE_URL}
                storageKey="RADAR_SEAMLESS_RESULT"
                defaultMode="general"
                etsyPresets={SEAMLESS_ETSY_PRESETS}
                generalPresets={SEAMLESS_GENERAL_PRESETS}
                headerTitle={<><span className="text-white">Tendencias de </span><span className="bg-gradient-to-r from-violet-300 to-pink-400 bg-clip-text text-transparent">Estilos</span></>}
                headerSubtitle="Detecta estilos de patrón en tendencia · Powered by Gemini + Playwright · Aplica en el Motor"
                modeLabels={{ etsy: "Búsquedas sugeridas" }}
            />
            <RadarResultsTable
                apiUrl={API_BASE_URL}
                storageKey="RADAR_SEAMLESS_RESULT"
                rowAction={{
                    label: "Estilo",
                    colorScheme: "indigo",
                    isCreated: (row) => customStyles.some(s => s.label === row.sub_nicho_estimado),
                    onCreate: addStyleFromRow,
                }}
            />
        </div>
    );

    return (
        <div className="space-y-12 pb-24">
            <AppTabNav tabs={tabs} activeTab={activeTab} onChange={changeTab} storageKey="seamless-tab" />
            <div className="relative pt-6">
                {activeTab === "motor"      && renderMotor()}
                {activeTab === "galeria"    && renderGaleria()}
                {activeTab === "insights"   && renderInsights()}
                {activeTab === "tendencias" && renderTendencias()}
            </div>
        </div>
    );
}
