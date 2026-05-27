"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PDFDocument, rgb } from "pdf-lib";
import {
    Sparkles,
    Wand2,
    Zap,
    TrendingUp,
    Layers,
    Search,
    BookOpen,
    CheckCircle2,
    Settings,
    Globe,
    BarChart,
    Activity,
    Plus,
    Trash2,
    DollarSign,
    Box,
    FileText,
    Image as ImageIcon,
    Shirt,
    Frame,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    ChevronDown,
    Loader2,
    Camera,
    X,
    Check,
    Cloud,
    UploadCloud,
    Monitor,
    Maximize,
    ChevronRight,
    ChevronLeft,
    Lightbulb,
    Download,
    Store,
    RefreshCw,
    StopCircle,
    ImagePlus,
    Copy,
    BookMarked,
    ChevronUp,
    Type,
    Tag,
    ListOrdered,
    BookText,
    Star,
    Send,
    ArrowRight,
    Newspaper,
    Heart,
    AlignLeft,
    AlignCenter,
    AlignRight,
    GripVertical,
    Pencil,
    Save,
    Clock,
    Target,
    ExternalLink,
    Archive,
    FolderArchive,
    Package,
    Upload,
    AlertTriangle,
    Info,
    ShoppingBag,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { KdpStatCard } from "@/components/ui/kdp-stat-card";
import { KdpVerticalBarChart } from "@/components/ui/kdp-vertical-bar-chart";
import { SectionHeader } from "@/components/ui/section-header";
import { toast } from "sonner";
import { createApiSocket } from "@/lib/socket";
import { NicheRadar } from "@/components/extractor/NicheRadar";
import { AppTabNav, type AppTab } from "@/components/tasks/apps/shared/app-tab-nav";

interface ProductPlatform {
    name: string;
    earnings: number;
    url?: string;
    date?: string;
}

interface DigitalProduct {
    id: string;
    _id?: string;
    type: string;
    title: string;
    description: string;
    status: "activo" | "pausado" | "borrador";
    platforms: ProductPlatform[];
    totalEarnings: number;
    createdAt: string;
    nicheId?: string;
}

const PRODUCT_TYPES = [
    { id: "kdp-color-book", name: "KDP Color Book", icon: <BookOpen size={18} />, color: "text-blue-400", bg: "bg-blue-500/10" },
    { id: "poster-digital", name: "Poster Digital", icon: <ImageIcon size={18} />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { id: "clothing", name: "Patrones para Ropa", icon: <Shirt size={18} />, color: "text-blue-400", bg: "bg-blue-500/10" },
    { id: "frames", name: "Cuadros Imprimibles", icon: <Frame size={18} />, color: "text-rose-400", bg: "bg-rose-500/10" },
    { id: "etsy-products", name: "Productos Etsy", icon: <Store size={18} />, color: "text-orange-400", bg: "bg-orange-500/10" },
    { id: "landing-page-template", name: "Landing Page Template", icon: <FileText size={18} />, color: "text-cyan-400", bg: "bg-cyan-500/10" }
];

const AI_MODELS = [
    { id: "flux-schnell", name: "FLUX.1 [schnell]", provider: "Hugging Face", type: "Ultra High Quality", modelId: "black-forest-labs/FLUX.1-schnell" },
    { id: "flux-dev", name: "FLUX.1 [dev]", provider: "Hugging Face", type: "Higher fidelity (may be gated)", modelId: "black-forest-labs/FLUX.1-dev" },
    { id: "sd-3.5", name: "Stable Diffusion 3.5", provider: "Hugging Face", type: "Versatile", modelId: "stabilityai/stable-diffusion-3.5-large-turbo" },
    { id: "openjourney-v4", name: "OpenJourney v4", provider: "Hugging Face", type: "Artistic/MJ Style", modelId: "prompthero/openjourney" },
    { id: "google-gemini-2-5", name: "Google Gemini 2.5 Flash Image", provider: "Google", type: "Fast image gen", modelId: "gemini-2.5-flash-image" },
    { id: "leonardo", name: "Leonardo (API)", provider: "Leonardo", type: "External API", modelId: "" },

    // Modelos con pesos públicos / licencias abiertas en Hugging Face (mejor base OSS).
    { id: "sdxl-base", name: "Stable Diffusion XL Base 1.0", provider: "Hugging Face", type: "General (OSS weights)", modelId: "stabilityai/stable-diffusion-xl-base-1.0" },
    { id: "sdxl-turbo", name: "SDXL Turbo", provider: "Hugging Face", type: "Fast (OSS weights)", modelId: "stabilityai/sdxl-turbo" },
    { id: "sd-1.5", name: "Stable Diffusion 1.5", provider: "Hugging Face", type: "Classic (OSS weights)", modelId: "runwayml/stable-diffusion-v1-5" },
    { id: "kandinsky-2.2", name: "Kandinsky 2.2", provider: "Hugging Face", type: "Creative", modelId: "ai-forever/Kandinsky-2.2" }
    ,
    // Coloring-book LoRA (SDXL) - puede requerir pipeline con LoRA; si HF Inference no lo soporta, caerá al fallback.
    { id: "coloringbook-redmond", name: "ColoringBook.Redmond (LoRA)", provider: "Hugging Face", type: "Coloring Book (clean lines)", modelId: "artificialguybr/ColoringBookRedmond" },
    { id: "coloringbook-redmond-v2", name: "ColoringBook.Redmond V2 (LoRA)", provider: "Hugging Face", type: "Coloring Book (clean lines)", modelId: "artificialguybr/ColoringBookRedmond-V2" },

    // Pollinations — sin API key, totalmente gratis
    { id: "pollinations-flux", name: "FLUX (Pollinations)", provider: "Pollinations", type: "Gratis · Sin API Key", modelId: "flux" },
    { id: "pollinations-flux-realism", name: "FLUX Realism (Pollinations)", provider: "Pollinations", type: "Gratis · Fotorrealista", modelId: "flux-realism" },
    { id: "pollinations-flux-anime", name: "FLUX Anime (Pollinations)", provider: "Pollinations", type: "Gratis · Anime/Ilustración", modelId: "flux-anime" },
    { id: "pollinations-turbo", name: "Turbo (Pollinations)", provider: "Pollinations", type: "Gratis · Ultra Rápido", modelId: "turbo" },

    // fal.ai — API key requerida ($0.003/img), inferencia muy rápida (<1s)
    { id: "falai-flux-schnell", name: "FLUX Schnell (fal.ai)", provider: "fal.ai", type: "Rápido · $0.003/img", modelId: "fal-ai/flux/schnell" },
    { id: "falai-flux-dev", name: "FLUX Dev (fal.ai)", provider: "fal.ai", type: "Alta calidad · fal.ai", modelId: "fal-ai/flux/dev" },
    { id: "falai-flux-lora-coloring", name: "FLUX LoRA Coloring (fal.ai)", provider: "fal.ai", type: "Línea art · Coloring Book", modelId: "fal-ai/flux/dev/lora" },

    // Segmind — 100 créditos gratis/día, sin tarjeta
    { id: "segmind-flux-schnell", name: "FLUX Schnell (Segmind)", provider: "Segmind", type: "100 gratis/día · Rápido", modelId: "flux-schnell" },
    { id: "segmind-sdxl", name: "SDXL 1.0 (Segmind)", provider: "Segmind", type: "100 gratis/día · General", modelId: "sdxl1.0" },
    { id: "segmind-canny", name: "SDXL Canny (Segmind)", provider: "Segmind", type: "100 gratis/día · Línea art", modelId: "canny-sdxl" },
];

const AI_DIMENSIONS = [
    { id: "sq", name: "Square", ratio: "1:1", width: 1024, height: 1024 },
    { id: "pt", name: "Portrait", ratio: "4:5", width: 896, height: 1152 },
    { id: "p23", name: "Portrait", ratio: "2:3", width: 832, height: 1248 },
    { id: "p34", name: "Portrait", ratio: "3:4", width: 864, height: 1152 },
    { id: "p79", name: "Portrait", ratio: "7:9", width: 896, height: 1152 },
    { id: "v", name: "Vertical", ratio: "9:16", width: 832, height: 1472 },
    { id: "ls", name: "Landscape", ratio: "16:9", width: 1152, height: 648 }
    ,
    // A4 portrait presets (good fit for the PDF export; no deformation, maintains aspect ratio)
    { id: "a4-150", name: "A4 (150 DPI)", ratio: "A4", width: 1240, height: 1754 },
    { id: "a4-200", name: "A4 (200 DPI)", ratio: "A4", width: 1654, height: 2339 },
    { id: "a4-300", name: "A4 (300 DPI)", ratio: "A4", width: 2480, height: 3508 }
];

const PLATFORMS = ["Amazon KDP", "Etsy", "Printify", "Creative Fabrica"];

type TabID = "insights" | "creation" | "studio" | "niches" | "gelato";
type PeriodID = "month" | "6months" | "year" | "all";

type NicheStatus = "found" | "active" | "research" | "archived";
type NicheProductType = "coloring-book" | "printable-poster" | "other";
type NicheStyle = "generic" | "anime" | "illustration" | "children" | "realistic" | "watercolor" | "abstract";

interface NicheRoyaltyEntry {
    month: string;
    sales: number;
    revenue: number;
}

interface NicheFE {
    _id: string;
    name: string;
    description: string;
    tags: string[];
    status: NicheStatus;
    competition: "unknown" | "low" | "medium" | "high";
    demand: "unknown" | "low" | "medium" | "high";
    productType: NicheProductType;
    styleCategory: NicheStyle;
    styleCategories?: NicheStyle[];
    notes: string;
    generatedPrompt?: string;
    catalogIds?: string[];
    phase?: "niche" | "catalog" | "pdf" | "published";
    publishedAt?: string;
    asin?: string;
    etsyUrl?: string;
    gumroadUrl?: string;
    sourceTitulo?: string;
    royalties?: NicheRoyaltyEntry[];
    createdAt: string;
}

const NICHE_STYLE_OPTIONS: { id: NicheStyle; label: string; desc: string }[] = [
    { id: "generic", label: "Dibujo genérico", desc: "Estilo versátil y limpio" },
    { id: "anime", label: "Anime", desc: "Estilo japonés animado" },
    { id: "illustration", label: "Ilustración", desc: "Estilo artístico/MJ" },
    { id: "children", label: "Dibujos para niños", desc: "Líneas limpias, coloreables" },
    { id: "realistic", label: "Imagen realista", desc: "Fotorrealista" },
    { id: "watercolor", label: "Acuarela", desc: "Estilo pintura acuarela" },
    { id: "abstract", label: "Abstracto", desc: "Arte abstracto" },
];

const NICHE_STYLE_MODEL: Record<NicheStyle, string> = {
    generic: "pollinations-flux",
    anime: "pollinations-flux-anime",
    illustration: "openjourney-v4",
    children: "coloringbook-redmond-v2",
    realistic: "pollinations-flux-realism",
    watercolor: "openjourney-v4",
    abstract: "pollinations-flux",
};

const NICHE_STYLE_TO_COVER: Record<NicheStyle, { style: string; colorTheme: string }> = {
    generic:      { style: "clean professional illustration, detailed decorative artwork, elegant composition",       colorTheme: "soft blue and white" },
    anime:        { style: "anime manga illustration, vibrant colors, Japanese art style, bold linework",             colorTheme: "vibrant pink and purple" },
    illustration: { style: "detailed artistic illustration, painterly fantasy art, rich textures",                    colorTheme: "deep forest green and gold" },
    children:     { style: "cute children's book illustration, bright cheerful colors, friendly characters",          colorTheme: "pastel rainbow colors" },
    realistic:    { style: "photorealistic detailed illustration, professional artwork, cinematic lighting",           colorTheme: "warm earth tones, natural colors" },
    watercolor:   { style: "soft watercolor painting, artistic brushstrokes, delicate washes, paper texture",         colorTheme: "soft pastels and cream" },
    abstract:     { style: "abstract geometric patterns, decorative mandala ornamental design, intricate linework",   colorTheme: "deep blue and gold" },
};

// Coloring book prompt templates — theme/specs/details are FIXED; AI decides only "particulars"
const COLORING_BOOK_TEMPLATE = {
    anime: {
        theme: (name: string) => `Iconic coloring page ${name} anime version.`,
        specs: "Funny Iconic coloring page, anime cartoon style, ultra thick clean black outlines, white background, high contrast, zero shading, zero stippling, zero gradients.",
        details: "Anime inspiration, no shadow, no grey, add more details behind the person and the scene",
    },
    default: {
        theme: (name: string) => `Iconic coloring page ${name}.`,
        specs: "Funny Iconic coloring page, ultra thick clean black outlines, white background, high contrast, zero shading, zero stippling, zero gradients.",
        details: "No shadow, no grey, add more details behind the person and the scene",
    },
};
const ANIME_STYLES: NicheStyle[] = ["anime", "children", "illustration"];

function buildColoringBookPromptParts(nicheName: string, style: NicheStyle, particulars: string) {
    const isAnime = ANIME_STYLES.includes(style);
    const tpl = isAnime ? COLORING_BOOK_TEMPLATE.anime : COLORING_BOOK_TEMPLATE.default;
    const theme = tpl.theme(nicheName);
    return {
        theme,
        specs: tpl.specs,
        details: tpl.details,
        particulars,
        fullPrompt: [theme, tpl.specs, tpl.details, particulars].filter(Boolean).join(" "),
    };
}

const NICHE_PRODUCT_OPTIONS: { id: NicheProductType; label: string }[] = [
    { id: "coloring-book", label: "Libro de colorear" },
    { id: "printable-poster", label: "Poster imprimible" },
    { id: "other", label: "Otro" },
];

interface CatalogImageFE {
    publicId: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
    createdAt: string;
}

interface IACatalogFE {
    _id: string;
    name: string;
    prompt: string;
    promptParts?: { theme: string; specs: string; details: string; particulars: string };
    productType?: "coloring-book" | "printable-poster" | "other";
    creativity?: number;
    negativePrompt?: string;
    aiModel: { id: string; name: string; provider: string; modelId: string };
    width: number;
    height: number;
    totalImages: number;
    images: CatalogImageFE[];
    status: "queued" | "pending" | "running" | "completed" | "failed" | "cancelled";
    lastError?: string;
    skippedImages?: number;
    nicheIds?: string[];
    currentPrompt?: string;
    createdAt: string;
}

interface SavedPromptFE {
    _id: string;
    name: string;
    category: string;
    promptParts: { theme: string; specs: string; details: string; particulars: string };
    aiModel?: { id: string; name: string; provider: string; modelId: string };
    createdAt: string;
}

const DEFAULT_PROMPT_CATEGORIES = ["General", "Anime", "Mandala", "Acuarela", "Ilustración", "Arte Digital", "Coloring Book", "Fotografía", "Retrato", "Paisaje", "Abstracto", "Cómic"];

interface PageTextStyle {
    content: string;
    bold: boolean;
    italic: boolean;
    fontSize: number;
    color: string;
    align: "left" | "center" | "right";
    verticalAlign: "top" | "middle" | "bottom";
    fontFamily: "helvetica" | "times" | "courier";
}

interface BookPage {
    id: string;
    type: "image" | "text" | "both" | "owner";
    image?: { url: string; scale: number; label?: string; border?: { width: number; color: string } };
    text: PageTextStyle;
}

interface FavoriteImage {
    url: string;
    label: string;
    source: "vault" | "catalog" | "cloudinary" | "generated";
    savedAt: string;
}

const defaultTextStyle = (): PageTextStyle => ({
    content: "", bold: false, italic: false, fontSize: 14, color: "#333333", align: "center", verticalAlign: "middle", fontFamily: "helvetica",
});

function KdpSelect({ value, onChange, options, accent = "white" }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    accent?: "white" | "violet" | "amber";
}) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);
    const current = options.find(o => o.value === value);
    const ringCls = accent === "violet" ? "border-sky-500/50 bg-sky-500/5" : accent === "amber" ? "border-amber-500/50 bg-amber-500/5" : "border-white/20 bg-white/5";
    const activeCls = accent === "violet" ? "text-sky-300 bg-sky-500/10" : accent === "amber" ? "text-amber-300 bg-amber-500/10" : "text-white bg-white/10";
    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-bold text-white transition-all bg-white/[0.03] border-white/8 hover:${ringCls} ${open ? ringCls : ""}`}>
                <span>{current?.label ?? value}</span>
                <ChevronDown size={12} className={`text-neutral-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    {options.map(opt => (
                        <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-[11px] font-medium transition-colors hover:bg-white/5 ${opt.value === value ? activeCls : "text-neutral-300"}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Gelato Upload Modal ───────────────────────────────────────────────────────
const WIRE_O_UID = "wire-o-multi-page-brochures_pf_a4_pt_115-gsm-uncoated_cl_4-4_bt_wire-o-left_cpt_300-gsm-uncoated_ver";

const MAX_GELATO_PAGES = 148; // max even image pages per PDF (+ owner page = 149 total, within 150 limit)

function GelatoUploadModal({
    bookPages,
    bookFileName,
    buildPdf,
    apiUrl,
    onClose,
}: {
    bookPages: BookPage[];
    bookFileName: string;
    buildPdf: (pages?: BookPage[]) => Promise<Uint8Array | null>;
    apiUrl: string;
    onClose: () => void;
}) {
    const pageCount = bookPages.length;
    const needsSplit = pageCount > MAX_GELATO_PAGES;
    // Build even-sized chunks of max MAX_GELATO_PAGES content pages.
    // Each PDF will be: owner page (1) + blank separator (1) + chunk pages (even) = even total.
    const chunks: BookPage[][] = [];
    if (needsSplit) {
        let i = 0;
        while (i < bookPages.length) {
            let end = Math.min(i + MAX_GELATO_PAGES, bookPages.length);
            // ensure even content count
            if ((end - i) % 2 !== 0) {
                if (end < bookPages.length) end--;   // trim last to keep even
                else end--;                          // last chunk: drop one rather than overflow
                if (end <= i) end = i + 2;          // floor at 2 if near end
            }
            chunks.push(bookPages.slice(i, Math.min(end, bookPages.length)));
            i = end;
        }
    }
    // blank page inserted after owner page so images always start on a right-side (odd) page
    const blankSeparator: BookPage = {
        id: "__blank-sep__",
        type: "image",
        text: { content: "", bold: false, italic: false, fontSize: 14, color: "#333333", align: "center", verticalAlign: "middle", fontFamily: "helvetica" },
    };
    const validPageCount = Math.max(20, pageCount % 2 === 0 ? pageCount : pageCount + 1);
    const isValidForWireO = pageCount >= 20;

    // Manual flow
    const [manualGenerating, setManualGenerating] = useState(false);
    const [manualDone, setManualDone] = useState(false);
    const [manualError, setManualError] = useState("");

    // Auto flow
    type AutoStep = "idle" | "generating" | "uploading" | "done" | "error";
    const [autoStep, setAutoStep] = useState<AutoStep>("idle");
    const [autoLog, setAutoLog] = useState<string[]>([]);
    const [autoError, setAutoError] = useState("");
    const [uploadedUrl, setUploadedUrl] = useState("");

    const addLog = (msg: string) => setAutoLog(p => [...p, msg]);

    const [multiProgress, setMultiProgress] = useState<{ current: number; total: number } | null>(null);

    const downloadBlob = (bytes: Uint8Array, name: string) => {
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
    };

    const handleDownload = async () => {
        setManualGenerating(true);
        setManualError("");
        setManualDone(false);
        try {
            const bytes = await buildPdf();
            if (!bytes) throw new Error("No se pudo generar el PDF");
            downloadBlob(bytes, `${bookFileName || "libro-kdp"}.pdf`);
            setManualDone(true);
        } catch (e: any) {
            setManualError(e.message);
        } finally {
            setManualGenerating(false);
        }
    };

    const handleDownloadMultiple = async () => {
        setManualGenerating(true);
        setManualError("");
        setManualDone(false);
        setMultiProgress({ current: 0, total: chunks.length });
        try {
            for (let i = 0; i < chunks.length; i++) {
                setMultiProgress({ current: i + 1, total: chunks.length });
                // owner page (auto-added by buildBookPdf) + blank separator + even content pages = even total
                const firstIsBlank = !chunks[i][0]?.image;
                const pagesForPdf = firstIsBlank ? chunks[i] : [blankSeparator, ...chunks[i]];
                const bytes = await buildPdf(pagesForPdf);
                if (!bytes) throw new Error(`Error generando parte ${i + 1}`);
                const partName = `${bookFileName || "libro-kdp"}-parte${i + 1}.pdf`;
                downloadBlob(bytes, partName);
                if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 600));
            }
            setManualDone(true);
        } catch (e: any) {
            setManualError(e.message);
        } finally {
            setManualGenerating(false);
            setMultiProgress(null);
        }
    };

    const handleAutoUpload = async () => {
        setAutoStep("generating");
        setAutoLog([]);
        setAutoError("");
        setUploadedUrl("");
        try {
            addLog("Generando PDF...");
            const bytes = await buildPdf();
            if (!bytes) throw new Error("No se pudo generar el PDF");
            addLog(`✓ PDF generado · ${(bytes.length / 1048576).toFixed(1)} MB`);

            setAutoStep("uploading");
            addLog("Subiendo al servidor...");
            let binary = "";
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
                binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
            }
            const base64 = btoa(binary);
            const upRes = await fetch(`${apiUrl}/uploads/pdf`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ base64, fileName: bookFileName }),
            });
            const upData = await upRes.json();
            if (!upRes.ok) throw new Error(upData.error ?? "Error al subir PDF");
            setUploadedUrl(upData.url);
            addLog(`✓ PDF subido · expira en ${upData.expiresInMinutes} min`);
            setAutoStep("done");
        } catch (e: any) {
            setAutoError(e.message);
            setAutoStep("error");
        }
    };

    const SPECS = [
        ["Páginas", `${pageCount}${pageCount !== validPageCount ? ` → ${validPageCount} (par)` : ""}`],
        ["Formato", "A4 · 210×297 mm"],
        ["Interior", "115 gsm · 4+4 color"],
        ["Encuadernado", "Wire-O izquierda"],
    ];

    const MANUAL_STEPS = [
        { n: "1", text: "Descarga el PDF con el botón de abajo" },
        { n: "2", text: "Abre el Gelato Dashboard → Products → Create new" },
        { n: "3", text: 'Elige "Wire-O Brochure" · A4 · 115 gsm · 4+4 · Wire-O left' },
        { n: "4", text: "Sube el PDF en el paso Print files" },
        { n: "5", text: "Configura título, precio y publica → sincroniza a Etsy" },
    ];

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-neutral-950/95 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
                        <Package size={17} className="text-orange-400" />
                    </div>
                    <div>
                        <p className="font-bold text-white">Subir a Gelato</p>
                        <p className="text-[11px] text-neutral-500">Impresión Wire-O bajo demanda</p>
                    </div>
                    <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/8">
                        <X size={14} className="text-neutral-400" />
                    </button>
                </div>

                {pageCount < 20 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2 mb-4">
                        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-300">Wire-O requiere mínimo 20 páginas. Tu libro tiene {pageCount}.</p>
                    </div>
                )}
                {needsSplit && (
                    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 flex gap-2 mb-4">
                        <AlertTriangle size={14} className="text-sky-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-sky-300 space-y-1">
                            <p className="font-bold">Tu libro tiene {pageCount} páginas — máximo {MAX_GELATO_PAGES} imágenes por PDF en Gelato.</p>
                            <p>Se dividirá en <span className="font-bold">{chunks.length} archivos</span>. Cada uno: <span className="font-mono text-white/70">prueba colores + blanco + {chunks.map(c => c.length).join(" / ")} imágenes</span> = <span className="font-bold">{chunks.map(c => 2 + c.length).join(" / ")} páginas totales (par ✓)</span>.</p>
                        </div>
                    </div>
                )}

                {/* Specs strip */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 mb-4">
                    {SPECS.map(([k, v]) => (
                        <div key={k} className="flex items-baseline gap-1">
                            <span className="text-[9px] text-neutral-600">{k}:</span>
                            <span className="text-[10px] text-neutral-300 font-medium">{v}</span>
                        </div>
                    ))}
                </div>

                <div className="space-y-3">
                    {/* ── Manual ── */}
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                                <Check size={9} className="text-emerald-400" />
                            </div>
                            <p className="text-sm font-bold text-white">Manual</p>
                            <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-2 py-0.5">Disponible</span>
                        </div>
                        <ol className="space-y-2 mb-4">
                            {MANUAL_STEPS.map(({ n, text }) => (
                                <li key={n} className="flex gap-2.5 items-start">
                                    <span className="w-4 h-4 rounded-full bg-white/8 flex items-center justify-center text-[8px] font-black text-neutral-400 shrink-0 mt-0.5">{n}</span>
                                    <span className="text-[11px] text-neutral-400 leading-relaxed">{text}</span>
                                </li>
                            ))}
                        </ol>
                        {manualError && <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2 mb-3">{manualError}</p>}
                        {manualDone && (
                            <div className="flex items-center gap-2 text-[11px] text-emerald-400 mb-3">
                                <Check size={12} /> {needsSplit ? `${chunks.length} PDFs descargados` : "PDF descargado"} — continúa en Gelato Dashboard
                            </div>
                        )}
                        {multiProgress && (
                            <div className="flex items-center gap-2 text-[11px] text-sky-400 mb-3">
                                <Loader2 size={12} className="animate-spin" /> Generando parte {multiProgress.current} de {multiProgress.total}...
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={needsSplit ? handleDownloadMultiple : handleDownload}
                                disabled={manualGenerating || !isValidForWireO}
                                className="flex-1 py-2.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                            >
                                {manualGenerating ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                {manualGenerating ? (multiProgress ? `Parte ${multiProgress.current}/${multiProgress.total}...` : "Generando...") : needsSplit ? `1. Descargar ${chunks.length} PDFs` : "1. Descargar PDF"}
                            </button>
                            <a
                                href="https://dashboard.gelato.com/store-products/product-list"
                                target="_blank" rel="noreferrer"
                                className="flex-1 py-2.5 rounded-2xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                            >
                                <ExternalLink size={12} /> 2. Abrir Gelato
                            </a>
                        </div>
                    </div>

                    {/* ── Automática (deshabilitada) ── */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.015] p-4 opacity-50 select-none">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded-full bg-white/8 border border-white/15 flex items-center justify-center shrink-0">
                                <Zap size={9} className="text-neutral-500" />
                            </div>
                            <p className="text-sm font-bold text-neutral-400">Automática</p>
                            <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-neutral-500 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">Próximamente</span>
                        </div>
                        <p className="text-[11px] text-neutral-600 pl-7">
                            Cuando alguien compre en Etsy, generará el PDF y creará el pedido en Gelato automáticamente. Requiere servidor en producción y webhooks de Etsy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

type CloudinaryImage = { publicId: string; url: string; width: number; height: number; bytes: number };

export function KdpFactoryApp() {
    const [activeTab, setActiveTab] = useState<TabID>(() => {
        if (typeof window === "undefined") return "insights";
        const saved = localStorage.getItem("kdp-active-tab");
        return (saved && ["insights", "creation", "studio", "gelato"].includes(saved)) ? saved as TabID : "insights";
    });
    const changeTab = (tab: TabID) => { localStorage.setItem("kdp-active-tab", tab); setActiveTab(tab); };
    const [chartPeriod, setChartPeriod] = useState<PeriodID>("month");
    const [chartData, setChartData] = useState<number[]>([]);

    useEffect(() => {
        let dataLength = 14;
        if (chartPeriod === "6months") dataLength = 24;
        if (chartPeriod === "year") dataLength = 12;
        if (chartPeriod === "all") dataLength = 20;
        setChartData(Array.from({ length: dataLength }, () => Math.floor(Math.random() * 150) + 20));
    }, [chartPeriod]);

    const [products, setProducts] = useState<DigitalProduct[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<DigitalProduct | null>(null);

    const [selectedType, setSelectedType] = useState(PRODUCT_TYPES[0].id);
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [catalogFilter, setCatalogFilter] = useState("all");
    const [productSearch, setProductSearch] = useState("");
    const [productSort, setProductSort] = useState<"earnings" | "date" | "status">("earnings");
    const [productViewMode, setProductViewMode] = useState<"list" | "compact">("list");
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [isBulkDeletingProducts, setIsBulkDeletingProducts] = useState(false);
    const [bulkStatusTarget, setBulkStatusTarget] = useState<"activo" | "pausado" | "borrador" | null>(null);
    const [quickEditEarnings, setQuickEditEarnings] = useState<{ productId: string; platIdx: number; value: string } | null>(null);
    const [listingTopic, setListingTopic] = useState("");
    const [listingResult, setListingResult] = useState<any | null>(null);
    const [isGeneratingListing, setIsGeneratingListing] = useState(false);
    const [listingCardOpen, setListingCardOpen] = useState(false);
    const [selectedListingNicheId, setSelectedListingNicheId] = useState<string | null>(null);
    const [listingSaveProductId, setListingSaveProductId] = useState<string>("new");
    const [isSavingListing, setIsSavingListing] = useState(false);

    const stats = useMemo(() => {
        const total = products.reduce((acc, p) => acc + p.totalEarnings, 0);
        const count = products.length;
        const avg = count > 0 ? total / count : 0;
        return { total, count, avg };
    }, [products]);

    const filteredProducts = useMemo(() => {
        let list = catalogFilter === "all" ? products : products.filter(p => p.type === (PRODUCT_TYPES.find(t => t.id === catalogFilter)?.name ?? ""));
        if (productSearch.trim()) {
            const q = productSearch.toLowerCase();
            list = list.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.platforms.some(pl => pl.name.toLowerCase().includes(q)));
        }
        return [...list].sort((a, b) => {
            if (productSort === "earnings") return b.totalEarnings - a.totalEarnings;
            if (productSort === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            const order = { activo: 0, borrador: 1, pausado: 2 };
            return (order[a.status ?? "borrador"] ?? 1) - (order[b.status ?? "borrador"] ?? 1);
        });
    }, [products, catalogFilter, productSearch, productSort]);

    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    // AI Studio State — 4-field prompt
    const [promptTheme, setPromptTheme] = useState("");
    const [promptSpecs, setPromptSpecs] = useState("");
    const [promptDetails, setPromptDetails] = useState("");
    const [promptParticulars, setPromptParticulars] = useState("");
    const imagePrompt = (() => {
        const theme = promptTheme.trim();
        if (!theme) return "";
        let p = `Genera una imagen con la siguiente temática: ${theme}`;
        if (promptSpecs.trim()) p += `, que tenga las siguientes especificaciones: ${promptSpecs.trim()}`;
        if (promptDetails.trim()) p += `, con los siguientes detalles: ${promptDetails.trim()}`;
        if (promptParticulars.trim()) p += `, y las siguientes particularidades: ${promptParticulars.trim()}`;
        return p;
    })();
    const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [showDimPicker, setShowDimPicker] = useState(false);
    const [selectedDim, setSelectedDim] = useState("p34");
    const modelPickerBtnRef = useRef<HTMLButtonElement>(null);
    const dimPickerBtnRef = useRef<HTMLButtonElement>(null);
    const modelPickerRectRef = useRef<DOMRect | null>(null);
    const dimPickerRectRef = useRef<DOMRect | null>(null);
    const [cloudinaryImages, setCloudinaryImages] = useState<{ publicId: string; url: string; width: number; height: number; bytes: number; createdAt: string }[]>([]);
    const [isLoadingCloudinary, setIsLoadingCloudinary] = useState(false);
    const [uploadingToCloud, setUploadingToCloud] = useState<number | null>(null);
    const [deletingFromCloud, setDeletingFromCloud] = useState<string | null>(null);

    const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

    // --- Catálogos IA state ---
    const [iaCatalogs, setIaCatalogs] = useState<IACatalogFE[]>([]);
    const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);
    const [catalogFormName, setCatalogFormName] = useState("");
    const [catalogFormCount, setCatalogFormCount] = useState(5);
    const [catalogProductType, setCatalogProductType] = useState<"coloring-book" | "printable-poster" | "other">("coloring-book");
    const [catalogCreativity, setCatalogCreativity] = useState(50);
    const [catalogNegativePrompt, setCatalogNegativePrompt] = useState("");
    const [isCreatingCatalog, setIsCreatingCatalog] = useState(false);
    const [deletingCatalogId, setDeletingCatalogId] = useState<string | null>(null);
    const [confirmDeleteCatalogId, setConfirmDeleteCatalogId] = useState<string | null>(null);
    const [confirmStopCatalogId, setConfirmStopCatalogId] = useState<string | null>(null);
    const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<string | null>(null);
    const [confirmDeleteImageInfo, setConfirmDeleteImageInfo] = useState<{ catalogId: string; publicId: string } | null>(null);
    const [bulkDeleteCatalogId, setBulkDeleteCatalogId] = useState<string | null>(null);
    const [bulkDeleteSelection, setBulkDeleteSelection] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [bookPages, setBookPages] = useState<BookPage[]>([]);
    const [directPdfCatalogId, setDirectPdfCatalogId] = useState<string | null>(null);
    const [directNichePdfId, setDirectNichePdfId] = useState<string | null>(null);
    const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
    const [bookEditorTab, setBookEditorTab] = useState<"editor" | "preview" | "images">("editor");
    const [showAddPageMenu, setShowAddPageMenu] = useState(false);
    const [selectedImageUrls, setSelectedImageUrls] = useState<Set<string>>(new Set());
    const [isVaultSelectMode, setIsVaultSelectMode] = useState(false);
    const [showSafeArea, setShowSafeArea] = useState(false);
    const [kdpPdfSize, setKdpPdfSize] = useState<"6x9" | "8x10" | "8.5x11" | "a4">("8.5x11");
    const [isExportingKdpPdf, setIsExportingKdpPdf] = useState(false);
    const [showInlineImagePicker, setShowInlineImagePicker] = useState(false);
    const [bookPreviewMode, setBookPreviewMode] = useState<"single" | "spread">("single");
    const [previewContext, setPreviewContext] = useState<{ urls: string[]; index: number; catalogCtx?: { id: string; images: CatalogImageFE[] }; vaultCtx?: true; cloudinaryCtx?: true } | null>(null);
    const [confirmClearBook, setConfirmClearBook] = useState(false);
    const [confirmDeleteVaultIndex, setConfirmDeleteVaultIndex] = useState<number | null>(null);
    const [confirmDeleteCloudinaryId, setConfirmDeleteCloudinaryId] = useState<string | null>(null);
    const [savedPrompts, setSavedPrompts] = useState<SavedPromptFE[]>([]);
    const [isLoadingSavedPrompts, setIsLoadingSavedPrompts] = useState(false);
    const [showSavePromptDialog, setShowSavePromptDialog] = useState(false);
    const [savePromptName, setSavePromptName] = useState("");
    const [savePromptCategory, setSavePromptCategory] = useState("General");
    const [newCategoryInput, setNewCategoryInput] = useState("");
    const [promptCategoryFilter, setPromptCategoryFilter] = useState("all");
    const [isSavingPrompt, setIsSavingPrompt] = useState(false);
    const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
    const [editingPromptName, setEditingPromptName] = useState("");
    const [fullEditingPromptId, setFullEditingPromptId] = useState<string | null>(null);
    const [fullEditingPrompt, setFullEditingPrompt] = useState<Partial<SavedPromptFE>>({});
    const [niches, setNiches] = useState<NicheFE[]>([]);
    const [isLoadingNiches, setIsLoadingNiches] = useState(false);
    const [nicheFormOpen, setNicheFormOpen] = useState(false);
    const [nicheEditTarget, setNicheEditTarget] = useState<NicheFE | null>(null);
    const [nicheFormName, setNicheFormName] = useState("");
    const [nicheFormDesc, setNicheFormDesc] = useState("");
    const [nicheFormTags, setNicheFormTags] = useState("");
    const [nicheFormStatus, setNicheFormStatus] = useState<NicheStatus>("found");
    const [nicheFormComp, setNicheFormComp] = useState<NicheFE["competition"]>("unknown");
    const [nicheFormDemand, setNicheFormDemand] = useState<NicheFE["demand"]>("unknown");
    const [nicheFormNotes, setNicheFormNotes] = useState("");
    const [nicheFormEtsyUrl, setNicheFormEtsyUrl] = useState("");
    const [nicheFormPrompt, setNicheFormPrompt] = useState("");
    const [isSavingNiche, setIsSavingNiche] = useState(false);
    const [nicheDeleteId, setNicheDeleteId] = useState<string | null>(null);
    const [nicheStatusFilter, setNicheStatusFilter] = useState<"all" | NicheStatus>("all");
    const [nicheViewMode, setNicheViewMode] = useState<"list" | "kanban">("list");
    const [nicheGeneratingId, setNicheGeneratingId] = useState<string | null>(null);
    const [nicheFormProductType, setNicheFormProductType] = useState<NicheProductType>("coloring-book");
    const [nicheFormStyles, setNicheFormStyles] = useState<NicheStyle[]>(["generic"]);
    const [catalogNicheFilter, setCatalogNicheFilter] = useState<string | null>(null);
    const [catalogNichePickerId, setCatalogNichePickerId] = useState<string | null>(null);
    const [kdpTemplateNicheFilter, setKdpTemplateNicheFilter] = useState<string | null>(null);
    const [kdpTemplateOpen, setKdpTemplateOpen] = useState(false);
    const [kdpTemplateTitle, setKdpTemplateTitle] = useState("Mi Libro de Colorear");
    const [kdpTemplateVaultSel, setKdpTemplateVaultSel] = useState<Set<number>>(new Set());
    const [kdpTemplateCatalogSel, setKdpTemplateCatalogSel] = useState<Set<string>>(new Set());
    const [kdpTemplateCloudSel, setKdpTemplateCloudSel] = useState<Set<number>>(new Set());
    const [kdpTemplateRandom, setKdpTemplateRandom] = useState(false);
    // Feature: retry failed slots
    const [retryingCatalogId, setRetryingCatalogId] = useState<string | null>(null);
    // Feature: compare catalogs
    // Feature: Zip Factory
    const [zipFactoryOpen, setZipFactoryOpen] = useState(false);
    const [zipSource, setZipSource] = useState<"all" | "vault" | "catalogs" | "cloudinary" | "favorites">("all");
    const [zipSelection, setZipSelection] = useState<Set<string>>(new Set());
    const [zipName, setZipName] = useState("imagenes-kdp");
    const [isDownloadingZip, setIsDownloadingZip] = useState(false);
    // Feature: cloudinary search + selection + custom catalog
    const [cloudSearch, setCloudSearch] = useState("");
    const [isCloudSelectMode, setIsCloudSelectMode] = useState(false);
    const [selectedCloudUrls, setSelectedCloudUrls] = useState<Set<string>>(new Set());
    const [showCustomCatalogModal, setShowCustomCatalogModal] = useState(false);
    const [customCatalogName, setCustomCatalogName] = useState("");
    const [isCreatingCustomCatalog, setIsCreatingCustomCatalog] = useState(false);
    // Feature: niche sort
    const [nicheSortBy, setNicheSortBy] = useState<"score" | "date">("score");
    const catalogSocketRef = useRef<ReturnType<typeof createApiSocket> | null>(null);
    const catalogsListRef = useRef<HTMLDivElement>(null);
    const [collapsedCompleted, setCollapsedCompleted] = useState(true);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const catalogStartTimeRef = useRef<Record<string, number>>({});
    const avgSecsPerImageRef = useRef<number>(90);
    const [queueEstimateMs, setQueueEstimateMs] = useState<number | null>(null);

    // --- Pipeline: publication panel + royalties ---
    const [nichePublishPanelId, setNichePublishPanelId] = useState<string | null>(null);
    const [publishPanelAsin, setPublishPanelAsin] = useState("");
    const [publishPanelEtsy, setPublishPanelEtsy] = useState("");
    const [publishPanelGumroad, setPublishPanelGumroad] = useState("");
    const [publishPanelDate, setPublishPanelDate] = useState("");
    const [isSavingPublish, setIsSavingPublish] = useState(false);
    const [royaltiesNicheId, setRoyaltiesNicheId] = useState<string | null>(null);
    const [royaltiesMonth, setRoyaltiesMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [royaltiesSales, setRoyaltiesSales] = useState("");
    const [royaltiesRevenue, setRoyaltiesRevenue] = useState("");
    const [isSavingRoyalties, setIsSavingRoyalties] = useState(false);

    const [contentGeneratorOpen, setContentGeneratorOpen] = useState(false);

    // --- Content generator state ---
    const [contentNiche, setContentNiche] = useState("");
    const [contentProductType, setContentProductType] = useState("Coloring Book");
    const [contentExtras, setContentExtras] = useState("");
    const [contentLanguage, setContentLanguage] = useState<"es" | "en">("en");
    const [contentType, setContentType] = useState<"kdp-physical-book" | "full-listing" | "titles" | "description" | "keywords" | "back-cover" | "series">("kdp-physical-book");
    const [contentResult, setContentResult] = useState<any | null>(null);
    const [isGeneratingContent, setIsGeneratingContent] = useState(false);
    const [imagePromptSuggestion, setImagePromptSuggestion] = useState<string | null>(null);
    const [isGeneratingImagePrompt, setIsGeneratingImagePrompt] = useState(false);

    // --- Trends state ---
    const [trendsPlatform, setTrendsPlatform] = useState<"all" | "kdp" | "etsy" | "printify">("all");
    const [trendsCategory, setTrendsCategory] = useState("all");
    const [trendsData, setTrendsData] = useState<any | null>(null);
    const [isLoadingTrends, setIsLoadingTrends] = useState(false);
    const [selectedTrend, setSelectedTrend] = useState<any | null>(null);

    // --- Integrations ---
    type IntegrationStatus = "dev" | "paused" | "study" | "active";
    interface Integration {
        _id?: string;
        id: string;
        name: string;
        icon: string;
        status: IntegrationStatus;
        statusLabel: string;
        desc: string;
        url?: string;
    }
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
    const [showIntegrationModal, setShowIntegrationModal] = useState(false);
    const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
    const [integrationDraft, setIntegrationDraft] = useState<Partial<Integration>>({});
    const [confirmDeleteIntegrationId, setConfirmDeleteIntegrationId] = useState<string | null>(null);
    const [isSavingIntegration, setIsSavingIntegration] = useState(false);

    // --- Favorites (persisted to MongoDB via /settings as FavoriteImage[]) ---
    const [favorites, setFavorites] = useState<Map<string, FavoriteImage>>(new Map());

    // --- PDF drag-to-reorder (desktop) + touch-reorder (mobile) ---
    const [bookDragIdx, setBookDragIdx] = useState<number | null>(null);
    const [bookDragOverIdx, setBookDragOverIdx] = useState<number | null>(null);
    const touchReorderRef = useRef<{ startIdx: number; currentIdx: number } | null>(null);

    // --- Vault carousel drag/swipe ---
    const vaultScrollRef = useRef<HTMLDivElement>(null);
    const vaultDrag = useRef<{ x: number; scrollLeft: number } | null>(null);
    const vaultDragMoved = useRef(false);

    const selectedPage = bookPages.find(p => p.id === selectedPageId) ?? null;
    const usedImageUrls = useMemo(() => new Set(bookPages.filter(p => p.image).map(p => p.image!.url)), [bookPages]);

    const fetchCatalogs = async () => {
        setIsLoadingCatalogs(true);
        try {
            const res = await fetch(`${API_BASE_URL}/catalogs`);
            if (!res.ok) return;
            const data = await res.json();
            setIaCatalogs(data.catalogs ?? []);
        } catch {
            // silently ignore if API unavailable
        } finally {
            setIsLoadingCatalogs(false);
        }
    };

    const deleteCatalogConfirmed = async (id: string) => {
        setConfirmDeleteCatalogId(null);
        setDeletingCatalogId(id);
        try {
            const catalog = iaCatalogs.find(c => c._id === id);
            const res = await fetch(`${API_BASE_URL}/catalogs/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Error al eliminar");
            setIaCatalogs((prev) => prev.filter((c) => c._id !== id));
            // Remove catalog from linked niches in local state
            if (catalog?.nicheIds?.length) {
                setNiches(prev => prev.map(n =>
                    catalog.nicheIds!.includes(n._id)
                        ? { ...n, catalogIds: (n.catalogIds ?? []).filter(cid => cid !== id) }
                        : n
                ));
            }
            toast.success("Catálogo eliminado");
        } catch (e: any) {
            toast.error(e.message ?? "Error al eliminar catálogo");
        } finally {
            setDeletingCatalogId(null);
        }
    };

    const cancelCatalog = async (id: string) => {
        try {
            await fetch(`${API_BASE_URL}/catalogs/${id}/cancel`, { method: "POST" });
            setIaCatalogs((prev) =>
                prev.map((c) => (c._id === id ? { ...c, status: "cancelled" } : c))
            );
            toast.info("Generación cancelada");
        } catch {
            toast.error("Error al cancelar");
        }
    };

    const createCatalogFromStudio = async () => {
        if (!promptTheme.trim()) {
            toast.error("Escribe la temática del catálogo primero");
            return;
        }
        if (!catalogFormCount || catalogFormCount < 1) {
            toast.error("Indica cuántas imágenes generar (mínimo 1)");
            return;
        }
        const model = AI_MODELS.find((m) => m.id === selectedModel);
        const dim = AI_DIMENSIONS.find((d) => d.id === selectedDim);
        if (!model) return;
        setIsCreatingCatalog(true);
        try {
            const res = await fetch(`${API_BASE_URL}/catalogs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: catalogFormName.trim() || undefined,
                    prompt: imagePrompt.trim(),
                    promptParts: { theme: promptTheme.trim(), specs: promptSpecs.trim(), details: promptDetails.trim(), particulars: promptParticulars.trim() },
                    productType: catalogProductType,
                    creativity: catalogCreativity,
                    negativePrompt: catalogNegativePrompt.trim(),
                    aiModel: { id: model.id, name: model.name, provider: model.provider, modelId: model.modelId },
                    width: dim?.width ?? 1024,
                    height: dim?.height ?? 1024,
                    totalImages: catalogFormCount,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al crear catálogo");
            setIaCatalogs((prev) => [data.catalog, ...prev]);
            setCatalogFormName("");
            setCatalogFormCount(5);
            setTimeout(() => catalogsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
            if (data.catalog.status === "queued") {
                toast.info(`Catálogo añadido a la cola — comenzará al terminar el actual`);
            } else {
                toast.success(`Catálogo iniciado — ${catalogFormCount} imágenes en segundo plano`);
            }
        } catch (e: any) {
            toast.error(e.message ?? "Error al crear catálogo");
        } finally {
            setIsCreatingCatalog(false);
        }
    };


    const fetchSavedPrompts = async () => {
        setIsLoadingSavedPrompts(true);
        try {
            const res = await fetch(`${API_BASE_URL}/saved-prompts`);
            if (!res.ok) return;
            const data = await res.json();
            setSavedPrompts(data.prompts ?? []);
        } catch { /* silently ignore */ } finally {
            setIsLoadingSavedPrompts(false);
        }
    };

    const fetchNiches = async () => {
        setIsLoadingNiches(true);
        try {
            const res = await fetch(`${API_BASE_URL}/niches`);
            if (!res.ok) return;
            const data = await res.json();
            setNiches(data.niches ?? []);
        } catch { /* silently ignore */ } finally {
            setIsLoadingNiches(false);
        }
    };

    const openNicheForm = (niche?: NicheFE) => {
        if (niche) {
            setNicheEditTarget(niche);
            setNicheFormName(niche.name);
            setNicheFormDesc(niche.description);
            setNicheFormTags(niche.tags.join(", "));
            setNicheFormStatus(niche.status);
            setNicheFormComp(niche.competition);
            setNicheFormDemand(niche.demand);
            setNicheFormProductType(niche.productType ?? "coloring-book");
            setNicheFormStyles(niche.styleCategories?.length ? niche.styleCategories : [niche.styleCategory ?? "generic"]);
            setNicheFormNotes(niche.notes);
            setNicheFormEtsyUrl(niche.etsyUrl ?? "");
            setNicheFormPrompt(niche.generatedPrompt ?? "");
        } else {
            setNicheEditTarget(null);
            setNicheFormName("");
            setNicheFormDesc("");
            setNicheFormTags("");
            setNicheFormStatus("found");
            setNicheFormComp("unknown");
            setNicheFormDemand("unknown");
            setNicheFormProductType("coloring-book");
            setNicheFormStyles(["generic"]);
            setNicheFormNotes("");
            setNicheFormEtsyUrl("");
            setNicheFormPrompt("");
        }
        setNicheFormOpen(true);
    };

    const generateNicheContent = async (niche: NicheFE, stylesToGen?: NicheStyle[]) => {
        const styles = stylesToGen
            ?? (niche.styleCategories?.length ? niche.styleCategories : [niche.styleCategory ?? "generic"]);
        setNicheGeneratingId(niche._id);
        const allNewCatalogIds: string[] = [...(niche.catalogIds ?? [])];
        let lastPrompt = niche.generatedPrompt ?? "";
        try {
            for (const style of styles) {
                const isColoringBook = niche.productType === "coloring-book";
                let imagePrompt: string;
                let promptParts: { theme: string; specs: string; details: string; particulars: string };

                if (isColoringBook) {
                    // For coloring books: fixed template, AI decides only "particulars"
                    const isAnime = ANIME_STYLES.includes(style);
                    const partRes = await fetch(`${API_BASE_URL}/ai/generate-text`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "niche-particulars",
                            niche: niche.name,
                            extras: isAnime ? "anime cartoon style" : undefined,
                            language: "en",
                            model: "gemini-2.5-flash",
                        }),
                    });
                    const partData = await partRes.json();
                    if (!partRes.ok) throw new Error(partData.error ?? "Error generando detalles");
                    const particulars: string = partData.result?.particulars ?? niche.name;
                    const built = buildColoringBookPromptParts(niche.name, style, particulars);
                    imagePrompt = built.fullPrompt;
                    promptParts = { theme: built.theme, specs: built.specs, details: built.details, particulars };

                    // Auto-save template to prompts library if not already there
                    const promptName = isAnime ? `Coloring Book · Anime · ${style}` : `Coloring Book · ${style}`;
                    void fetch(`${API_BASE_URL}/saved-prompts`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: promptName,
                            category: isAnime ? "Anime" : "Coloring Book",
                            promptParts: { theme: built.theme, specs: built.specs, details: built.details, particulars: "" },
                            aiModel: { id: NICHE_STYLE_MODEL[style], name: AI_MODELS.find(m => m.id === NICHE_STYLE_MODEL[style])?.name ?? style, provider: "Pollinations", modelId: AI_MODELS.find(m => m.id === NICHE_STYLE_MODEL[style])?.modelId ?? "" },
                        }),
                    }).catch(() => { });
                } else {
                    // For other types: AI generates everything
                    const promptRes = await fetch(`${API_BASE_URL}/ai/generate-text`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "image-prompt",
                            niche: niche.name,
                            productType: niche.productType === "printable-poster" ? "printable poster" : niche.name,
                            language: "en",
                            model: "gemini-2.5-flash",
                        }),
                    });
                    const promptData = await promptRes.json();
                    if (!promptRes.ok) throw new Error(promptData.error ?? "Error generando prompt");
                    imagePrompt = typeof promptData.result === "object"
                        ? (promptData.result.prompt ?? niche.name)
                        : (promptData.result ?? niche.name);
                    promptParts = { theme: niche.name, specs: "", details: "", particulars: imagePrompt };
                }

                lastPrompt = imagePrompt;
                const modelId = NICHE_STYLE_MODEL[style] ?? NICHE_STYLE_MODEL[niche.styleCategory ?? "generic"];
                const model = AI_MODELS.find(m => m.id === modelId) ?? AI_MODELS.find(m => m.id === "pollinations-flux")!;
                const catalogLabel = styles.length > 1 ? `${niche.name} · ${style}` : niche.name;

                const catalogRes = await fetch(`${API_BASE_URL}/catalogs`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: catalogLabel,
                        prompt: imagePrompt,
                        promptParts,
                        productType: niche.productType ?? "coloring-book",
                        aiModel: { id: model.id, name: model.name, provider: model.provider, modelId: model.modelId },
                        width: 1024,
                        height: 1024,
                        totalImages: 5,
                        nicheIds: [niche._id],
                    }),
                });
                const catalogData = await catalogRes.json();
                if (!catalogRes.ok) throw new Error(catalogData.error ?? "Error al crear catálogo");
                setIaCatalogs(prev => [catalogData.catalog, ...prev]);
                allNewCatalogIds.push(catalogData.catalog._id);
                toast.success(`Catálogo iniciado · ${catalogLabel} · ${model.name}`);
            }

            // Persist prompt + catalogIds back to niche
            await fetch(`${API_BASE_URL}/niches/${niche._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generatedPrompt: lastPrompt, catalogIds: allNewCatalogIds }),
            });
            setNiches(prev => prev.map(n => n._id === niche._id
                ? { ...n, generatedPrompt: lastPrompt, catalogIds: allNewCatalogIds }
                : n
            ));
        } catch (e: any) {
            toast.error(e.message ?? "Error al generar contenido");
        } finally {
            setNicheGeneratingId(null);
        }
    };

    const saveNiche = async () => {
        if (!nicheFormName.trim()) { toast.error("El nombre es obligatorio"); return; }
        setIsSavingNiche(true);
        try {
            const body = {
                name: nicheFormName.trim(),
                description: nicheFormDesc.trim(),
                tags: nicheFormTags.split(",").map(t => t.trim()).filter(Boolean),
                status: nicheFormStatus,
                competition: nicheFormComp,
                demand: nicheFormDemand,
                productType: nicheFormProductType,
                styleCategory: nicheFormStyles[0] ?? "generic",
                styleCategories: nicheFormStyles,
                notes: nicheFormNotes.trim(),
                etsyUrl: nicheFormEtsyUrl.trim(),
                generatedPrompt: nicheFormPrompt.trim(),
            };
            const url = nicheEditTarget ? `${API_BASE_URL}/niches/${nicheEditTarget._id}` : `${API_BASE_URL}/niches`;
            const method = nicheEditTarget ? "PATCH" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            if (nicheEditTarget) {
                setNiches(prev => prev.map(n => n._id === nicheEditTarget._id ? data.niche : n));
                toast.success("Nicho actualizado");
            } else {
                setNiches(prev => [data.niche, ...prev]);
                toast.success("Nicho creado");
            }
            setNicheFormOpen(false);
        } catch (e: any) {
            toast.error(e.message ?? "Error al guardar nicho");
        } finally {
            setIsSavingNiche(false);
        }
    };

    const deleteNiche = async (id: string) => {
        try {
            await fetch(`${API_BASE_URL}/niches/${id}`, { method: "DELETE" });
            setNiches(prev => prev.filter(n => n._id !== id));
            setNicheDeleteId(null);
            toast.success("Nicho eliminado");
        } catch {
            toast.error("Error al eliminar nicho");
        }
    };

    const nicheScore = (n: NicheFE): number => {
        const demandPts = { unknown: 0, low: 10, medium: 25, high: 40 }[n.demand] ?? 0;
        const compPts = { unknown: 0, high: 5, medium: 20, low: 35 }[n.competition] ?? 0;
        const catalogPts = (n.catalogIds?.length ?? 0) > 0 ? 10 : 0;
        const statusPts = n.status === "active" ? 5 : n.status === "research" ? 3 : 0;
        return demandPts + compPts + catalogPts + statusPts;
    };

    const retryFailedSlots = async (catalogId: string) => {
        setRetryingCatalogId(catalogId);
        try {
            const res = await fetch(`${API_BASE_URL}/catalogs/${catalogId}/retry-failed`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Error");
            setIaCatalogs(prev => prev.map(c => c._id === catalogId ? { ...c, status: "running", skippedImages: 0 } : c));
            toast.success(`Reintentando ${data.slotsToRetry} slot${data.slotsToRetry > 1 ? "s" : ""} fallados`);
        } catch (e: any) {
            toast.error(e.message ?? "Error al reintentar");
        } finally {
            setRetryingCatalogId(null);
        }
    };

    const handleQueueReorder = async (draggedId: string, targetId: string) => {
        if (draggedId === targetId) return;
        setIaCatalogs(prev => {
            const queued = prev.filter(c => c.status === "queued");
            const draggedIdx = queued.findIndex(c => c._id === draggedId);
            const targetIdx = queued.findIndex(c => c._id === targetId);
            if (draggedIdx === -1 || targetIdx === -1) return prev;
            const newQueued = [...queued];
            const [removed] = newQueued.splice(draggedIdx, 1);
            newQueued.splice(targetIdx, 0, removed);
            const queuedPositions = prev.map((c, i) => c.status === "queued" ? i : -1).filter(i => i >= 0);
            const result = [...prev];
            newQueued.forEach((c, i) => { result[queuedPositions[i]] = c; });
            return result;
        });
        try {
            const ids = iaCatalogs.filter(c => c.status === "queued").map(c => c._id);
            const draggedIdx = ids.indexOf(draggedId);
            const targetIdx = ids.indexOf(targetId);
            const reordered = [...ids];
            const [rem] = reordered.splice(draggedIdx, 1);
            reordered.splice(targetIdx, 0, rem);
            await fetch(`${API_BASE_URL}/catalogs/queue-reorder`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: reordered }),
            });
        } catch { toast.error("Error al reordenar cola"); }
    };

    const saveNichePromptToLibrary = (niche: NicheFE) => {
        if (!niche.generatedPrompt) return;
        setPromptTheme(niche.generatedPrompt);
        setPromptSpecs(""); setPromptDetails(""); setPromptParticulars("");
        const modelId = NICHE_STYLE_MODEL[niche.styleCategory ?? "generic"];
        const match = AI_MODELS.find(m => m.id === modelId);
        if (match) setSelectedModel(match.id);
        setSavePromptName(niche.name);
        setSavePromptCategory(
            niche.productType === "coloring-book" ? "Coloring Book" :
                niche.productType === "printable-poster" ? "Arte Digital" : "General"
        );
        setShowSavePromptDialog(true);
    };

    const openPublishPanel = (niche: NicheFE) => {
        setNichePublishPanelId(niche._id);
        setPublishPanelAsin(niche.asin ?? "");
        setPublishPanelEtsy(niche.etsyUrl ?? "");
        setPublishPanelGumroad(niche.gumroadUrl ?? "");
        setPublishPanelDate(niche.publishedAt ? niche.publishedAt.slice(0, 10) : "");
    };

    const savePublishPanel = async (nicheId: string) => {
        setIsSavingPublish(true);
        try {
            const body: Record<string, any> = {
                asin: publishPanelAsin.trim(),
                etsyUrl: publishPanelEtsy.trim(),
                gumroadUrl: publishPanelGumroad.trim(),
                publishedAt: publishPanelDate || null,
            };
            if (publishPanelDate || publishPanelAsin || publishPanelEtsy) body.phase = "published";
            const res = await fetch(`${API_BASE_URL}/niches/${nicheId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error("Error al guardar");
            const data = await res.json();
            setNiches(prev => prev.map(n => n._id === nicheId ? data.niche : n));
            setNichePublishPanelId(null);
            toast.success("Datos de publicación guardados");
        } catch { toast.error("Error al guardar publicación"); }
        finally { setIsSavingPublish(false); }
    };

    const addRoyaltyEntry = async (nicheId: string) => {
        if (!royaltiesMonth || !royaltiesRevenue) { toast.error("Mes e ingresos son obligatorios"); return; }
        setIsSavingRoyalties(true);
        try {
            const res = await fetch(`${API_BASE_URL}/niches/${nicheId}/royalties`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month: royaltiesMonth, sales: Number(royaltiesSales) || 0, revenue: Number(royaltiesRevenue) }),
            });
            if (!res.ok) throw new Error("Error");
            const data = await res.json();
            setNiches(prev => prev.map(n => n._id === nicheId ? data.niche : n));
            setRoyaltiesSales("");
            setRoyaltiesRevenue("");
            toast.success("Royalties registrados");
        } catch { toast.error("Error al guardar royalties"); }
        finally { setIsSavingRoyalties(false); }
    };

    const deleteRoyaltyEntry = async (nicheId: string, month: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/niches/${nicheId}/royalties/${encodeURIComponent(month)}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Error");
            const data = await res.json();
            setNiches(prev => prev.map(n => n._id === nicheId ? data.niche : n));
        } catch { toast.error("Error al eliminar royalty"); }
    };

    const saveCurrentPrompt = async () => {
        if (!promptTheme.trim()) { toast.error("La temática está vacía"); return; }
        if (!savePromptName.trim()) { toast.error("Dale un nombre al prompt"); return; }
        setIsSavingPrompt(true);
        try {
            const model = AI_MODELS.find(m => m.id === selectedModel);
            const res = await fetch(`${API_BASE_URL}/saved-prompts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: savePromptName.trim(),
                    category: savePromptCategory,
                    promptParts: { theme: promptTheme.trim(), specs: promptSpecs.trim(), details: promptDetails.trim(), particulars: promptParticulars.trim() },
                    aiModel: model ? { id: model.id, name: model.name, provider: model.provider, modelId: model.modelId } : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            setSavedPrompts(prev => [data.prompt, ...prev]);
            setShowSavePromptDialog(false);
            setSavePromptName("");
            toast.success("Prompt guardado");
        } catch (e: any) {
            toast.error(e.message ?? "Error al guardar prompt");
        } finally {
            setIsSavingPrompt(false);
        }
    };

    const deleteSavedPrompt = async (id: string) => {
        try {
            await fetch(`${API_BASE_URL}/saved-prompts/${id}`, { method: "DELETE" });
            setSavedPrompts(prev => prev.filter(p => p._id !== id));
            toast.success("Prompt eliminado");
        } catch { toast.error("Error al eliminar prompt"); }
    };

    const renameSavedPrompt = async (id: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed) { setEditingPromptId(null); return; }
        setSavedPrompts(prev => prev.map(p => p._id === id ? { ...p, name: trimmed } : p));
        setEditingPromptId(null);
        try {
            await fetch(`${API_BASE_URL}/saved-prompts/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed }),
            });
        } catch { toast.error("Error al renombrar prompt"); }
    };

    const updateSavedPrompt = async (id: string, patch: Partial<Pick<SavedPromptFE, "name" | "category" | "promptParts" | "aiModel">>) => {
        try {
            const res = await fetch(`${API_BASE_URL}/saved-prompts/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            setSavedPrompts(prev => prev.map(p => p._id === id ? { ...p, ...patch } : p));
        } catch { toast.error("Error al actualizar prompt"); }
    };

    const loadSavedPrompt = (p: SavedPromptFE) => {
        setPromptTheme(p.promptParts.theme);
        setPromptSpecs(p.promptParts.specs);
        setPromptDetails(p.promptParts.details);
        setPromptParticulars(p.promptParts.particulars);
        if (p.aiModel?.id) {
            const match = AI_MODELS.find(m => m.id === p.aiModel!.id);
            if (match) setSelectedModel(match.id);
        }
        toast.success("Prompt cargado");
    };


    const deleteCatalogImageConfirmed = async (catalogId: string, publicId: string) => {
        setConfirmDeleteImageInfo(null);
        closePreview();
        try {
            const res = await fetch(`${API_BASE_URL}/catalogs/${catalogId}/delete-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publicId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            setIaCatalogs((prev) =>
                prev.map((c) =>
                    c._id === catalogId
                        ? { ...c, images: c.images.filter((img) => img.publicId !== publicId) }
                        : c
                )
            );
            toast.success("Imagen eliminada");
        } catch (e: any) {
            toast.error(e.message ?? "Error al eliminar imagen");
        }
    };

    const bulkDeleteSelectedImages = async (catalogId: string) => {
        if (bulkDeleteSelection.size === 0) return;
        setIsBulkDeleting(true);
        const publicIds = [...bulkDeleteSelection];
        try {
            await Promise.all(publicIds.map(pid =>
                fetch(`${API_BASE_URL}/catalogs/${catalogId}/delete-image`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ publicId: pid }),
                })
            ));
            setIaCatalogs(prev => prev.map(c =>
                c._id === catalogId ? { ...c, images: c.images.filter(img => !bulkDeleteSelection.has(img.publicId)) } : c
            ));
            toast.success(`${publicIds.length} imagen${publicIds.length !== 1 ? "es" : ""} eliminada${publicIds.length !== 1 ? "s" : ""}`);
            setBulkDeleteSelection(new Set());
            setBulkDeleteCatalogId(null);
        } catch {
            toast.error("Error al eliminar imágenes");
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const addImageFileToVault = (file: File) => {
        if (!file.type.startsWith("image/")) { toast.error("Solo se aceptan imágenes"); return; }
        const url = URL.createObjectURL(file);
        const modelName = AI_MODELS.find(m => m.id === selectedModel)?.name || "Importado";
        const dimName = AI_DIMENSIONS.find(d => d.id === selectedDim)?.ratio || "—";
        setVaultImages(prev => [{ url, model: modelName, dim: dimName }, ...prev]);
        toast.success("Imagen añadida al vault");
    };

    const addCatalogImageToVault = (img: CatalogImageFE) => {
        setVaultImages((prev) => [{ url: img.url, model: "Catálogo IA", dim: `${img.width}x${img.height}` }, ...prev]);
        toast.success("Imagen añadida al vault");
    };

    const openVaultImagePreview = (index: number) => {
        setPreviewImage(vaultImages[index].url);
        setPreviewContext({ urls: vaultImages.map(v => v.url), index, vaultCtx: true });
    };

    const openCloudinaryImagePreview = (index: number) => {
        setPreviewImage(cloudinaryImages[index].url);
        setPreviewContext({ urls: cloudinaryImages.map(c => c.url), index, cloudinaryCtx: true });
    };

    const genPageId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

    const addImagePage = (url: string, label?: string) => {
        const id = genPageId();
        setBookPages(prev => [...prev, { id, type: "image", image: { url, scale: 1, label }, text: defaultTextStyle() }]);
        setSelectedPageId(id);
        setBookEditorTab("editor");
    };

    const addBlankPage = (type: BookPage["type"]) => {
        const id = genPageId();
        setBookPages(prev => [...prev, { id, type, text: defaultTextStyle() }]);
        setSelectedPageId(id);
        setShowAddPageMenu(false);
        setBookEditorTab("editor");
    };

    const openKdpTemplateSelector = () => {
        const completedCatalogs = iaCatalogs.filter(c => c.status === "completed" && c.images.length > 0);
        if (vaultImages.length === 0 && completedCatalogs.length === 0 && cloudinaryImages.length === 0) {
            toast.error("No hay imágenes en el vault, almacén ni catálogos completados");
            return;
        }
        setKdpTemplateVaultSel(new Set());
        setKdpTemplateCatalogSel(new Set());
        setKdpTemplateCloudSel(new Set());
        setKdpTemplateOpen(true);
    };

    const applyColoringBookTemplate = (titleText = "Mi Libro de Colorear", imageEntries?: { url: string; label: string }[], randomOrder = false) => {
        let entries = imageEntries ?? [
            ...vaultImages.map(v => ({ url: v.url, label: v.model || "Vault" })),
            ...iaCatalogs
                .filter(c => c.status === "completed" && c.images.length > 0)
                .flatMap(c => c.images.map((img, i) => ({ url: img.url, label: `${c.name} #${i + 1}` }))),
        ];

        if (entries.length === 0) {
            toast.error("No hay imágenes seleccionadas");
            return;
        }

        if (randomOrder) {
            entries = [...entries].sort(() => Math.random() - 0.5);
        }

        const pages: BookPage[] = [];

        // Owner/copyright first page (if enabled)
        if (includeOwnerPage) {
            pages.push({ id: genPageId(), type: "owner", text: defaultTextStyle() });
        }

        // Title page + optional blank back
        const titleStyle = defaultTextStyle();
        titleStyle.content = titleText;
        titleStyle.fontSize = 24;
        titleStyle.bold = true;
        titleStyle.verticalAlign = "middle";
        titleStyle.align = "center";
        pages.push({ id: genPageId(), type: "text", text: titleStyle });
        if (!noBlankPages) pages.push({ id: genPageId(), type: "text", text: defaultTextStyle() }); // blank back

        // Image pages — blank back only when noBlankPages is off
        for (const { url, label } of entries) {
            pages.push({ id: genPageId(), type: "image", image: { url, scale: 1, label }, text: defaultTextStyle() });
            if (!noBlankPages) pages.push({ id: genPageId(), type: "text", text: defaultTextStyle() }); // blank back
        }

        setBookPages(pages);
        setSelectedPageId(pages[0].id);
        setBookEditorOpen(true);
        const ownerNote = includeOwnerPage ? " + pág. propietario" : "";
        const blankNote = noBlankPages ? " · sin páginas en blanco" : "";
        toast.success(`Plantilla KDP · ${pages.length} páginas (${entries.length} imágenes${randomOrder ? " · orden aleatorio" : ""}${ownerNote}${blankNote})`);
    };

    const deletePage = (id: string) => {
        setBookPages(prev => {
            const next = prev.filter(p => p.id !== id);
            if (selectedPageId === id) setSelectedPageId(next[0]?.id ?? null);
            return next;
        });
    };

    const updatePageType = (id: string, type: BookPage["type"]) => {
        setBookPages(prev => prev.map(p => p.id === id ? { ...p, type } : p));
    };

    const updatePageText = (id: string, patch: Partial<PageTextStyle>) => {
        setBookPages(prev => prev.map(p => p.id === id ? { ...p, text: { ...p.text, ...patch } } : p));
    };

    const updatePageImageScale = (id: string, scale: number) => {
        setBookPages(prev => prev.map(p => p.id === id && p.image ? { ...p, image: { ...p.image, scale } } : p));
    };

    const clearPageImage = (id: string) => {
        setBookPages(prev => prev.map(p => p.id === id ? { ...p, image: undefined } : p));
    };

    const setPageImage = (id: string, url: string, label?: string) => {
        setBookPages(prev => prev.map(p => p.id === id ? { ...p, image: { url, scale: 1, label } } : p));
    };

    const updatePageImageBorder = (id: string, border: { width: number; color: string } | undefined) => {
        setBookPages(prev => prev.map(p => p.id === id && p.image ? { ...p, image: { ...p.image, border } } : p));
    };

    const duplicatePage = (id: string) => {
        const page = bookPages.find(p => p.id === id);
        if (!page) return;
        const newId = genPageId();
        const clone = { ...page, id: newId };
        setBookPages(prev => {
            const idx = prev.findIndex(p => p.id === id);
            const next = [...prev];
            next.splice(idx + 1, 0, clone);
            return next;
        });
        setSelectedPageId(newId);
    };

    const toggleImageSelect = (url: string) => {
        setSelectedImageUrls(prev => {
            const next = new Set(prev);
            if (next.has(url)) next.delete(url); else next.add(url);
            return next;
        });
    };

    const addSelectedAsPages = () => {
        const urls = [...selectedImageUrls];
        if (urls.length === 0) return;
        const newPages: BookPage[] = urls.map(url => {
            const vaultMatch = vaultImages.find(v => v.url === url);
            const catImg = iaCatalogs.flatMap(c => c.images).find(i => i.url === url);
            const cloudMatch = cloudinaryImages.find(c => c.url === url);
            const label = vaultMatch?.model ?? (catImg ? "Catálogo" : cloudMatch?.publicId.split("/").pop() ?? "");
            return { id: genPageId(), type: "image" as const, image: { url, scale: 1, label }, text: defaultTextStyle() };
        });
        setBookPages(prev => [...prev, ...newPages]);
        setSelectedImageUrls(new Set());
        setSelectedPageId(newPages[0].id);
        setBookEditorTab("editor");
        toast.success(`${newPages.length} página${newPages.length > 1 ? "s" : ""} añadida${newPages.length > 1 ? "s" : ""}`);
    };

    const KDP_PAGE_SIZES = {
        "6x9": { label: '6"×9"', w: 432, h: 648 },
        "8x10": { label: '8"×10"', w: 576, h: 720 },
        "8.5x11": { label: '8.5"×11"', w: 612, h: 792 },
        "a4": { label: "A4", w: 595.28, h: 841.89 },
    } as const;

    const KDP_BOOK_SIZES = [
        { id: "8.5x11",  label: '8.5"×11"', sublabel: "21,59×27,94 cm", w: 612,    h: 792,    margin: 40 },
        { id: "8x10",    label: '8"×10"',   sublabel: "20,32×25,4 cm",  w: 576,    h: 720,    margin: 38 },
        { id: "7x10",    label: '7"×10"',   sublabel: "17,78×25,4 cm",  w: 504,    h: 720,    margin: 36 },
        { id: "6x9",     label: '6"×9"',    sublabel: "15,24×22,86 cm", w: 432,    h: 648,    margin: 32 },
        { id: "5.5x8.5", label: '5.5"×8.5"', sublabel: "13,97×21,59 cm", w: 396,  h: 612,    margin: 30 },
        { id: "5x8",     label: '5"×8"',    sublabel: "12,7×20,32 cm",  w: 360,    h: 576,    margin: 28 },
        { id: "a4",      label: "A4",        sublabel: "21,0×29,7 cm",   w: 595.28, h: 841.89, margin: 40 },
    ];

    const exportKdpPdf = async () => {
        const urls = [...selectedImageUrls];
        if (urls.length === 0) return;
        setIsExportingKdpPdf(true);
        try {
            const { PDFDocument: PD } = await import("pdf-lib");
            const pdf = await PD.create();
            const size = KDP_PAGE_SIZES[kdpPdfSize];
            for (const url of urls) {
                let bytes: Uint8Array;
                try {
                    const res = await fetch(url);
                    bytes = new Uint8Array(await res.arrayBuffer());
                } catch {
                    const objUrl = await ensureObjectUrl(url);
                    const res2 = await fetch(objUrl);
                    bytes = new Uint8Array(await res2.arrayBuffer());
                }
                let embedded: any;
                try { embedded = await pdf.embedPng(bytes); } catch { embedded = await pdf.embedJpg(bytes); }
                const page = pdf.addPage([size.w, size.h]);
                const scale = Math.min(size.w / embedded.width, size.h / embedded.height);
                const dw = embedded.width * scale;
                const dh = embedded.height * scale;
                page.drawImage(embedded, { x: (size.w - dw) / 2, y: (size.h - dh) / 2, width: dw, height: dh });
            }
            const pdfBytes = await pdf.save();
            const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
            const blobUrl = URL.createObjectURL(blob);
            await downloadFile(blobUrl, `interior-kdp-${size.label.replace(/[^a-z0-9]/gi, "")}.pdf`);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
            toast.success(`PDF KDP generado · ${urls.length} página${urls.length > 1 ? "s" : ""} · ${size.label}`);
            setSelectedImageUrls(new Set());
            setIsVaultSelectMode(false);
        } catch (e) {
            console.error(e);
            toast.error("Error al generar el PDF");
        } finally {
            setIsExportingKdpPdf(false);
        }
    };

    const toggleFavorite = (url: string, meta?: Pick<FavoriteImage, "label" | "source">) => {
        setFavorites(prev => {
            const next = new Map(prev);
            if (next.has(url)) {
                next.delete(url);
            } else {
                next.set(url, {
                    url,
                    label: meta?.label ?? "",
                    source: meta?.source ?? "generated",
                    savedAt: new Date().toISOString(),
                });
            }
            // Persist stable (non-blob) objects to MongoDB via /settings
            const stable = [...next.values()].filter(f => !f.url.startsWith("blob:"));
            fetch(`${API_BASE_URL}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{ key: "kdp-favorites", value: stable }]),
            }).catch(() => { });
            return next;
        });
    };

    const handleBookDragStart = (idx: number) => setBookDragIdx(idx);
    const handleBookDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setBookDragOverIdx(idx); };
    const handleBookDrop = (toIdx: number) => {
        if (bookDragIdx === null || bookDragIdx === toIdx) { setBookDragIdx(null); setBookDragOverIdx(null); return; }
        setBookPages(prev => {
            const next = [...prev];
            const [moved] = next.splice(bookDragIdx, 1);
            next.splice(toIdx, 0, moved);
            return next;
        });
        setBookDragIdx(null);
        setBookDragOverIdx(null);
    };
    const handleBookDragEnd = () => { setBookDragIdx(null); setBookDragOverIdx(null); };

    const handleThumbnailTouchStart = (e: React.TouchEvent, idx: number) => {
        touchReorderRef.current = { startIdx: idx, currentIdx: idx };
        setBookDragIdx(idx);
    };
    const handleThumbnailTouchMove = (e: React.TouchEvent) => {
        if (!touchReorderRef.current) return;
        e.preventDefault();
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const thumbEl = el?.closest("[data-page-idx]");
        if (thumbEl) {
            const toIdx = parseInt(thumbEl.getAttribute("data-page-idx") ?? "0", 10);
            if (toIdx !== touchReorderRef.current.currentIdx) {
                touchReorderRef.current.currentIdx = toIdx;
                setBookDragOverIdx(toIdx);
            }
        }
    };
    const handleThumbnailTouchEnd = () => {
        if (!touchReorderRef.current) return;
        const { startIdx, currentIdx } = touchReorderRef.current;
        touchReorderRef.current = null;
        if (startIdx !== currentIdx) {
            setBookPages(prev => {
                const next = [...prev];
                const [moved] = next.splice(startIdx, 1);
                next.splice(currentIdx, 0, moved);
                return next;
            });
        }
        setBookDragIdx(null);
        setBookDragOverIdx(null);
    };

    const openCatalogImagePreview = (images: CatalogImageFE[], index: number, catalogId?: string) => {
        setPreviewImage(images[index].url);
        setPreviewContext({
            urls: images.map((i) => i.url),
            index,
            catalogCtx: catalogId ? { id: catalogId, images } : undefined,
        });
    };

    const closePreview = () => {
        setPreviewImage(null);
        setPreviewContext(null);
    };

    const navigatePreview = (dir: -1 | 1) => {
        if (!previewContext) return;
        const next = previewContext.index + dir;
        if (next < 0 || next >= previewContext.urls.length) return;
        setPreviewImage(previewContext.urls[next]);
        setPreviewContext({ ...previewContext, index: next });
        if (previewLensRef.current) previewLensRef.current.style.display = "none";
    };


    const blobUrlToDataUrl = async (url: string): Promise<string> => {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const fetchCloudinaryImages = async () => {
        setIsLoadingCloudinary(true);
        try {
            const res = await fetch(`${API_BASE_URL}/cloudinary/images`);
            if (!res.ok) return;
            const data = await res.json();
            setCloudinaryImages(data.images ?? []);
        } catch {
            // silently ignore if not configured
        } finally {
            setIsLoadingCloudinary(false);
        }
    };

    const createCustomCatalogFromCloud = async () => {
        const selected = cloudinaryImages.filter(img => selectedCloudUrls.has(img.url));
        if (selected.length === 0 || !customCatalogName.trim()) return;
        setIsCreatingCustomCatalog(true);
        try {
            const res = await fetch(`${API_BASE_URL}/catalogs/from-cloudinary`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: customCatalogName.trim(), images: selected }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al crear catálogo");
            setIaCatalogs(prev => [data.catalog, ...prev]);
            toast.success(`Catálogo "${customCatalogName.trim()}" creado con ${selected.length} imágenes`);
            setShowCustomCatalogModal(false);
            setCustomCatalogName("");
            setSelectedCloudUrls(new Set());
            setIsCloudSelectMode(false);
        } catch (e: any) {
            toast.error(e.message ?? "Error al crear catálogo personalizado");
        } finally {
            setIsCreatingCustomCatalog(false);
        }
    };

    const downloadZip = async () => {
        if (zipSelection.size === 0) return;
        setIsDownloadingZip(true);
        try {
            // Build image list with clean filenames
            const allZipImages: { url: string; filename: string }[] = [];
            const usedNames = new Map<string, number>();
            const uniqueName = (base: string, ext: string) => {
                const key = base;
                const n = usedNames.get(key) ?? 0;
                usedNames.set(key, n + 1);
                return n === 0 ? `${base}.${ext}` : `${base}-${n}.${ext}`;
            };

            // Vault
            vaultImages.forEach((img, i) => {
                if (!zipSelection.has(img.url)) return;
                const base = img.model?.replace(/[^a-z0-9]/gi, "_").toLowerCase() || `vault-${i + 1}`;
                allZipImages.push({ url: img.url, filename: uniqueName(base, "jpg") });
            });
            // Catalogs
            iaCatalogs.forEach(c => {
                c.images.forEach((img, i) => {
                    if (!zipSelection.has(img.url)) return;
                    const base = `${c.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${String(i + 1).padStart(3, "0")}`;
                    allZipImages.push({ url: img.url, filename: uniqueName(base, "jpg") });
                });
            });
            // Cloudinary
            cloudinaryImages.forEach(img => {
                if (!zipSelection.has(img.url)) return;
                const base = img.publicId.split("/").pop()?.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "cloudinary";
                allZipImages.push({ url: img.url, filename: uniqueName(base, "jpg") });
            });

            const res = await fetch(`${API_BASE_URL}/zip/download`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ images: allZipImages, name: zipName || "imagenes-kdp" }),
            });
            if (!res.ok) throw new Error("Error al generar ZIP");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${zipName || "imagenes-kdp"}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success(`${allZipImages.length} imágenes descargadas`);
        } catch (e: any) {
            toast.error(e.message ?? "Error al descargar ZIP");
        } finally {
            setIsDownloadingZip(false);
        }
    };

    const uploadToCloudinary = async (vaultIndex: number) => {
        const img = vaultImages[vaultIndex];
        if (!img) return;
        setUploadingToCloud(vaultIndex);
        try {
            const dataUrl = await blobUrlToDataUrl(img.url);
            const res = await fetch(`${API_BASE_URL}/cloudinary/upload`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataUrl }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Upload failed");
            toast.success("Imagen guardada en Cloudinary");
            setCloudinaryImages((prev) => [data.image, ...prev]);
            setVaultImages((prev) => prev.filter((_, idx) => idx !== vaultIndex));
        } catch (e: any) {
            toast.error(e.message ?? "Error al subir a Cloudinary");
        } finally {
            setUploadingToCloud(null);
        }
    };

    const deleteFromCloudinary = async (publicId: string) => {
        setDeletingFromCloud(publicId);
        try {
            const res = await fetch(`${API_BASE_URL}/cloudinary/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publicId }),
            });
            if (!res.ok) throw new Error("Error al eliminar");
            setCloudinaryImages((prev) => prev.filter((img) => img.publicId !== publicId));
            toast.success("Imagen eliminada de Cloudinary");
        } catch (e: any) {
            toast.error(e.message ?? "Error al eliminar");
        } finally {
            setDeletingFromCloud(null);
        }
    };

    const [isGenerating, setIsGenerating] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewZoom, setPreviewZoom] = useState(2);
    const [previewMagnifier, setPreviewMagnifier] = useState(false);
    const previewImgRef = useRef<HTMLImageElement | null>(null);
    const previewLensRef = useRef<HTMLDivElement | null>(null);
    const [vaultImages, setVaultImages] = useState<{ url: string, model: string, dim: string, seed?: number }[]>([]);
    const generatedImageObjectUrlRef = useRef<string | null>(null);
    const previewImageObjectUrlRef = useRef<string | null>(null);

    const [coverTitle, setCoverTitle] = useState("");
    const [coverSubtitle, setCoverSubtitle] = useState("");
    const [coverStyle, setCoverStyle] = useState("vibrant illustration, fantasy");
    const [coverColorTheme, setCoverColorTheme] = useState("deep blue and gold");
    const [coverModelId, setCoverModelId] = useState("pollinations-flux");
    const [isBuildingCover, setIsBuildingCover] = useState(false);
    const [generatedCoverUrl, setGeneratedCoverUrl] = useState<string | null>(null);
    const [showCoverModal, setShowCoverModal] = useState(false);
    const [coverModalTab, setCoverModalTab] = useState<"front" | "back">("front");
    const [coverDescription, setCoverDescription] = useState("");
    const [coverAuthor, setCoverAuthor] = useState("");
    const [generatedBackCoverUrl, setGeneratedBackCoverUrl] = useState<string | null>(null);
    const [isBuildingBackCover, setIsBuildingBackCover] = useState(false);
    const [selectedCoverNicheId, setSelectedCoverNicheId] = useState<string | null>(null);

    const [bookEditorOpen, setBookEditorOpen] = useState(false);
    const [bookFileName, setBookFileName] = useState("libro-kdp");
    const [bookPdfSize, setBookPdfSize] = useState("8.5x11");
    const [isBuildingPdf, setIsBuildingPdf] = useState(false);
    const [includeOwnerPage, setIncludeOwnerPage] = useState(true);
    const [noBlankPages, setNoBlankPages] = useState(false);
    const [showGelatoUpload, setShowGelatoUpload] = useState(false);
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [showKdpTips, setShowKdpTips] = useState(false);
    const [splitParts, setSplitParts] = useState(2);
    const [splitProgress, setSplitProgress] = useState<{ current: number; total: number } | null>(null);
    const [gelatoStoreProducts, setGelatoStoreProducts] = useState<any[]>([]);
    const [gelatoOrders, setGelatoOrders] = useState<any[]>([]);
    const [loadingGelatoData, setLoadingGelatoData] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);

    const selectedSizeConfig = useMemo(
        () => KDP_BOOK_SIZES.find(s => s.id === bookPdfSize) ?? KDP_BOOK_SIZES[0],
        [bookPdfSize]
    );
    const previewW = selectedSizeConfig.w;
    const previewH = selectedSizeConfig.h;
    const previewMargin = selectedSizeConfig.margin;

    const [bookDrafts, setBookDrafts] = useState<{ id: string; fileName: string; pages: BookPage[]; savedAt: string }[]>([]);
    const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
    const [confirmDeleteDraftId, setConfirmDeleteDraftId] = useState<string | null>(null);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [showCatalogAccordion, setShowCatalogAccordion] = useState(false);
    const [negativePrompt, setNegativePrompt] = useState("");
    const [inferenceSteps, setInferenceSteps] = useState(28);
    const [guidanceScale, setGuidanceScale] = useState(7.5);
    const [fixedSeed, setFixedSeed] = useState("");
    const [ideogramStyle, setIdeogramStyle] = useState("AUTO");
    const [initImageDataUrl, setInitImageDataUrl] = useState<string | null>(null);
    const [initImageStrength, setInitImageStrength] = useState(0.6);

    const downloadFile = async (url: string, filename: string) => {
        try {
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                const res = await fetch(url);
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
            }
        } catch {
            toast.error("Error al descargar la imagen");
        }
    };

    const downloadPng = (url: string, filenameBase: string) => {
        void downloadFile(url, `${filenameBase}.png`);
    };

    const setGeneratedImageFromFile = (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Solo se aceptan imágenes");
            return;
        }
        if (generatedImageObjectUrlRef.current) {
            URL.revokeObjectURL(generatedImageObjectUrlRef.current);
            generatedImageObjectUrlRef.current = null;
        }
        const url = URL.createObjectURL(file);
        generatedImageObjectUrlRef.current = url;
        setIsGenerating(false);
        setIsImageLoading(true);
        setGeneratedImage(url);
        toast.success("Imagen cargada");
    };

    const setInitImageFromFile = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Solo se aceptan imágenes");
            return;
        }
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onerror = () => reject(new Error("read failed"));
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(file);
        });
        setInitImageDataUrl(dataUrl);
        toast.success("Imagen de referencia añadida");
    };


    const ensureObjectUrl = async (url: string) => {
        if (url.startsWith("blob:")) return url;
        const res = await fetch(url);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        return objectUrl;
    };

    const saveBookDraft = async () => {
        setIsSavingDraft(true);
        try {
            const serializablePages = bookPages.map(p => ({
                ...p,
                image: p.image?.url.startsWith("blob:") ? undefined : p.image,
            }));
            const draftId = activeDraftId ?? `draft-${Date.now()}`;
            const savedAt = new Date().toISOString();
            const draft = { id: draftId, fileName: bookFileName, pages: serializablePages, savedAt };
            const updated = bookDrafts.some(d => d.id === draftId)
                ? bookDrafts.map(d => d.id === draftId ? draft : d)
                : [...bookDrafts, draft];
            setBookDrafts(updated);
            setActiveDraftId(draftId);
            await fetch(`${API_BASE_URL}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{ key: "kdp-book-drafts", value: updated }]),
            });
            toast.success("Borrador guardado");
        } catch {
            toast.error("Error al guardar el borrador");
        } finally {
            setIsSavingDraft(false);
        }
    };

    const deleteBookDraft = async (draftId: string) => {
        const updated = bookDrafts.filter(d => d.id !== draftId);
        setBookDrafts(updated);
        if (activeDraftId === draftId) {
            setBookPages([]);
            setSelectedPageId(null);
            setBookFileName("libro-kdp");
            setActiveDraftId(null);
            setBookEditorOpen(false);
        }
        try {
            await fetch(`${API_BASE_URL}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{ key: "kdp-book-drafts", value: updated }]),
            });
        } catch { /* silent */ }
    };

    const loadBookDraft = (draft: { id: string; fileName: string; pages: BookPage[]; savedAt: string }) => {
        setBookPages(draft.pages);
        setSelectedPageId(draft.pages[0]?.id ?? null);
        setBookFileName(draft.fileName);
        setActiveDraftId(draft.id);
        setBookEditorOpen(true);
    };

    const newBookDraft = () => {
        setBookPages([]);
        setSelectedPageId(null);
        setBookFileName("libro-kdp");
        setActiveDraftId(null);
        setBookEditorOpen(true);
    };

    const downloadCatalogPdfDirect = async (catalog: { _id: string; name: string; images: { url: string }[] }) => {
        if (!catalog.images.length) return;
        setDirectPdfCatalogId(catalog._id);
        try {
            const pages: BookPage[] = catalog.images.map((img, i) => ({
                id: `dp-${i}-${Date.now()}`,
                type: "image" as const,
                image: { url: img.url, scale: 1, label: `${catalog.name} #${i + 1}` },
                text: defaultTextStyle(),
            }));
            const bytes = await buildBookPdf(undefined, false, pages, true);
            if (!bytes) throw new Error("No se pudo generar el PDF");
            const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `${catalog.name || "libro-kdp"}.pdf`;
            a.click();
            toast.success(`PDF generado · ${catalog.images.length} páginas`);
        } catch (e: any) {
            toast.error(e.message ?? "Error generando PDF");
        } finally {
            setDirectPdfCatalogId(null);
        }
    };

    const downloadNichePdfDirect = async (niche: NicheFE, linkedCats: typeof iaCatalogs) => {
        const allImages = linkedCats.flatMap(c => c.images);
        if (!allImages.length) { toast.error("Este nicho no tiene imágenes aún"); return; }
        setDirectNichePdfId(niche._id);
        try {
            const pages: BookPage[] = allImages.map((img, i) => ({
                id: `np-${i}-${Date.now()}`,
                type: "image" as const,
                image: { url: img.url, scale: 1, label: `${niche.name} #${i + 1}` },
                text: defaultTextStyle(),
            }));
            const bytes = await buildBookPdf(undefined, false, pages, true);
            if (!bytes) throw new Error("No se pudo generar el PDF");
            const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `${niche.name || "nicho-kdp"}.pdf`;
            a.click();
            toast.success(`PDF generado · ${allImages.length} imágenes`);
        } catch (e: any) {
            toast.error(e.message ?? "Error generando PDF");
        } finally {
            setDirectNichePdfId(null);
        }
    };

    const buildBookPdf = async (onBytes?: (bytes: Uint8Array) => void, compressImages = false, pagesToUse?: BookPage[], forceNoOwnerPage = false) => {
        const pages = pagesToUse ?? bookPages;
        if (pages.length === 0) return null;
        setIsBuildingPdf(true);
        try {
            const pdf = await PDFDocument.create();
            const fontkitMod = await import("@pdf-lib/fontkit");
            pdf.registerFontkit(fontkitMod.default ?? fontkitMod);
            const sizeConfig = KDP_BOOK_SIZES.find(s => s.id === bookPdfSize) ?? KDP_BOOK_SIZES[0];
            const pageWidth = sizeConfig.w;
            const pageHeight = sizeConfig.h;
            const margin = sizeConfig.margin;

            // Compress an image via Canvas → JPEG. Fetches bytes first to avoid CORS issues.
            const compressToJpeg = async (url: string, quality = 0.68): Promise<Uint8Array> => {
                // Fetch bytes directly (works for any origin via fetch)
                let rawBytes: Uint8Array;
                try {
                    const res = await fetch(url);
                    rawBytes = new Uint8Array(await res.arrayBuffer());
                } catch {
                    const objectUrl = await ensureObjectUrl(url);
                    const res = await fetch(objectUrl);
                    rawBytes = new Uint8Array(await res.arrayBuffer());
                }
                // Create a local blob URL — canvas loads this without CORS restrictions
                const blobUrl = URL.createObjectURL(new Blob([rawBytes as BlobPart]));
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        URL.revokeObjectURL(blobUrl);
                        const MAX = 1400;
                        let { naturalWidth: w, naturalHeight: h } = img;
                        if (w > MAX || h > MAX) {
                            const r = Math.min(MAX / w, MAX / h);
                            w = Math.round(w * r); h = Math.round(h * r);
                        }
                        const canvas = document.createElement("canvas");
                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext("2d")!;
                        ctx.fillStyle = "#fff";
                        ctx.fillRect(0, 0, w, h);
                        ctx.drawImage(img, 0, 0, w, h);
                        canvas.toBlob(blob => {
                            if (!blob) { reject(new Error("Canvas blob failed")); return; }
                            blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
                        }, "image/jpeg", quality);
                    };
                    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("img load failed")); };
                    img.src = blobUrl;
                });
            };

            const embedImage = async (url: string) => {
                if (compressImages) {
                    try {
                        const jpegBytes = await compressToJpeg(url);
                        return await pdf.embedJpg(jpegBytes);
                    } catch { /* fall through to original method */ }
                }
                let bytes: Uint8Array;
                try {
                    const res = await fetch(url);
                    bytes = new Uint8Array(await res.arrayBuffer());
                } catch {
                    const objectUrl = await ensureObjectUrl(url);
                    const res = await fetch(objectUrl);
                    bytes = new Uint8Array(await res.arrayBuffer());
                }
                try { return await pdf.embedPng(bytes); } catch { return await pdf.embedJpg(bytes); }
            };

            const drawImageCentered = (page: any, embedded: any, zoom: number = 1) => {
                const effectiveMargin = margin / Math.max(zoom, 0.1);
                const maxW = pageWidth - effectiveMargin * 2;
                const maxH = pageHeight - effectiveMargin * 2;
                const imgScale = Math.min(maxW / embedded.width, maxH / embedded.height);
                const drawW = embedded.width * imgScale;
                const drawH = embedded.height * imgScale;
                const imgX = (pageWidth - drawW) / 2;
                const imgY = (pageHeight - drawH) / 2;
                page.drawImage(embedded, { x: imgX, y: imgY, width: drawW, height: drawH });
                return { x: imgX, y: imgY, w: drawW, h: drawH };
            };

            // Fetch and embed Roboto TTF so all fonts are fully embedded (KDP requirement)
            const fontRes = await fetch("/fonts/Geist-Regular.ttf");
            const embeddedFont = await pdf.embedFont(new Uint8Array(await fontRes.arrayBuffer()));

            const drawTextOnPage = async (pdfPage: any, style: PageTextStyle) => {
                const text = style.content.trim();
                if (!text) return;
                const font = embeddedFont;
                const fontSize = style.fontSize;
                const hex = style.color.replace("#", "");
                const textColor = rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
                // Handle multi-line: split by newline and render each line
                const lines = text.split("\n");
                const lineH = fontSize * 1.3;
                const blockH = lines.length * lineH;
                let yStart: number;
                if (style.verticalAlign === "top") yStart = pageHeight - margin - fontSize;
                else if (style.verticalAlign === "middle") yStart = (pageHeight + blockH) / 2 - fontSize;
                else yStart = margin + blockH - fontSize; // bottom
                lines.forEach((line, i) => {
                    const w = font.widthOfTextAtSize(line || " ", fontSize);
                    let x = margin;
                    if (style.align === "center") x = Math.max(margin, (pageWidth - w) / 2);
                    else if (style.align === "right") x = Math.max(margin, pageWidth - margin - w);
                    pdfPage.drawText(line || " ", { x, y: yStart - i * lineH, size: fontSize, font, color: textColor });
                });
            };

            // ── Helper: draws the owner/copyright page content scaled to any page size ──
            const drawOwnerPageContent = (pg: any, font: any) => {
                const cx = pageWidth / 2;
                const grayMid = rgb(0.5, 0.5, 0.5);
                const grayLight = rgb(0.78, 0.78, 0.78);
                const grayVeryLight = rgb(0.88, 0.88, 0.88);

                // "pertenece a" section — positioned at ~66.5% and ~63.7% from bottom
                const belongsY  = pageHeight * 0.665;
                const belongsEnY = pageHeight * 0.637;
                const labelSize = Math.round(15 * (pageHeight / 841.89));
                const spanishText = "Este libro pertenece a:";
                const englishText = "This book belongs to:";
                pg.drawText(spanishText, { x: cx - font.widthOfTextAtSize(spanishText, labelSize) / 2, y: belongsY, size: labelSize, font, color: grayMid });
                pg.drawText(englishText, { x: cx - font.widthOfTextAtSize(englishText, labelSize - 1) / 2, y: belongsEnY, size: labelSize - 1, font, color: grayLight });

                // Dotted line at ~60.3% from bottom
                const lineY = pageHeight * 0.603;
                const lineX1 = margin + 50 * (pageWidth / 612);
                const lineX2 = pageWidth - margin - 50 * (pageWidth / 612);
                for (let x = lineX1; x < lineX2; x += 8) {
                    pg.drawLine({ start: { x, y: lineY }, end: { x: Math.min(x + 4, lineX2), y: lineY }, thickness: 0.8, color: grayLight });
                }

                // Color test squares at ~12.8% from bottom
                const squareSize = Math.round(30 * (pageWidth / 612));
                const squareCount = 6;
                const squareGap = Math.round(9 * (pageWidth / 612));
                const totalW = squareCount * squareSize + (squareCount - 1) * squareGap;
                const squareStartX = cx - totalW / 2;
                const squareY = pageHeight * 0.128;
                const colorTestLabel = "Prueba tus colores aquí  ·  Test your colors here";
                const colorLabelSize = Math.max(5, 7.5 * (pageHeight / 841.89));
                pg.drawText(colorTestLabel, { x: cx - font.widthOfTextAtSize(colorTestLabel, colorLabelSize) / 2, y: squareY + squareSize + 10, size: colorLabelSize, font, color: grayMid });
                pg.drawRectangle({ x: squareStartX - 6, y: squareY - 6, width: totalW + 12, height: squareSize + 12, borderColor: grayVeryLight, borderWidth: 0.5, color: rgb(1, 1, 1) });
                for (let i = 0; i < squareCount; i++) {
                    pg.drawRectangle({ x: squareStartX + i * (squareSize + squareGap), y: squareY, width: squareSize, height: squareSize, borderColor: grayLight, borderWidth: 0.6, color: rgb(1, 1, 1) });
                }

                // Copyright line — just above the margin
                const copyrightText = `© ${new Date().getFullYear()} Emilio Jiménez. Todos los derechos reservados.`;
                const copyrightSize = Math.max(5, 7 * (pageHeight / 841.89));
                pg.drawText(copyrightText, { x: cx - font.widthOfTextAtSize(copyrightText, copyrightSize) / 2, y: margin + 8, size: copyrightSize, font, color: grayVeryLight });
            };

            // ── Página de propietario / copyright (primera página, si no viene en pages) ──
            if (includeOwnerPage && !forceNoOwnerPage && !pages.some(p => p.type === "owner")) {
                const ownerPage = pdf.addPage([pageWidth, pageHeight]);
                drawOwnerPageContent(ownerPage, embeddedFont);
            }

            for (const bookPage of pages) {
                // ── Owner page type: render same content as standalone owner page ──
                if (bookPage.type === "owner") {
                    const ownerPage = pdf.addPage([pageWidth, pageHeight]);
                    drawOwnerPageContent(ownerPage, embeddedFont);
                    continue;
                }

                const pdfPage = pdf.addPage([pageWidth, pageHeight]);
                if (bookPage.image) {
                    const embedded = await embedImage(bookPage.image.url);
                    drawImageCentered(pdfPage, embedded, bookPage.image.scale ?? 1);
                    if (bookPage.image.border) {
                        const hexToRgb = (hex: string) => {
                            const r = parseInt(hex.slice(1, 3), 16) / 255;
                            const g = parseInt(hex.slice(3, 5), 16) / 255;
                            const b = parseInt(hex.slice(5, 7), 16) / 255;
                            return rgb(r, g, b);
                        };
                        const bw = bookPage.image.border.width;
                        pdfPage.drawRectangle({
                            x: bw / 2,
                            y: bw / 2,
                            width: pageWidth - bw,
                            height: pageHeight - bw,
                            borderColor: hexToRgb(bookPage.image.border.color),
                            borderWidth: bw,
                        });
                    }
                }
                if ((bookPage.type === "text" || bookPage.type === "both") && bookPage.text.content.trim()) {
                    await drawTextOnPage(pdfPage, bookPage.text);
                }
            }

            const pdfBytes = await pdf.save();
            if (onBytes) {
                onBytes(pdfBytes as Uint8Array);
                return pdfBytes as Uint8Array;
            }
            const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            downloadFile(url, `${(bookFileName.trim() || "libro-kdp")}_${bookPdfSize}.pdf`);
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
            toast.success("PDF generado");
            return pdfBytes as Uint8Array;
        } catch (e) {
            console.error(e);
            toast.error("No se pudo generar el PDF");
            return null;
        } finally {
            setIsBuildingPdf(false);
        }
    };

    // Vault persistence: load non-blob images from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem("kdp-vault-images");
            if (saved) {
                const parsed: { url: string; model: string; dim: string; seed?: number }[] = JSON.parse(saved);
                const valid = parsed.filter(img => !img.url.startsWith("blob:"));
                if (valid.length > 0) setVaultImages(valid);
            }
        } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        try {
            const toSave = vaultImages.filter(img => !img.url.startsWith("blob:"));
            localStorage.setItem("kdp-vault-images", JSON.stringify(toSave));
        } catch { /* ignore */ }
    }, [vaultImages]);

    // Load favorites + book draft from MongoDB on mount
    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/settings`);
                if (!res.ok) return;
                const data = await res.json();

                // Favorites
                const favFound = (data.settings ?? []).find((s: any) => s.key === "kdp-favorites");
                if (Array.isArray(favFound?.value) && favFound.value.length > 0) {
                    const map = new Map<string, FavoriteImage>();
                    for (const item of favFound.value) {
                        if (typeof item === "string") {
                            map.set(item, { url: item, label: "", source: "generated", savedAt: new Date().toISOString() });
                        } else if (item && typeof item.url === "string") {
                            map.set(item.url, item as FavoriteImage);
                        }
                    }
                    setFavorites(map);
                }

                // Book drafts (multi-draft)
                const draftsFound = (data.settings ?? []).find((s: any) => s.key === "kdp-book-drafts");
                if (draftsFound?.value && Array.isArray(draftsFound.value) && draftsFound.value.length > 0) {
                    setBookDrafts(draftsFound.value);
                } else {
                    // Migrate legacy single draft
                    const legacyDraft = (data.settings ?? []).find((s: any) => s.key === "kdp-book-draft");
                    if (legacyDraft?.value?.pages && Array.isArray(legacyDraft.value.pages) && legacyDraft.value.pages.length > 0) {
                        const migrated = [{ id: "draft-legacy", fileName: legacyDraft.value.fileName ?? "libro-kdp", pages: legacyDraft.value.pages, savedAt: new Date().toISOString() }];
                        setBookDrafts(migrated);
                    }
                }
            } catch { }
        };
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            if (generatedImageObjectUrlRef.current) {
                URL.revokeObjectURL(generatedImageObjectUrlRef.current);
                generatedImageObjectUrlRef.current = null;
            }
            if (previewImageObjectUrlRef.current) {
                URL.revokeObjectURL(previewImageObjectUrlRef.current);
                previewImageObjectUrlRef.current = null;
            }
        };
    }, []);

    // Load all data on mount in parallel — no tab gating so every section is ready when first visited
    useEffect(() => {
        void fetchProducts();
        void fetchIntegrations();
        void fetchNiches();
        void fetchCloudinaryImages();
        void fetchSavedPrompts();
        setLoadingGelatoData(true);
        Promise.all([
            fetch(`${API_BASE_URL}/gelato/store/products?limit=50`).then(r => r.ok ? r.json() : { products: [] }).catch(() => ({ products: [] })),
            fetch(`${API_BASE_URL}/gelato/orders?limit=10`).then(r => r.ok ? r.json() : { orders: [] }).catch(() => ({ orders: [] })),
        ]).then(([prod, ord]) => {
            setGelatoStoreProducts(prod.products ?? []);
            setGelatoOrders(ord.orders ?? []);
        }).finally(() => setLoadingGelatoData(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Global paste listener: when in creation tab and no image is being shown/generated,
    // paste goes directly to the vault (no need to click the card first)
    const addImageFileToVaultRef = useRef(addImageFileToVault);
    useEffect(() => { addImageFileToVaultRef.current = addImageFileToVault; });
    useEffect(() => {
        if (activeTab !== "creation") return;
        const handleGlobalPaste = (e: ClipboardEvent) => {
            if (generatedImage || isGenerating) return;
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
            const items = Array.from(e.clipboardData?.items || []);
            const imageItem = items.find(it => it.kind === "file" && it.type.startsWith("image/"));
            const file = imageItem?.getAsFile();
            if (file) addImageFileToVaultRef.current(file);
        };
        document.addEventListener("paste", handleGlobalPaste);
        return () => document.removeEventListener("paste", handleGlobalPaste);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, generatedImage, isGenerating]);

    // Fetch catalogs on mount (socket connects when entering creation tab)
    useEffect(() => { void fetchCatalogs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Connect socket when entering the creation tab (catalog real-time updates)
    useEffect(() => {
        if (activeTab !== "creation") return;

        const socket = createApiSocket(API_BASE_URL);
        catalogSocketRef.current = socket;

        socket.on("catalog:progress", (data: { catalogId: string; status: string; current: number; total: number; image?: CatalogImageFE; lastError?: string; skipped?: number; promptSnippet?: string }) => {
            setIaCatalogs((prev) =>
                prev.map((c) => {
                    if (c._id !== data.catalogId) return c;
                    const updated: IACatalogFE = {
                        ...c,
                        status: data.status as IACatalogFE["status"],
                        lastError: data.lastError !== undefined ? data.lastError : c.lastError,
                        skippedImages: data.skipped !== undefined ? data.skipped : c.skippedImages,
                        currentPrompt: data.promptSnippet !== undefined ? data.promptSnippet : c.currentPrompt,
                    };
                    if (data.image) {
                        const alreadyExists = updated.images.some((img) => img.publicId === data.image!.publicId);
                        if (!alreadyExists) updated.images = [...updated.images, data.image];
                    }
                    return updated;
                })
            );
        });

        socket.on("catalog:completed", (data: { catalogId: string }) => {
            setIaCatalogs((prev) => {
                const updated: IACatalogFE[] = prev.map((c) => (c._id === data.catalogId ? { ...c, status: "completed" as const, lastError: "" } : c));
                const catalog = updated.find(c => c._id === data.catalogId);
                toast.success(`"${catalog?.name ?? "Catálogo"}" completado · ${catalog?.images?.length ?? 0} imágenes`);
                return updated;
            });
        });

        socket.on("catalog:queue-activated", (data: { catalogId: string; status: string; name: string }) => {
            setIaCatalogs((prev) =>
                prev.map((c) => (c._id === data.catalogId ? { ...c, status: "running" } : c))
            );
            toast.info(`Cola: iniciando "${data.name}" — primera imagen en 2 min`);
        });

        socket.on("catalog:error", (data: { catalogId: string; error: string }) => {
            setIaCatalogs((prev) =>
                prev.map((c) => (c._id === data.catalogId ? { ...c, status: "failed", lastError: data.error } : c))
            );
            toast.error(`Error en catálogo: ${data.error}`);
        });

        return () => {
            socket.disconnect();
            catalogSocketRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // Track catalog start times and update historical avg on completion
    useEffect(() => {
        iaCatalogs.forEach(c => {
            if ((c.status === "running" || c.status === "pending") && !catalogStartTimeRef.current[c._id]) {
                catalogStartTimeRef.current[c._id] = Date.now();
            }
        });
        iaCatalogs.forEach(c => {
            const startedAt = catalogStartTimeRef.current[c._id];
            if (!startedAt) return;
            if (c.status === "completed" && c.images.length > 0) {
                const secsPerImg = (Date.now() - startedAt) / 1000 / c.images.length;
                avgSecsPerImageRef.current = avgSecsPerImageRef.current * 0.7 + secsPerImg * 0.3;
                delete catalogStartTimeRef.current[c._id];
            } else if (c.status === "cancelled" || c.status === "failed") {
                delete catalogStartTimeRef.current[c._id];
            }
        });
    }, [iaCatalogs]);

    // Live countdown timer for queue estimate
    useEffect(() => {
        const active = iaCatalogs.filter(c => c.status === "running" || c.status === "pending" || c.status === "queued");
        if (active.length === 0) { setQueueEstimateMs(null); return; }
        const interval = setInterval(() => {
            let totalMs = 0;
            const avgMs = avgSecsPerImageRef.current * 1000;
            for (const c of iaCatalogs.filter(cat => cat.status === "running" || cat.status === "pending" || cat.status === "queued")) {
                const remaining = Math.max(0, c.totalImages - c.images.length - (c.skippedImages ?? 0));
                const startedAt = catalogStartTimeRef.current[c._id];
                if ((c.status === "running" || c.status === "pending") && startedAt && c.images.length > 0) {
                    const elapsed = Date.now() - startedAt;
                    const msPerImg = elapsed / c.images.length;
                    totalMs += remaining * msPerImg;
                } else {
                    totalMs += remaining * avgMs;
                }
            }
            setQueueEstimateMs(Math.max(0, totalMs));
        }, 1000);
        return () => clearInterval(interval);
    }, [iaCatalogs]);

    // Sincronizar estado de carga cuando cambia la URL
    useEffect(() => {
        if (generatedImage) {
            setIsImageLoading(true);
        }
    }, [generatedImage]);

    const handleGenerateImage = async (retryCount = 0) => {
        if (!imagePrompt.trim()) return;

        const model = AI_MODELS.find(m => m.id === selectedModel);
        const dimensions = AI_DIMENSIONS.find(d => d.id === selectedDim);

        setIsGenerating(true);
        setGeneratedImage(null);

        try {
            const response = await fetch(`${API_BASE_URL}/ai/generate-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: imagePrompt,
                    modelId: model?.modelId,
                    provider: model?.provider,
                    width: dimensions?.width,
                    height: dimensions?.height,
                    initImage: initImageDataUrl
                        ? { dataUrl: initImageDataUrl, strength: initImageStrength }
                        : undefined,
                    advancedParams: {
                        negativePrompt: negativePrompt.trim() || undefined,
                        steps: (model?.provider === "Hugging Face" || model?.provider === "Leonardo") ? inferenceSteps : undefined,
                        guidanceScale: (model?.provider === "Hugging Face" || model?.provider === "Leonardo") ? guidanceScale : undefined,
                        seed: fixedSeed ? Number(fixedSeed) : undefined,
                        style: model?.provider === "Ideogram" ? ideogramStyle : undefined,
                    },
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                setGeneratedImage(url);
                setIsGenerating(false);
                toast.success("Arte generado con éxito");
                return;
            } else if (response.status === 429 && retryCount < 2) {
                const retryAfter = Number(response.headers.get("Retry-After") || "10");
                const waitMs = Number.isFinite(retryAfter) ? Math.max(3, retryAfter) * 1000 : 10000;
                toast.info(`Límite alcanzado. Reintentando en ${Math.round(waitMs / 1000)}s (${retryCount + 1}/2)`);
                setTimeout(() => handleGenerateImage(retryCount + 1), waitMs);
                return;
            } else if (response.status === 503 && retryCount < 2) {
                toast.info(`El modelo se está cargando... Reintentando (${retryCount + 1}/2)`);
                setTimeout(() => handleGenerateImage(retryCount + 1), 5000);
                return;
            }

            setIsGenerating(false);
            setIsImageLoading(false);
            toast.error("Error generando imagen. Prueba otro modelo o inténtalo de nuevo.");

        } catch (error) {
            console.error("Generation error:", error);
            setIsGenerating(false);
            setIsImageLoading(false);
            toast.error("Error en el motor de generación");
        }
    };

    const handleKeepImage = async () => {
        if (generatedImage) {
            const modelName = AI_MODELS.find(m => m.id === selectedModel)?.name || "Unknown";
            const dimName = AI_DIMENSIONS.find(d => d.id === selectedDim)?.ratio || "1:1";

            let urlToStore = generatedImage;
            try {
                urlToStore = await ensureObjectUrl(generatedImage);
            } catch {
                // keep original URL if it cannot be fetched (may impact PDF generation)
            }

            setVaultImages([{
                url: urlToStore,
                model: modelName,
                dim: dimName,
                seed: fixedSeed ? Number(fixedSeed) : undefined,
            }, ...vaultImages]);
            setGeneratedImage(null);
        }
    };

    const handleDeleteVaultImage = (index: number) => {
        setConfirmDeleteVaultIndex(index);
    };

    const handleAddProduct = () => {
        if (!newTitle.trim()) {
            toast.error("El título es obligatorio");
            return;
        }

        const typeInfo = PRODUCT_TYPES.find(t => t.id === selectedType);

        const mockPlatforms = PLATFORMS.slice(0, Math.floor(Math.random() * 3) + 1).map(name => ({
            name,
            earnings: Math.floor(Math.random() * 100) + 20
        }));
        const totalEarnings = mockPlatforms.reduce((acc, p) => acc + p.earnings, 0);

        const newProduct: DigitalProduct = {
            id: `prod_${Date.now()}`,
            type: typeInfo ? typeInfo.name : "Digital Asset",
            title: newTitle.trim(),
            description: newDesc.trim() || "Generated by KDP Factory AI Engine",
            status: "borrador",
            platforms: mockPlatforms,
            totalEarnings,
            createdAt: new Date().toISOString()
        };

        setProducts([newProduct, ...products]);
        setNewTitle("");
        setNewDesc("");
        toast.success("Producto creado. ¡Revísalo en Insights!");
        changeTab("insights");
    };

    const fetchProducts = async () => {
        setIsLoadingProducts(true);
        try {
            const res = await fetch(`${API_BASE_URL}/digital-products`);
            if (!res.ok) return;
            const data = await res.json();
            setProducts((data.products ?? []).map((p: any) => ({ ...p, id: p._id })));
        } catch { /* keep empty */ } finally {
            setIsLoadingProducts(false);
        }
    };

    const handleSaveProduct = async (draft: DigitalProduct) => {
        try {
            const body = { type: draft.type, title: draft.title, description: draft.description, status: draft.status, platforms: draft.platforms, nicheId: draft.nicheId ?? "", totalEarnings: draft.totalEarnings };
            if (draft._id) {
                const res = await fetch(`${API_BASE_URL}/digital-products/${draft._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                if (res.ok) { const d = await res.json(); setProducts(ps => ps.map(p => p.id === draft.id ? { ...d.product, id: d.product._id } : p)); }
            } else {
                const res = await fetch(`${API_BASE_URL}/digital-products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                if (res.ok) { const d = await res.json(); setProducts(ps => [{ ...d.product, id: d.product._id }, ...ps.filter(p => p.id !== draft.id)]); }
            }
            toast.success("Producto guardado");
        } catch { toast.error("Error al guardar"); }
    };

    const handleDeleteProduct = async (id: string) => {
        const product = products.find(p => p.id === id);
        if (product?._id) {
            await fetch(`${API_BASE_URL}/digital-products/${product._id}`, { method: "DELETE" }).catch(() => {});
        }
        setProducts(products.filter(p => p.id !== id));
        toast.success("Producto eliminado");
    };

    const handleDuplicateProduct = async (product: DigitalProduct) => {
        const body = {
            type: product.type,
            title: `${product.title} (copia)`,
            description: product.description,
            status: "borrador" as const,
            platforms: product.platforms.map(p => ({ ...p, earnings: 0 })),
            nicheId: product.nicheId ?? "",
        };
        try {
            const res = await fetch(`${API_BASE_URL}/digital-products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (res.ok) {
                const d = await res.json();
                setProducts(ps => [{ ...d.product, id: d.product._id }, ...ps]);
                toast.success("Producto duplicado");
            }
        } catch { toast.error("Error al duplicar"); }
    };

    const handleBulkDelete = async () => {
        setIsBulkDeletingProducts(true);
        try {
            await Promise.all([...selectedProductIds].map(id => {
                const p = products.find(x => x.id === id);
                return p?._id ? fetch(`${API_BASE_URL}/digital-products/${p._id}`, { method: "DELETE" }).catch(() => {}) : Promise.resolve();
            }));
            setProducts(ps => ps.filter(p => !selectedProductIds.has(p.id)));
            setSelectedProductIds(new Set());
            toast.success("Productos eliminados");
        } catch { toast.error("Error al eliminar"); } finally { setIsBulkDeletingProducts(false); }
    };

    const handleBulkStatus = async (newStatus: "activo" | "pausado" | "borrador") => {
        try {
            await Promise.all([...selectedProductIds].map(id => {
                const p = products.find(x => x.id === id);
                return p?._id ? fetch(`${API_BASE_URL}/digital-products/${p._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) }).catch(() => {}) : Promise.resolve();
            }));
            setProducts(ps => ps.map(p => selectedProductIds.has(p.id) ? { ...p, status: newStatus } : p));
            setSelectedProductIds(new Set());
            toast.success("Estado actualizado");
        } catch { toast.error("Error al actualizar"); }
    };

    const generateListing = async () => {
        if (!listingTopic.trim()) { toast.error("Describe el producto"); return; }
        setIsGeneratingListing(true);
        setListingResult(null);
        try {
            const selectedNiche = niches.find(n => n._id === selectedListingNicheId);
            const productTypeLabel = selectedNiche?.productType === "coloring-book" ? "Libro de colorear KDP"
                : selectedNiche?.productType === "printable-poster" ? "Poster imprimible KDP"
                : "Libro KDP";
            const extrasContext = selectedNiche
                ? [
                    selectedNiche.tags.length > 0 ? `tags: ${selectedNiche.tags.join(", ")}` : "",
                    selectedNiche.styleCategory ? `estilo: ${selectedNiche.styleCategory}` : "",
                    selectedNiche.description ? `descripción: ${selectedNiche.description}` : "",
                    selectedNiche.demand !== "unknown" ? `demanda: ${selectedNiche.demand}` : "",
                  ].filter(Boolean).join(" · ")
                : undefined;
            const res = await fetch(`${API_BASE_URL}/ai/generate-text`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "kdp-physical-book",
                    niche: listingTopic,
                    productType: productTypeLabel,
                    extras: extrasContext,
                    language: "es",
                }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error ?? "Error"); return; }
            setListingResult(data.result);
        } catch { toast.error("Error conectando con la API"); } finally { setIsGeneratingListing(false); }
    };

    const saveListingToProduct = async () => {
        if (!listingResult) return;
        setIsSavingListing(true);
        try {
            const r = listingResult;
            const keywords = Array.isArray(r.keywords) ? r.keywords : (typeof r.keywords === "string" ? r.keywords.split(/[,\n]/).map((k: string) => k.trim()).filter(Boolean) : []);
            const descText = typeof r.description === "string" ? r.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
            const fullDesc = [descText, keywords.length > 0 ? `Keywords: ${keywords.join(", ")}` : ""].filter(Boolean).join("\n\n");

            if (listingSaveProductId === "new") {
                const body = {
                    type: "KDP Color Book",
                    title: r.title ?? listingTopic,
                    description: fullDesc,
                    status: "borrador" as const,
                    platforms: [],
                    nicheId: selectedListingNicheId ?? undefined,
                };
                const res = await fetch(`${API_BASE_URL}/digital-products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? "Error al crear producto");
                setProducts(prev => [data.product ?? data, ...prev]);
                toast.success(`Producto "${r.title ?? listingTopic}" creado en borrador`);
            } else {
                const body = { title: r.title ?? undefined, description: fullDesc };
                const res = await fetch(`${API_BASE_URL}/digital-products/${listingSaveProductId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? "Error al actualizar producto");
                setProducts(prev => prev.map(p => (p._id === listingSaveProductId || p.id === listingSaveProductId) ? { ...p, title: r.title ?? p.title, description: fullDesc } : p));
                const name = products.find(p => p._id === listingSaveProductId || p.id === listingSaveProductId)?.title ?? "Producto";
                toast.success(`Listing guardado en "${name}"`);
            }
        } catch (e: any) {
            toast.error(e.message ?? "Error al guardar");
        } finally {
            setIsSavingListing(false);
        }
    };

    const monthlyEarningsData = useMemo(() => {
        const map = new Map<string, number>();
        products.forEach(p => {
            p.platforms.forEach(pl => {
                const raw = pl.date?.trim();
                let key = "";
                if (raw && raw.length >= 7) {
                    key = raw.slice(0, 7);
                } else {
                    key = p.createdAt ? p.createdAt.slice(0, 7) : "";
                }
                if (key) map.set(key, (map.get(key) ?? 0) + (pl.earnings || 0));
            });
        });
        return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([month, earnings]) => ({ month, earnings }));
    }, [products]);

    const fetchIntegrations = async () => {
        setIsLoadingIntegrations(true);
        try {
            const res = await fetch(`${API_BASE_URL}/integrations`);
            if (!res.ok) return;
            const data = await res.json();
            setIntegrations((data.integrations ?? []).map((i: any) => ({ ...i, id: i._id })));
        } catch { /* keep empty */ } finally {
            setIsLoadingIntegrations(false);
        }
    };

    const handleSaveIntegration = async () => {
        if (!integrationDraft.name?.trim()) { toast.error("El nombre es obligatorio"); return; }
        setIsSavingIntegration(true);
        try {
            if (editingIntegration?._id) {
                const res = await fetch(`${API_BASE_URL}/integrations/${editingIntegration._id}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(integrationDraft),
                });
                if (res.ok) {
                    const d = await res.json();
                    setIntegrations(prev => prev.map(i => i.id === editingIntegration.id ? { ...d.integration, id: d.integration._id } : i));
                    toast.success("Integración actualizada");
                }
            } else {
                const res = await fetch(`${API_BASE_URL}/integrations`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(integrationDraft),
                });
                if (res.ok) {
                    const d = await res.json();
                    setIntegrations(prev => [...prev, { ...d.integration, id: d.integration._id }]);
                    toast.success("Integración añadida");
                }
            }
            setShowIntegrationModal(false);
            setEditingIntegration(null);
            setIntegrationDraft({});
        } catch { toast.error("Error al guardar"); } finally {
            setIsSavingIntegration(false);
        }
    };

    const handleDeleteIntegration = async (id: string) => {
        const integ = integrations.find(i => i.id === id);
        if (integ?._id) {
            await fetch(`${API_BASE_URL}/integrations/${integ._id}`, { method: "DELETE" }).catch(() => {});
        }
        setIntegrations(prev => prev.filter(i => i.id !== id));
        toast.success("Integración eliminada");
    };

    const COMPETITION_LABELS: Record<NicheFE["competition"], { label: string; color: string }> = {
        unknown: { label: "Desconocida", color: "text-neutral-500 bg-neutral-500/10 border-neutral-500/20" },
        low: { label: "Baja", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
        medium: { label: "Media", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
        high: { label: "Alta", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
    };
    const DEMAND_LABELS: Record<NicheFE["demand"], { label: string; color: string }> = {
        unknown: { label: "Desconocida", color: "text-neutral-500 bg-neutral-500/10 border-neutral-500/20" },
        low: { label: "Baja", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
        medium: { label: "Media", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
        high: { label: "Alta", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    };
    const STATUS_LABELS: Record<NicheStatus, { label: string; color: string }> = {
        found: { label: "Encontrado", color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
        research: { label: "Investigando", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
        active: { label: "Activo", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
        archived: { label: "Archivado", color: "text-neutral-500 bg-neutral-500/10 border-neutral-500/20" },
    };


    const renderInsights = () => {
        const lastMo = monthlyEarningsData.at(-1)?.earnings ?? 0;
        const prevMo = monthlyEarningsData.at(-2)?.earnings ?? 0;
        const monthTrend = prevMo > 0 ? ((lastMo - prevMo) / prevMo * 100) : null;

        const activePlatforms = new Set(
            products.flatMap(p => p.platforms.filter(pl => pl.earnings > 0).map(pl => pl.name))
        );
        const totalPlatforms = new Set(products.flatMap(p => p.platforms.map(pl => pl.name)));

        const topNiche = [...niches]
            .filter(n => n.royalties && n.royalties.length > 0)
            .sort((a, b) => {
                const ea = (a.royalties ?? []).reduce((s, r) => s + r.revenue, 0);
                const eb = (b.royalties ?? []).reduce((s, r) => s + r.revenue, 0);
                return eb - ea;
            })[0] ?? niches.find(n => n.phase === "published") ?? niches[0] ?? null;
        const topNicheDemand = topNiche?.demand;

        return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col gap-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {isLoadingProducts ? [1,2,3,4].map(i => (
                    <div key={i} className="h-28 rounded-2xl bg-white/[0.03] animate-pulse border border-white/5" />
                )) : <>
                    <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-indigo-500/30 hover:shadow-[0_0_30px_rgba(99,102,241,0.12)] transition-all duration-500 group relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/10 blur-2xl rounded-full transition-all group-hover:scale-150" />
                        <div className="flex items-center justify-between relative">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Ganancias Totales</span>
                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><TrendingUp size={16} /></div>
                        </div>
                        <div className="space-y-1 relative">
                            <p className="text-3xl font-black italic tracking-tighter text-white tabular-nums">{stats.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€</p>
                            {monthTrend !== null ? (
                                <div className={`flex items-center gap-1.5 text-[10px] font-bold ${monthTrend >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {monthTrend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                    <span>{monthTrend >= 0 ? "+" : ""}{monthTrend.toFixed(1)}% vs mes anterior</span>
                                </div>
                            ) : (
                                <div className="text-[10px] font-bold text-neutral-600 italic">Sin datos comparativos</div>
                            )}
                        </div>
                    </Card>
                    <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.12)] transition-all duration-500 group relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 blur-2xl rounded-full transition-all group-hover:scale-150" />
                        <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Promedio / Asset</span><div className="p-2 rounded-xl bg-blue-500/10 text-blue-400"><BarChart size={16} /></div></div>
                        <div className="space-y-1"><p className="text-3xl font-black italic tracking-tighter text-white tabular-nums">{stats.avg.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€</p><div className="text-[10px] font-bold text-blue-400 italic">{stats.avg >= 5 ? "Rendimiento Saludable" : stats.avg > 0 ? "En crecimiento" : "Sin ventas aún"}</div></div>
                    </Card>
                    <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.12)] transition-all duration-500 group relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 blur-2xl rounded-full transition-all group-hover:scale-150" />
                        <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Market Reach</span><div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400"><Globe size={16} /></div></div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black italic tracking-tighter text-white">
                                {activePlatforms.size}<span className="text-sm font-bold text-neutral-500 not-italic">/{totalPlatforms.size}</span>
                                <span className="text-xs uppercase text-neutral-500 tracking-widest not-italic ml-2">Platforms</span>
                            </div>
                            {totalPlatforms.size > 0 && (
                                <div className="text-[10px] font-bold text-emerald-400 italic">{[...activePlatforms].slice(0, 2).join(" · ")}{activePlatforms.size > 2 ? ` +${activePlatforms.size - 2}` : ""}</div>
                            )}
                        </div>
                    </Card>
                    <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.12)] transition-all duration-500 group relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 blur-2xl rounded-full transition-all group-hover:scale-150" />
                        <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Top Nicho</span><div className="p-2 rounded-xl bg-blue-500/10 text-blue-400"><Activity size={16} /></div></div>
                        {topNiche ? (
                            <div className="space-y-1 text-xl font-black italic tracking-tighter text-white flex flex-col">
                                <span className="truncate">{topNiche.name}</span>
                                <span className={`text-[11px] uppercase font-black tracking-widest ${topNicheDemand === "high" ? "text-emerald-400" : topNicheDemand === "medium" ? "text-amber-400" : "text-blue-400"}`}>
                                    {topNicheDemand === "high" ? "Alta demanda" : topNicheDemand === "medium" ? "Demanda media" : topNicheDemand === "low" ? "Demanda baja" : topNiche.phase === "published" ? "Publicado" : "En desarrollo"}
                                </span>
                            </div>
                        ) : (
                            <div className="text-[11px] text-neutral-700 italic">Sin nichos aún</div>
                        )}
                    </Card>
                </>}
            </div>

            {/* ── Monthly earnings line chart ── */}
            {monthlyEarningsData.length > 1 && (() => {
                const maxVal = Math.max(...monthlyEarningsData.map(d => d.earnings), 1);
                const totalMo = monthlyEarningsData.reduce((s, d) => s + d.earnings, 0);
                const lastMo = monthlyEarningsData.at(-1)?.earnings ?? 0;
                const prevMo = monthlyEarningsData.at(-2)?.earnings ?? 0;
                const trend = prevMo > 0 ? ((lastMo - prevMo) / prevMo * 100).toFixed(1) : null;
                const pts = monthlyEarningsData.map((d, i) => {
                    const x = (i / (monthlyEarningsData.length - 1)) * 100;
                    const y = 100 - (d.earnings / maxVal) * 85;
                    return `${x},${y}`;
                }).join(" ");
                return (
                    <Card variant="outline" className="p-5 border-white/5 bg-white/[0.01] space-y-4 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-transparent pointer-events-none" />
                        <div className="flex items-center justify-between gap-4 relative">
                            <SectionHeader icon={<TrendingUp size={15} />} title="Ingresos Mensuales" subtitle="Evolución real por plataforma · últimos 12 meses" color="emerald" size="sm" />
                            <div className="flex items-center gap-4 shrink-0">
                                {trend !== null && (
                                    <span className={`text-[10px] font-black tabular-nums flex items-center gap-1 ${Number(trend) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        {Number(trend) >= 0 ? <ArrowUpRight size={12} /> : <ArrowUpRight size={12} className="rotate-90" />}
                                        {Number(trend) >= 0 ? "+" : ""}{trend}% vs mes ant.
                                    </span>
                                )}
                                <span className="text-[11px] font-black text-white tabular-nums">{totalMo.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€ total</span>
                            </div>
                        </div>
                        <div className="relative h-28">
                            <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="meLine" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                                <polygon points={`0,100 ${pts} 100,100`} fill="url(#meLine)" opacity="0.25" />
                                {monthlyEarningsData.map((d, i) => {
                                    const x = (i / (monthlyEarningsData.length - 1)) * 100;
                                    const y = 100 - (d.earnings / maxVal) * 85;
                                    return <circle key={i} cx={x} cy={y} r="1.8" fill="#10b981" vectorEffect="non-scaling-stroke" />;
                                })}
                            </svg>
                        </div>
                        <div className="flex justify-between gap-1 overflow-x-auto">
                            {monthlyEarningsData.map((d, i) => (
                                <div key={i} className="flex flex-col items-center gap-0.5 shrink-0">
                                    <span className="text-[9px] font-black text-white tabular-nums">{d.earnings > 0 ? `${d.earnings.toFixed(0)}€` : ""}</span>
                                    <span className="text-[8px] text-neutral-700 font-mono">{d.month.slice(5)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                );
            })()}

            {/* ── Top 3 productos ── */}
            {products.length > 0 && (() => {
                const top3 = [...products]
                    .filter(p => p.totalEarnings > 0)
                    .sort((a, b) => b.totalEarnings - a.totalEarnings)
                    .slice(0, 3);
                if (top3.length === 0) return null;
                const medals = ["🥇", "🥈", "🥉"];
                const colors = [
                    "from-amber-500/20 to-amber-500/5 border-amber-500/20",
                    "from-neutral-400/15 to-neutral-400/5 border-neutral-400/15",
                    "from-orange-700/15 to-orange-700/5 border-orange-700/15",
                ];
                const textColors = ["text-amber-400", "text-neutral-300", "text-orange-500"];
                return (
                    <Card variant="outline" className="p-5 border-white/5 bg-white/[0.01] space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <SectionHeader icon={<Star size={15} />} title="Top Productos" subtitle="Ranking por ingresos acumulados" color="amber" size="sm" />
                            <span className="text-[9px] font-mono text-neutral-700">{products.filter(p => p.totalEarnings > 0).length} con ingresos</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {top3.map((p, i) => (
                                <div key={p.id} className={`rounded-2xl bg-gradient-to-br ${colors[i]} border p-4 space-y-2 relative overflow-hidden`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-xl leading-none">{medals[i]}</span>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-black/30 ${textColors[i]}`}>{p.type?.split(" ")[0] ?? "KDP"}</span>
                                    </div>
                                    <p className="text-[11px] font-black text-white leading-snug line-clamp-2">{p.title}</p>
                                    <p className={`text-lg font-black tabular-nums ${textColors[i]}`}>{p.totalEarnings.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€</p>
                                    <div className="flex flex-wrap gap-1">
                                        {p.platforms?.map((pl: any) => (
                                            <span key={pl.name} className="text-[8px] text-neutral-600 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded-full">{pl.name}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                );
            })()}

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card variant="glass" className="lg:col-span-2 p-8 border-white/5 bg-white/[0.01] space-y-8 relative overflow-hidden hover:shadow-[0_0_40px_rgba(99,102,241,0.08)] transition-all duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <SectionHeader
                            icon={<Activity size={16} />}
                            title="Evolución de Tendencias"
                            subtitle="Análisis predictivo basado en volumen de ventas"
                            color="indigo"
                            size="sm"
                        />
                        <div className="w-full md:w-48 shrink-0">
                            <KdpSelect value={chartPeriod} onChange={v => setChartPeriod(v as PeriodID)}
                                options={[{ value: "month", label: "Último Mes" }, { value: "6months", label: "Últimos 6 Meses" }, { value: "year", label: "Último Año" }, { value: "all", label: "Histórico Total" }]} />
                        </div>
                    </div>
                    <div className="h-[250px] w-full flex items-end justify-between gap-1 sm:gap-2 pt-14 mt-4">
                        {chartData.map((height, i) => (
                            <div key={i} className="flex-1 group/bar relative h-full flex items-end">
                                <div className="w-full bg-gradient-to-t from-indigo-500/10 via-indigo-500/30 to-indigo-500/50 rounded-t-sm sm:rounded-t-lg group-hover/bar:from-indigo-500/30 group-hover/bar:to-indigo-400 transition-all duration-700 relative overflow-hidden" style={{ height: `${height}%` }}>
                                    <div className="absolute inset-x-0 top-0 h-0.5 bg-white/40 blur-[1px]" />
                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/bar:translate-y-0 transition-transform duration-500" />
                                </div>
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-[10px] font-black text-black px-2 py-1 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all scale-75 group-hover/bar:scale-100 pointer-events-none shadow-2xl z-20">{height}€</div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between px-2 text-[10px] font-black text-neutral-600 uppercase tracking-widest pt-3 border-t border-white/5">
                        {chartPeriod === "month" && <><span>Semana 1</span><span>Semana 2</span><span>Semana 3</span><span>Semana 4</span></>}
                        {chartPeriod === "6months" && <><span>Mes 1</span><span>Mes 3</span><span>Mes 6</span></>}
                        {chartPeriod === "year" && <><span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span></>}
                        {chartPeriod === "all" && <><span>2024</span><span>2025</span><span>2026</span></>}
                    </div>
                </Card>
                <Card variant="glass" className="p-8 border-white/5 bg-white/[0.01] space-y-8 flex flex-col justify-between relative overflow-hidden hover:shadow-[0_0_40px_rgba(99,102,241,0.08)] transition-all duration-500">
                    <div className="space-y-6 relative">
                        <SectionHeader icon={<BarChart size={16} />} title="Platform Split" subtitle="Distribución por canales de venta" color="blue" size="sm" />
                        <div className="space-y-5">
                            {[{ name: "Amazon KDP", percent: 65, color: "bg-orange-500" }, { name: "Etsy", percent: 25, color: "bg-indigo-500" }, { name: "Creative Fabrica", percent: 10, color: "bg-blue-500" }].map(plat => (
                                <div key={plat.name} className="space-y-2.5">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest"><span className="text-neutral-400">{plat.name}</span><span className="text-white italic tabular-nums">{plat.percent}%</span></div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[2px]"><div className={`h-full ${plat.color} rounded-full flex items-center justify-end px-1`} style={{ width: `${plat.percent}%` }}><div className="w-1 h-1 bg-white/40 rounded-full blur-[1px]" /></div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-3 relative group/alert hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all duration-500">
                        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover/alert:opacity-100 transition-opacity duration-500 rounded-2xl" />
                        <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.05em] flex items-center gap-2"><Lightbulb size={10} /> Smart Insight</p>
                        <p className="text-[11px] text-neutral-400 leading-relaxed italic relative">"Los posters digitales de la serie 'Cyberpunk' están rindiendo un 25% mejor en Etsy que en otras plataformas este mes."</p>
                    </div>
                </Card>
            </section>


            {/* ── ROYALTIES TRACKER ── */}
            {niches.some(n => n.phase === "published" || (n.royalties?.length ?? 0) > 0) && (
                <section className="space-y-5">
                    <SectionHeader
                        icon={<DollarSign size={18} />}
                        title="Tracker de Royalties KDP"
                        color="emerald"
                        size="md"
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {niches.filter(n => n.phase === "published" || (n.royalties?.length ?? 0) > 0).map(n => {
                            const totalRevenue = (n.royalties ?? []).reduce((s, r) => s + r.revenue, 0);
                            const totalSales = (n.royalties ?? []).reduce((s, r) => s + r.sales, 0);
                            const isSelected = royaltiesNicheId === n._id;
                            return (
                                <Card key={n._id} variant="glass" className="group p-5 pl-6 border-white/5 bg-white/[0.01] space-y-4 relative overflow-hidden hover:border-emerald-500/15 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)] transition-all duration-500">
                                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-emerald-500 via-emerald-400 to-cyan-400 opacity-40 group-hover:opacity-100 transition-all duration-300" />
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5">
                                            <p className="text-[12px] font-black text-white">{n.name}</p>
                                            <div className="flex items-center gap-3 text-[9px]">
                                                <span className="text-neutral-600">{(n.royalties ?? []).length} entradas</span>
                                                <span className="font-black text-emerald-400 tabular-nums">{totalRevenue.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
                                                {totalSales > 0 && <span className="text-neutral-600">{totalSales} ventas</span>}
                                            </div>
                                        </div>
                                        <button onClick={() => setRoyaltiesNicheId(isSelected ? null : n._id)}
                                            className={`flex items-center gap-1 px-3 h-7 rounded-xl border text-[9px] font-black transition-all ${isSelected ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/5 text-neutral-500 hover:text-emerald-400 hover:border-emerald-500/20"}`}>
                                            <Plus size={10} /> Añadir
                                        </button>
                                    </div>

                                    {/* Add royalty form */}
                                    {isSelected && (
                                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 space-y-2.5">
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="text-[8px] font-black uppercase tracking-widest text-neutral-600 block mb-1">Mes</label>
                                                    <input type="month" value={royaltiesMonth} onChange={e => setRoyaltiesMonth(e.target.value)}
                                                        className="w-full h-8 bg-white/5 border border-white/10 rounded-lg px-2 text-[10px] text-white focus:outline-none focus:border-emerald-500/30" />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black uppercase tracking-widest text-neutral-600 block mb-1">Ventas</label>
                                                    <input type="number" value={royaltiesSales} onChange={e => setRoyaltiesSales(e.target.value)} min="0" placeholder="0"
                                                        className="w-full h-8 bg-white/5 border border-white/10 rounded-lg px-2 text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500/30" />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black uppercase tracking-widest text-neutral-600 block mb-1">Ingresos €</label>
                                                    <input type="number" value={royaltiesRevenue} onChange={e => setRoyaltiesRevenue(e.target.value)} min="0" step="0.01" placeholder="0.00"
                                                        className="w-full h-8 bg-white/5 border border-white/10 rounded-lg px-2 text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500/30" />
                                                </div>
                                            </div>
                                            <button onClick={() => void addRoyaltyEntry(n._id)} disabled={isSavingRoyalties}
                                                className="w-full h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                                                {isSavingRoyalties ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                                                Registrar royalties
                                            </button>
                                        </div>
                                    )}

                                    {/* Royalties history */}
                                    {(n.royalties?.length ?? 0) > 0 && (
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {[...(n.royalties ?? [])].reverse().map((r, i) => (
                                                <div key={i} className="flex items-center justify-between gap-2 py-1 border-b border-white/[0.04] last:border-0 group/row">
                                                    <span className="text-[9px] font-mono text-neutral-500">{r.month}</span>
                                                    <div className="flex items-center gap-3">
                                                        {r.sales > 0 && <span className="text-[9px] text-neutral-600">{r.sales} vtas.</span>}
                                                        <span className="text-[10px] font-black text-emerald-400 tabular-nums">{r.revenue.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
                                                        <button onClick={() => void deleteRoyaltyEntry(n._id, r.month)}
                                                            className="opacity-0 group-hover/row:opacity-100 p-0.5 text-neutral-700 hover:text-rose-400 transition-all">
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {(n.royalties?.length ?? 0) === 0 && (
                                        <p className="text-[9px] text-neutral-700 italic text-center py-2">Sin entradas aún — pulsa "Añadir" para registrar</p>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ── Gráfico ganancias por producto ── */}
            {products.length > 0 && (() => {
                const sorted = [...products].sort((a, b) => b.totalEarnings - a.totalEarnings).slice(0, 8);
                const maxE = Math.max(...sorted.map(p => p.totalEarnings), 1);
                const colors = ["from-indigo-500 to-blue-400", "from-blue-500 to-cyan-400", "from-violet-500 to-purple-400", "from-sky-500 to-cyan-400", "from-emerald-500 to-teal-400", "from-amber-500 to-orange-400", "from-rose-500 to-pink-400", "from-fuchsia-500 to-pink-400"];
                // Per-platform aggregation
                const platMap: Record<string, number> = {};
                for (const p of products) for (const pl of p.platforms) platMap[pl.name] = (platMap[pl.name] ?? 0) + pl.earnings;
                const platSorted = Object.entries(platMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
                const maxP = Math.max(...platSorted.map(e => e[1]), 1);
                return (
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Products bar chart */}
                        <Card variant="outline" className="p-5 bg-white/[0.02] border-white/5 space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Ganancias por producto</p>
                            <div className="space-y-2">
                                {sorted.map((p, i) => (
                                    <div key={p.id} className="flex items-center gap-3 group">
                                        <span className="text-[9px] text-neutral-500 truncate w-28 shrink-0 group-hover:text-white transition-colors">{p.title}</span>
                                        <div className="flex-1 h-5 bg-white/[0.04] rounded-lg overflow-hidden">
                                            <div className={`h-full bg-gradient-to-r ${colors[i % colors.length]} rounded-lg transition-all duration-700`} style={{ width: `${(p.totalEarnings / maxE) * 100}%` }} />
                                        </div>
                                        <span className="text-[10px] font-black text-white tabular-nums shrink-0 w-16 text-right">{p.totalEarnings.toFixed(0)}€</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                        {/* Platform bar chart */}
                        <Card variant="outline" className="p-5 bg-white/[0.02] border-white/5 space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Ganancias por plataforma</p>
                            <div className="space-y-2">
                                {platSorted.map(([name, val], i) => (
                                    <div key={name} className="flex items-center gap-3 group">
                                        <span className="text-[9px] text-neutral-500 truncate w-28 shrink-0 group-hover:text-white transition-colors">{name}</span>
                                        <div className="flex-1 h-5 bg-white/[0.04] rounded-lg overflow-hidden">
                                            <div className={`h-full bg-gradient-to-r ${colors[(i + 2) % colors.length]} rounded-lg transition-all duration-700`} style={{ width: `${(val / maxP) * 100}%` }} />
                                        </div>
                                        <span className="text-[10px] font-black text-white tabular-nums shrink-0 w-16 text-right">{val.toFixed(0)}€</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </section>
                );
            })()}

            {/* ── KDP Listing Generator ── */}
            <Card variant="outline" className="overflow-hidden border-white/5 bg-white/[0.01]">
                <button
                    onClick={() => setListingCardOpen(v => !v)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-all"
                >
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                        <Sparkles size={14} className="text-amber-400" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <p className="text-[12px] font-black text-white">Generador de Listing KDP</p>
                        <p className="text-[10px] text-neutral-600">Título · 7 keywords · Descripción HTML lista para publicar</p>
                    </div>
                    <ChevronDown size={14} className={`text-neutral-600 transition-transform shrink-0 ${listingCardOpen ? "rotate-180" : ""}`} />
                </button>
                {listingCardOpen && (
                    <div className="border-t border-white/[0.05] px-5 pb-5 pt-4 space-y-4">
                        {/* Niche selector */}
                        {niches.filter(n => n.status !== "archived").length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Desde nicho</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {niches.filter(n => n.status !== "archived").map(n => {
                                        const isSelected = selectedListingNicheId === n._id;
                                        return (
                                            <button key={n._id} type="button"
                                                onClick={() => {
                                                    if (isSelected) { setSelectedListingNicheId(null); return; }
                                                    setSelectedListingNicheId(n._id);
                                                    setListingTopic(n.name);
                                                }}
                                                className={`flex items-center gap-1 h-6 px-2.5 rounded-lg border text-[9px] font-black transition-all ${
                                                    isSelected ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                                                    : n.phase === "published" ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15"
                                                    : "border-white/10 bg-white/[0.03] text-neutral-500 hover:text-white hover:bg-white/8"
                                                }`}>
                                                <Target size={8} />
                                                {n.name}
                                                {isSelected && <Check size={8} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={listingTopic}
                                onChange={e => setListingTopic(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") void generateListing(); }}
                                placeholder="Ej: Libro de colorear de mandalas zen para adultos"
                                className="flex-1 h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-[12px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/40"
                            />
                            <button
                                onClick={() => void generateListing()}
                                disabled={isGeneratingListing || !listingTopic.trim()}
                                className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-40 shrink-0"
                            >
                                {isGeneratingListing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                Generar
                            </button>
                        </div>
                        {listingResult && (() => {
                            const r = listingResult;
                            const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado"); };
                            const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">{label}</span>
                                        <button onClick={() => copy(value)} className="flex items-center gap-1 text-[9px] text-neutral-700 hover:text-indigo-400 transition-all"><Copy size={9} />Copiar</button>
                                    </div>
                                    <div className={`px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-[11px] text-neutral-300 leading-relaxed ${mono ? "font-mono" : ""}`}>
                                        {value || <span className="text-neutral-700 italic">—</span>}
                                    </div>
                                </div>
                            );
                            const keywords = Array.isArray(r.keywords) ? r.keywords : (typeof r.keywords === "string" ? r.keywords.split(/[,\n]/).map((k: string) => k.trim()).filter(Boolean) : []);
                            const descText = typeof r.description === "string" ? r.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
                            return (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {r.title && <Field label="Título" value={r.title} />}
                                    {r.subtitle && <Field label="Subtítulo" value={r.subtitle} />}
                                    {keywords.length > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Keywords ({keywords.length})</span>
                                                <button onClick={() => copy(keywords.join(", "))} className="flex items-center gap-1 text-[9px] text-neutral-700 hover:text-indigo-400 transition-all"><Copy size={9} />Copiar todo</button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {keywords.map((kw: string, i: number) => (
                                                    <button key={i} onClick={() => copy(kw)} className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[9px] text-indigo-300 hover:bg-indigo-500/20 transition-all font-mono">
                                                        {kw}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {descText && <Field label="Descripción" value={descText} />}
                                    {/* ── Guardar en producto ── */}
                                    <div className="pt-2 border-t border-white/[0.05] space-y-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Guardar en producto</p>
                                        <div className="flex gap-2">
                                            <select
                                                value={listingSaveProductId}
                                                onChange={e => setListingSaveProductId(e.target.value)}
                                                className="flex-1 h-9 px-2.5 bg-white/5 border border-white/10 rounded-xl text-[11px] text-neutral-300 focus:outline-none focus:border-amber-500/40"
                                            >
                                                <option value="new">+ Nuevo producto (borrador)</option>
                                                {products.map(p => (
                                                    <option key={p._id ?? p.id} value={p._id ?? p.id}>{p.title}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => void saveListingToProduct()}
                                                disabled={isSavingListing}
                                                className="h-9 px-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                                            >
                                                {isSavingListing ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                                Guardar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </Card>

            {/* ── Productos ── */}
            <section className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <SectionHeader
                        icon={<Box size={16} />}
                        title="Productos"
                        subtitle="Catálogo de activos digitales publicados"
                        color="indigo"
                        size="sm"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Export CSV */}
                        {products.length > 0 && (
                            <button
                                onClick={() => {
                                    const header = "Título,Tipo,Estado,Ganancias (€),Plataformas,Fecha";
                                    const rows = products.map(p => {
                                        const plats = p.platforms.map((pl: any) => pl.name).join(" | ");
                                        const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString("es-ES") : "";
                                        return [
                                            `"${(p.title ?? "").replace(/"/g, '""')}"`,
                                            `"${(p.type ?? "").replace(/"/g, '""')}"`,
                                            p.status ?? "",
                                            p.totalEarnings?.toFixed(2) ?? "0.00",
                                            `"${plats}"`,
                                            date,
                                        ].join(",");
                                    });
                                    const csv = [header, ...rows].join("\n");
                                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url; a.download = "productos-kdp.csv"; a.click();
                                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                                    toast.success("CSV exportado");
                                }}
                                className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:border-white/20 flex items-center gap-1.5 transition-all text-[10px] font-black uppercase"
                                title="Exportar CSV"
                            >
                                <Download size={12} /> CSV
                            </button>
                        )}
                        {/* View toggle compact/list */}
                        <div className="flex p-1 bg-white/[0.04] border border-white/8 rounded-xl gap-0.5">
                            <button onClick={() => setProductViewMode("list")} title="Vista detallada"
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${productViewMode === "list" ? "bg-white/15 text-white" : "text-neutral-600 hover:text-neutral-400"}`}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="0" y="1" width="12" height="2" rx="1" fill="currentColor"/><rect x="0" y="5" width="12" height="2" rx="1" fill="currentColor"/><rect x="0" y="9" width="12" height="2" rx="1" fill="currentColor"/></svg>
                            </button>
                            <button onClick={() => setProductViewMode("compact")} title="Vista compacta"
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${productViewMode === "compact" ? "bg-white/15 text-white" : "text-neutral-600 hover:text-neutral-400"}`}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="0" y="0" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="0" y="3.5" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="0" y="7" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="0" y="10.5" width="12" height="1.5" rx="0.75" fill="currentColor"/></svg>
                            </button>
                        </div>
                        <button
                            onClick={async () => {
                                const tempId = `temp_${Date.now()}`;
                                const newP: DigitalProduct = {
                                    id: tempId,
                                    type: PRODUCT_TYPES[0].name,
                                    title: "Nuevo producto",
                                    description: "",
                                    status: "borrador",
                                    platforms: [{ name: "Amazon KDP", earnings: 0, url: "", date: "" }],
                                    totalEarnings: 0,
                                    createdAt: new Date().toISOString(),
                                };
                                try {
                                    const res = await fetch(`${API_BASE_URL}/digital-products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: newP.type, title: newP.title, description: newP.description, status: newP.status, platforms: newP.platforms }) });
                                    if (res.ok) { const d = await res.json(); const saved = { ...d.product, id: d.product._id }; setProducts(ps => [saved, ...ps]); setEditingProductId(saved.id); setEditDraft({ ...saved, platforms: saved.platforms.map((p: any) => ({ ...p })) }); return; }
                                } catch { /* fall through to temp */ }
                                setProducts(ps => [newP, ...ps]);
                                setEditingProductId(tempId);
                                setEditDraft({ ...newP, platforms: [{ ...newP.platforms[0] }] });
                            }}
                            className="h-9 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                        >
                            <Plus size={12} /> Añadir
                        </button>
                    </div>
                </div>

                {/* ── Bulk action bar ── */}
                {selectedProductIds.size > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 animate-in fade-in slide-in-from-top-2 duration-200">
                        <span className="text-[11px] font-black text-indigo-300 mr-auto">{selectedProductIds.size} seleccionado{selectedProductIds.size !== 1 ? "s" : ""}</span>
                        {(["activo", "pausado", "borrador"] as const).map(s => (
                            <button key={s} onClick={() => void handleBulkStatus(s)}
                                className="h-7 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10">
                                {s}
                            </button>
                        ))}
                        <button onClick={() => void handleBulkDelete()} disabled={isBulkDeletingProducts}
                            className="h-7 px-3 rounded-xl bg-rose-500/15 border border-rose-500/20 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50">
                            {isBulkDeletingProducts ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />} Eliminar
                        </button>
                        <button onClick={() => setSelectedProductIds(new Set())} className="h-7 px-2 rounded-xl text-neutral-600 hover:text-white transition-all">
                            <X size={12} />
                        </button>
                    </div>
                )}

                {/* ── Toolbar ── */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[160px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" size={13} />
                        <input
                            type="text"
                            value={productSearch}
                            onChange={e => setProductSearch(e.target.value)}
                            placeholder="Buscar producto…"
                            className="h-9 w-full bg-white/[0.04] border border-white/8 rounded-xl pl-9 pr-3 text-[11px] text-white placeholder:text-neutral-700 outline-none focus:border-indigo-500/40 transition-all"
                        />
                        {productSearch && (
                            <button onClick={() => setProductSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-all">
                                <X size={11} />
                            </button>
                        )}
                    </div>
                    {/* Category filter */}
                    <select value={catalogFilter} onChange={e => setCatalogFilter(e.target.value)}
                        className="h-9 rounded-xl bg-white/[0.04] border border-white/8 px-3 text-[11px] text-white outline-none [color-scheme:dark] cursor-pointer hover:border-white/15 transition-all">
                        <option value="all">Todos los tipos</option>
                        {PRODUCT_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {/* Sort */}
                    <div className="flex p-1 bg-white/[0.03] border border-white/8 rounded-xl gap-0.5">
                        {([["earnings", "€"], ["date", "Fecha"], ["status", "Estado"]] as const).map(([val, label]) => (
                            <button key={val} onClick={() => setProductSort(val)}
                                className={`h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${productSort === val ? "bg-indigo-500/20 text-indigo-300" : "text-neutral-600 hover:text-neutral-400"}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                    {/* Result count */}
                    {(productSearch || catalogFilter !== "all") && (
                        <span className="text-[10px] font-mono text-neutral-600">{filteredProducts.length} resultado{filteredProducts.length !== 1 ? "s" : ""}</span>
                    )}
                </div>
                <div className="grid grid-cols-1 gap-5">
                    {/* Skeleton loaders */}
                    {isLoadingProducts && [1,2,3].map(i => (
                        <div key={i} className="h-36 rounded-2xl bg-white/[0.03] animate-pulse border border-white/5" />
                    ))}
                    {!isLoadingProducts && filteredProducts.length === 0 && products.length === 0 ? (
                        /* ── Empty state (sin productos todavía) ── */
                        <Card variant="outline" className="p-16 border-dashed border-indigo-500/20 bg-indigo-500/[0.02] flex flex-col items-center justify-center text-center space-y-5">
                            <div className="p-5 rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
                                <Box size={36} strokeWidth={1.2} className="text-indigo-400" />
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-lg font-black text-white italic tracking-tight">Sin productos todavía</p>
                                <p className="text-sm text-neutral-500 max-w-xs">Registra tu primer activo digital publicado para empezar a seguir tus ganancias.</p>
                            </div>
                            <button onClick={async () => {
                                const tempId = `temp_${Date.now()}`;
                                const newP: DigitalProduct = { id: tempId, type: PRODUCT_TYPES[0].name, title: "Nuevo producto", description: "", status: "borrador", platforms: [{ name: "Amazon KDP", earnings: 0, url: "", date: "" }], totalEarnings: 0, createdAt: new Date().toISOString() };
                                try {
                                    const res = await fetch(`${API_BASE_URL}/digital-products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: newP.type, title: newP.title, description: newP.description, status: newP.status, platforms: newP.platforms }) });
                                    if (res.ok) { const d = await res.json(); const saved = { ...d.product, id: d.product._id }; setProducts([saved]); setEditingProductId(saved.id); setEditDraft({ ...saved, platforms: saved.platforms.map((p: any) => ({ ...p })) }); return; }
                                } catch { /**/ }
                                setProducts([newP]); setEditingProductId(tempId); setEditDraft({ ...newP, platforms: [{ ...newP.platforms[0] }] });
                            }}
                                className="h-10 px-6 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_4px_20px_rgba(99,102,241,0.4)]">
                                <Plus size={13} /> Añadir mi primer producto
                            </button>
                        </Card>
                    ) : !isLoadingProducts && filteredProducts.length === 0 ? (
                        /* ── Empty state (filtro sin resultados) ── */
                        <Card variant="outline" className="p-14 border-dashed border-white/8 bg-white/[0.01] flex flex-col items-center justify-center text-center space-y-3">
                            <Search size={28} strokeWidth={1.2} className="text-neutral-700" />
                            <p className="text-sm font-black text-neutral-500 italic">Sin resultados para «{productSearch || catalogFilter}»</p>
                            <button onClick={() => { setProductSearch(""); setCatalogFilter("all"); }} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-all">Limpiar filtros</button>
                        </Card>
                    ) : !isLoadingProducts && (
                        filteredProducts.map((product) => {
                            const isSelected = selectedProductIds.has(product.id);
                            if (productViewMode === "compact") return (
                                <div key={product.id} onClick={() => setSelectedProductIds(prev => { const n = new Set(prev); isSelected ? n.delete(product.id) : n.add(product.id); return n; })}
                                    className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all cursor-pointer ${isSelected ? "border-indigo-500/40 bg-indigo-500/8" : "border-white/5 bg-white/[0.01] hover:border-white/12 hover:bg-white/[0.02]"}`}>
                                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "border-indigo-400 bg-indigo-500" : "border-white/15 group-hover:border-white/30"}`}>
                                        {isSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><polyline points="1,4 3.2,6.2 7,1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                    </div>
                                    <span className="text-[10px] text-neutral-600 shrink-0 font-mono w-16 truncate">{product.type}</span>
                                    <span className="flex-1 text-[12px] font-black text-white truncate">{product.title}</span>
                                    <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border shrink-0 ${{ activo: "bg-emerald-500/15 border-emerald-500/20 text-emerald-400", pausado: "bg-neutral-500/15 border-neutral-500/20 text-neutral-500", borrador: "bg-amber-500/15 border-amber-500/20 text-amber-500" }[product.status] ?? ""}`}>{product.status}</span>
                                    <span className="text-[11px] font-black text-white tabular-nums shrink-0 w-20 text-right">{product.totalEarnings.toFixed(2)}€</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => void handleDuplicateProduct(product)} className="w-6 h-6 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-neutral-600 hover:text-sky-400 transition-all"><Copy size={9} /></button>
                                        <button onClick={() => setConfirmDeleteProductId(product.id)} className="w-6 h-6 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-neutral-600 hover:text-rose-400 transition-all"><Trash2 size={9} /></button>
                                    </div>
                                </div>
                            );
                            return (
                            <Card key={product.id} variant="glass" className={`group relative p-6 border-white/5 bg-white/[0.01] hover:border-white/20 transition-all duration-300 overflow-hidden ${isSelected ? "ring-1 ring-indigo-500/40 border-indigo-500/20" : ""}`}>
                                {/* Checkbox on hover */}
                                <div className={`absolute top-3 left-3 z-10 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                    onClick={e => { e.stopPropagation(); setSelectedProductIds(prev => { const n = new Set(prev); isSelected ? n.delete(product.id) : n.add(product.id); return n; }); }}>
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${isSelected ? "border-indigo-400 bg-indigo-500" : "border-white/30 bg-black/40 backdrop-blur"}`}>
                                        {isSelected && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><polyline points="1.5,4.5 3.8,7 7.5,1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                    </div>
                                </div>
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-blue-500 to-cyan-500 opacity-30 group-hover:opacity-100 transition-opacity" />
                                {editingProductId === product.id && editDraft ? (
                                    /* ── EDIT MODE ── */
                                    <div className="space-y-4 relative">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="neutral" className="bg-indigo-500/10 border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.05em] px-2.5">{product.type}</Badge>
                                            <span className="text-[10px] font-medium text-neutral-700 font-mono">#{product.id.slice(-6)}</span>
                                        </div>
                                        <input
                                            value={editDraft.title}
                                            onChange={e => setEditDraft(d => d && ({ ...d, title: e.target.value }))}
                                            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white font-black text-lg italic outline-none focus:border-indigo-500/50"
                                            placeholder="Título del producto"
                                        />
                                        <textarea
                                            value={editDraft.description}
                                            onChange={e => setEditDraft(d => d && ({ ...d, description: e.target.value }))}
                                            rows={2}
                                            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-neutral-300 text-sm outline-none focus:border-indigo-500/50 resize-none"
                                            placeholder="Descripción / subtítulo"
                                        />
                                        {/* Niche link */}
                                        <div className="space-y-1.5">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Nicho vinculado</p>
                                            {niches.length === 0 ? (
                                                <p className="text-[11px] text-neutral-600 italic px-1">No hay nichos creados todavía</p>
                                            ) : (
                                                <select
                                                    value={editDraft.nicheId ?? ""}
                                                    onChange={e => setEditDraft(d => d && ({ ...d, nicheId: e.target.value || undefined }))}
                                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                                                >
                                                    <option value="">— Sin nicho —</option>
                                                    {niches.map(n => (
                                                        <option key={n._id} value={n._id}>{n.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                        {/* Platforms edit */}
                                        <div className="space-y-2">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Plataformas</p>
                                            {editDraft.platforms.map((plat, pi) => (
                                                <div key={pi} className="flex flex-wrap gap-2 items-center p-3 rounded-xl bg-white/[0.02] border border-white/8">
                                                    <input
                                                        value={plat.name}
                                                        onChange={e => setEditDraft(d => { if (!d) return d; const p = [...d.platforms]; p[pi] = { ...p[pi], name: e.target.value }; return { ...d, platforms: p }; })}
                                                        className="w-28 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-[11px] font-black text-white outline-none focus:border-indigo-500/40"
                                                        placeholder="Plataforma"
                                                    />
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={plat.earnings}
                                                            onChange={e => setEditDraft(d => { if (!d) return d; const p = [...d.platforms]; p[pi] = { ...p[pi], earnings: parseFloat(e.target.value) || 0 }; return { ...d, platforms: p, totalEarnings: p.reduce((s, x) => s + (x.earnings || 0), 0) }; })}
                                                            className="w-24 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-[11px] font-black text-emerald-400 outline-none focus:border-emerald-500/40"
                                                            placeholder="0.00"
                                                        />
                                                        <span className="text-[10px] text-neutral-600">€</span>
                                                    </div>
                                                    <input
                                                        type="date"
                                                        value={plat.date ?? ""}
                                                        onChange={e => setEditDraft(d => { if (!d) return d; const p = [...d.platforms]; p[pi] = { ...p[pi], date: e.target.value }; return { ...d, platforms: p }; })}
                                                        className="bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-neutral-400 outline-none focus:border-indigo-500/40 [color-scheme:dark]"
                                                    />
                                                    <input
                                                        value={plat.url ?? ""}
                                                        onChange={e => setEditDraft(d => { if (!d) return d; const p = [...d.platforms]; p[pi] = { ...p[pi], url: e.target.value }; return { ...d, platforms: p }; })}
                                                        className="flex-1 min-w-[120px] bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-neutral-500 outline-none focus:border-indigo-500/40"
                                                        placeholder="https://... (URL oculta)"
                                                    />
                                                    <button onClick={() => setEditDraft(d => { if (!d) return d; const p = d.platforms.filter((_, i) => i !== pi); return { ...d, platforms: p, totalEarnings: p.reduce((s, x) => s + x.earnings, 0) }; })}
                                                        className="w-6 h-6 rounded-md text-neutral-600 hover:text-rose-400 flex items-center justify-center transition-all">
                                                        <X size={11} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={() => setEditDraft(d => d && ({ ...d, platforms: [...d.platforms, { name: "", earnings: 0, url: "", date: "" }] }))}
                                                className="flex items-center gap-1.5 text-[10px] font-black text-neutral-600 hover:text-neutral-300 transition-all px-1">
                                                <Plus size={11} /> Añadir plataforma
                                            </button>
                                        </div>
                                        {/* Status */}
                                        <div className="flex items-center gap-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 shrink-0">Estado</p>
                                            <div className="flex gap-2">
                                                {(["activo", "pausado", "borrador"] as const).map(s => {
                                                    const colors = { activo: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400", pausado: "border-amber-500/40 bg-amber-500/10 text-amber-400", borrador: "border-neutral-500/30 bg-neutral-500/10 text-neutral-400" };
                                                    const active = editDraft?.status === s;
                                                    return (
                                                        <button key={s} onClick={() => setEditDraft(d => d && ({ ...d, status: s }))}
                                                            className={`h-7 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${active ? colors[s] : "border-white/8 text-neutral-600 hover:text-neutral-400"}`}>
                                                            {s}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        {/* Actions */}
                                        <div className="flex items-center justify-end gap-2 pt-1">
                                            <button onClick={() => { setEditingProductId(null); setEditDraft(null); }}
                                                className="h-8 px-3 rounded-xl border border-white/10 text-[10px] font-black text-neutral-400 hover:text-white transition-all">
                                                Cancelar
                                            </button>
                                            <button onClick={async () => {
                                                if (!editDraft) return;
                                                await handleSaveProduct(editDraft);
                                                setEditingProductId(null); setEditDraft(null);
                                            }}
                                                className="h-8 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-black transition-all flex items-center gap-1.5">
                                                <Check size={11} /> Guardar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* ── VIEW MODE ── */
                                    <div className="flex flex-col md:flex-row gap-6 relative">
                                        <div className="flex-1 space-y-5">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="neutral" className="bg-indigo-500/10 border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.05em] px-2.5">
                                                        {product.type}
                                                    </Badge>
                                                    {(() => {
                                                        const st = product.status ?? "activo";
                                                        const cls = { activo: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", pausado: "bg-amber-500/10 border-amber-500/20 text-amber-400", borrador: "bg-neutral-500/10 border-neutral-500/20 text-neutral-500" }[st];
                                                        return <Badge variant="neutral" className={`${cls} text-[9px] font-black uppercase tracking-[0.05em] px-2`}>{st}</Badge>;
                                                    })()}
                                                    {product.nicheId && (() => {
                                                        const linkedNiche = niches.find(n => n._id === product.nicheId);
                                                        return linkedNiche ? (
                                                            <Badge variant="neutral" className="bg-violet-500/10 border-violet-500/20 text-violet-400 text-[10px] font-black px-2.5 flex items-center gap-1">
                                                                <Target size={9} /> {linkedNiche.name}
                                                            </Badge>
                                                        ) : null;
                                                    })()}
                                                    <span className="text-[10px] font-medium text-neutral-700 font-mono">#{product.id.slice(-6)}</span>
                                                </div>
                                                <h3 className="text-xl font-black text-white italic tracking-tight">{product.title}</h3>
                                            </div>
                                            <p className="text-sm text-neutral-500 leading-relaxed max-w-2xl font-medium tracking-tight">{product.description}</p>
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {product.platforms.map((plat, platIdx) => {
                                                    const qeKey = `${product.id}-${platIdx}`;
                                                    const isQE = quickEditEarnings?.productId === product.id && quickEditEarnings.platIdx === platIdx;
                                                    return (
                                                        <div key={plat.name + platIdx} className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all group/plat">
                                                            <div className="flex items-center gap-2">
                                                                {plat.url ? (
                                                                    <a href={plat.url} target="_blank" rel="noopener noreferrer"
                                                                        className="text-[10px] font-black uppercase text-neutral-500 hover:text-indigo-400 tracking-tighter transition-colors flex items-center gap-1">
                                                                        {plat.name} <ExternalLink size={9} />
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-[10px] font-black uppercase text-neutral-600 tracking-tighter">{plat.name}</span>
                                                                )}
                                                                <div className="w-px h-2.5 bg-white/10" />
                                                                {isQE ? (
                                                                    <form onSubmit={async e => {
                                                                        e.preventDefault();
                                                                        const val = parseFloat(quickEditEarnings!.value) || 0;
                                                                        const updated = { ...product, platforms: product.platforms.map((p, i) => i === platIdx ? { ...p, earnings: val } : p) };
                                                                        updated.totalEarnings = updated.platforms.reduce((s, p) => s + p.earnings, 0);
                                                                        await handleSaveProduct(updated);
                                                                        setProducts(ps => ps.map(p => p.id === product.id ? updated : p));
                                                                        setQuickEditEarnings(null);
                                                                    }} className="flex items-center gap-1">
                                                                        <input autoFocus type="number" step="0.01" value={quickEditEarnings!.value}
                                                                            onChange={e => setQuickEditEarnings(q => q && ({ ...q, value: e.target.value }))}
                                                                            onKeyDown={e => e.key === "Escape" && setQuickEditEarnings(null)}
                                                                            className="w-20 bg-white/[0.08] border border-emerald-500/40 rounded-lg px-2 py-0.5 text-[11px] font-black text-emerald-400 outline-none tabular-nums" />
                                                                        <button type="submit" className="text-emerald-400 hover:text-emerald-300"><Check size={11} /></button>
                                                                        <button type="button" onClick={() => setQuickEditEarnings(null)} className="text-neutral-600 hover:text-white"><X size={11} /></button>
                                                                    </form>
                                                                ) : (
                                                                    <button onClick={() => setQuickEditEarnings({ productId: product.id, platIdx, value: String(plat.earnings) })}
                                                                        className="text-[11px] font-black italic tracking-tighter text-emerald-400 tabular-nums hover:text-emerald-300 transition-colors" title="Click para editar">
                                                                        {plat.earnings.toFixed(2)}€
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {plat.date && (
                                                                <span className="text-[9px] text-neutral-700 font-mono">{new Date(plat.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="flex md:flex-col justify-between items-end md:items-end gap-3 md:gap-4 md:w-48 md:border-l border-white/5 md:pl-8 pt-5 md:pt-0 border-t md:border-t-0">
                                            <div className="text-right space-y-0.5">
                                                <span className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-600 block">Total Profit</span>
                                                <span className="text-2xl md:text-3xl font-black italic tracking-tighter text-white tabular-nums">{product.totalEarnings.toFixed(2)}€</span>
                                            </div>
                                            <Button className="h-9 md:h-10 px-4 md:w-full rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 transition-all shadow-xl shadow-white/10">
                                                Informe
                                            </Button>
                                            <div className="flex items-center gap-1 md:w-full">
                                                <button onClick={() => { setEditingProductId(product.id); setEditDraft({ ...product, platforms: product.platforms.map(p => ({ ...p })) }); }}
                                                    className="flex-1 h-8 rounded-xl border border-white/8 text-neutral-600 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                                                    <Pencil size={11} /> Editar
                                                </button>
                                                <button onClick={() => void handleDuplicateProduct(product)} title="Duplicar"
                                                    className="h-8 w-8 rounded-xl border border-white/8 text-neutral-600 hover:text-sky-400 hover:border-sky-500/30 hover:bg-sky-500/5 transition-all flex items-center justify-center">
                                                    <Copy size={12} />
                                                </button>
                                                <button onClick={() => setConfirmDeleteProductId(product.id)}
                                                    className="h-8 w-8 rounded-xl border border-white/8 text-neutral-600 hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all flex items-center justify-center">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                            );
                        })
                    )}
                </div>
            </section>

            {/* ── Tabla de integraciones ── */}
            {(() => {
                const badge: Record<string, string> = {
                    dev:    "bg-amber-500/15 border-amber-500/30 text-amber-400",
                    paused: "bg-neutral-500/15 border-neutral-500/30 text-neutral-500",
                    study:  "bg-sky-500/15 border-sky-500/30 text-sky-400",
                    active: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
                };
                return (
                    <section className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <SectionHeader icon={<Store size={15} />} title="Integraciones" subtitle="Estado de los marketplaces conectados o en hoja de ruta" color="indigo" size="sm" />
                            <button
                                onClick={() => { setEditingIntegration(null); setIntegrationDraft({ status: "study", statusLabel: "En estudio", icon: "🔗" }); setShowIntegrationModal(true); }}
                                className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all text-[10px] font-black uppercase tracking-wider shrink-0"
                            >
                                <Plus size={11} /> Añadir
                            </button>
                        </div>
                        <Card variant="outline" className="overflow-hidden border-white/5 bg-white/[0.01]">
                            {isLoadingIntegrations ? (
                                <div className="divide-y divide-white/[0.05]">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                                            <div className="w-7 h-5 rounded bg-white/5 shrink-0" />
                                            <div className="flex-1 space-y-1.5">
                                                <div className="h-2.5 w-28 rounded bg-white/5" />
                                                <div className="h-2 w-44 rounded bg-white/5" />
                                            </div>
                                            <div className="h-5 w-20 rounded-lg bg-white/5 shrink-0" />
                                        </div>
                                    ))}
                                </div>
                            ) : integrations.length === 0 ? (
                                <div className="flex flex-col items-center gap-3 py-10 text-center">
                                    <Store size={28} className="text-neutral-700" />
                                    <p className="text-[11px] text-neutral-600">No hay integraciones. Añade la primera.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/[0.05]">
                                    {integrations.map((int) => (
                                        <div key={int.id} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-all">
                                            <span className="text-lg w-7 shrink-0">{int.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-black text-white">{int.name}</p>
                                                <p className="text-[10px] text-neutral-600 truncate">{int.desc}</p>
                                                {int.url && <a href={int.url} target="_blank" rel="noreferrer" className="text-[9px] text-indigo-500 hover:text-indigo-400 truncate block">{int.url}</a>}
                                            </div>
                                            <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${badge[int.status] ?? badge.study}`}>
                                                {int.statusLabel}
                                            </span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <button
                                                    onClick={() => { setEditingIntegration(int); setIntegrationDraft({ name: int.name, icon: int.icon, status: int.status, statusLabel: int.statusLabel, desc: int.desc, url: int.url ?? "" }); setShowIntegrationModal(true); }}
                                                    className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-white/10 transition-all"
                                                ><Pencil size={10} /></button>
                                                <button
                                                    onClick={() => setConfirmDeleteIntegrationId(int.id)}
                                                    className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all"
                                                ><Trash2 size={10} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </section>
                );
            })()}
        </div>
        );
    };



    const renderAIStudio = () => {
        const currentModel = AI_MODELS.find(m => m.id === selectedModel);
        const currentDim = AI_DIMENSIONS.find(d => d.id === selectedDim);
        const providerColor: Record<string, string> = {
            "Pollinations": "emerald",
            "Hugging Face": "amber",
            "Google": "sky",
            "Leonardo": "orange",
            "Ideogram": "violet",
            "fal.ai": "fuchsia",
            "Segmind": "cyan",
        };
        const pColor = providerColor[currentModel?.provider || ""] || "neutral";

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div className="rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
                    <div className="h-px w-full bg-gradient-to-r from-amber-500/80 via-orange-400/40 to-transparent" />
                    <div className="px-6 py-5 flex items-center justify-between gap-4">
                        <SectionHeader
                            icon={<Zap size={20} />}
                            title={<><span className="text-white">IA Asset </span><span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">Studio</span></>}
                            subtitle="Genera imágenes únicas · Gestiona catálogos · Vault de activos"
                            color="amber"
                            size="lg"
                        />
                        <button
                            onClick={() => setShowSafeArea(v => !v)}
                            className={`flex items-center gap-2 h-9 px-4 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-wider shrink-0 ${showSafeArea ? "bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.2)]" : "bg-white/5 border-white/10 text-neutral-500 hover:text-amber-400 hover:border-amber-500/30"}`}
                        >
                            <Maximize size={11} /> Safe area
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* ─── LEFT CARD: Controls ─── */}
                    <div className="relative rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
                        <div className="h-px w-full bg-gradient-to-r from-amber-500/50 via-orange-400/20 to-transparent" />
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/5 blur-[90px] pointer-events-none rounded-full" />

                        {/* ── 01 MODELO & FORMATO ── */}
                        <div className="p-6 space-y-4 relative z-10">
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-white/6 border border-white/12 text-[9px] font-black text-neutral-500 flex items-center justify-center shrink-0">01</span>
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Modelo & Formato</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Model picker */}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600 ml-1">Modelo I.A.</label>
                                    <div className="relative">
                                        <button ref={modelPickerBtnRef} type="button"
                                            onClick={() => {
                                                modelPickerRectRef.current = modelPickerBtnRef.current?.getBoundingClientRect() ?? null;
                                                setShowModelPicker(v => !v);
                                                setShowDimPicker(false);
                                            }}
                                            className="w-full h-12 bg-white/4 border border-white/8 rounded-2xl px-3.5 flex items-center gap-3 hover:bg-white/7 hover:border-white/14 transition-all focus:outline-none"
                                        >
                                            <div className={`w-2 h-2 rounded-full bg-${pColor}-400 shrink-0 shadow-[0_0_8px_2px] shadow-${pColor}-400/40`} />
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="text-sm font-bold text-white truncate leading-tight">{currentModel?.name}</p>
                                                <p className="text-[9px] text-neutral-500 truncate leading-tight">{currentModel?.provider} · {currentModel?.type}</p>
                                            </div>
                                            <ChevronDown size={14} className={`text-neutral-600 shrink-0 transition-transform duration-200 ${showModelPicker ? "rotate-180" : ""}`} />
                                        </button>
                                        {showModelPicker && modelPickerRectRef.current && createPortal(
                                            <>
                                                <div className="fixed inset-0 z-[9998]" onClick={() => setShowModelPicker(false)} />
                                                <div
                                                    className="fixed z-[9999] bg-[#111111] border border-white/12 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden"
                                                    style={{
                                                        top: modelPickerRectRef.current.bottom + 6,
                                                        left: modelPickerRectRef.current.left,
                                                        width: modelPickerRectRef.current.width,
                                                        maxHeight: "288px",
                                                        overflowY: "auto",
                                                    }}
                                                >
                                                    {AI_MODELS.map(m => {
                                                        const mColor = providerColor[m.provider] || "neutral";
                                                        return (
                                                            <button key={m.id} type="button"
                                                                onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                                                                className={`w-full px-4 py-3 flex items-center gap-3 transition-all text-left border-b border-white/5 last:border-0 ${selectedModel === m.id ? "bg-white/10" : "hover:bg-white/6"}`}
                                                            >
                                                                <div className={`w-2 h-2 rounded-full bg-${mColor}-400 shrink-0`} />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-bold text-white leading-tight">{m.name}</p>
                                                                    <p className="text-[10px] text-neutral-500 leading-tight mt-0.5">{m.provider} · {m.type}</p>
                                                                </div>
                                                                {selectedModel === m.id && <Check size={14} className="text-emerald-400 shrink-0" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </>,
                                            document.body
                                        )}
                                    </div>
                                </div>

                                {/* Dimension picker */}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600 ml-1">Dimensiones</label>
                                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                                        {AI_DIMENSIONS.filter(d => ["sq", "pt", "p23", "p34"].includes(d.id)).map(d => (
                                            <button key={d.id} type="button" onClick={() => setSelectedDim(d.id)}
                                                className={`h-10 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${selectedDim === d.id ? "bg-white text-black border-white shadow-[0_4px_12px_rgba(255,255,255,0.15)]" : "bg-white/4 border-white/8 text-neutral-500 hover:bg-white/7"}`}
                                            >
                                                {d.id === "sq" ? <Monitor size={11} /> : <Maximize size={11} />}
                                                <span className="text-[8px] font-black uppercase">{d.ratio}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="relative">
                                        <button ref={dimPickerBtnRef} type="button"
                                            onClick={() => {
                                                dimPickerRectRef.current = dimPickerBtnRef.current?.getBoundingClientRect() ?? null;
                                                setShowDimPicker(v => !v);
                                                setShowModelPicker(false);
                                            }}
                                            className="w-full h-10 bg-white/4 border border-white/8 rounded-2xl px-3.5 flex items-center justify-between gap-3 hover:bg-white/7 transition-all focus:outline-none"
                                        >
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="text-sm font-bold text-white truncate leading-tight">{currentDim?.name} <span className="font-normal text-neutral-500">({currentDim?.ratio})</span></p>
                                                <p className="text-[9px] text-neutral-600 leading-tight">{currentDim?.width}×{currentDim?.height}px</p>
                                            </div>
                                            <ChevronDown size={14} className={`text-neutral-600 shrink-0 transition-transform duration-200 ${showDimPicker ? "rotate-180" : ""}`} />
                                        </button>
                                        {showDimPicker && dimPickerRectRef.current && createPortal(
                                            <>
                                                <div className="fixed inset-0 z-[9998]" onClick={() => setShowDimPicker(false)} />
                                                <div
                                                    className="fixed z-[9999] bg-[#111111] border border-white/12 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden"
                                                    style={{
                                                        top: dimPickerRectRef.current.bottom + 6,
                                                        left: dimPickerRectRef.current.left,
                                                        width: dimPickerRectRef.current.width,
                                                        maxHeight: "256px",
                                                        overflowY: "auto",
                                                    }}
                                                >
                                                    {AI_DIMENSIONS.map(d => (
                                                        <button key={d.id} type="button"
                                                            onClick={() => { setSelectedDim(d.id); setShowDimPicker(false); }}
                                                            className={`w-full px-4 py-3 flex items-center gap-3 transition-all text-left border-b border-white/5 last:border-0 ${selectedDim === d.id ? "bg-white/6" : "hover:bg-white/3"}`}
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-bold text-white leading-tight">{d.name} <span className="font-normal text-neutral-500">({d.ratio})</span></p>
                                                                <p className="text-[10px] text-neutral-500 leading-tight mt-0.5">{d.width}×{d.height}px</p>
                                                            </div>
                                                            {selectedDim === d.id && <Check size={14} className="text-emerald-400 shrink-0" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>,
                                            document.body
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent mx-6" />

                        {/* ── 02 PROMPT ── */}
                        <div className="p-6 space-y-4 relative z-10">
                            {niches.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Cargar desde nicho</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {niches.filter(n => n.status !== "archived").map(niche => (
                                            <button
                                                key={niche._id}
                                                type="button"
                                                onClick={() => {
                                                    if (niche.productType === "coloring-book") {
                                                        const parts = buildColoringBookPromptParts(niche.name, niche.styleCategory, "");
                                                        setPromptTheme(parts.theme);
                                                        setPromptSpecs(parts.specs);
                                                        setPromptDetails(parts.details);
                                                        setPromptParticulars("");
                                                    } else {
                                                        setPromptTheme(niche.name);
                                                        setPromptSpecs(niche.tags.join(", "));
                                                        setPromptDetails(niche.description || "");
                                                        setPromptParticulars("");
                                                    }
                                                    if (niche.styleCategory && NICHE_STYLE_MODEL[niche.styleCategory]) {
                                                        setSelectedModel(NICHE_STYLE_MODEL[niche.styleCategory]);
                                                    }
                                                    toast.success(`Prompt cargado desde "${niche.name}"`);
                                                }}
                                                className={`flex items-center gap-1.5 h-6 px-2.5 rounded-lg border text-[9px] font-black transition-all ${
                                                    niche.phase === "published" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                                    : niche.status === "active" ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                                                    : "border-white/10 bg-white/[0.03] text-neutral-500 hover:text-white hover:bg-white/8"
                                                }`}
                                            >
                                                <Target size={8} />
                                                {niche.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-white/6 border border-white/12 text-[9px] font-black text-neutral-500 flex items-center justify-center shrink-0">02</span>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Prompt del Activo</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {(promptTheme || promptSpecs || promptDetails || promptParticulars || negativePrompt) && (
                                        <button type="button"
                                            onClick={() => { setPromptTheme(""); setPromptSpecs(""); setPromptDetails(""); setPromptParticulars(""); setNegativePrompt(""); }}
                                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/20" title="Limpiar prompt">
                                            <X size={10} />
                                        </button>
                                    )}
                                    {imagePrompt && (
                                        <>
                                            <button type="button"
                                                onClick={() => navigator.clipboard.writeText(imagePrompt).then(() => toast.success("Prompt copiado"))}
                                                className="p-1.5 rounded-lg bg-white/5 text-neutral-600 hover:text-white hover:bg-white/10 transition-all border border-white/8" title="Copiar">
                                                <Copy size={10} />
                                            </button>
                                            <button type="button"
                                                onClick={() => { setSavePromptName(""); setSavePromptCategory("General"); setShowSavePromptDialog(true); }}
                                                className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-all border border-sky-500/20" title="Guardar en biblioteca">
                                                <BookMarked size={10} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <input value={promptTheme} onChange={e => setPromptTheme(e.target.value)}
                                    placeholder="Temática · Ej: Vintage botanical illustration"
                                    className="w-full h-10 bg-white/4 border border-white/8 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/25 focus:bg-white/6 transition-all font-medium"
                                />
                                <input value={promptSpecs} onChange={e => setPromptSpecs(e.target.value)}
                                    placeholder="Especificaciones · Ej: watercolor style, high detail"
                                    className="w-full h-10 bg-white/4 border border-white/8 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/25 focus:bg-white/6 transition-all font-medium"
                                />
                                <input value={promptDetails} onChange={e => setPromptDetails(e.target.value)}
                                    placeholder="Detalles · Ej: lavender field, soft pastel palette"
                                    className="w-full h-10 bg-white/4 border border-white/8 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/25 focus:bg-white/6 transition-all font-medium"
                                />
                                <div className="relative">
                                    <input value={promptParticulars} onChange={e => setPromptParticulars(e.target.value)}
                                        placeholder="Particularidades · editado por IA en catálogo"
                                        className="w-full h-10 bg-sky-500/[0.06] border border-sky-500/20 rounded-xl px-4 pr-20 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-sky-500/40 focus:bg-sky-500/[0.09] transition-all font-medium"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black uppercase tracking-widest text-sky-400/60 pointer-events-none flex items-center gap-1">
                                        <Sparkles size={7} className="animate-pulse" /> IA
                                    </span>
                                </div>
                            </div>
                            {imagePrompt && (
                                <p className="text-[9px] text-neutral-700 font-mono truncate px-1" title={imagePrompt}>{imagePrompt}</p>
                            )}
                        </div>

                        <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent mx-6" />

                        {/* ── 03 OPCIONES AVANZADAS ── */}
                        <div className="relative z-10">
                            <button type="button"
                                onClick={() => setShowAdvancedOptions(v => !v)}
                                className="w-full px-6 py-4 flex items-center gap-3 hover:bg-white/2 transition-colors group"
                            >
                                <span className="w-6 h-6 rounded-full bg-white/6 border border-white/12 text-[9px] font-black text-neutral-500 flex items-center justify-center shrink-0">03</span>
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-neutral-200 transition-colors flex-1 text-left">Opciones avanzadas</p>
                                <ChevronDown size={13} className={`text-neutral-600 transition-transform duration-300 ${showAdvancedOptions ? "rotate-180" : ""}`} />
                            </button>

                            {showAdvancedOptions && (() => {
                                const prov = currentModel?.provider;
                                return (
                                    <div className="px-6 pb-5 space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Prompt negativo</label>
                                            <input value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)}
                                                placeholder="Ej: ugly, deformed, blurry, watermark"
                                                className="w-full h-10 bg-white/4 border border-white/8 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-rose-500/25 transition-all"
                                            />
                                        </div>
                                        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Imagen de referencia</p>
                                                <p className="text-[9px] text-neutral-700 italic">Ctrl/⌘+V o arrastra</p>
                                            </div>
                                            <div className="grid grid-cols-[96px_1fr] gap-3 items-start">
                                                <div
                                                    className="rounded-xl border border-dashed border-white/12 bg-black/20 w-24 aspect-square flex items-center justify-center text-center focus:outline-none overflow-hidden cursor-pointer"
                                                    tabIndex={0}
                                                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                                                    onDrop={e => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files?.[0]; if (file) void setInitImageFromFile(file); }}
                                                    onPaste={e => { const items = Array.from(e.clipboardData?.items || []); const imageItem = items.find(it => it.kind === "file" && it.type.startsWith("image/")); const file = imageItem?.getAsFile() || null; if (file) void setInitImageFromFile(file); }}
                                                >
                                                    {initImageDataUrl ? (
                                                        <img src={initImageDataUrl} alt="Referencia" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="space-y-1 p-2">
                                                            <Camera size={18} className="text-neutral-600 mx-auto" />
                                                            <p className="text-[8px] text-neutral-700 italic">Pegar</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-3">
                                                    <p className="text-[9px] text-neutral-600 italic">Enviada junto al prompt (Gemini / Leonardo).</p>
                                                    {initImageDataUrl && (
                                                        <>
                                                            <Button onClick={() => setInitImageDataUrl(null)} variant="outline"
                                                                className="h-8 rounded-xl border-white/10 bg-white/5 text-[9px] font-black uppercase text-neutral-400 hover:text-white">
                                                                Quitar imagen
                                                            </Button>
                                                            <div className="space-y-1.5">
                                                                <div className="flex justify-between">
                                                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Fuerza</label>
                                                                    <span className="text-[9px] font-mono text-amber-400">{initImageStrength.toFixed(2)}</span>
                                                                </div>
                                                                <input type="range" min={0.1} max={0.9} step={0.05} value={initImageStrength}
                                                                    onChange={e => setInitImageStrength(Number(e.target.value))}
                                                                    className="w-full accent-amber-500 h-1" />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {(prov === "Hugging Face" || prov === "Leonardo") && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Pasos de inferencia</label>
                                                    <span className="text-[10px] font-mono text-amber-400">{inferenceSteps}</span>
                                                </div>
                                                <input type="range" min={10} max={50} step={1} value={inferenceSteps} onChange={e => setInferenceSteps(Number(e.target.value))} className="w-full accent-amber-500 h-1" />
                                                <div className="flex justify-between text-[8px] text-neutral-700 font-mono"><span>10 rápido</span><span>50 calidad</span></div>
                                            </div>
                                        )}
                                        {(prov === "Hugging Face" || prov === "Leonardo") && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Guidance Scale (CFG)</label>
                                                    <span className="text-[10px] font-mono text-amber-400">{guidanceScale.toFixed(1)}</span>
                                                </div>
                                                <input type="range" min={1} max={20} step={0.5} value={guidanceScale} onChange={e => setGuidanceScale(Number(e.target.value))} className="w-full accent-amber-500 h-1" />
                                                <div className="flex justify-between text-[8px] text-neutral-700 font-mono"><span>1 creativo</span><span>20 fiel</span></div>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Seed fijo (vacío = aleatorio)</label>
                                            <input type="text" inputMode="numeric" value={fixedSeed}
                                                onChange={e => setFixedSeed(e.target.value.replace(/\D/g, ""))}
                                                placeholder="Ej: 42069"
                                                className="w-full h-9 bg-white/4 border border-white/8 rounded-xl px-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/25 transition-all font-mono"
                                            />
                                        </div>
                                        {prov === "Ideogram" && (
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Estilo Ideogram</label>
                                                <KdpSelect accent="amber" value={ideogramStyle} onChange={setIdeogramStyle}
                                                    options={["AUTO", "REALISTIC", "DESIGN", "RENDER_3D", "ANIME"].map(s => ({ value: s, label: s }))} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent mx-6" />

                        {/* ── GENERATE BUTTON ── */}
                        <div className="px-6 pb-6 pt-1 relative z-10 space-y-3">
                            {(() => {
                                const running = iaCatalogs.filter(c => c.status === "running" || c.status === "pending");
                                const queued = iaCatalogs.filter(c => c.status === "queued");
                                const isCatalogActive = running.length > 0 || queued.length > 0;
                                return (
                                    <>
                                        <Button
                                            onClick={() => handleGenerateImage()}
                                            disabled={isGenerating || !imagePrompt.trim() || isCatalogActive}
                                            className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all duration-500 ${isGenerating
                                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                                : isCatalogActive
                                                    ? "bg-white/4 text-neutral-500 border border-white/8 cursor-not-allowed"
                                                    : "bg-amber-500 text-black hover:bg-amber-400 hover:scale-[1.02] active:scale-[0.98] shadow-[0_8px_30px_rgba(245,158,11,0.25)]"
                                                }`}
                                        >
                                            {isGenerating ? (
                                                <><Loader2 size={18} className="mr-3 animate-spin" /> Procesando Activo Visual...</>
                                            ) : isCatalogActive ? (
                                                <><Layers size={18} className="mr-3" /> Catálogo en progreso...</>
                                            ) : (
                                                <><Zap size={18} className="mr-3 fill-current" /> Lanzar Generación I.A.</>
                                            )}
                                        </Button>

                                        {/* Estado de cola — siempre visible cuando hay actividad */}
                                        {isCatalogActive && (
                                            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-sky-500/[0.06] border border-sky-500/20">
                                                <div className="relative shrink-0">
                                                    <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                                                    <div className="absolute inset-0 rounded-full bg-sky-400/40 animate-ping" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black text-sky-300 leading-tight">
                                                        {running.length > 0 ? `Generando — ${running[0]?.name || "catálogo"}` : `En cola — ${queued[0]?.name || "catálogo"}`}
                                                    </p>
                                                    <p className="text-[9px] text-neutral-600 mt-0.5">
                                                        {running.length > 0 && `${running[0]?.images?.length ?? 0}/${running[0]?.totalImages ?? "?"} imágenes`}
                                                        {running.length > 0 && queued.length > 0 && " · "}
                                                        {queued.length > 0 && `${queued.length} en cola`}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setShowCatalogAccordion(true)}
                                                    className="text-[9px] font-black uppercase tracking-widest text-sky-400/60 hover:text-sky-300 transition-colors shrink-0"
                                                >
                                                    Ver
                                                </button>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        {/* ── 04 CATÁLOGO IA (accordion) ── */}
                        <div className="border-t border-white/6 relative z-10">
                            <button type="button"
                                onClick={() => setShowCatalogAccordion(v => !v)}
                                className="w-full px-6 py-4 flex items-center gap-3 hover:bg-white/2 transition-colors group"
                            >
                                <span className="w-6 h-6 rounded-full bg-sky-500/10 border border-sky-500/20 text-[9px] font-black text-sky-400 flex items-center justify-center shrink-0">04</span>
                                <div className="flex-1 text-left">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-neutral-200 transition-colors">Generar catálogo</p>
                                    <p className="text-[9px] text-neutral-600 mt-0.5">Producción masiva con estos ajustes</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {iaCatalogs.some(c => c.status === "running" || c.status === "queued") && (
                                        <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                                    )}
                                    <ChevronDown size={13} className={`text-neutral-600 transition-transform duration-300 ${showCatalogAccordion ? "rotate-180" : ""}`} />
                                </div>
                            </button>
                            {showCatalogAccordion && (
                                <div className="px-6 pb-6 space-y-4">
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Tipo de producto</p>
                                        <div className="flex gap-1.5">
                                            {([
                                                { id: "coloring-book" as const, label: "Colorear", desc: "B&W line art" },
                                                { id: "printable-poster" as const, label: "Poster", desc: "Alta calidad" },
                                                { id: "other" as const, label: "Otro", desc: "Sin modificar" },
                                            ]).map(pt => (
                                                <button key={pt.id} onClick={() => setCatalogProductType(pt.id)}
                                                    className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl border transition-all ${catalogProductType === pt.id ? "border-sky-500/40 bg-sky-500/[0.08] text-sky-300" : "border-white/8 bg-white/[0.02] text-neutral-600 hover:border-white/15 hover:text-neutral-400"}`}
                                                >
                                                    <span className="text-[9px] font-black uppercase tracking-wide">{pt.label}</span>
                                                    <span className={`text-[8px] ${catalogProductType === pt.id ? "text-sky-500/60" : "text-neutral-700"}`}>{pt.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {catalogProductType === "coloring-book" && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Prompt negativo adicional</p>
                                                <span className="text-[8px] text-neutral-700 italic">Auto: sombreado, color…</span>
                                            </div>
                                            <input value={catalogNegativePrompt} onChange={e => setCatalogNegativePrompt(e.target.value)}
                                                placeholder="Ej: cartoon, hands, text, watermark…"
                                                className="w-full h-9 bg-white/4 border border-white/8 rounded-xl px-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-rose-500/25 transition-all"
                                            />
                                            <div className="flex flex-wrap gap-1">
                                                {["shading", "gray tones", "gradients", "color", "sepia"].map(t => (
                                                    <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-full bg-rose-500/6 border border-rose-500/12 text-rose-400/50 font-mono">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Variación IA</p>
                                            <span className={`text-[9px] font-black tabular-nums ${catalogCreativity <= 10 ? "text-neutral-700" : catalogCreativity <= 35 ? "text-sky-400/70" : catalogCreativity <= 65 ? "text-emerald-400/70" : catalogCreativity <= 85 ? "text-amber-400/70" : "text-orange-400/70"}`}>
                                                {catalogCreativity <= 10 ? "Sin variación" : catalogCreativity <= 35 ? "Sutil" : catalogCreativity <= 65 ? "Moderada" : catalogCreativity <= 85 ? "Alta" : "Máxima"}
                                            </span>
                                        </div>
                                        <input type="range" min={0} max={100} step={5} value={catalogCreativity}
                                            onChange={e => setCatalogCreativity(Number(e.target.value))}
                                            className="w-full accent-sky-500 h-1.5 rounded-full cursor-pointer" />
                                        <div className="flex justify-between text-[8px] text-neutral-700"><span>Idénticas</span><span>Diferentes</span></div>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                        <input value={catalogFormName} onChange={e => setCatalogFormName(e.target.value)}
                                            placeholder="Nombre del catálogo (opcional)"
                                            className="flex-1 min-w-0 h-10 bg-white/4 border border-white/8 rounded-xl px-3 text-sm text-white outline-none focus:border-sky-500/30 transition-all placeholder:text-neutral-700"
                                        />
                                        <div className="flex gap-2">
                                            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="5"
                                                value={catalogFormCount === 0 ? "" : String(catalogFormCount)}
                                                onChange={e => { const raw = e.target.value.replace(/\D/g, ""); setCatalogFormCount(raw === "" ? 0 : Math.min(50, Number(raw))); }}
                                                className="w-14 h-10 bg-white/4 border border-white/8 rounded-xl px-2 text-sm font-bold text-white outline-none focus:border-sky-500/30 transition-all text-center"
                                            />
                                            <button onClick={() => void createCatalogFromStudio()}
                                                disabled={isCreatingCatalog || !promptTheme.trim()}
                                                className="flex-1 sm:flex-none h-10 px-5 bg-sky-600/80 hover:bg-sky-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(14,165,233,0.2)]"
                                            >
                                                {isCreatingCatalog ? <Loader2 size={13} className="animate-spin" /> : <><Layers size={13} />Crear</>}
                                            </button>
                                        </div>
                                    </div>
                                    {(() => {
                                        const running = iaCatalogs.filter(c => c.status === "running" || c.status === "pending");
                                        const queued = iaCatalogs.filter(c => c.status === "queued");
                                        if (running.length === 0 && queued.length === 0) return null;
                                        return (
                                            <p className="text-[10px] text-amber-500/70 italic flex items-center gap-1.5">
                                                <Loader2 size={9} className="animate-spin" />
                                                {running.length > 0 ? `${running.length} en progreso` : ""}
                                                {running.length > 0 && queued.length > 0 ? " · " : ""}
                                                {queued.length > 0 ? `${queued.length} en cola` : ""}
                                                {" · el nuevo se añadirá a la cola"}
                                            </p>
                                        );
                                    })()}
                                    <p className="text-[9px] text-neutral-700 italic">
                                        ~{Math.ceil(catalogFormCount * 1.5)} min · {catalogFormCount} imágenes · {currentModel?.name} · {currentDim?.ratio}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="flex flex-col gap-6">
                        {/* Preview Area */}
                        <Card
                            variant="glass"
                            className="relative border-white/5 bg-white/[0.01] overflow-hidden h-[280px] flex items-center justify-center group rounded-[40px] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                            tabIndex={0}
                            onClick={(e) => (e.currentTarget as HTMLElement).focus()}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const file = e.dataTransfer.files?.[0];
                                if (!file) return;
                                if (generatedImage) setGeneratedImageFromFile(file);
                                else addImageFileToVault(file);
                            }}
                            onPaste={(e) => {
                                const items = Array.from(e.clipboardData?.items || []);
                                const imageItem = items.find((it) => it.kind === "file" && it.type.startsWith("image/"));
                                const file = imageItem?.getAsFile() || null;
                                if (!file) return;
                                if (generatedImage) setGeneratedImageFromFile(file);
                                else addImageFileToVault(file);
                            }}
                        >
                            {generatedImage ? (
                                <div className="relative w-full h-full animate-in fade-in zoom-in duration-700">

                                    <img
                                        src={generatedImage}
                                        alt="AI Generated"
                                        className={`w-full h-full object-cover transition-opacity duration-700 ${isImageLoading ? 'opacity-0' : 'opacity-100'} ${!isImageLoading ? 'cursor-zoom-in' : ''}`}
                                        onLoad={() => setIsImageLoading(false)}
                                        onClick={() => {
                                            if (!isImageLoading) setPreviewImage(generatedImage);
                                        }}
                                    />

                                    {isImageLoading && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]/60 backdrop-blur-xl gap-4">
                                            <div className="relative">
                                                <div className="w-16 h-16 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                                                <Zap size={20} className="absolute inset-0 m-auto text-amber-500 animate-pulse" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Renderizando Arte...</p>
                                        </div>
                                    )}

                                    {showSafeArea && !isImageLoading && (
                                        <div className="absolute inset-0 pointer-events-none">
                                            <div className="absolute inset-[3%] border border-dashed border-amber-400/50 rounded-md" />
                                            <div className="absolute inset-[9%] border border-dashed border-amber-300/25 rounded-sm" />
                                            <div className="absolute top-[3%] left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-amber-500/70 backdrop-blur-sm text-[8px] font-black text-black uppercase tracking-widest whitespace-nowrap">Bleed · Trim</div>
                                            <div className="absolute bottom-[9%] left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm text-[8px] font-black text-amber-300/80 uppercase tracking-widest whitespace-nowrap">Safe area</div>
                                        </div>
                                    )}
                                    {!isImageLoading && (
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 p-8 flex flex-col justify-between">
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col gap-2">
                                                    <Badge className="bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest px-3 border-none">Master Draft</Badge>
                                                    <div className="px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-[9px] font-bold text-neutral-300 w-fit">
                                                        {AI_MODELS.find(m => m.id === selectedModel)?.name} • {AI_DIMENSIONS.find(d => d.id === selectedDim)?.ratio}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const modelName = AI_MODELS.find(m => m.id === selectedModel)?.name || "ai-image";
                                                            const dimName = AI_DIMENSIONS.find(d => d.id === selectedDim)?.ratio || "1x1";
                                                            downloadPng(generatedImage, `${modelName}-${dimName}`.replaceAll(" ", "_"));
                                                        }}
                                                        className="p-3 rounded-2xl bg-black/40 backdrop-blur-md text-white hover:bg-white/10 transition-all border border-white/10"
                                                        aria-label="Descargar imagen"
                                                        title="Descargar"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => setGeneratedImage(null)}
                                                        className="p-3 rounded-2xl bg-black/40 backdrop-blur-md text-white hover:bg-rose-500 transition-all border border-white/10"
                                                        aria-label="Cerrar"
                                                        title="Cerrar"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <Button
                                                    onClick={() => setGeneratedImage(null)}
                                                    variant="outline"
                                                    className="h-14 rounded-2xl border-white/10 bg-white/5 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10"
                                                >
                                                    <X size={16} className="mr-2" /> Descartar
                                                </Button>
                                                <Button
                                                    onClick={handleKeepImage}
                                                    className="h-14 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-white/10"
                                                >
                                                    <Check size={16} className="mr-2" /> Conservar Activo
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : isGenerating ? (
                                /* Full-card skeleton while generating */
                                <div className="absolute inset-0 overflow-hidden flex flex-col">
                                    {/* Shimmer background */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-[#0d0d0d] via-neutral-900/40 to-[#0d0d0d] animate-pulse" />
                                    {/* Center content */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8">
                                        <div className="relative">
                                            <div className="absolute inset-0 scale-[2] blur-3xl bg-amber-500/10 animate-pulse rounded-full" />
                                            <div className="w-20 h-20 rounded-[28px] border border-amber-500/20 bg-amber-500/[0.04] flex items-center justify-center relative">
                                                <Zap size={30} className="text-amber-500/50 animate-bounce" />
                                            </div>
                                        </div>
                                        <div className="space-y-2.5 w-full max-w-[180px] flex flex-col items-center">
                                            <div className="h-2 w-full rounded-full bg-white/[0.06] animate-pulse" />
                                            <div className="h-2 w-4/5 rounded-full bg-white/[0.04] animate-pulse" />
                                            <div className="h-2 w-3/5 rounded-full bg-white/[0.03] animate-pulse" />
                                        </div>
                                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-500/40 animate-pulse">
                                            {AI_MODELS.find(m => m.id === selectedModel)?.name}
                                        </p>
                                    </div>
                                    {/* Bottom skeleton (mimics the keep/discard buttons) */}
                                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent space-y-3 pointer-events-none">
                                        <div className="flex justify-between">
                                            <div className="h-6 w-28 rounded-xl bg-amber-500/[0.05] animate-pulse" />
                                            <div className="flex gap-2">
                                                <div className="w-11 h-11 rounded-2xl bg-white/[0.04] animate-pulse" />
                                                <div className="w-11 h-11 rounded-2xl bg-white/[0.04] animate-pulse" />
                                                <div className="w-11 h-11 rounded-2xl bg-white/[0.04] animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="h-12 rounded-2xl bg-white/[0.03] animate-pulse" />
                                            <div className="h-12 rounded-2xl bg-white/[0.05] animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center p-12 space-y-6">
                                    <div className="space-y-5 opacity-30 group-hover:opacity-60 transition-all duration-500">
                                        <div className="w-24 h-24 rounded-[36px] border-2 border-dashed border-white/10 flex items-center justify-center mx-auto bg-white/5">
                                            <Camera size={36} strokeWidth={1.5} className="text-neutral-400" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-black uppercase tracking-widest text-white">Visual Engine Ready</p>
                                            <p className="text-[10px] text-neutral-600 font-medium italic">Arrastra o pega (Ctrl/⌘+V) una imagen</p>
                                            <p className="text-[10px] text-amber-500/50 font-black uppercase tracking-widest">→ va directo al vault</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Saved Prompts Library */}
                        <div className="space-y-4">
                            {/* ── IA Prompt Generator ─────────────────────────────────── */}
                            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center shrink-0">
                                        <Wand2 size={14} className="text-sky-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-white tracking-tight">Generador de prompt con IA</p>
                                        <p className="text-[9px] text-neutral-600">Describe tu producto y la IA crea el prompt ideal para guardar en biblioteca</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={contentNiche}
                                        onChange={e => setContentNiche(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") void generateImagePromptSuggestion(); }}
                                        placeholder="Ej: libro de colorear de mandalas zen para adultos…"
                                        className="flex-1 h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/40 transition-all"
                                    />
                                    <button
                                        onClick={() => void generateImagePromptSuggestion()}
                                        disabled={isGeneratingImagePrompt || !contentNiche.trim()}
                                        className="h-10 px-4 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                                        {isGeneratingImagePrompt ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                        {isGeneratingImagePrompt ? "..." : "Generar"}
                                    </button>
                                </div>
                                {isGeneratingImagePrompt && (
                                    <div className="h-12 rounded-xl bg-white/5 border border-white/8 animate-pulse flex items-center justify-center">
                                        <Loader2 size={12} className="animate-spin text-sky-400" />
                                    </div>
                                )}
                                {imagePromptSuggestion && !isGeneratingImagePrompt && (
                                    <div className="space-y-2">
                                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-amber-400/70">Prompt generado</p>
                                                <button onClick={() => copyText(imagePromptSuggestion)} className="p-1 rounded text-neutral-700 hover:text-white transition-colors"><Copy size={8} /></button>
                                            </div>
                                            <p className="text-[10px] text-neutral-300 leading-relaxed font-mono">{imagePromptSuggestion}</p>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            <button
                                                onClick={() => { setPromptTheme(imagePromptSuggestion); toast.success("Prompt aplicado al formulario"); }}
                                                className="flex-1 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500 hover:text-black text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]">
                                                <ArrowRight size={11} /> Aplicar al formulario
                                            </button>
                                            <button
                                                onClick={() => saveImagePromptToLibrary(imagePromptSuggestion)}
                                                className="flex-1 h-9 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]">
                                                <BookMarked size={11} /> Guardar
                                            </button>
                                            <button onClick={() => void generateImagePromptSuggestion()}
                                                className="h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-neutral-500 hover:text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors">
                                                <Sparkles size={10} /> Regenerar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-4 px-2">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                <div className="flex items-center gap-3">
                                    <BookMarked size={14} className="text-sky-400" />
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Biblioteca de Prompts</h3>
                                </div>
                                <button onClick={() => void fetchSavedPrompts()} disabled={isLoadingSavedPrompts} className="p-2 rounded-xl bg-white/5 border border-white/10 text-neutral-500 hover:text-sky-400 hover:border-sky-500/30 transition-all disabled:opacity-40">
                                    {isLoadingSavedPrompts ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                </button>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            </div>

                            {savedPrompts.length > 0 && (
                                <div className="flex gap-2 flex-wrap px-2">
                                    <button
                                        onClick={() => setPromptCategoryFilter("all")}
                                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${promptCategoryFilter === "all" ? "bg-sky-500/20 border-sky-500/40 text-sky-300" : "bg-white/5 border-white/10 text-neutral-500 hover:text-white"}`}
                                    >
                                        Todos ({savedPrompts.length})
                                    </button>
                                    {Array.from(new Set(savedPrompts.map(p => p.category))).map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setPromptCategoryFilter(cat)}
                                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${promptCategoryFilter === cat ? "bg-sky-500/20 border-sky-500/40 text-sky-300" : "bg-white/5 border-white/10 text-neutral-500 hover:text-white"}`}
                                        >
                                            {cat} ({savedPrompts.filter(p => p.category === cat).length})
                                        </button>
                                    ))}
                                </div>
                            )}

                            {savedPrompts.length === 0 && !isLoadingSavedPrompts ? (
                                <div className="flex flex-col items-center gap-3 py-10 opacity-40">
                                    <BookMarked size={28} strokeWidth={1.2} className="text-neutral-600" />
                                    <p className="text-[11px] font-black uppercase tracking-widest text-neutral-600">Sin prompts guardados aún</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {savedPrompts
                                        .filter(p => promptCategoryFilter === "all" || p.category === promptCategoryFilter)
                                        .map(p => {
                                            const isFullEdit = fullEditingPromptId === p._id;
                                            const fe = isFullEdit ? fullEditingPrompt : {};
                                            return (
                                                <div key={p._id}
                                                    className="group relative rounded-2xl border border-white/8 bg-white/[0.03] hover:border-sky-500/25 hover:bg-white/[0.05] transition-all overflow-hidden">
                                                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-sky-500 via-sky-400 to-cyan-400 opacity-40 group-hover:opacity-100 transition-all duration-300" />
                                                    <div className="p-4 pl-5 space-y-3">
                                                        <div className="flex items-start gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                {isFullEdit ? (
                                                                    <input autoFocus value={(fe.name ?? p.name)} onChange={e => setFullEditingPrompt(prev => ({ ...prev, name: e.target.value }))}
                                                                        className="w-full bg-white/5 border border-sky-500/40 rounded-lg px-2 py-1 text-[12px] font-black text-white outline-none mb-1" />
                                                                ) : (
                                                                    <p className="text-[12px] font-black text-white truncate leading-tight">{p.name}</p>
                                                                )}
                                                                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                                                    <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-[8px] font-black uppercase tracking-widest text-sky-400">{p.category}</span>
                                                                    {p.aiModel?.name && (
                                                                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[8px] text-neutral-500 font-black uppercase truncate max-w-[120px]" title={p.aiModel.name}>
                                                                            {p.aiModel.provider} · {p.aiModel.name.split(" ").slice(0, 2).join(" ")}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                                                                {isFullEdit ? null : (
                                                                    <button onClick={() => { setFullEditingPromptId(p._id); setFullEditingPrompt({ name: p.name, category: p.category, promptParts: { ...p.promptParts }, aiModel: p.aiModel }); }}
                                                                        className="p-1.5 rounded-lg text-neutral-600 hover:text-sky-400 hover:bg-sky-500/10 transition-all">
                                                                        <Pencil size={12} />
                                                                    </button>
                                                                )}
                                                                <button onClick={() => void deleteSavedPrompt(p._id)}
                                                                    className="p-1.5 rounded-lg text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {isFullEdit ? (
                                                            <div className="space-y-2">
                                                                <textarea value={(fe.promptParts?.theme ?? p.promptParts.theme)}
                                                                    onChange={e => setFullEditingPrompt(prev => ({ ...prev, promptParts: { ...(prev.promptParts ?? p.promptParts), theme: e.target.value } }))}
                                                                    rows={3} placeholder="Temática / prompt principal…"
                                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/40 resize-none font-mono" />
                                                                <select value={(fe.aiModel?.id ?? p.aiModel?.id ?? "")}
                                                                    onChange={e => {
                                                                        const m = AI_MODELS.find(m => m.id === e.target.value);
                                                                        setFullEditingPrompt(prev => ({ ...prev, aiModel: m ? { id: m.id, name: m.name, provider: m.provider, modelId: m.modelId } : undefined }));
                                                                    }}
                                                                    className="w-full h-8 bg-white/5 border border-white/10 rounded-xl px-3 text-[10px] text-white focus:outline-none focus:border-sky-500/40">
                                                                    <option value="">Sin modelo asociado</option>
                                                                    {AI_MODELS.map(m => <option key={m.id} value={m.id}>{m.provider} · {m.name}</option>)}
                                                                </select>
                                                                <div className="flex gap-2">
                                                                    <button onClick={() => setFullEditingPromptId(null)}
                                                                        className="flex-1 h-8 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase text-neutral-400 hover:text-white transition-all">
                                                                        Cancelar
                                                                    </button>
                                                                    <button onClick={() => {
                                                                        void updateSavedPrompt(p._id, {
                                                                            name: fe.name ?? p.name,
                                                                            category: fe.category ?? p.category,
                                                                            promptParts: fe.promptParts ?? p.promptParts,
                                                                            aiModel: fe.aiModel,
                                                                        });
                                                                        setFullEditingPromptId(null);
                                                                        toast.success("Prompt actualizado");
                                                                    }}
                                                                        className="flex-1 h-8 rounded-xl bg-sky-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-sky-500 transition-all flex items-center justify-center gap-1.5">
                                                                        <Save size={10} /> Guardar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="text-[10px] text-neutral-500 line-clamp-2 leading-relaxed italic">
                                                                    {p.promptParts.theme || <span className="opacity-40">Sin temática</span>}
                                                                </p>
                                                                <button
                                                                    onClick={() => loadSavedPrompt(p)}
                                                                    className="w-full h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-all flex items-center justify-center gap-1.5">
                                                                    <ArrowRight size={11} />Cargar prompt
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Asset Vault / Carousel — always visible */}
                <div className="space-y-6 animate-in fade-in slide-in-from-left-8 duration-700 pb-4">
                    <div className="flex items-center px-2 gap-3">
                        <div className="flex-1">
                            <SectionHeader
                                icon={<Box size={16} />}
                                title="Vault de Activos Digitales"
                                subtitle={`Sesión actual: ${vaultImages.length} activos conservados`}
                                color="amber"
                                size="sm"
                            />
                        </div>
                        {vaultImages.length > 0 && (
                            <button
                                onClick={() => { setIsVaultSelectMode(v => !v); setSelectedImageUrls(new Set()); }}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isVaultSelectMode ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-white/5 border-white/10 text-neutral-500 hover:text-white hover:border-white/20"}`}
                            >
                                {isVaultSelectMode ? "Cancelar" : "Seleccionar"}
                            </button>
                        )}
                        {isVaultSelectMode && selectedImageUrls.size > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => { addSelectedAsPages(); setIsVaultSelectMode(false); }}
                                    className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-500 text-black hover:bg-amber-400 transition-all border border-amber-500/50 flex items-center gap-1.5"
                                >
                                    <Plus size={11} />
                                    {selectedImageUrls.size} al libro
                                </button>
                                <select
                                    value={kdpPdfSize}
                                    onChange={e => setKdpPdfSize(e.target.value as typeof kdpPdfSize)}
                                    className="h-7 bg-neutral-900 border border-white/10 rounded-xl px-2 text-[10px] font-black text-white outline-none focus:border-sky-500/40"
                                >
                                    <option value="6x9">6"×9"</option>
                                    <option value="8x10">8"×10"</option>
                                    <option value="8.5x11">8.5"×11"</option>
                                    <option value="a4">A4</option>
                                </select>
                                <button
                                    onClick={() => void exportKdpPdf()}
                                    disabled={isExportingKdpPdf}
                                    className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-sky-600/80 hover:bg-sky-500 text-white transition-all border border-sky-500/50 flex items-center gap-1.5 disabled:opacity-40"
                                >
                                    {isExportingKdpPdf ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                                    PDF KDP
                                </button>
                            </div>
                        )}
                    </div>

                    {vaultImages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 opacity-40">
                            <Box size={32} className="text-neutral-600" strokeWidth={1.5} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                                Vault vacío · Genera y conserva imágenes para crear libros PDF
                            </p>
                        </div>
                    ) : (
                        <div
                            ref={vaultScrollRef}
                            className={`flex gap-5 overflow-x-auto pb-4 pt-2 no-scrollbar px-2 ${isVaultSelectMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} select-none`}
                            onMouseDown={(e) => {
                                if (isVaultSelectMode) return;
                                if (!vaultScrollRef.current) return;
                                vaultDragMoved.current = false;
                                vaultDrag.current = { x: e.clientX, scrollLeft: vaultScrollRef.current.scrollLeft };
                            }}
                            onMouseMove={(e) => {
                                if (isVaultSelectMode) return;
                                if (!vaultDrag.current || !vaultScrollRef.current) return;
                                const dx = e.clientX - vaultDrag.current.x;
                                if (Math.abs(dx) > 4) vaultDragMoved.current = true;
                                vaultScrollRef.current.scrollLeft = vaultDrag.current.scrollLeft - dx;
                            }}
                            onMouseUp={() => { vaultDrag.current = null; }}
                            onMouseLeave={() => { vaultDrag.current = null; }}
                            onTouchStart={(e) => {
                                if (isVaultSelectMode) return;
                                if (!vaultScrollRef.current) return;
                                vaultDragMoved.current = false;
                                vaultDrag.current = { x: e.touches[0].clientX, scrollLeft: vaultScrollRef.current.scrollLeft };
                            }}
                            onTouchMove={(e) => {
                                if (isVaultSelectMode) return;
                                if (!vaultDrag.current || !vaultScrollRef.current) return;
                                const dx = e.touches[0].clientX - vaultDrag.current.x;
                                if (Math.abs(dx) > 4) vaultDragMoved.current = true;
                                vaultScrollRef.current.scrollLeft = vaultDrag.current.scrollLeft - dx;
                            }}
                            onTouchEnd={() => { vaultDrag.current = null; }}
                        >
                            {vaultImages.map((img, i) => {
                                const isSelected = selectedImageUrls.has(img.url);
                                return (
                                    <div
                                        key={i}
                                        className={`shrink-0 w-56 h-64 md:w-64 md:h-80 rounded-[32px] overflow-hidden border transition-all shadow-2xl relative bg-neutral-900
                                ${isVaultSelectMode
                                                ? isSelected
                                                    ? "border-amber-500 scale-[0.97] ring-2 ring-amber-500/50"
                                                    : "border-white/20 hover:border-amber-500/60"
                                                : usedImageUrls.has(img.url)
                                                    ? "border-emerald-500/50 hover:border-emerald-400 cursor-zoom-in"
                                                    : "border-white/10 hover:border-amber-500/50 cursor-zoom-in"}`}
                                        onClick={() => {
                                            if (isVaultSelectMode) { toggleImageSelect(img.url); return; }
                                            if (vaultDragMoved.current) return;
                                            openVaultImagePreview(i);
                                        }}
                                    >
                                        <img
                                            src={img.url}
                                            alt={`Vault ${i}`}
                                            className="w-full h-full object-cover"
                                        />
                                        {isVaultSelectMode && (
                                            <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "bg-amber-500 border-amber-500" : "bg-black/40 border-white/40 backdrop-blur-sm"}`}>
                                                {isSelected && <Check size={13} className="text-black" strokeWidth={3} />}
                                            </div>
                                        )}
                                        {!isVaultSelectMode && usedImageUrls.has(img.url) && (
                                            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-500/90 backdrop-blur-sm pointer-events-none">
                                                <FileText size={10} className="text-white" />
                                                <span className="text-[9px] font-black text-white uppercase tracking-wide">En PDF</span>
                                            </div>
                                        )}
                                        {!isVaultSelectMode && favorites.has(img.url) && (
                                            <div className="absolute top-2 left-2 p-1.5 rounded-xl bg-black/60 text-rose-400 pointer-events-none">
                                                <Heart size={11} className="fill-rose-400" />
                                            </div>
                                        )}
                                        {!isVaultSelectMode && img.seed !== undefined && (
                                            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm pointer-events-none">
                                                <span className="text-[8px] font-mono text-amber-400/80">seed {img.seed}</span>
                                            </div>
                                        )}
                                        {isVaultSelectMode && isSelected && (
                                            <div className="absolute inset-0 bg-amber-500/15 pointer-events-none" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Cloudinary Persistent Gallery */}
                <div className="space-y-4 pb-4">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <div className="flex items-center gap-3">
                            <Cloud size={14} className="text-cyan-400" />
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Cloudinary · Almacén Persistente</h3>
                        </div>
                        {cloudinaryImages.length > 0 && (
                            <button
                                onClick={() => {
                                    setIsCloudSelectMode(v => {
                                        if (v) setSelectedCloudUrls(new Set());
                                        return !v;
                                    });
                                }}
                                className={`h-7 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${isCloudSelectMode ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300" : "bg-white/5 border-white/10 text-neutral-500 hover:text-white hover:border-white/20"}`}
                            >
                                {isCloudSelectMode ? "Cancelar" : "Seleccionar"}
                            </button>
                        )}
                        <button
                            onClick={() => void fetchCloudinaryImages()}
                            disabled={isLoadingCloudinary}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 text-neutral-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-40"
                            title="Actualizar galería"
                        >
                            {isLoadingCloudinary ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        </button>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>

                    {/* Selection action bar */}
                    {isCloudSelectMode && selectedCloudUrls.size > 0 && (
                        <div className="mx-2 flex items-center gap-3 px-4 py-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                            <span className="text-[11px] font-black text-cyan-300 flex-1">{selectedCloudUrls.size} imagen{selectedCloudUrls.size !== 1 ? "es" : ""} seleccionada{selectedCloudUrls.size !== 1 ? "s" : ""}</span>
                            <button
                                onClick={() => setSelectedCloudUrls(new Set(cloudinaryImages.map(i => i.url)))}
                                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-200 transition-colors"
                            >Selec. todo</button>
                            <button
                                onClick={() => {
                                    setCustomCatalogName(`Catálogo Cloudinary ${new Date().toLocaleDateString("es-ES")}`);
                                    setShowCustomCatalogModal(true);
                                }}
                                className="h-8 px-4 rounded-xl bg-cyan-500 text-black text-[11px] font-black hover:bg-cyan-400 transition-all flex items-center gap-2"
                            >
                                <Layers size={12} />
                                Crear Catálogo
                            </button>
                        </div>
                    )}

                    {/* Search */}
                    {cloudinaryImages.length > 0 && (
                        <div className="px-2">
                            <input
                                value={cloudSearch}
                                onChange={e => setCloudSearch(e.target.value)}
                                placeholder="Buscar por nombre de archivo…"
                                className="w-full h-8 bg-white/5 border border-white/10 rounded-xl px-3 text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-cyan-500/40 transition-all"
                            />
                        </div>
                    )}

                    {cloudinaryImages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 opacity-40">
                            <Cloud size={32} className="text-neutral-600" strokeWidth={1.5} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                                {isLoadingCloudinary ? "Cargando..." : "Sin imágenes en Cloudinary · Sube assets desde el vault"}
                            </p>
                        </div>
                    ) : (
                        <div className="flex gap-4 overflow-x-auto pb-4 pt-2 no-scrollbar px-2">
                            {cloudinaryImages.filter(img => !cloudSearch.trim() || img.publicId.toLowerCase().includes(cloudSearch.toLowerCase())).map((img, cldIdx) => {
                                const isCloudSel = selectedCloudUrls.has(img.url);
                                const isFav = favorites.has(img.url);
                                return (
                                    <div
                                        key={img.publicId}
                                        className={`shrink-0 w-44 h-52 md:w-52 md:h-64 rounded-[28px] overflow-hidden border transition-all shadow-xl relative bg-neutral-900 group ${isCloudSelectMode ? "cursor-pointer" : "cursor-zoom-in"} ${isCloudSel ? "border-cyan-500/70 ring-2 ring-cyan-500/30" : "border-white/10 hover:border-cyan-500/40"}`}
                                        onClick={() => {
                                            if (isCloudSelectMode) {
                                                setSelectedCloudUrls(prev => {
                                                    const next = new Set(prev);
                                                    next.has(img.url) ? next.delete(img.url) : next.add(img.url);
                                                    return next;
                                                });
                                            } else {
                                                openCloudinaryImagePreview(cldIdx);
                                            }
                                        }}
                                    >
                                        <img src={img.url} alt={img.publicId} className="w-full h-full object-cover" />

                                        {/* Selection overlay */}
                                        {isCloudSelectMode && (
                                            <>
                                                <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isCloudSel ? "bg-cyan-500 border-cyan-500" : "bg-black/40 border-white/40 backdrop-blur-sm"}`}>
                                                    {isCloudSel && <Check size={13} className="text-black" strokeWidth={3} />}
                                                </div>
                                                {isCloudSel && <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none" />}
                                            </>
                                        )}

                                        {/* Heart button: always top-left; rose filled when fav */}
                                        {!isCloudSelectMode && (
                                            <button
                                                onClick={e => { e.stopPropagation(); toggleFavorite(img.url, { label: img.publicId.split("/").pop() ?? "", source: "cloudinary" }); }}
                                                className={`absolute top-2 left-2 p-1.5 rounded-xl backdrop-blur-sm transition-all ${isFav ? "bg-rose-500/80 text-white opacity-100" : "bg-black/50 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-rose-400"}`}
                                            >
                                                <Heart size={11} className={isFav ? "fill-white" : ""} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* IA Catalog list */}
                <div ref={catalogsListRef}>
                    {/* Skeleton while loading initial list */}
                    {isLoadingCatalogs && iaCatalogs.length === 0 && (
                        <div className="space-y-4">
                            <SectionHeader icon={<Layers size={16} />} title="Catálogos IA" color="sky" size="sm" />
                            <div className="space-y-3">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.01] overflow-hidden animate-pulse">
                                        <div className="h-px w-full bg-white/10" />
                                        <div className="p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-2 flex-1">
                                                    <div className="h-4 w-1/3 bg-white/5 rounded-lg" />
                                                    <div className="h-3 w-2/3 bg-white/5 rounded-lg" />
                                                </div>
                                                <div className="h-5 w-20 bg-white/5 rounded-full" />
                                            </div>
                                            <div className="flex justify-between">
                                                <div className="h-7 w-36 bg-white/5 rounded-xl" />
                                                <div className="h-4 w-20 bg-white/5 rounded-lg" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {iaCatalogs.length > 0 && (() => {
                        const filteredByCatalogNiche = catalogNicheFilter
                            ? iaCatalogs.filter(c => (c.nicheIds ?? []).includes(catalogNicheFilter))
                            : iaCatalogs;
                        const activeCatalogs = filteredByCatalogNiche.filter(c => c.status === "running" || c.status === "pending" || c.status === "queued");
                        const doneCatalogs = filteredByCatalogNiche.filter(c => c.status === "completed" || c.status === "failed" || c.status === "cancelled");
                        const totalImages = filteredByCatalogNiche.reduce((sum, c) => sum + c.images.length, 0);

                        const renderCard = (catalog: IACatalogFE) => {
                            const progress = catalog.totalImages > 0 ? (catalog.images.length / catalog.totalImages) * 100 : 0;
                            const isActive = catalog.status === "running" || catalog.status === "pending" || catalog.status === "queued";
                            const queuedList = iaCatalogs.filter(c => c.status === "queued");
                            const queuePos = catalog.status === "queued" ? queuedList.indexOf(catalog) + 1 : 0;
                            const remainingImages = Math.max(0, catalog.totalImages - catalog.images.length - (catalog.skippedImages ?? 0));
                            const estMin = Math.round(remainingImages * 1.5);
                            const timeStr = estMin > 60 ? `~${Math.floor(estMin / 60)}h ${estMin % 60}m` : estMin > 0 ? `~${estMin}m` : "";
                            const providerColor = catalog.aiModel?.provider === "Google" ? { bar: "bg-blue-500/50", gradient: "from-blue-500 via-blue-400 to-cyan-400", border: "hover:border-blue-500/20", badge: "bg-blue-500/10 border-blue-500/20 text-blue-300", dot: "bg-blue-400" }
                                : catalog.aiModel?.provider === "Leonardo" ? { bar: "bg-amber-500/50", gradient: "from-amber-500 via-orange-400 to-amber-300", border: "hover:border-amber-500/20", badge: "bg-amber-500/10 border-amber-500/20 text-amber-300", dot: "bg-amber-400" }
                                    : catalog.aiModel?.provider === "Pollinations" ? { bar: "bg-emerald-500/50", gradient: "from-emerald-500 via-emerald-400 to-cyan-400", border: "hover:border-emerald-500/20", badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300", dot: "bg-emerald-400" }
                                        : { bar: "bg-sky-500/50", gradient: "from-sky-500 via-sky-400 to-cyan-400", border: "hover:border-sky-500/20", badge: "bg-sky-500/10 border-sky-500/20 text-sky-300", dot: "bg-sky-400" };
                            const isDraggable = catalog.status === "queued";
                            const isDragOver = dragOverId === catalog._id;
                            return (
                                <Card
                                    key={catalog._id}
                                    variant="outline"
                                    draggable={isDraggable}
                                    onDragStart={() => isDraggable && setDraggingId(catalog._id)}
                                    onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                                    onDragOver={(e: React.DragEvent) => { if (isDraggable && draggingId) { e.preventDefault(); setDragOverId(catalog._id); } }}
                                    onDrop={(e: React.DragEvent) => { e.preventDefault(); if (draggingId && isDraggable) void handleQueueReorder(draggingId, catalog._id); setDraggingId(null); setDragOverId(null); }}
                                    className={`group relative border-white/5 bg-white/[0.01] overflow-hidden transition-all duration-300 ${providerColor.border} ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragOver ? "ring-1 ring-orange-500/50 border-orange-500/30" : ""} ${draggingId === catalog._id ? "opacity-50" : ""}`}
                                >
                                    {/* Lateral provider border */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${providerColor.gradient} opacity-40 group-hover:opacity-100 transition-all duration-300`} />
                                    {/* Top accent */}
                                    <div className={`h-px w-full ${providerColor.bar} opacity-60`} />
                                    <div className="p-4 pl-5 space-y-3">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    {isDraggable && <GripVertical size={12} className="text-neutral-700 shrink-0" />}
                                                    <h4 className="font-black text-white text-lg leading-tight truncate">{catalog.name}</h4>
                                                </div>
                                                <p className="text-xs text-neutral-500 line-clamp-1 leading-relaxed pl-0.5 italic">{catalog.prompt}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                {statusBadge(catalog.status)}
                                                <span className="text-[9px] text-neutral-600 font-mono">{new Date(catalog.createdAt).toLocaleDateString("es-ES")}</span>
                                            </div>
                                        </div>
                                        {/* Model badge + meta */}
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 backdrop-blur-sm">
                                                <div className={`w-1.5 h-1.5 rounded-full ${providerColor.dot} shrink-0`} />
                                                <span className={`text-[9px] font-black uppercase tracking-wider ${providerColor.badge.split(" ").find(c => c.startsWith("text-")) ?? "text-neutral-400"}`}>{catalog.aiModel?.provider}</span>
                                                <span className="text-neutral-700 text-[9px]">·</span>
                                                <span className="text-[9px] font-mono text-neutral-400 truncate max-w-[160px]">{catalog.aiModel?.name.split(" ").slice(0, 3).join(" ")}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] font-mono text-neutral-600">
                                                <span>{catalog.width}×{catalog.height}</span>
                                                <span className="text-neutral-700">·</span>
                                                <span className="font-black text-neutral-400">{catalog.images.length}/{catalog.totalImages}</span>
                                                {isActive && catalog.status !== "queued" && <Loader2 size={9} className="text-blue-400 animate-spin" />}
                                                {(catalog.skippedImages ?? 0) > 0 && <span className="text-amber-500/70 not-mono">· {catalog.skippedImages} omit.</span>}
                                                {isActive && catalog.status === "running" && timeStr && <span className="text-sky-400/70 not-mono">· {timeStr}</span>}
                                            </div>
                                        </div>
                                        {/* Niche tags */}
                                        {(catalog.nicheIds?.length ?? 0) > 0 && (
                                            <div className="flex gap-1.5 flex-wrap">
                                                {catalog.nicheIds!.map(nid => {
                                                    const n = niches.find(n => n._id === nid);
                                                    return n ? (
                                                        <span key={nid} className="flex items-center gap-1 px-2 h-5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[9px] font-bold text-sky-400">
                                                            <Target size={7} /> {n.name}
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}
                                        {/* Error */}
                                        {catalog.lastError && (
                                            <p className="text-[9px] text-red-400/70 font-mono break-all leading-relaxed bg-red-500/5 border border-red-500/10 rounded-lg px-2 py-1.5">
                                                ⚠ {catalog.lastError.length > 100 ? catalog.lastError.slice(0, 100) + "…" : catalog.lastError}
                                            </p>
                                        )}
                                        {/* Action buttons — two groups */}
                                        <div className="flex items-center justify-between gap-2">
                                            {/* Left: utility actions */}
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <button
                                                    onClick={() => {
                                                        if (catalog.promptParts?.theme) {
                                                            setPromptTheme(catalog.promptParts.theme);
                                                            setPromptSpecs(catalog.promptParts.specs ?? "");
                                                            setPromptDetails(catalog.promptParts.details ?? "");
                                                            setPromptParticulars(catalog.promptParts.particulars ?? "");
                                                        } else {
                                                            const prefix = "Genera una imagen con la siguiente temática: ";
                                                            let raw = catalog.prompt;
                                                            if (raw.startsWith(prefix)) raw = raw.slice(prefix.length);
                                                            const styleIdx = raw.indexOf(". Style:");
                                                            if (styleIdx >= 0) raw = raw.slice(0, styleIdx);
                                                            const cutAt = [
                                                                raw.indexOf(", que tenga las siguientes especificaciones:"),
                                                                raw.indexOf(", con los siguientes detalles:"),
                                                                raw.indexOf(", y las siguientes particularidades:"),
                                                            ].filter(i => i >= 0).sort((a, b) => a - b)[0] ?? -1;
                                                            setPromptTheme(cutAt >= 0 ? raw.slice(0, cutAt) : raw);
                                                            setPromptSpecs(""); setPromptDetails(""); setPromptParticulars("");
                                                        }
                                                        const matchModel = AI_MODELS.find(m => m.id === catalog.aiModel?.id);
                                                        if (matchModel) setSelectedModel(matchModel.id);
                                                        const matchDim = AI_DIMENSIONS.find(d => d.width === catalog.width && d.height === catalog.height);
                                                        if (matchDim) setSelectedDim(matchDim.id);
                                                        if (catalog.productType) setCatalogProductType(catalog.productType);
                                                        if (catalog.creativity !== undefined) setCatalogCreativity(catalog.creativity);
                                                        if (catalog.negativePrompt !== undefined) setCatalogNegativePrompt(catalog.negativePrompt);
                                                        toast.success("Prompt, modelo y resolución cargados");
                                                    }}
                                                    title="Cargar prompt, modelo y resolución"
                                                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white transition-all border border-white/10 text-[9px] font-black uppercase tracking-widest"
                                                >
                                                    <Copy size={11} /> Reusar
                                                </button>
                                                {catalog.images.length > 0 && (
                                                    <>
                                                        <button
                                                            onClick={() => { const pages: BookPage[] = catalog.images.map((img, i) => ({ id: genPageId(), type: "image" as const, image: { url: img.url, scale: 1, label: `${catalog.name} #${i + 1}` }, text: defaultTextStyle() })); setBookPages(pages); setSelectedPageId(pages[0]?.id ?? null); setBookEditorOpen(true); }}
                                                            title="Editar PDF en editor"
                                                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/20 text-[9px] font-black uppercase tracking-widest"
                                                        >
                                                            <FileText size={11} /> Editor
                                                        </button>
                                                        <button
                                                            onClick={() => void downloadCatalogPdfDirect(catalog)}
                                                            disabled={directPdfCatalogId === catalog._id}
                                                            title={`Descargar PDF directo · ${catalog.images.length} páginas`}
                                                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-all border border-sky-500/20 text-[9px] font-black uppercase tracking-widest disabled:opacity-50"
                                                        >
                                                            {directPdfCatalogId === catalog._id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                                            PDF
                                                        </button>
                                                    </>
                                                )}
                                                {catalog.status === "completed" && catalog.images.length > 0 && (catalog.nicheIds?.length ?? 0) > 0 && (() => {
                                                    const linkedNiche = niches.find(n => (catalog.nicheIds ?? []).includes(n._id));
                                                    if (!linkedNiche) return null;
                                                    return (
                                                        <button
                                                            onClick={() => {
                                                                setContentNiche(`${linkedNiche.name} — ${NICHE_PRODUCT_OPTIONS.find(p => p.id === linkedNiche.productType)?.label ?? linkedNiche.productType}`);
                                                                setContentType("kdp-physical-book");
                                                                setContentResult(null);
                                                                changeTab("studio");
                                                                toast.success(`Contenido listo para: ${linkedNiche.name}`);
                                                            }}
                                                            title="Generar contenido KDP para este nicho"
                                                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest"
                                                        >
                                                            <ArrowRight size={11} /> Contenido
                                                        </button>
                                                    );
                                                })()}
                                                {(catalog.skippedImages ?? 0) > 0 && !isActive && (
                                                    <button
                                                        onClick={() => void retryFailedSlots(catalog._id)}
                                                        disabled={retryingCatalogId === catalog._id}
                                                        title={`Reintentar ${catalog.skippedImages} fallados`}
                                                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/20 text-[9px] font-black uppercase tracking-widest disabled:opacity-50"
                                                    >
                                                        {retryingCatalogId === catalog._id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                                                        {catalog.skippedImages} fallidos
                                                    </button>
                                                )}
                                                {(() => {
                                                    const linkedNiches = niches.filter(n => (catalog.nicheIds ?? []).includes(n._id));
                                                    const isOpen = catalogNichePickerId === catalog._id;
                                                    const hasNiches = niches.length > 0;
                                                    return (
                                                        <button
                                                            onClick={() => hasNiches && setCatalogNichePickerId(isOpen ? null : catalog._id)}
                                                            title={hasNiches ? "Vincular nicho" : "No hay nichos — créalos primero en la pestaña Nichos"}
                                                            disabled={!hasNiches}
                                                            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-xl border transition-all text-[9px] font-black uppercase tracking-wider shrink-0 disabled:opacity-40 disabled:cursor-not-allowed
                                                                ${linkedNiches.length > 0
                                                                    ? isOpen
                                                                        ? "bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.2)]"
                                                                        : "bg-sky-500/10 border-sky-500/25 text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/40"
                                                                    : isOpen
                                                                        ? "bg-violet-500/15 border-violet-500/35 text-violet-300"
                                                                        : "border-dashed border-white/15 text-neutral-500 hover:border-sky-500/30 hover:text-sky-400 hover:bg-sky-500/[0.06]"
                                                                }`}
                                                        >
                                                            <Target size={11} className="shrink-0" />
                                                            {linkedNiches.length > 0
                                                                ? <span className="max-w-[80px] truncate">{linkedNiches.length === 1 ? linkedNiches[0].name : `${linkedNiches.length} nichos`}</span>
                                                                : "Nicho"
                                                            }
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                            {/* Right: destructive actions */}
                                            <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-white/[0.06]">
                                                {isActive && (
                                                    <button
                                                        onClick={() => setConfirmStopCatalogId(catalog._id)}
                                                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest"
                                                    >
                                                        <StopCircle size={11} /> Detener
                                                    </button>
                                                )}
                                                <button onClick={() => setConfirmDeleteCatalogId(catalog._id)} disabled={deletingCatalogId === catalog._id} title="Eliminar catálogo" className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20 disabled:opacity-50">
                                                    {deletingCatalogId === catalog._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Progress bar */}
                                    {isActive && (
                                        <div className="px-4 pb-3 space-y-1.5 border-t border-white/5 pt-3">
                                            <div className="flex justify-between text-[9px] uppercase tracking-widest text-neutral-600">
                                                <span className="flex items-center gap-1.5"><Loader2 size={8} className="animate-spin text-blue-400" />{catalog.status === "queued" ? `En cola · posición ${queuePos}` : catalog.status === "pending" ? "Iniciando..." : "Generando"}</span>
                                                {catalog.status !== "queued" && <span className="font-black text-neutral-400">{Math.round(progress)}% {timeStr && <span className="text-sky-400/80 normal-case">{timeStr}</span>}</span>}
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                {catalog.status === "queued"
                                                    ? <div className="h-full w-1/3 bg-gradient-to-r from-orange-500/30 to-orange-400/60 rounded-full animate-pulse" />
                                                    : <div className="h-full bg-gradient-to-r from-sky-500 to-blue-400 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                                                }
                                            </div>
                                        </div>
                                    )}
                                    {/* Niche picker inline */}
                                    {catalogNichePickerId === catalog._id && (
                                        <div className="px-4 pb-4 border-t border-sky-500/10 pt-3 space-y-3 bg-gradient-to-b from-sky-500/[0.04] to-transparent">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
                                                        <Target size={10} className="text-sky-400" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-sky-400/80">Vincular nichos</span>
                                                </div>
                                                <button onClick={() => setCatalogNichePickerId(null)} className="w-5 h-5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-600 hover:text-white hover:bg-white/10 transition-all">
                                                    <X size={9} />
                                                </button>
                                            </div>
                                            <div className="rounded-2xl border border-white/8 bg-white/[0.015] overflow-hidden max-h-48 overflow-y-auto">
                                                {niches.map((n, ni) => {
                                                    const assigned = (catalog.nicheIds ?? []).includes(n._id);
                                                    const catCount = iaCatalogs.filter(c => (c.nicheIds ?? []).includes(n._id)).length;
                                                    return (
                                                        <button key={n._id}
                                                            onClick={() => {
                                                                const cur = catalog.nicheIds ?? [];
                                                                const next = assigned ? cur.filter(id => id !== n._id) : [...cur, n._id];
                                                                setIaCatalogs(prev => prev.map(c => c._id === catalog._id ? { ...c, nicheIds: next } : c));
                                                                setNiches(prev => prev.map(nx => {
                                                                    if (nx._id === n._id) {
                                                                        const cats = nx.catalogIds ?? [];
                                                                        return {
                                                                            ...nx,
                                                                            catalogIds: assigned
                                                                                ? cats.filter(cid => cid !== catalog._id)
                                                                                : cats.includes(catalog._id) ? cats : [...cats, catalog._id],
                                                                        };
                                                                    }
                                                                    return nx;
                                                                }));
                                                                fetch(`${API_BASE_URL}/catalogs/${catalog._id}`, {
                                                                    method: "PATCH",
                                                                    headers: { "Content-Type": "application/json" },
                                                                    body: JSON.stringify({ nicheIds: next }),
                                                                }).catch(() => { });
                                                            }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${ni > 0 ? "border-t border-white/[0.05]" : ""} ${assigned ? "bg-sky-500/[0.07]" : "hover:bg-white/[0.03]"}`}
                                                        >
                                                            <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${assigned ? "bg-sky-500 border-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.4)]" : "border-neutral-700 bg-transparent"}`}>
                                                                {assigned && <Check size={8} className="text-white" strokeWidth={3} />}
                                                            </div>
                                                            <span className={`text-[11px] font-bold flex-1 truncate ${assigned ? "text-white" : "text-neutral-400"}`}>{n.name}</span>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {catCount > 0 && <span className="text-[8px] font-black text-sky-400/60 bg-sky-500/10 border border-sky-500/15 px-1.5 py-0.5 rounded-full">{catCount} cat</span>}
                                                                {n.status && <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${n.status === "active" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/15" : "text-neutral-600 bg-white/5 border border-white/8"}`}>{n.status}</span>}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {/* Image grid */}
                                    {catalog.images.length > 0 && (
                                        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
                                            {/* Bulk delete toolbar */}
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[9px] text-neutral-700 font-mono">{catalog.images.length} imgs</span>
                                                <div className="flex items-center gap-1.5">
                                                    {bulkDeleteCatalogId === catalog._id && (
                                                        <button
                                                            onClick={() => {
                                                                const allIds = catalog.images.map(i => i.publicId);
                                                                const allSelected = allIds.every(id => bulkDeleteSelection.has(id));
                                                                setBulkDeleteSelection(allSelected ? new Set() : new Set(allIds));
                                                            }}
                                                            className="h-6 px-2 rounded-lg bg-white/5 border border-white/10 text-[9px] text-neutral-500 hover:text-white transition-all">
                                                            {catalog.images.every(i => bulkDeleteSelection.has(i.publicId)) ? "Desel. todo" : "Sel. todo"}
                                                        </button>
                                                    )}
                                                    {bulkDeleteCatalogId === catalog._id && bulkDeleteSelection.size > 0 && (
                                                        <button
                                                            onClick={() => void bulkDeleteSelectedImages(catalog._id)}
                                                            disabled={isBulkDeleting}
                                                            className="flex items-center gap-1 h-6 px-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                                                        >
                                                            {isBulkDeleting ? <Loader2 size={9} className="animate-spin" /> : <Trash2 size={9} />}
                                                            Borrar {bulkDeleteSelection.size}
                                                        </button>
                                                    )}
                                                    {bulkDeleteCatalogId === catalog._id && bulkDeleteSelection.size > 0 && (
                                                        <button onClick={() => setBulkDeleteSelection(new Set())}
                                                            className="h-6 px-2 rounded-lg bg-white/5 border border-white/10 text-[9px] text-neutral-500 hover:text-white transition-all">
                                                            Limpiar
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            if (bulkDeleteCatalogId === catalog._id) {
                                                                setBulkDeleteCatalogId(null);
                                                                setBulkDeleteSelection(new Set());
                                                            } else {
                                                                setBulkDeleteCatalogId(catalog._id);
                                                                setBulkDeleteSelection(new Set());
                                                            }
                                                        }}
                                                        className={`h-6 px-2.5 rounded-lg text-[9px] font-black uppercase transition-all border ${bulkDeleteCatalogId === catalog._id ? "bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25" : "bg-white/5 border-white/10 text-neutral-500 hover:text-white"}`}
                                                    >
                                                        {bulkDeleteCatalogId === catalog._id ? "✕ Cancelar" : "Seleccionar"}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                                                {catalog.images.map((img, imgIdx) => {
                                                    const isCatSelected = selectedImageUrls.has(img.url);
                                                    const isBulkSel = bulkDeleteCatalogId === catalog._id && bulkDeleteSelection.has(img.publicId);
                                                    const isBulkMode = bulkDeleteCatalogId === catalog._id;
                                                    return (
                                                        <div
                                                            key={img.publicId}
                                                            className={`aspect-square rounded-lg overflow-hidden bg-white/5 border transition-all relative group ${isBulkMode ? (isBulkSel ? "border-red-500 ring-1 ring-red-500/50 cursor-pointer" : "border-white/10 hover:border-red-500/50 cursor-pointer") : isVaultSelectMode ? (isCatSelected ? "border-sky-500 ring-1 ring-sky-500/50 cursor-pointer" : "border-white/10 hover:border-sky-500/50 cursor-pointer") : "border-white/5 cursor-zoom-in hover:border-sky-500/40"}`}
                                                            onClick={() => {
                                                                if (isBulkMode) {
                                                                    setBulkDeleteSelection(prev => { const next = new Set(prev); isBulkSel ? next.delete(img.publicId) : next.add(img.publicId); return next; });
                                                                } else if (isVaultSelectMode) {
                                                                    toggleImageSelect(img.url);
                                                                } else {
                                                                    openCatalogImagePreview(catalog.images, imgIdx, catalog._id);
                                                                }
                                                            }}
                                                        >
                                                            <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                            {isBulkMode && (
                                                                <div className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isBulkSel ? "bg-red-500 border-red-500" : "bg-black/50 border-white/30 backdrop-blur-sm"}`}>
                                                                    {isBulkSel && <Check size={9} className="text-white" strokeWidth={3} />}
                                                                </div>
                                                            )}
                                                            {!isBulkMode && isVaultSelectMode && (
                                                                <div className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isCatSelected ? "bg-sky-500 border-sky-500" : "bg-black/50 border-white/30 backdrop-blur-sm"}`}>
                                                                    {isCatSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                                                                </div>
                                                            )}
                                                            {!isBulkMode && !isVaultSelectMode && (
                                                                <button
                                                                    onClick={e => { e.stopPropagation(); toggleFavorite(img.url, { label: `${catalog.name} #${imgIdx + 1}`, source: "catalog" }); }}
                                                                    className={`absolute top-0.5 left-0.5 p-0.5 rounded-md backdrop-blur-sm transition-all ${favorites.has(img.url) ? "bg-rose-500/80 text-white opacity-100" : "bg-black/50 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-rose-400"}`}
                                                                >
                                                                    <Heart size={8} className={favorites.has(img.url) ? "fill-white" : ""} />
                                                                </button>
                                                            )}
                                                            {isBulkSel && <div className="absolute inset-0 bg-red-500/10 pointer-events-none" />}
                                                        </div>
                                                    );
                                                })}
                                                {isActive && Array.from({ length: catalog.totalImages - catalog.images.length }).map((_, i) => (
                                                    <div key={`ph-${i}`} className="aspect-square rounded-lg bg-white/[0.02] border border-dashed border-white/10 flex items-center justify-center">
                                                        <Loader2 size={10} className="text-neutral-700 animate-spin" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            );
                        };

                        return (
                            <div className="space-y-4">
                                {/* Header with counter + controls */}
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <SectionHeader
                                            icon={<Layers size={16} />}
                                            title={<>Catálogos IA{totalImages > 0 && <span className="text-[9px] font-black text-sky-400/60 tabular-nums ml-2 not-italic">{totalImages} imgs</span>}</>}
                                            color="sky"
                                            size="sm"
                                        />
                                    </div>
                                    <button onClick={() => void fetchCatalogs()} disabled={isLoadingCatalogs} className="p-2 rounded-xl bg-white/5 border border-white/10 text-neutral-500 hover:text-sky-400 hover:border-sky-500/30 transition-all disabled:opacity-40">
                                        {isLoadingCatalogs ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    </button>
                                </div>

                                {/* ── Niche filter bar ── */}
                                {niches.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                                            {/* All */}
                                            <button
                                                onClick={() => setCatalogNicheFilter(null)}
                                                className={`flex items-center gap-2 h-9 px-4 rounded-2xl border text-[10px] font-black whitespace-nowrap shrink-0 transition-all ${!catalogNicheFilter
                                                    ? "bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-[0_0_16px_rgba(14,165,233,0.25)]"
                                                    : "border-white/10 bg-white/[0.02] text-neutral-500 hover:text-neutral-300 hover:border-white/20 hover:bg-white/[0.04]"}`}>
                                                <Layers size={12} className={!catalogNicheFilter ? "text-sky-400" : "text-neutral-600"} />
                                                Todos los catálogos
                                                <span className={`text-[9px] tabular-nums font-black ${!catalogNicheFilter ? "text-sky-400/70" : "text-neutral-700"}`}>{iaCatalogs.length}</span>
                                            </button>
                                            {/* Per-niche pills */}
                                            {niches.map(n => {
                                                const count = iaCatalogs.filter(c => (c.nicheIds ?? []).includes(n._id)).length;
                                                const isAct = catalogNicheFilter === n._id;
                                                const statusDot: Record<NicheStatus, string> = { found: "bg-sky-400", research: "bg-blue-400", active: "bg-emerald-400", archived: "bg-neutral-600" };
                                                return (
                                                    <button key={n._id}
                                                        onClick={() => setCatalogNicheFilter(isAct ? null : n._id)}
                                                        className={`flex items-center gap-2 h-9 px-4 rounded-2xl border text-[10px] font-black whitespace-nowrap shrink-0 transition-all ${isAct
                                                            ? "bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-[0_0_16px_rgba(14,165,233,0.25)]"
                                                            : "border-white/10 bg-white/[0.02] text-neutral-500 hover:text-neutral-300 hover:border-white/20 hover:bg-white/[0.04]"}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[n.status]}`} />
                                                        {n.name}
                                                        <span className={`text-[9px] tabular-nums font-black px-1.5 py-0.5 rounded-lg ${isAct
                                                            ? "bg-sky-500/30 text-sky-300"
                                                            : count > 0 ? "bg-white/5 text-neutral-600" : "text-neutral-800"}`}>
                                                            {count}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {/* Active filter indicator */}
                                        {catalogNicheFilter && (() => {
                                            const n = niches.find(x => x._id === catalogNicheFilter);
                                            return n ? (
                                                <div className="flex items-center gap-2 px-1">
                                                    <div className="h-px flex-1 bg-sky-500/20" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-sky-400/60">
                                                        Filtrando por: {n.name}
                                                    </span>
                                                    <button onClick={() => setCatalogNicheFilter(null)} className="text-[9px] text-neutral-600 hover:text-sky-400 transition-colors">
                                                        <X size={10} />
                                                    </button>
                                                    <div className="h-px flex-1 bg-sky-500/20" />
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                )}

                                {/* ── Queue time estimate banner ── */}
                                {activeCatalogs.length > 0 && queueEstimateMs !== null && (() => {
                                    const totalSec = Math.max(0, Math.round(queueEstimateMs / 1000));
                                    const h = Math.floor(totalSec / 3600);
                                    const m = Math.floor((totalSec % 3600) / 60);
                                    const s = totalSec % 60;
                                    const timeLabel = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
                                    const running = activeCatalogs.filter(c => c.status === "running" || c.status === "pending");
                                    const queued = activeCatalogs.filter(c => c.status === "queued");
                                    const totalImagesLeft = activeCatalogs.reduce((s, c) => s + Math.max(0, c.totalImages - c.images.length - (c.skippedImages ?? 0)), 0);
                                    const totalImagesAll = activeCatalogs.reduce((s, c) => s + c.totalImages, 0);
                                    const totalGenerated = activeCatalogs.reduce((s, c) => s + c.images.length, 0);
                                    const overallPct = totalImagesAll > 0 ? Math.round((totalGenerated / totalImagesAll) * 100) : 0;
                                    return (
                                        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] overflow-hidden">
                                            <div className="px-4 py-3 flex items-center gap-3">
                                                <div className="relative shrink-0">
                                                    <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                                                    <div className="absolute inset-0 rounded-full bg-sky-400/30 animate-ping" />
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="space-y-0.5">
                                                            <p className="text-[10px] font-black text-sky-300 leading-tight">
                                                                {running.length > 0 ? `Generando catálogo ${running.length > 1 ? `(${running.length})` : `"${running[0].name}"`}` : `En cola — ${queued.length} catálogo${queued.length !== 1 ? "s" : ""}`}
                                                                {queued.length > 0 && running.length > 0 && <span className="text-sky-500/60 font-normal"> · {queued.length} en cola</span>}
                                                            </p>
                                                            {running[0]?.currentPrompt && (
                                                                <p className="text-[9px] text-sky-500/70 font-mono truncate max-w-[260px]" title={running[0].currentPrompt}>"{running[0].currentPrompt}"</p>
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] font-black text-white tabular-nums shrink-0">~{timeLabel}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all duration-1000"
                                                                style={{ width: `${overallPct}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[9px] text-neutral-600 tabular-nums shrink-0">{totalGenerated}/{totalImagesAll} imgs</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Active catalogs (always visible) */}
                                {activeCatalogs.length > 0 && (
                                    <div className="space-y-3">
                                        {activeCatalogs.map(renderCard)}
                                    </div>
                                )}

                                {/* Done catalogs with collapse toggle */}
                                {doneCatalogs.length > 0 && (
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => setCollapsedCompleted(v => !v)}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all text-left"
                                        >
                                            <ChevronDown size={12} className={`text-neutral-600 transition-transform duration-300 ${collapsedCompleted ? "" : "rotate-180"}`} />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">
                                                {collapsedCompleted ? `Ver ${doneCatalogs.length} catálogo${doneCatalogs.length > 1 ? "s" : ""} finalizado${doneCatalogs.length > 1 ? "s" : ""}` : `Ocultar finalizados`}
                                            </span>
                                            <span className="ml-auto text-[9px] text-neutral-700 font-mono">{doneCatalogs.reduce((s, c) => s + c.images.length, 0)} imgs</span>
                                        </button>
                                        {!collapsedCompleted && (
                                            <div className="space-y-3">
                                                {doneCatalogs.map(renderCard)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {iaCatalogs.length === 0 && !isLoadingCatalogs && (
                        <div className="flex items-center gap-4 px-2 opacity-30">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 flex items-center gap-2"><Layers size={12} />Sin catálogos aún</span>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        </div>
                    )}
                </div>

            </div>
        );
    };

    const renderCreation = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {renderAIStudio()}
        </div>
    );

    const statusBadge = (status: IACatalogFE["status"]) => {
        const map: Record<IACatalogFE["status"], { label: string; cls: string }> = {
            queued: { label: "En espera", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
            pending: { label: "Iniciando...", cls: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20" },
            running: { label: "Generando...", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            completed: { label: "Completado", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
            failed: { label: "Error", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
            cancelled: { label: "Cancelado", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
        };
        const { label, cls } = map[status] ?? { label: status, cls: "bg-white/5 text-neutral-400 border-white/10" };
        return <Badge variant="neutral" className={`text-[9px] font-black uppercase ${cls}`}>{label}</Badge>;
    };

    // ─── STUDIO (Tendencias + Contenido) ─────────────────────────────────────
    const generateContent = async () => {
        if (!contentNiche.trim()) { toast.error("Describe el producto"); return; }
        setIsGeneratingContent(true);
        setContentResult(null);
        try {
            const res = await fetch(`${API_BASE_URL}/ai/generate-text`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: contentType,
                    niche: contentNiche,
                    productType: contentType === "kdp-physical-book" ? "Physical KDP Book" : contentProductType,
                    extras: contentExtras,
                    language: contentLanguage,
                    model: "gemini-2.5-flash",
                }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error ?? "Error generando contenido"); return; }
            setContentResult(data.result);
        } catch { toast.error("Error conectando con la API"); }
        finally { setIsGeneratingContent(false); }
    };

    const generateImagePromptSuggestion = async () => {
        if (!contentNiche.trim()) { toast.error("Describe el producto primero"); return; }
        setIsGeneratingImagePrompt(true);
        setImagePromptSuggestion(null);
        try {
            const res = await fetch(`${API_BASE_URL}/ai/generate-text`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "image-prompt",
                    niche: contentNiche,
                    productType: contentType === "kdp-physical-book" ? "KDP coloring book" : contentProductType,
                    language: "en",
                    model: "gemini-2.5-flash",
                }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error ?? "Error generando prompt"); return; }
            const prompt = typeof data.result === "object" ? (data.result.prompt ?? "") : data.result;
            setImagePromptSuggestion(prompt);
        } catch { toast.error("Error conectando con la API"); }
        finally { setIsGeneratingImagePrompt(false); }
    };

    const saveImagePromptToLibrary = (prompt: string) => {
        setPromptTheme(prompt);
        setPromptSpecs("");
        setPromptDetails("");
        setPromptParticulars("");
        setSavePromptName("");
        setSavePromptCategory("General");
        setShowSavePromptDialog(true);
    };

    const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado"); };

    const generateCover = async () => {
        if (!coverTitle.trim()) { toast.error("Escribe el título del libro"); return; }
        setIsBuildingCover(true);
        setGeneratedCoverUrl(null);
        try {
            const model = AI_MODELS.find(m => m.id === coverModelId) ?? AI_MODELS.find(m => m.id === "pollinations-flux")!;
            const prompt = `KDP paperback book cover illustration background. Style: ${coverStyle}. Color theme: ${coverColorTheme}. Beautiful decorative composition, centered focal artwork, professional book cover layout, high detail, no text, no letters, no words, no typography, no title, no captions, purely illustrative background`;
            const res = await fetch(`${API_BASE_URL}/ai/generate-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, provider: model.provider, modelId: model.modelId, width: 1600, height: 2560 }),
            });
            if (!res.ok) { const err = await res.json(); toast.error(err.error ?? "Error generando portada"); return; }
            const blob = await res.blob();
            setGeneratedCoverUrl(URL.createObjectURL(blob));
        } catch { toast.error("Error conectando con la API"); } finally { setIsBuildingCover(false); }
    };

    const generateBackCover = async () => {
        setIsBuildingBackCover(true);
        setGeneratedBackCoverUrl(null);
        try {
            const model = AI_MODELS.find(m => m.id === coverModelId) ?? AI_MODELS.find(m => m.id === "pollinations-flux")!;
            const prompt = `KDP paperback back cover background. Style: ${coverStyle}. Color theme: ${coverColorTheme}. Subtle and simple background pattern, muted tones, minimal composition, space for text overlay, no text, no letters, no words, no typography, soft decorative elements, professional book back cover`;
            const res = await fetch(`${API_BASE_URL}/ai/generate-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, provider: model.provider, modelId: model.modelId, width: 1600, height: 2560 }),
            });
            if (!res.ok) { const err = await res.json(); toast.error(err.error ?? "Error generando contraportada"); return; }
            const blob = await res.blob();
            setGeneratedBackCoverUrl(URL.createObjectURL(blob));
        } catch { toast.error("Error conectando con la API"); } finally { setIsBuildingBackCover(false); }
    };

    const fetchTrends = async (forceRefresh = false) => {
        setIsLoadingTrends(true);
        if (!forceRefresh) { setTrendsData(null); setSelectedTrend(null); }
        try {
            const res = await fetch(`${API_BASE_URL}/ai/trends`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platform: trendsPlatform, category: trendsCategory, refresh: forceRefresh }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 429) {
                    toast.error("Límite de cuota de Gemini alcanzado — espera unos minutos y vuelve a intentarlo", { duration: 8000 });
                } else {
                    toast.error(data.error ?? "Error obteniendo tendencias");
                }
                return;
            }
            setTrendsData(data);
            if (data._stale) toast.info("Mostrando datos en caché (límite de cuota alcanzado)", { duration: 5000 });
            else if (data._cached) toast.success("Tendencias cargadas desde caché");
        } catch { toast.error("Error conectando con la API"); }
        finally { setIsLoadingTrends(false); }
    };

    const CONTENT_PRODUCT_TYPES = ["Coloring Book", "Activity Book", "Journal", "Planner", "Wall Art", "Sticker Sheet", "Template Pack", "Workbook", "Puzzle Book", "Notebook", "Low Content Book", "Printable Set"];
    const CONTENT_TYPES_SECONDARY = [
        { id: "full-listing", label: "Listing Completo", icon: <ListOrdered size={12} /> },
        { id: "titles", label: "Títulos", icon: <Type size={12} /> },
        { id: "description", label: "Descripción", icon: <FileText size={12} /> },
        { id: "keywords", label: "Keywords", icon: <Tag size={12} /> },
        { id: "back-cover", label: "Contraportada", icon: <BookText size={12} /> },
        { id: "series", label: "Serie", icon: <Layers size={12} /> },
    ] as const;
    const TREND_CATEGORIES = ["all", "Coloring Books", "Journals", "Planners", "Wall Art", "Stickers", "Activity Books", "Templates", "Notebooks", "Puzzle Books"];
    const COMPETITION_COLORS: Record<string, string> = { low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", medium: "text-amber-400 bg-amber-500/10 border-amber-500/20", high: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
    const DEMAND_ICONS: Record<string, React.ReactElement> = { rising: <ArrowUpRight size={12} className="text-emerald-400" />, stable: <ArrowRight size={12} className="text-amber-400" />, declining: <ArrowDownRight size={12} className="text-rose-400" /> };

    const renderGelato = () => {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight">
                            <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Factory</span>
                        </h2>
                        <p className="text-sm text-neutral-500 mt-1">Herramientas de producción · libros, zips, contenido y print-on-demand</p>
                    </div>
                    <a
                        href="https://dashboard.gelato.com/store-products/product-list"
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-500/30 text-orange-300 font-bold text-sm transition-all shadow-lg shadow-orange-500/10"
                    >
                        <ExternalLink size={15} /> Gelato Dashboard
                    </a>
                </div>

                {/* ── Gelato real data ── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Tu tienda Gelato</p>
                        <button
                            onClick={() => {
                                setGelatoStoreProducts([]);
                                setLoadingGelatoData(true);
                                Promise.all([
                                    fetch(`${API_BASE_URL}/gelato/store/products?limit=50`).then(r => r.ok ? r.json() : { products: [] }).catch(() => ({ products: [] })),
                                    fetch(`${API_BASE_URL}/gelato/orders?limit=10`).then(r => r.ok ? r.json() : { orders: [] }).catch(() => ({ orders: [] })),
                                ]).then(([prod, ord]) => {
                                    setGelatoStoreProducts(prod.products ?? []);
                                    setGelatoOrders(ord.orders ?? []);
                                }).finally(() => setLoadingGelatoData(false));
                            }}
                            disabled={loadingGelatoData}
                            className="flex items-center gap-1.5 text-[10px] text-neutral-500 hover:text-white transition-colors"
                        >
                            {loadingGelatoData ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Actualizar
                        </button>
                    </div>

                    {loadingGelatoData && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl bg-white/[0.03] animate-pulse border border-white/5" />)}
                        </div>
                    )}

                    {!loadingGelatoData && (
                        <>
                            {/* Stats row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <KdpStatCard label="Productos totales" value={gelatoStoreProducts.length} icon={<Package size={16} />} color="orange" />
                                <KdpStatCard label="Publicados" value={gelatoStoreProducts.filter((p: any) => p.status === "active" || p.status === "published").length} icon={<Store size={16} />} color="emerald" />
                                <KdpStatCard label="Borradores" value={gelatoStoreProducts.filter((p: any) => p.status === "draft").length} icon={<FileText size={16} />} color="sky" />
                                <KdpStatCard label="Pedidos (últimos 10)" value={gelatoOrders.length} icon={<ShoppingBag size={16} />} color="purple" />
                            </div>

                            {/* Products list */}
                            {gelatoStoreProducts.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {gelatoStoreProducts.slice(0, 6).map((p: any) => (
                                        <div key={p.id ?? p.productUid} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3 hover:border-white/15 transition-all">
                                            {p.previewUrl || p.thumbnail
                                                ? <img src={p.previewUrl ?? p.thumbnail} alt={p.title} className="w-10 h-10 rounded-lg object-cover shrink-0 bg-white/5" />
                                                : <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0"><Package size={16} className="text-neutral-700" /></div>
                                            }
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-white truncate">{p.title ?? p.externalId ?? "Sin título"}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${(p.status === "active" || p.status === "published") ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" : "text-neutral-400 bg-white/5 border-white/10"}`}>{p.status}</span>
                                                    {p.retailPrice && <span className="text-[9px] text-neutral-500">{p.currency ?? "EUR"} {p.retailPrice}</span>}
                                                </div>
                                            </div>
                                            <a href="https://dashboard.gelato.com/store-products/product-list" target="_blank" rel="noreferrer" className="shrink-0 p-1 rounded-lg text-neutral-600 hover:text-white hover:bg-white/8 transition-all">
                                                <ExternalLink size={11} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Recent orders */}
                            {gelatoOrders.length > 0 && (
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-700 mb-2">Pedidos recientes</p>
                                    <div className="space-y-1.5">
                                        {gelatoOrders.slice(0, 5).map((o: any) => {
                                            const statusColor = o.fulfillmentStatus === "fulfilled" ? "text-emerald-400" : o.fulfillmentStatus === "canceled" ? "text-red-400" : "text-amber-400";
                                            return (
                                                <div key={o.id ?? o.orderId} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.01] px-3 py-2 hover:border-white/10 transition-all">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold text-white truncate">{o.orderReferenceId ?? o.id ?? "—"}</p>
                                                        <p className="text-[9px] text-neutral-600">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("es-ES") : ""}</p>
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase ${statusColor}`}>{o.fulfillmentStatus ?? o.status ?? "—"}</span>
                                                    {o.totalAmount && <span className="text-[9px] text-neutral-500 tabular-nums">{o.currency} {o.totalAmount}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {gelatoStoreProducts.length === 0 && gelatoOrders.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-white/8 bg-white/[0.01] p-8 text-center text-neutral-600">
                                    <Store size={24} className="mx-auto mb-2 opacity-40" />
                                    <p className="text-[11px]">Sin datos — comprueba que GELATO_API_KEY y GELATO_STORE_ID están configurados en Ajustes</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── Factories ── */}
                <div className="space-y-4 pt-4 border-t border-white/8">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Herramientas de Producción</p>

                    {/* Book Factory */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Card variant="outline" className="relative overflow-hidden border-white/8 bg-gradient-to-br from-white/[0.02] to-transparent">
                            <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/8 blur-[60px] pointer-events-none" />
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10 shrink-0">
                                        <BookOpen size={19} className="text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-black text-white tracking-tight italic leading-tight">Book Factory</h4>
                                        <p className="text-[10px] text-neutral-500 font-medium">
                                            {bookDrafts.length === 0 ? "Sin borradores" : `${bookDrafts.length} borrador${bookDrafts.length !== 1 ? "es" : ""}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => openKdpTemplateSelector()}
                                            className="h-8 px-3 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95"
                                        >
                                            <BookOpen size={11} /> Plantilla
                                        </button>
                                        <button
                                            onClick={newBookDraft}
                                            className="h-8 px-3 rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(245,158,11,0.25)] active:scale-95"
                                        >
                                            <Plus size={11} /> Nuevo
                                        </button>
                                    </div>
                                </div>
                                {bookDrafts.length === 0 ? (
                                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/6">
                                        <div className="flex gap-1.5">
                                            {[0, 1, 2, 3].map(i => (
                                                <div key={i} className="w-8 h-11 rounded-md bg-white/5 border border-dashed border-white/10" style={{ opacity: 1 - i * 0.2 }} />
                                            ))}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Sin borradores</p>
                                            <p className="text-[9px] text-neutral-700">Pulsa "Nuevo" para crear tu primer libro</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {bookDrafts.map(draft => (
                                            <div key={draft.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${activeDraftId === draft.id ? "border-amber-500/30 bg-amber-500/5" : "border-white/8 bg-white/[0.02] hover:border-white/14"}`}>
                                                <div className="flex gap-1 shrink-0">
                                                    {draft.pages.slice(0, 4).map((page, idx) => (
                                                        <div key={page.id} className="w-7 h-9 rounded-md overflow-hidden bg-white/5 border border-white/10 relative">
                                                            {page.image
                                                                ? <img src={page.image.url} alt="" className="w-full h-full object-cover" />
                                                                : <div className="w-full h-full flex items-center justify-center"><Type size={8} className="text-neutral-700" /></div>}
                                                            <span className="absolute bottom-0 right-0.5 text-[4px] font-mono text-white/40">{idx + 1}</span>
                                                        </div>
                                                    ))}
                                                    {draft.pages.length > 4 && (
                                                        <div className="w-7 h-9 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[7px] font-black text-neutral-600">+{draft.pages.length - 4}</div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-black text-white truncate">{draft.fileName || "libro-kdp"}</p>
                                                    <p className="text-[9px] text-neutral-600">{draft.pages.length} pág · {new Date(draft.savedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button onClick={() => loadBookDraft(draft)}
                                                        className="h-7 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black transition-all text-[9px] font-black uppercase tracking-widest">
                                                        {activeDraftId === draft.id ? "Editando" : "Abrir"}
                                                    </button>
                                                    <button onClick={() => setConfirmDeleteDraftId(draft.id)}
                                                        className="h-7 w-7 rounded-lg text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all flex items-center justify-center">
                                                        <Trash2 size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Consejos KDP */}
                                <div className="border border-white/[0.06] rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setShowKdpTips(v => !v)}
                                        className="w-full flex items-center gap-2.5 px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left"
                                    >
                                        <Lightbulb size={12} className="text-amber-400 shrink-0" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex-1">Consejos Amazon KDP</span>
                                        <ChevronDown size={12} className={`text-neutral-600 transition-transform duration-300 ${showKdpTips ? "rotate-180" : ""}`} />
                                    </button>
                                    {showKdpTips && (
                                        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-white/[0.05]">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                {[
                                                    { label: "Tamaño", value: "8,5 × 11 pulgadas", icon: <FileText size={11} />, color: "text-blue-400 bg-blue-500/10" },
                                                    { label: "Máx. ilustraciones", value: "~50 por libro", icon: <ImageIcon size={11} />, color: "text-violet-400 bg-violet-500/10" },
                                                    { label: "Interior", value: "Color estándar · Papel blanco", icon: <Layers size={11} />, color: "text-emerald-400 bg-emerald-500/10" },
                                                ].map(({ label, value, icon, color }) => (
                                                    <div key={label} className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                                        <div className={`mt-0.5 p-1 rounded-md ${color} shrink-0`}>{icon}</div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 mb-0.5">{label}</p>
                                                            <p className="text-[11px] font-bold text-white leading-tight">{value}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 mb-1.5 flex items-center gap-1.5"><Tag size={9} />Categorías activas</p>
                                                <div className="space-y-1">
                                                    {[
                                                        "Libros para Colorear para Adultos › Fantasía y Ciencia Ficción",
                                                        "Libros para Colorear para Adultos › Ciudades y Arquitectura",
                                                        "Libros para Colorear para Adultos › General",
                                                    ].map(cat => (
                                                        <div key={cat} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.025] border border-white/[0.05]">
                                                            <div className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                                                            <span className="text-[10px] text-neutral-400 leading-snug">Libros › … › Manualidades › <span className="text-white font-semibold">{cat}</span></span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Zip Factory */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Card variant="outline" className="relative overflow-hidden border-white/8 bg-gradient-to-br from-white/[0.02] to-transparent">
                            <div className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-500/8 blur-[60px] pointer-events-none" />
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10 shrink-0">
                                        <Archive size={19} className="text-emerald-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-black text-white tracking-tight italic leading-tight">Zip Factory</h4>
                                        <p className="text-[10px] text-neutral-500 font-medium">Selecciona imágenes y descárgalas comprimidas</p>
                                    </div>
                                    <Button
                                        onClick={() => setZipFactoryOpen(true)}
                                        className="h-9 px-4 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(16,185,129,0.3)] active:scale-95 shrink-0"
                                    >
                                        <FolderArchive size={13} />
                                        Abrir
                                    </Button>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-neutral-600">
                                    <span className="flex items-center gap-1"><Box size={10} className="text-emerald-600" />{vaultImages.length} vault</span>
                                    <span className="flex items-center gap-1"><Layers size={10} className="text-emerald-600" />{iaCatalogs.reduce((s, c) => s + c.images.length, 0)} catálogos</span>
                                    <span className="flex items-center gap-1"><Cloud size={10} className="text-emerald-600" />{cloudinaryImages.length} cloud</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Generador de Contenido */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Card variant="outline" className="relative overflow-hidden border-white/8 bg-gradient-to-br from-white/[0.02] to-transparent">
                            <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/8 blur-[60px] pointer-events-none" />
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10 shrink-0">
                                        <Sparkles size={19} className="text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-black text-white tracking-tight italic leading-tight">Generador de Contenido</h4>
                                        <p className="text-[10px] text-neutral-500 font-medium">Títulos · Descripción · Keywords · Listing completo</p>
                                    </div>
                                    <Button
                                        onClick={() => setContentGeneratorOpen(true)}
                                        className="h-9 px-4 rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(245,158,11,0.3)] active:scale-95 shrink-0"
                                    >
                                        <Sparkles size={13} />
                                        Abrir
                                    </Button>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-neutral-600">
                                    <span className="flex items-center gap-1"><BookOpen size={10} className="text-amber-600" />KDP físico</span>
                                    <span className="flex items-center gap-1"><Type size={10} className="text-amber-600" />Títulos &amp; Keywords</span>
                                    <span className="flex items-center gap-1"><AlignLeft size={10} className="text-amber-600" />Listings Etsy</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Cover Factory */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Card variant="outline" className="relative overflow-hidden border-white/8 bg-gradient-to-br from-white/[0.02] to-transparent">
                            <div className="absolute -top-16 -right-16 w-48 h-48 bg-fuchsia-500/8 blur-[60px] pointer-events-none" />
                            <div className="p-5 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-600/10 border border-fuchsia-500/20 flex items-center justify-center shadow-lg shadow-fuchsia-500/10 shrink-0">
                                        <ImageIcon size={19} className="text-fuchsia-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-black text-white tracking-tight italic leading-tight">Cover Factory</h4>
                                        <p className="text-[10px] text-neutral-500 font-medium">Portada tall-format · 1600×2560px · Lista para KDP</p>
                                    </div>
                                    <button
                                        onClick={() => setShowCoverModal(true)}
                                        className="h-8 px-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(192,38,211,0.25)] active:scale-95 shrink-0"
                                    >
                                        <ImageIcon size={11} /> Abrir
                                    </button>
                                </div>
                                {generatedCoverUrl && (
                                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-fuchsia-500/[0.04] border border-fuchsia-500/15">
                                        <img src={generatedCoverUrl} alt="" className="w-8 h-12 rounded-lg object-cover border border-fuchsia-500/20 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-white truncate">{coverTitle || "Portada generada"}</p>
                                            <p className="text-[9px] text-neutral-600">1600×2560px · Lista para descargar</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <a href={generatedCoverUrl} download={`portada-${(coverTitle || "cover").toLowerCase().replace(/\s+/g, "-")}.jpg`}
                                                className="flex items-center gap-1 h-7 px-2.5 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 text-[9px] font-black uppercase text-fuchsia-300 hover:bg-fuchsia-500/25 transition-all">
                                                <Download size={9} /> DL
                                            </a>
                                            <button onClick={() => setGeneratedCoverUrl(null)}
                                                className="w-7 h-7 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all flex items-center justify-center">
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        );
    };

    const renderStudio = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">

            {/* ══ MIS NICHOS ══ */}
            <div className="rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
                <div className="h-px w-full bg-gradient-to-r from-sky-500/80 via-cyan-400/40 to-transparent" />
                <div className="p-6 space-y-6">
                    {/* ── Header ── */}
                    <div className="flex items-start justify-between gap-4">
                        <SectionHeader
                            icon={<Target size={20} />}
                            title={<><span className="text-white">Mis </span><span className="bg-gradient-to-r from-sky-300 to-cyan-400 bg-clip-text text-transparent">Nichos</span></>}
                            subtitle="Gestión de nichos KDP · Catálogos vinculados · Métricas de mercado"
                            color="sky"
                            size="lg"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => void fetchNiches()} disabled={isLoadingNiches}
                                className="p-2.5 rounded-xl bg-white/5 border border-white/8 text-neutral-500 hover:text-sky-400 hover:border-sky-500/30 transition-all disabled:opacity-40">
                                {isLoadingNiches ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                            </button>
                            {/* View toggle */}
                            <div className="flex p-1 bg-white/[0.04] border border-white/8 rounded-xl gap-0.5">
                                <button onClick={() => setNicheViewMode("list")} title="Vista lista"
                                    className={`w-8 h-7 rounded-lg flex items-center justify-center transition-all ${nicheViewMode === "list" ? "bg-white/15 text-white" : "text-neutral-600 hover:text-neutral-400"}`}>
                                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="0" y="1" width="13" height="2" rx="1" fill="currentColor"/><rect x="0" y="5.5" width="13" height="2" rx="1" fill="currentColor"/><rect x="0" y="10" width="13" height="2" rx="1" fill="currentColor"/></svg>
                                </button>
                                <button onClick={() => setNicheViewMode("kanban")} title="Vista kanban"
                                    className={`w-8 h-7 rounded-lg flex items-center justify-center transition-all ${nicheViewMode === "kanban" ? "bg-white/15 text-white" : "text-neutral-600 hover:text-neutral-400"}`}>
                                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="0" y="0" width="3.5" height="13" rx="1" fill="currentColor"/><rect x="4.75" y="0" width="3.5" height="13" rx="1" fill="currentColor"/><rect x="9.5" y="0" width="3.5" height="13" rx="1" fill="currentColor"/></svg>
                                </button>
                            </div>
                            <button onClick={() => openNicheForm()}
                                className="flex items-center gap-2 h-10 px-5 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-600 hover:from-sky-500 hover:to-sky-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_4px_20px_rgba(14,165,233,0.4)]">
                                <Plus size={14} /> Nuevo nicho
                            </button>
                        </div>
                    </div>

                    {/* ── Stats row ── */}
                    {niches.length > 0 && (() => {
                        const activeCount = niches.filter(n => n.status === "active").length;
                        const totalLinkedCats = iaCatalogs.filter(c => (c.nicheIds?.length ?? 0) > 0).length;
                        const totalLinkedImgs = iaCatalogs.filter(c => (c.nicheIds?.length ?? 0) > 0).reduce((s, c) => s + c.images.length, 0);
                        return (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <KdpStatCard label="Nichos" value={niches.length} icon={<Target size={16} />} color="sky" />
                                <KdpStatCard label="Activos" value={activeCount} icon={<Activity size={16} />} color="emerald" />
                                <KdpStatCard label="Catálogos" value={totalLinkedCats} icon={<Layers size={16} />} color="blue" />
                                <KdpStatCard label="Imágenes" value={totalLinkedImgs} icon={<ImageIcon size={16} />} color="cyan" />
                            </div>
                        );
                    })()}

                    {/* ── Per-niche vertical bar charts ── */}
                    {niches.length > 0 && (() => {
                        const nicheChartData = niches
                            .map(n => {
                                const cats = iaCatalogs.filter(c => (c.nicheIds ?? []).includes(n._id));
                                return { label: n.name.split(" ").slice(0, 2).join(" "), images: cats.reduce((s, c) => s + c.images.length, 0), catalogs: cats.length };
                            });
                        return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <KdpVerticalBarChart
                                    title="Imágenes por nicho"
                                    subtitle="Producción total de imágenes por nicho"
                                    icon={<ImageIcon size={13} />}
                                    items={[...nicheChartData].sort((a, b) => b.images - a.images).map(d => ({ label: d.label, value: d.images }))}
                                    color="sky"
                                    height={160}
                                    emptyMessage="Genera catálogos para ver estadísticas"
                                />
                                <KdpVerticalBarChart
                                    title="Catálogos por nicho"
                                    subtitle="Número de catálogos vinculados por nicho"
                                    icon={<Layers size={13} />}
                                    items={[...nicheChartData].sort((a, b) => b.catalogs - a.catalogs).map(d => ({ label: d.label, value: d.catalogs }))}
                                    color="blue"
                                    height={160}
                                    emptyMessage="Genera catálogos para ver estadísticas"
                                />
                            </div>
                        );
                    })()}

                    {/* ── Segmented filter ── */}
                    <div className="flex p-1.5 bg-white/[0.03] border border-white/8 rounded-2xl gap-0.5">
                        {(["all", "found", "research", "active", "archived"] as const).map(s => {
                            const cnt = s === "all" ? niches.length : niches.filter(n => n.status === s).length;
                            const isAct = nicheStatusFilter === s;
                            const dot: Record<string, string> = { found: "bg-sky-400", research: "bg-blue-400", active: "bg-emerald-400", archived: "bg-neutral-600" };
                            return (
                                <button key={s} onClick={() => setNicheStatusFilter(s)}
                                    className={`flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${isAct ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" : "text-neutral-600 hover:text-neutral-400"}`}>
                                    {s !== "all" && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[s]}`} />}
                                    <span className="truncate">{s === "all" ? "Todos" : STATUS_LABELS[s].label}</span>
                                    {cnt > 0 && <span className={`text-[8px] tabular-nums ${isAct ? "text-white/50" : "text-neutral-700"}`}>{cnt}</span>}
                                </button>
                            );
                        })}
                        <button onClick={() => setNicheSortBy(p => p === "score" ? "date" : "score")}
                            className="ml-1 h-8 px-3 rounded-xl bg-white/5 border border-white/8 text-[9px] font-black uppercase text-neutral-500 hover:text-white transition-all shrink-0">
                            {nicheSortBy === "score" ? "★" : "↓"}
                        </button>
                    </div>

                    {/* ── Loading skeletons ── */}
                    {isLoadingNiches && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-56 rounded-2xl bg-white/[0.03] animate-pulse border border-white/5" />)}
                        </div>
                    )}

                    {/* ── Kanban view ── */}
                    {!isLoadingNiches && nicheViewMode === "kanban" && niches.length > 0 && (() => {
                        const PHASES: { id: NicheFE["phase"]; label: string; color: string; dot: string }[] = [
                            { id: "niche",     label: "Nicho",     color: "border-sky-500/30 bg-sky-500/[0.05]",     dot: "bg-sky-400" },
                            { id: "catalog",   label: "Catálogo",  color: "border-blue-500/30 bg-blue-500/[0.05]",   dot: "bg-blue-400" },
                            { id: "pdf",       label: "PDF",       color: "border-violet-500/30 bg-violet-500/[0.05]", dot: "bg-violet-400" },
                            { id: "published", label: "Publicado", color: "border-emerald-500/30 bg-emerald-500/[0.05]", dot: "bg-emerald-400" },
                        ];
                        const phaseOrder = ["niche", "catalog", "pdf", "published"] as const;
                        const movePhase = async (nicheId: string, direction: 1 | -1) => {
                            const niche = niches.find(n => n._id === nicheId);
                            if (!niche) return;
                            const cur = phaseOrder.indexOf(niche.phase ?? "niche");
                            const next = phaseOrder[Math.max(0, Math.min(phaseOrder.length - 1, cur + direction))];
                            if (next === niche.phase) return;
                            await fetch(`${API_BASE_URL}/niches/${nicheId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phase: next }) }).catch(() => {});
                            setNiches(ns => ns.map(n => n._id === nicheId ? { ...n, phase: next } : n));
                        };
                        return (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {PHASES.map(col => {
                                    const colNiches = niches.filter(n => (n.phase ?? "niche") === col.id);
                                    return (
                                        <div key={col.id} className={`rounded-2xl border ${col.color} p-3 space-y-2 min-h-[120px]`}>
                                            <div className="flex items-center gap-2 pb-1 border-b border-white/5">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{col.label}</span>
                                                <span className="ml-auto text-[9px] font-mono text-neutral-600">{colNiches.length}</span>
                                            </div>
                                            {colNiches.length === 0 && (
                                                <div className="flex items-center justify-center h-16 opacity-30">
                                                    <span className="text-[9px] text-neutral-600">Sin nichos</span>
                                                </div>
                                            )}
                                            {colNiches.map(niche => (
                                                <div key={niche._id} className="group rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] p-3 space-y-2 transition-all cursor-pointer" onClick={() => openNicheForm(niche)}>
                                                    <p className="text-[11px] font-black text-white leading-tight line-clamp-2">{niche.name}</p>
                                                    {niche.tags.length > 0 && <p className="text-[9px] text-neutral-600 truncate">{niche.tags.slice(0, 3).join(" · ")}</p>}
                                                    {niche.etsyUrl && (
                                                        <a href={niche.etsyUrl} target="_blank" rel="noopener noreferrer"
                                                            onClick={e => e.stopPropagation()}
                                                            className="inline-flex items-center gap-1 text-[8px] font-black text-sky-400 hover:text-sky-300 transition-colors">
                                                            <ExternalLink size={8} /> Ver fuente
                                                        </a>
                                                    )}
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${niche.status === "active" ? "bg-emerald-500/15 text-emerald-400" : niche.status === "archived" ? "bg-neutral-500/15 text-neutral-500" : "bg-sky-500/15 text-sky-400"}`}>{niche.status}</span>
                                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={e => { e.stopPropagation(); void movePhase(niche._id, -1); }} className="w-5 h-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-400 hover:text-white transition-all" title="Retroceder">‹</button>
                                                            <button onClick={e => { e.stopPropagation(); void movePhase(niche._id, 1); }} className="w-5 h-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-400 hover:text-white transition-all" title="Avanzar">›</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* ── Empty state (list mode only) ── */}
                    {!isLoadingNiches && nicheViewMode === "list" && (nicheStatusFilter === "all" ? niches : niches.filter(n => n.status === nicheStatusFilter)).length === 0 && (
                        <div className="flex flex-col items-center gap-4 py-16 opacity-40">
                            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/8 flex items-center justify-center">
                                <Target size={28} strokeWidth={1.2} className="text-neutral-600" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                                {niches.length === 0 ? "Sin nichos aún — crea el primero" : "Sin resultados para este filtro"}
                            </p>
                        </div>
                    )}

                    {/* ── Niche cards grid (list mode) ── */}
                    {!isLoadingNiches && nicheViewMode === "list" && (nicheStatusFilter === "all" ? niches : niches.filter(n => n.status === nicheStatusFilter)).length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {(nicheStatusFilter === "all" ? niches : niches.filter(n => n.status === nicheStatusFilter))
                                .slice()
                                .sort((a, b) => nicheSortBy === "score" ? nicheScore(b) - nicheScore(a) : 0)
                                .map(niche => {
                                    const score = nicheScore(niche);
                                    const scoreColor = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-sky-400";
                                    const linkedCats = iaCatalogs.filter(c => (c.nicheIds ?? []).includes(niche._id));
                                    const linkedImgs = linkedCats.reduce((s, c) => s + c.images.length, 0);
                                    const statusDotMap: Record<NicheStatus, string> = { found: "bg-sky-400", research: "bg-blue-400", active: "bg-emerald-400", archived: "bg-neutral-600" };
                                    const statusGradient: Record<NicheStatus, string> = { found: "from-sky-500 via-sky-400 to-cyan-400", research: "from-blue-500 via-blue-400 to-sky-400", active: "from-emerald-500 via-emerald-400 to-cyan-400", archived: "from-neutral-600 via-neutral-500 to-neutral-700" };
                                    const statusHoverBorder: Record<NicheStatus, string> = { found: "hover:border-sky-500/25", research: "hover:border-blue-500/25", active: "hover:border-emerald-500/25", archived: "hover:border-neutral-500/20" };
                                    return (
                                        <div key={niche._id} className={`group relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] ${statusHoverBorder[niche.status]} hover:from-white/[0.06] hover:to-white/[0.02] transition-all overflow-hidden`}>
                                            <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${statusGradient[niche.status]} opacity-40 group-hover:opacity-100 transition-all duration-300`} />
                                            <div className="p-5 pl-6 space-y-4 relative">

                                                {/* ─ Card header ─ */}
                                                <div className="flex items-start gap-3">
                                                    {/* Score ring with gradient */}
                                                    <div className="shrink-0 relative w-14 h-14">
                                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                                                            <defs>
                                                                <linearGradient id={`ring-grad-${niche._id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                                                    {score >= 70
                                                                        ? <><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#22d3ee" /></>
                                                                        : score >= 40
                                                                            ? <><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#fb923c" /></>
                                                                            : <><stop offset="0%" stopColor="#0284c7" /><stop offset="50%" stopColor="#0ea5e9" /><stop offset="100%" stopColor="#38bdf8" /></>}
                                                                </linearGradient>
                                                            </defs>
                                                            <circle cx="22" cy="22" r="17" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4.5" />
                                                            <circle cx="22" cy="22" r="17" fill="none"
                                                                stroke={`url(#ring-grad-${niche._id})`} strokeWidth="4.5" strokeLinecap="round"
                                                                strokeDasharray={`${Math.min((score / 90) * 107, 107)} 107`} />
                                                        </svg>
                                                        <span className={`absolute inset-0 flex items-center justify-center text-[12px] font-black ${scoreColor}`}>{score}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xl font-black text-white leading-tight tracking-tight">{niche.name}</p>
                                                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                            <span className="text-[9px] font-black uppercase tracking-wide text-sky-400/80 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">
                                                                {NICHE_PRODUCT_OPTIONS.find(p => p.id === (niche.productType ?? "coloring-book"))?.label ?? niche.productType}
                                                            </span>
                                                            <span className="text-[9px] font-black uppercase tracking-wide text-neutral-400 bg-white/[0.04] border border-white/8 px-2 py-0.5 rounded-full">
                                                                {NICHE_STYLE_OPTIONS.find(s => s.id === (niche.styleCategory ?? "generic"))?.label ?? niche.styleCategory}
                                                            </span>
                                                        </div>
                                                        {niche.description && <p className="text-xs text-neutral-500 mt-2 line-clamp-2 leading-relaxed">{niche.description}</p>}
                                                        {niche.etsyUrl && (
                                                            <a href={niche.etsyUrl} target="_blank" rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-black text-sky-400 hover:text-sky-300 transition-colors">
                                                                <ExternalLink size={9} /> Ver en Etsy
                                                            </a>
                                                        )}
                                                    </div>
                                                    {/* Actions — visible on hover */}
                                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {niche.generatedPrompt && (
                                                            <button onClick={() => saveNichePromptToLibrary(niche)} title="Guardar prompt en biblioteca"
                                                                className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-white/8 transition-all">
                                                                <BookMarked size={12} />
                                                            </button>
                                                        )}
                                                        <button onClick={() => openNicheForm(niche)} className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-white/8 transition-all"><Pencil size={12} /></button>
                                                        <button onClick={() => setNicheDeleteId(niche._id)} className="p-1.5 rounded-lg text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"><Trash2 size={12} /></button>
                                                    </div>
                                                </div>

                                                {/* ─ Mini stats ─ */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    {[
                                                        { label: "Catálogos", value: linkedCats.length, color: linkedCats.length > 0 ? "text-sky-400" : "text-neutral-700" },
                                                        { label: "Imágenes", value: linkedImgs, color: linkedImgs > 0 ? "text-blue-400" : "text-neutral-700" },
                                                    ].map(st => (
                                                        <div key={st.label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
                                                            <p className="text-[9px] uppercase tracking-wider text-neutral-600 font-black">{st.label}</p>
                                                            <p className={`text-xl font-black mt-0.5 tabular-nums ${st.color}`}>{st.value}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* ─ Competition & demand bars ─ */}
                                                {(niche.competition !== "unknown" || niche.demand !== "unknown") && (
                                                    <div className="space-y-2">
                                                        {niche.competition !== "unknown" && (
                                                            <div className="flex items-center gap-2.5">
                                                                <span className="text-[9px] text-neutral-600 uppercase font-black w-14 shrink-0">Comp.</span>
                                                                <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                                                                    <div className={`h-full rounded-full transition-all ${niche.competition === "low" ? "w-1/3 bg-emerald-500" : niche.competition === "medium" ? "w-2/3 bg-amber-500" : "w-full bg-rose-500"}`} />
                                                                </div>
                                                                <span className={`text-[9px] font-black w-12 text-right ${COMPETITION_LABELS[niche.competition].color.split(" ")[0]}`}>{COMPETITION_LABELS[niche.competition].label}</span>
                                                            </div>
                                                        )}
                                                        {niche.demand !== "unknown" && (
                                                            <div className="flex items-center gap-2.5">
                                                                <span className="text-[9px] text-neutral-600 uppercase font-black w-14 shrink-0">Dem.</span>
                                                                <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                                                                    <div className={`h-full rounded-full transition-all ${niche.demand === "high" ? "w-full bg-emerald-500" : niche.demand === "medium" ? "w-2/3 bg-amber-500" : "w-1/3 bg-rose-500"}`} />
                                                                </div>
                                                                <span className={`text-[9px] font-black w-12 text-right ${DEMAND_LABELS[niche.demand].color.split(" ")[0]}`}>{DEMAND_LABELS[niche.demand].label}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ─ Status chips ─ */}
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {(["found", "research", "active", "archived"] as NicheStatus[]).map(s => {
                                                        const isActive = niche.status === s;
                                                        return (
                                                            <button key={s}
                                                                onClick={() => {
                                                                    if (isActive) return;
                                                                    fetch(`${API_BASE_URL}/niches/${niche._id}`, {
                                                                        method: "PATCH",
                                                                        headers: { "Content-Type": "application/json" },
                                                                        body: JSON.stringify({ status: s }),
                                                                    }).catch(() => { });
                                                                    setNiches(prev => prev.map(n => n._id === niche._id ? { ...n, status: s } : n));
                                                                }}
                                                                className={`flex items-center gap-1 px-2.5 h-6 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${isActive ? STATUS_LABELS[s].color : "border-white/8 bg-transparent text-neutral-700 hover:text-neutral-400 hover:border-white/20"}`}>
                                                                {isActive && <span className={`w-1 h-1 rounded-full ${statusDotMap[s]}`} />}
                                                                {STATUS_LABELS[s].label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* ─ Tags ─ */}
                                                {niche.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {niche.tags.slice(0, 6).map(tag => (
                                                            <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500">#{tag}</span>
                                                        ))}
                                                        {niche.tags.length > 6 && <span className="text-[9px] text-neutral-700">+{niche.tags.length - 6} más</span>}
                                                    </div>
                                                )}


                                                {/* ─ Publication panel ─ */}
                                                {nichePublishPanelId === niche._id && (
                                                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Datos de publicación</span>
                                                            <button onClick={() => setNichePublishPanelId(null)} className="text-neutral-600 hover:text-white transition-colors"><X size={11} /></button>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="text-[8px] font-black uppercase tracking-widest text-neutral-600 block mb-1">ASIN (KDP)</label>
                                                                <input value={publishPanelAsin} onChange={e => setPublishPanelAsin(e.target.value)}
                                                                    placeholder="B0XXXXXXXXX"
                                                                    className="w-full h-8 bg-white/5 border border-white/10 rounded-lg px-2.5 text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-orange-500/30 font-mono" />
                                                            </div>
                                                            <div>
                                                                <label className="text-[8px] font-black uppercase tracking-widest text-neutral-600 block mb-1">Fecha publicación</label>
                                                                <input type="date" value={publishPanelDate} onChange={e => setPublishPanelDate(e.target.value)}
                                                                    className="w-full h-8 bg-white/5 border border-white/10 rounded-lg px-2.5 text-[10px] text-white focus:outline-none focus:border-emerald-500/30" />
                                                            </div>
                                                            <div>
                                                                <label className="text-[8px] font-black uppercase tracking-widest text-neutral-600 block mb-1">URL Etsy</label>
                                                                <input value={publishPanelEtsy} onChange={e => setPublishPanelEtsy(e.target.value)}
                                                                    placeholder="https://etsy.com/listing/..."
                                                                    className="w-full h-8 bg-white/5 border border-white/10 rounded-lg px-2.5 text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/30" />
                                                            </div>
                                                            <div>
                                                                <label className="text-[8px] font-black uppercase tracking-widest text-neutral-600 block mb-1">URL Gumroad</label>
                                                                <input value={publishPanelGumroad} onChange={e => setPublishPanelGumroad(e.target.value)}
                                                                    placeholder="https://gumroad.com/..."
                                                                    className="w-full h-8 bg-white/5 border border-white/10 rounded-lg px-2.5 text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-pink-500/30" />
                                                            </div>
                                                        </div>
                                                        <button onClick={() => void savePublishPanel(niche._id)} disabled={isSavingPublish}
                                                            className="w-full h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                                                            {isSavingPublish ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                                                            Guardar y marcar publicado
                                                        </button>
                                                    </div>
                                                )}

                                                {/* ─ Footer: generate action ─ */}
                                                <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
                                                    <div className="text-[9px] text-neutral-700 tabular-nums">
                                                        {new Date(niche.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            title="Pre-llenar formulario de catálogo"
                                                            onClick={() => {
                                                                setPromptTheme(niche.name);
                                                                setPromptSpecs("");
                                                                setPromptDetails("");
                                                                setPromptParticulars("");
                                                                const style = niche.styleCategory ?? "generic";
                                                                const modelId = NICHE_STYLE_MODEL[style as NicheStyle] ?? NICHE_STYLE_MODEL["generic"];
                                                                setSelectedModel(modelId);
                                                                setCatalogFormName(niche.name);
                                                                setCatalogProductType(niche.productType ?? "coloring-book");
                                                                setShowCatalogAccordion(true);
                                                                changeTab("creation");
                                                                toast.success(`Formulario pre-cargado con "${niche.name}"`);
                                                            }}
                                                            className="flex items-center gap-1 px-2.5 h-8 rounded-xl bg-white/[0.04] border border-white/10 text-[9px] font-black text-neutral-500 hover:text-white hover:bg-white/8 transition-all">
                                                            <Layers size={10} /> Form
                                                        </button>
                                                        {linkedImgs > 0 && (
                                                            <button
                                                                onClick={() => void downloadNichePdfDirect(niche, linkedCats)}
                                                                disabled={directNichePdfId === niche._id}
                                                                title={`PDF directo · ${linkedImgs} imágenes sin páginas en blanco`}
                                                                className="flex items-center gap-1 px-2.5 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[9px] font-black text-sky-400 hover:bg-sky-500/20 transition-all disabled:opacity-40">
                                                                {directNichePdfId === niche._id ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                                                                PDF
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => void generateNicheContent(niche)}
                                                            disabled={nicheGeneratingId === niche._id}
                                                            className="flex items-center gap-1.5 px-4 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 text-[10px] font-black text-sky-300 hover:bg-sky-500/25 hover:border-sky-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                                            {nicheGeneratingId === niche._id
                                                                ? <><Loader2 size={11} className="animate-spin" /> Generando...</>
                                                                : <><Sparkles size={11} /> Generar catálogo</>}
                                                        </button>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                </div>
            </div>

            {/* ══ RADAR DE NICHOS ══ */}
            <div className="rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
                <div className="h-px w-full bg-gradient-to-r from-amber-500/60 via-orange-400/20 to-transparent" />
                <div className="p-6">
                    <NicheRadar apiUrl={API_BASE_URL} niches={niches} onNicheCreated={() => void fetchNiches()} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-12 pb-24">
            <AppTabNav
                tabs={[
                    { id: "insights", name: "Insights", icon: <Activity size={15} /> },
                    { id: "creation", name: "Imágenes", icon: <ImageIcon size={15} /> },
                    { id: "studio", name: "Studio IA", icon: <Sparkles size={15} /> },
                    { id: "gelato", name: "Factory", icon: <Store size={15} /> },
                ] satisfies AppTab[]}
                activeTab={activeTab}
                onChange={(id) => changeTab(id as TabID)}
                storageKey="kdp-active-tab"
            />

            {/* Content Area Rendering Based on Active Tab */}
            <div className="relative pt-6">
                {activeTab === "insights" && renderInsights()}
                {activeTab === "creation" && renderCreation()}
                {activeTab === "studio" && renderStudio()}
                {activeTab === "gelato" && renderGelato()}
            </div>

            {/* Image Preview Modal */}
            {previewImage && (() => {
                const favLabel = previewContext?.vaultCtx
                    ? (vaultImages[previewContext.index]?.model ?? "")
                    : previewContext?.cloudinaryCtx
                        ? (cloudinaryImages[previewContext.index]?.publicId?.split("/").pop() ?? "")
                        : previewContext?.catalogCtx
                            ? (previewContext.catalogCtx.images[previewContext.index]?.publicId?.split("/").pop() ?? "")
                            : "";
                const favSource: FavoriteImage["source"] = previewContext?.vaultCtx ? "vault"
                    : previewContext?.cloudinaryCtx ? "cloudinary"
                        : previewContext?.catalogCtx ? "catalog"
                            : "generated";
                const vaultIdx = previewContext?.vaultCtx ? previewContext.index : -1;
                const vaultImg = vaultIdx >= 0 ? vaultImages[vaultIdx] : null;
                const cldImg = previewContext?.cloudinaryCtx ? cloudinaryImages[previewContext.index] : null;
                const catalogImg = previewContext?.catalogCtx?.images[previewContext.index] ?? null;
                return (
                    <div
                        className="fixed inset-0 z-[100] bg-black/96"
                        onClick={closePreview}
                        role="dialog"
                        aria-modal="true"
                    >
                        {/* Image — explicit top/bottom push so full image is always visible */}
                        <div
                            className="absolute inset-x-0 flex items-center justify-center px-8"
                            style={{ top: "88px", bottom: "calc(env(safe-area-inset-bottom) + 220px)" }}
                            onClick={closePreview}
                        >
                            <div
                                className="relative flex items-center justify-center w-full max-w-6xl gap-3"
                                style={{ height: "100%" }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {previewContext && previewContext.index > 0 ? (
                                    <button onClick={() => navigatePreview(-1)}
                                        className="shrink-0 w-11 h-11 rounded-2xl bg-black/60 backdrop-blur-md text-white border border-white/10 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center">
                                        <ChevronLeft size={20} />
                                    </button>
                                ) : previewContext ? <div className="shrink-0 w-11" /> : null}
                                {/* Image + magnifier lens (only active when previewMagnifier=true) */}
                                <div className="flex-1 min-w-0 relative flex items-center justify-center"
                                    onMouseMove={e => {
                                        const img = previewImgRef.current;
                                        const lens = previewLensRef.current;
                                        if (!img || !lens || !previewMagnifier) return;
                                        const rect = img.getBoundingClientRect();
                                        const LENS = 180;
                                        const x = e.clientX - rect.left;
                                        const y = e.clientY - rect.top;
                                        if (x < 0 || y < 0 || x > rect.width || y > rect.height) { lens.style.display = "none"; return; }
                                        lens.style.display = "block";
                                        lens.style.left = `${Math.min(Math.max(x - LENS / 2, 0), rect.width - LENS)}px`;
                                        lens.style.top = `${Math.min(Math.max(y - LENS / 2, 0), rect.height - LENS)}px`;
                                        lens.style.backgroundPosition = `${-(x * previewZoom - LENS / 2)}px ${-(y * previewZoom - LENS / 2)}px`;
                                        lens.style.backgroundSize = `${rect.width * previewZoom}px ${rect.height * previewZoom}px`;
                                        lens.style.backgroundImage = `url(${previewImage})`;
                                    }}
                                    onMouseLeave={() => { if (previewLensRef.current) previewLensRef.current.style.display = "none"; }}
                                >
                                    <img
                                        key={previewImage}
                                        ref={previewImgRef}
                                        src={previewImage}
                                        alt="Vista previa"
                                        className="w-auto h-auto object-contain rounded-2xl"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            maxWidth: "100%",
                                            maxHeight: "calc(100vh - 370px)",
                                            cursor: previewMagnifier ? "crosshair" : "default",
                                        }}
                                    />
                                    {/* Magnifier lens — only shown via JS when magnifier is active */}
                                    <div
                                        ref={previewLensRef}
                                        className="absolute pointer-events-none rounded-2xl border-2 border-white/40 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.9)]"
                                        style={{ width: 180, height: 180, display: "none", backgroundRepeat: "no-repeat" }}
                                    />
                                </div>
                                {previewContext && previewContext.index < previewContext.urls.length - 1 ? (
                                    <button onClick={() => navigatePreview(1)}
                                        className="shrink-0 w-11 h-11 rounded-2xl bg-black/60 backdrop-blur-md text-white border border-white/10 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center">
                                        <ChevronRight size={20} />
                                    </button>
                                ) : previewContext ? <div className="shrink-0 w-11" /> : null}
                            </div>
                        </div>

                        {/* Toolbar — gradient overlay anchored at bottom, safe-area aware */}
                        <div
                            className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col items-center gap-2.5 pt-10"
                            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 56px)" }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3">
                                {previewContext && (
                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                                        {previewContext.index + 1} / {previewContext.urls.length}
                                    </span>
                                )}
                                {/* Magnifier toggle + zoom selector */}
                                <div className="flex items-center gap-0.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-1">
                                    <button onClick={() => { setPreviewMagnifier(false); if (previewLensRef.current) previewLensRef.current.style.display = "none"; }}
                                        className={`h-6 px-2.5 rounded-xl text-[9px] font-black transition-all ${!previewMagnifier ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}>
                                        Off
                                    </button>
                                    {([1.5, 2, 3, 4] as const).map(z => (
                                        <button key={z} onClick={() => { setPreviewZoom(z); setPreviewMagnifier(true); }}
                                            className={`h-6 px-2.5 rounded-xl text-[9px] font-black transition-all ${previewMagnifier && previewZoom === z ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}>
                                            {z}×
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-center px-4">
                                {/* Favorite */}
                                <button
                                    onClick={() => toggleFavorite(previewImage, { label: favLabel, source: favSource })}
                                    className={`p-2.5 rounded-2xl backdrop-blur-md transition-all active:scale-90 border ${favorites.has(previewImage) ? "text-rose-400 border-rose-500/40 bg-rose-500/15" : "text-white border-white/15 bg-black/50"}`}
                                    title={favorites.has(previewImage) ? "Quitar de favoritos" : "Marcar como favorita"}
                                >
                                    <Heart size={18} className={favorites.has(previewImage) ? "fill-rose-400" : ""} />
                                </button>
                                {/* Download */}
                                <button
                                    onClick={() => {
                                        let fname = "imagen-kdp";
                                        if (vaultImg) fname = `vault-${vaultImg.model || "image"}`.replaceAll(" ", "_");
                                        else if (cldImg) fname = cldImg.publicId?.split("/").pop() ?? "cloudinary-image";
                                        else if (catalogImg) fname = catalogImg.publicId?.split("/").pop() ?? "catalog-image";
                                        else {
                                            const modelName = AI_MODELS.find(m => m.id === selectedModel)?.name || "ai-image";
                                            const dimName = AI_DIMENSIONS.find(d => d.id === selectedDim)?.ratio || "1x1";
                                            fname = `${modelName}-${dimName}`.replaceAll(" ", "_");
                                        }
                                        downloadPng(previewImage, fname);
                                    }}
                                    className="p-2.5 rounded-2xl bg-black/50 backdrop-blur-md text-white active:scale-90 transition-all border border-white/15"
                                    title="Descargar"
                                >
                                    <Download size={18} />
                                </button>
                                {/* Vault-specific */}
                                {vaultImg && (
                                    <>
                                        <button
                                            onClick={() => void uploadToCloudinary(vaultIdx)}
                                            disabled={uploadingToCloud === vaultIdx}
                                            className="p-2.5 rounded-2xl bg-cyan-500/15 backdrop-blur-md text-cyan-400 active:scale-90 transition-all border border-cyan-500/25 disabled:opacity-40"
                                            title="Guardar en Cloudinary"
                                        >
                                            {uploadingToCloud === vaultIdx ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteVaultIndex(vaultIdx)}
                                            className="p-2.5 rounded-2xl bg-rose-500/15 backdrop-blur-md text-rose-400 active:scale-90 transition-all border border-rose-500/25"
                                            title="Eliminar del vault"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </>
                                )}
                                {/* Cloudinary-specific */}
                                {cldImg && (
                                    <>
                                        <button
                                            onClick={() => {
                                                const ratio = cldImg.width && cldImg.height ? `${cldImg.width}×${cldImg.height}` : "1:1";
                                                setVaultImages(prev => [{ url: cldImg.url, model: "Cloudinary", dim: ratio }, ...prev]);
                                                toast.success("Añadida al vault");
                                            }}
                                            className="p-2.5 rounded-2xl bg-amber-500/15 backdrop-blur-md text-amber-400 active:scale-90 transition-all border border-amber-500/25"
                                            title="Añadir al Vault"
                                        >
                                            <Plus size={18} />
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteCloudinaryId(cldImg.publicId)}
                                            disabled={deletingFromCloud === cldImg.publicId}
                                            className="p-2.5 rounded-2xl bg-rose-500/15 backdrop-blur-md text-rose-400 active:scale-90 transition-all border border-rose-500/25 disabled:opacity-40"
                                            title="Eliminar de Cloudinary"
                                        >
                                            {deletingFromCloud === cldImg.publicId ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                        </button>
                                    </>
                                )}
                                {/* Catalog-specific */}
                                {catalogImg && (
                                    <>
                                        <button
                                            onClick={() => addCatalogImageToVault(catalogImg)}
                                            className="p-2.5 rounded-2xl bg-emerald-500/15 backdrop-blur-md text-emerald-400 active:scale-90 transition-all border border-emerald-500/25"
                                            title="Añadir al Vault"
                                        >
                                            <ImagePlus size={18} />
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteImageInfo({ catalogId: previewContext!.catalogCtx!.id, publicId: catalogImg.publicId })}
                                            className="p-2.5 rounded-2xl bg-rose-500/15 backdrop-blur-md text-rose-400 active:scale-90 transition-all border border-rose-500/25"
                                            title="Eliminar imagen del catálogo"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </>
                                )}
                                {/* Close */}
                                <button
                                    onClick={closePreview}
                                    className="p-2.5 rounded-2xl bg-black/50 backdrop-blur-md text-neutral-400 hover:text-white hover:bg-rose-500/80 active:scale-90 transition-all border border-white/15"
                                    title="Cerrar"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {showGelatoUpload && (
                <GelatoUploadModal
                    bookPages={bookPages}
                    bookFileName={bookFileName}
                    apiUrl={API_BASE_URL}
                    buildPdf={async (pages?) => {
                        let result: Uint8Array | null = null;
                        await buildBookPdf(bytes => { result = bytes; }, false, pages);
                        return result;
                    }}
                    onClose={() => setShowGelatoUpload(false)}
                />
            )}

            {/* Split Books Modal */}
            {showSplitModal && (() => {
                const contentPages = bookPages.filter(p => p.type !== "owner");

                // Pages before the first real image = preamble (title, blank, etc.)
                const firstImageIdx = contentPages.findIndex(p => p.image);
                const preamble = firstImageIdx > 0 ? contentPages.slice(0, firstImageIdx) : [];
                const imagePages = firstImageIdx >= 0 ? contentPages.slice(firstImageIdx) : contentPages;

                const n = imagePages.length;
                const parts = Math.max(2, Math.min(splitParts, 20));

                // Build even-sized chunks from image pages only
                const chunks: BookPage[][] = [];
                let start = 0;
                for (let i = 0; i < parts; i++) {
                    const remaining = parts - i;
                    let size = Math.ceil((n - start) / remaining);
                    if (size % 2 !== 0) size++;
                    const end = Math.min(start + size, n);
                    if (start < n) chunks.push(imagePages.slice(start, end));
                    start = end;
                    if (start >= n) break;
                }

                // Blank separator so images land on right-side pages:
                // owner(1) + blank(1) + preamble(P) + images(even) — if P is odd add extra blank
                const blankSep: BookPage = {
                    id: "__blank-sep__",
                    type: "image",
                    text: { content: "", bold: false, italic: false, fontSize: 14, color: "#333333", align: "center", verticalAlign: "middle", fontFamily: "helvetica" },
                };
                // Extra blank after preamble if preamble length is odd (keeps images on right)
                const preambleWithPad = preamble.length % 2 !== 0 ? [...preamble, blankSep] : preamble;

                const handleDownloadAll = async () => {
                    setSplitProgress({ current: 0, total: chunks.length });
                    for (let i = 0; i < chunks.length; i++) {
                        setSplitProgress({ current: i + 1, total: chunks.length });
                        // First chunk already has preamble; subsequent chunks need it prepended
                        const preamblePart = i === 0 ? [] : preambleWithPad;
                        const pagesForPdf = [blankSep, ...preamblePart, ...chunks[i]];
                        let result: Uint8Array | null = null;
                        await buildBookPdf(bytes => { result = bytes; }, false, pagesForPdf);
                        if (result) {
                            const blob = new Blob([result], { type: "application/pdf" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${bookFileName}-parte-${i + 1}.pdf`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }
                        if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 600));
                    }
                    setSplitProgress(null);
                    setShowSplitModal(false);
                };

                return createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                                <div className="flex items-center gap-2">
                                    <BookOpen size={15} className="text-amber-400" />
                                    <span className="text-[13px] font-black text-white uppercase tracking-widest">Dividir libro</span>
                                </div>
                                <button onClick={() => setShowSplitModal(false)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-all">
                                    <X size={13} />
                                </button>
                            </div>

                            <div className="p-5 flex flex-col gap-4">
                                <p className="text-[11px] text-neutral-400 leading-relaxed">
                                    Divide el libro en <span className="text-white font-bold">{chunks.length}</span> PDFs con páginas pares y página de propietario en cada uno.
                                </p>

                                {/* Parts selector */}
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] text-neutral-500 w-20 shrink-0">Nº de partes</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setSplitParts(p => Math.max(2, p - 1))}
                                            className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 text-neutral-300 flex items-center justify-center transition-all text-lg leading-none">−</button>
                                        <span className="w-8 text-center text-white font-black text-[15px]">{parts}</span>
                                        <button onClick={() => setSplitParts(p => Math.min(20, p + 1))}
                                            className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 text-neutral-300 flex items-center justify-center transition-all text-lg leading-none">+</button>
                                    </div>
                                    <span className="text-[10px] text-neutral-600">{n} páginas en total</span>
                                </div>

                                {/* Preview of chunks */}
                                <div className="flex flex-col gap-1.5">
                                    {chunks.map((chunk, i) => {
                                        const pre = i === 0 ? 0 : preambleWithPad.length;
                                        const total = 1 + 1 + pre + chunk.length; // owner+blank+preamble+imgs
                                        return (
                                            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                                                <BookOpen size={11} className="text-amber-400 shrink-0" />
                                                <span className="text-[11px] text-neutral-300 flex-1">{bookFileName}-parte-{i + 1}.pdf</span>
                                                <span className="text-[10px] font-mono text-neutral-500">{total}p</span>
                                                <span className="text-[9px] text-neutral-600">{chunk.length} imgs</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Progress */}
                                {splitProgress && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                        <Loader2 size={12} className="animate-spin text-amber-400 shrink-0" />
                                        <span className="text-[11px] text-amber-300">Generando parte {splitProgress.current} de {splitProgress.total}…</span>
                                    </div>
                                )}

                                {/* Download button */}
                                <button onClick={() => void handleDownloadAll()} disabled={!!splitProgress || chunks.length === 0}
                                    className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                                    {splitProgress ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                                    {splitProgress ? `Parte ${splitProgress.current}/${splitProgress.total}…` : `Descargar ${chunks.length} PDFs`}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                );
            })()}

            {/* Cover Factory Modal */}
            {showCoverModal && (
                <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
                    onClick={() => setShowCoverModal(false)} role="dialog" aria-modal="true">
                    <div className="relative w-full max-w-2xl rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0a0a0a] overflow-hidden flex flex-col"
                        onClick={e => e.stopPropagation()}>
                        <div className="absolute -top-24 -right-24 w-72 h-72 bg-fuchsia-500/8 blur-[80px] pointer-events-none" />
                        {/* Header */}
                        <div className="shrink-0 border-b border-white/8 px-5 py-4 flex items-center gap-3 relative">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-600/10 border border-fuchsia-500/20 flex items-center justify-center shrink-0">
                                <ImageIcon size={15} className="text-fuchsia-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Cover Factory</p>
                                <p className="text-[10px] text-neutral-600">1600×2560px · Tall-format para Amazon KDP</p>
                            </div>
                            <button onClick={() => setShowCoverModal(false)}
                                className="w-9 h-9 rounded-xl bg-white/5 text-neutral-400 hover:bg-rose-500 hover:text-white transition-all border border-white/10 shrink-0 flex items-center justify-center">
                                <X size={15} />
                            </button>
                        </div>
                        {/* Tabs */}
                        <div className="shrink-0 border-b border-white/6 px-5 flex gap-1 pt-3 pb-0">
                            {([["front", "Portada"], ["back", "Contraportada"]] as const).map(([id, label]) => (
                                <button key={id} onClick={() => setCoverModalTab(id)}
                                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-t-xl transition-all border-b-2 ${coverModalTab === id ? "text-fuchsia-300 border-fuchsia-500/60 bg-fuchsia-500/[0.06]" : "text-neutral-600 border-transparent hover:text-neutral-400"}`}>
                                    {label}
                                    {id === "front" && generatedCoverUrl && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-fuchsia-400 inline-block" />}
                                    {id === "back" && generatedBackCoverUrl && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />}
                                </button>
                            ))}
                        </div>
                        {/* Body */}
                        <div className="overflow-y-auto p-5 space-y-5 relative" style={{ maxHeight: "75dvh" }}>
                            {/* ── Niche picker ── */}
                            {niches.filter(n => n.status !== "archived").length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 flex items-center gap-1.5">
                                        <Target size={9} /> Cargar desde nicho
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {niches.filter(n => n.status !== "archived").map(niche => {
                                            const isSelected = selectedCoverNicheId === niche._id;
                                            return (
                                                <button
                                                    key={niche._id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedCoverNicheId(null);
                                                            return;
                                                        }
                                                        setSelectedCoverNicheId(niche._id);
                                                        const coverMap = NICHE_STYLE_TO_COVER[niche.styleCategory] ?? NICHE_STYLE_TO_COVER.generic;
                                                        setCoverTitle(niche.name);
                                                        if (niche.productType === "coloring-book") {
                                                            setCoverSubtitle("Coloring Book for Adults");
                                                        } else if (niche.productType === "printable-poster") {
                                                            setCoverSubtitle("Premium Printable Artwork");
                                                        } else {
                                                            setCoverSubtitle("");
                                                        }
                                                        setCoverStyle(coverMap.style);
                                                        setCoverColorTheme(coverMap.colorTheme);
                                                        setCoverModelId(NICHE_STYLE_MODEL[niche.styleCategory] ?? "pollinations-flux");
                                                        if (niche.description) setCoverDescription(niche.description);
                                                        toast.success(`Campos cargados desde "${niche.name}"`);
                                                    }}
                                                    className={`flex items-center gap-1.5 h-6 px-2.5 rounded-lg border text-[9px] font-black transition-all ${
                                                        isSelected
                                                            ? "border-fuchsia-500/50 bg-fuchsia-500/20 text-fuchsia-300"
                                                            : niche.phase === "published"
                                                                ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15"
                                                                : "border-white/10 bg-white/[0.03] text-neutral-500 hover:text-white hover:bg-white/8"
                                                    }`}
                                                >
                                                    <Target size={8} />
                                                    {niche.name}
                                                    {isSelected && <Check size={8} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {selectedCoverNicheId && (
                                        <p className="text-[8px] text-neutral-700 italic">
                                            Campos auto-rellenados · puedes editarlos libremente antes de generar
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* ── Shared fields (always visible) ── */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Título <span className="text-fuchsia-500">*</span></label>
                                    <input type="text" value={coverTitle} onChange={e => setCoverTitle(e.target.value)} placeholder="Ej: Mandala Zen Coloring Book"
                                        className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 rounded-xl text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-fuchsia-500/40" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Subtítulo</label>
                                    <input type="text" value={coverSubtitle} onChange={e => setCoverSubtitle(e.target.value)} placeholder="Ej: 50 Relaxing Designs for Adults"
                                        className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 rounded-xl text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-fuchsia-500/40" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Estilo visual</label>
                                    <input type="text" value={coverStyle} onChange={e => setCoverStyle(e.target.value)} placeholder="Ej: vibrant illustration, fantasy"
                                        className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 rounded-xl text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-fuchsia-500/40" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Modelo</label>
                                    <select value={coverModelId} onChange={e => setCoverModelId(e.target.value)}
                                        className="w-full h-9 px-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-[10px] text-white focus:outline-none focus:border-fuchsia-500/40 [color-scheme:dark]">
                                        {AI_MODELS.filter(m => ["Pollinations", "fal.ai", "Ideogram", "Google"].includes(m.provider)).map(m => (
                                            <option key={m.id} value={m.id}>{m.name} · {m.provider}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Paleta de colores</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {["deep blue and gold", "pastel pink and mint", "dark forest green", "warm sunset orange", "purple and silver"].map(p => (
                                        <button key={p} onClick={() => setCoverColorTheme(p)}
                                            className={`px-2 py-1 rounded-lg border text-[8px] font-black transition-all ${coverColorTheme === p ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300" : "border-white/8 bg-white/[0.02] text-neutral-600 hover:text-neutral-400"}`}>
                                            {p}
                                        </button>
                                    ))}
                                    <input type="text" value={coverColorTheme} onChange={e => setCoverColorTheme(e.target.value)}
                                        className="flex-1 min-w-[90px] h-7 px-2 bg-white/[0.04] border border-white/10 rounded-lg text-[9px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-fuchsia-500/40" placeholder="tema libre..." />
                                </div>
                            </div>

                            <div className="h-px bg-white/6" />

                            {/* ── Tab content ── */}
                            {coverModalTab === "front" ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <button onClick={() => void generateCover()} disabled={isBuildingCover || !coverTitle.trim()}
                                        className="h-10 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-[0_4px_20px_rgba(192,38,211,0.3)] active:scale-95">
                                        {isBuildingCover ? <><Loader2 size={13} className="animate-spin" /> Generando...</> : <><ImageIcon size={13} /> Generar Portada</>}
                                    </button>
                                    <div className="flex items-start justify-center">
                                        {generatedCoverUrl ? (
                                            <div className="space-y-2 w-full flex flex-col items-center">
                                                <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(192,38,211,0.15)]" style={{ maxWidth: 160 }}>
                                                    <img src={generatedCoverUrl} alt="Portada KDP" className="w-full object-cover" style={{ aspectRatio: "1600/2560" }} />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                                                </div>
                                                <p className="text-[8px] text-neutral-700 text-center font-mono">1600×2560px · front</p>
                                                <div className="flex gap-1.5 flex-wrap justify-center">
                                                    <a href={generatedCoverUrl} download={`portada-${(coverTitle || "cover").toLowerCase().replace(/\s+/g, "-")}.jpg`}
                                                        className="flex items-center gap-1 h-7 px-2.5 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 text-[9px] font-black uppercase text-fuchsia-300 hover:bg-fuchsia-500/25 transition-all">
                                                        <Download size={9} /> DL
                                                    </a>
                                                    <button onClick={() => void generateCover()} disabled={isBuildingCover}
                                                        className="flex items-center gap-1 h-7 px-2.5 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-neutral-500 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40">
                                                        <RefreshCw size={9} /> Regen.
                                                    </button>
                                                    <button onClick={() => setGeneratedCoverUrl(null)}
                                                        className="h-7 w-7 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all flex items-center justify-center">
                                                        <Trash2 size={9} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full flex flex-col items-center justify-center gap-2 py-8 border border-dashed border-fuchsia-500/15 rounded-2xl bg-fuchsia-500/[0.02]">
                                                {isBuildingCover ? (
                                                    <><Loader2 size={24} className="text-fuchsia-500/50 animate-spin" /><p className="text-[9px] text-neutral-600">Generando…</p></>
                                                ) : (
                                                    <><div className="w-12 h-18 rounded-xl border-2 border-dashed border-fuchsia-500/20 flex items-center justify-center" style={{ height: 72 }}><ImageIcon size={16} className="text-fuchsia-500/20" /></div><p className="text-[9px] text-neutral-700">Portada · 1600×2560</p></>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Autor <span className="text-neutral-700">(opcional)</span></label>
                                                <input type="text" value={coverAuthor} onChange={e => setCoverAuthor(e.target.value)} placeholder="Ej: Editorial Zen Studio"
                                                    className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 rounded-xl text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Descripción / Blurb</label>
                                                <textarea value={coverDescription} onChange={e => setCoverDescription(e.target.value)}
                                                    placeholder="Texto descriptivo que aparecerá en la contraportada..."
                                                    rows={4}
                                                    className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 resize-none leading-relaxed" />
                                            </div>
                                            <button onClick={() => void generateBackCover()} disabled={isBuildingBackCover || !coverTitle.trim()}
                                                className="w-full h-10 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-[0_4px_20px_rgba(139,92,246,0.3)] active:scale-95">
                                                {isBuildingBackCover ? <><Loader2 size={13} className="animate-spin" /> Generando...</> : <><ImageIcon size={13} /> Generar Contraportada</>}
                                            </button>
                                        </div>
                                        <div className="flex items-start justify-center">
                                            {generatedBackCoverUrl ? (
                                                <div className="space-y-2 w-full flex flex-col items-center">
                                                    <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(139,92,246,0.15)]" style={{ maxWidth: 160 }}>
                                                        <img src={generatedBackCoverUrl} alt="Contraportada KDP" className="w-full object-cover" style={{ aspectRatio: "1600/2560" }} />
                                                        {/* Text overlay preview */}
                                                        {(coverTitle || coverDescription || coverAuthor) && (
                                                            <div className="absolute inset-0 flex flex-col justify-between p-2 bg-black/30">
                                                                <div />
                                                                <div className="space-y-1">
                                                                    {coverDescription && <p className="text-[5px] text-white/90 leading-tight line-clamp-6">{coverDescription}</p>}
                                                                    {coverAuthor && <p className="text-[5px] font-bold text-white/70">{coverAuthor}</p>}
                                                                    <div className="w-8 h-6 bg-white/10 rounded flex items-center justify-center">
                                                                        <span className="text-[4px] text-white/40 font-mono">ISBN</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-[8px] text-neutral-700 text-center font-mono">1600×2560px · back</p>
                                                    <div className="flex gap-1.5 flex-wrap justify-center">
                                                        <a href={generatedBackCoverUrl} download={`contraportada-${(coverTitle || "cover").toLowerCase().replace(/\s+/g, "-")}.jpg`}
                                                            className="flex items-center gap-1 h-7 px-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-[9px] font-black uppercase text-violet-300 hover:bg-violet-500/25 transition-all">
                                                            <Download size={9} /> DL
                                                        </a>
                                                        <button onClick={() => void generateBackCover()} disabled={isBuildingBackCover}
                                                            className="flex items-center gap-1 h-7 px-2.5 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-neutral-500 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40">
                                                            <RefreshCw size={9} /> Regen.
                                                        </button>
                                                        <button onClick={() => setGeneratedBackCoverUrl(null)}
                                                            className="h-7 w-7 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all flex items-center justify-center">
                                                            <Trash2 size={9} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full flex flex-col items-center justify-center gap-2 py-8 border border-dashed border-violet-500/15 rounded-2xl bg-violet-500/[0.02]">
                                                    {isBuildingBackCover ? (
                                                        <><Loader2 size={24} className="text-violet-500/50 animate-spin" /><p className="text-[9px] text-neutral-600">Generando…</p></>
                                                    ) : (
                                                        <><div className="w-12 rounded-xl border-2 border-dashed border-violet-500/20 flex items-center justify-center" style={{ height: 72 }}><AlignLeft size={16} className="text-violet-500/20" /></div><p className="text-[9px] text-neutral-700">Contraportada · 1600×2560</p></>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Book Editor Modal */}
            {bookEditorOpen && (
                <div
                    className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
                    onClick={() => setBookEditorOpen(false)}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="relative w-full max-w-4xl h-[100dvh] sm:h-[90vh] rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0a0a0a] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="shrink-0 border-b border-white/8">
                            <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-3 flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-neutral-400">Editor · PDF</p>
                                    <p className="text-[10px] sm:text-[11px] text-neutral-600">{bookPages.length} pág{bookPages.length !== 1 ? "s" : "."}</p>
                                </div>
                                {/* Filename input — desktop */}
                                <input value={bookFileName} onChange={e => setBookFileName(e.target.value)}
                                    className="hidden sm:block w-28 h-9 rounded-xl bg-white/5 border border-white/10 px-2.5 text-[11px] text-white outline-none focus:border-amber-500/40 shrink-0"
                                    placeholder="libro-kdp" />
                                {/* Save */}
                                <button onClick={() => void saveBookDraft()} disabled={isSavingDraft || bookPages.length === 0}
                                    className="w-9 h-9 sm:w-auto sm:px-3 rounded-xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:border-white/20 shrink-0 flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-black uppercase"
                                    title="Guardar borrador">
                                    {isSavingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    <span className="hidden sm:inline">Guardar</span>
                                </button>
                                {/* Owner page toggle */}
                                <button
                                    onClick={() => {
                                        const next = !includeOwnerPage;
                                        setIncludeOwnerPage(next);
                                        if (next) {
                                            // Add owner page at position 0 if not already there
                                            setBookPages(prev => prev[0]?.type === "owner" ? prev : [{ id: genPageId(), type: "owner", text: defaultTextStyle() }, ...prev]);
                                        } else {
                                            // Remove owner page(s) from front
                                            setBookPages(prev => prev.filter(p => p.type !== "owner"));
                                        }
                                    }}
                                    title={includeOwnerPage ? "Primera página: propietario + copyright (activa)" : "Primera página: desactivada"}
                                    className={`w-9 h-9 rounded-xl border shrink-0 flex items-center justify-center transition-all text-[9px] ${includeOwnerPage ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-white/5 border-white/10 text-neutral-600 hover:text-neutral-400"}`}
                                >
                                    <BookOpen size={14} />
                                </button>
                                {/* Subir a Gelato */}
                                <button onClick={() => setShowGelatoUpload(true)} disabled={bookPages.length === 0}
                                    className="h-9 px-3 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 shrink-0 flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 text-[10px] font-black uppercase"
                                    title="Subir a Gelato">
                                    <Package size={13} />
                                    <span className="hidden sm:inline">Gelato</span>
                                </button>
                                {/* Split into X books */}
                                <button onClick={() => setShowSplitModal(true)} disabled={bookPages.length === 0}
                                    className="h-9 px-3 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 shrink-0 flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 text-[10px] font-black uppercase"
                                    title="Dividir en varios PDFs">
                                    <Layers size={13} />
                                    <span className="hidden sm:inline">Dividir</span>
                                </button>
                                {/* Generate PDF — always shows text on mobile */}
                                <button onClick={() => void buildBookPdf()} disabled={isBuildingPdf || bookPages.length === 0}
                                    className="h-9 px-3 sm:px-4 rounded-xl bg-amber-500 text-black hover:bg-amber-400 shrink-0 flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-[10px] sm:text-[11px] font-black uppercase"
                                    title="Generar PDF">
                                    {isBuildingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                    <span>PDF</span>
                                </button>
                                {/* Close */}
                                <button onClick={() => { setBookEditorOpen(false); setShowAddPageMenu(false); }}
                                    className="w-9 h-9 rounded-xl bg-white/5 text-neutral-400 hover:bg-rose-500 hover:text-white transition-all border border-white/10 shrink-0 flex items-center justify-center">
                                    <X size={15} />
                                </button>
                            </div>
                            {/* Filename + page count — mobile only */}
                            <div className="sm:hidden px-3 pb-2.5 flex items-center gap-2">
                                <input value={bookFileName} onChange={e => setBookFileName(e.target.value)}
                                    className="flex-1 h-9 rounded-xl bg-white/5 border border-white/10 px-3 text-[12px] text-white outline-none focus:border-amber-500/40"
                                    placeholder="Nombre del libro..." />
                                <span className="text-[10px] font-mono text-neutral-600 shrink-0">{bookPages.length}p</span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="shrink-0 flex border-b border-white/8 bg-black/20">
                            {([["editor", "Editar", Pencil], ["preview", "Vista previa", FileText]] as [string, string, React.ElementType][]).map(([tab, label, Icon]) => (
                                <button key={tab} onClick={() => setBookEditorTab(tab as "editor" | "preview")}
                                    className={`flex-1 flex items-center justify-center gap-1.5 h-12 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all ${bookEditorTab === tab ? "border-amber-500 text-amber-400 bg-amber-500/5" : "border-transparent text-neutral-600 hover:text-neutral-400"}`}>
                                    <Icon size={13} />{label}
                                </button>
                            ))}
                        </div>

                        {/* ── TAB: EDITAR ── */}
                        {bookEditorTab === "editor" && (
                            <div className="flex-1 overflow-hidden flex flex-col min-h-0">

                                {/* ── Timeline ── */}
                                <div className="shrink-0 border-b border-white/8 px-3 py-2.5 bg-black/30">
                                    <div className="flex items-center gap-2">
                                        {/* Scrollable pages strip */}
                                        <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar min-w-0">
                                            {/* Page counter badge — always visible */}
                                            <div className={`shrink-0 h-7 px-2.5 rounded-lg border flex items-center gap-1 text-[9px] font-black tabular-nums ${bookPages.length === 0 ? "bg-white/4 border-white/8 text-neutral-600" : bookPages.length < 20 ? "bg-amber-500/10 border-amber-500/25 text-amber-400" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"}`}>
                                                <FileText size={9} />
                                                {bookPages.length} pág{bookPages.length !== 1 ? "s" : "."}
                                                {bookPages.length > 0 && bookPages.length < 20 && <span className="text-amber-500/60 font-normal">· mín 20</span>}
                                            </div>
                                            {bookPages.map((page, idx) => (
                                                <div key={page.id}
                                                    data-page-idx={idx}
                                                    draggable={page.type !== "owner"}
                                                    onDragStart={() => page.type !== "owner" && handleBookDragStart(idx)}
                                                    onDragOver={e => page.type !== "owner" && handleBookDragOver(e, idx)}
                                                    onDrop={() => page.type !== "owner" && handleBookDrop(idx)}
                                                    onDragEnd={handleBookDragEnd}
                                                    onTouchStart={e => page.type !== "owner" && handleThumbnailTouchStart(e, idx)}
                                                    onTouchMove={handleThumbnailTouchMove}
                                                    onTouchEnd={handleThumbnailTouchEnd}
                                                    onClick={() => { setSelectedPageId(page.id); setShowInlineImagePicker(false); }}
                                                    className={`group shrink-0 w-14 h-[80px] sm:w-12 sm:h-[68px] rounded-xl border-2 relative overflow-hidden transition-all select-none touch-none
                                                        ${page.type === "owner" ? "cursor-default" : "cursor-grab active:cursor-grabbing"}
                                                        ${selectedPageId === page.id
                                                            ? "border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                                                            : bookDragOverIdx === idx && bookDragIdx !== idx
                                                                ? "border-amber-500/40 scale-105"
                                                                : bookDragIdx === idx
                                                                    ? "border-white/10 opacity-25"
                                                                    : page.type === "owner"
                                                                        ? "border-amber-500/20"
                                                                        : "border-white/10 hover:border-white/30"}`}>
                                                    <div className="w-full h-full bg-[#1a1a1a]">
                                                        {page.type === "owner"
                                                            ? <div className="w-full h-full bg-white flex flex-col items-center justify-between py-1.5 px-1">
                                                                {/* "pertenece a" text lines */}
                                                                <div className="w-full space-y-0.5 mt-1">
                                                                    <div className="w-3/4 mx-auto h-[2px] bg-neutral-400/50 rounded-full" />
                                                                    <div className="w-1/2 mx-auto h-[2px] bg-neutral-300/50 rounded-full" />
                                                                    <div className="w-2/3 mx-auto h-px bg-neutral-300/40 mt-1 rounded-full" />
                                                                </div>
                                                                {/* color squares */}
                                                                <div className="flex gap-[2px]">
                                                                    {["#eee","#ddd","#eee","#ddd","#eee","#ddd"].map((c,i) => <div key={i} className="w-[4px] h-[4px] border border-neutral-300/60 rounded-[1px]" style={{ background: c }} />)}
                                                                </div>
                                                                {/* copyright line */}
                                                                <div className="w-5/6 h-px bg-neutral-300/40 rounded-full" />
                                                            </div>
                                                            : page.image
                                                                ? <img src={page.image.url} alt="" className="w-full h-full object-cover" />
                                                                : <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                                                                    <Type size={14} className="text-neutral-700" />
                                                                </div>}
                                                    </div>
                                                    {/* Page number */}
                                                    <div className="absolute bottom-0 inset-x-0 h-5 bg-gradient-to-t from-black/80 to-transparent flex items-end px-1 pb-0.5">
                                                        <span className="text-[8px] font-mono text-white/50">{idx + 1}</span>
                                                    </div>
                                                    {/* Type badge */}
                                                    {page.type === "text" && <div className="absolute top-1 left-1 w-3 h-3 rounded bg-blue-500/80 flex items-center justify-center"><Type size={6} className="text-white" /></div>}
                                                    {page.type === "both" && <div className="absolute top-1 left-1 w-3 h-3 rounded bg-purple-500/80 flex items-center justify-center"><Layers size={6} className="text-white" /></div>}
                                                    {/* Delete — hidden for owner page */}
                                                    {page.type !== "owner" && (
                                                        <button onClick={e => { e.stopPropagation(); deletePage(page.id); }}
                                                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-black/80 text-red-400 sm:opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                                            title="Eliminar">
                                                            <X size={9} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {bookPages.length === 0 && (
                                                <p className="text-[11px] text-neutral-700 shrink-0 italic px-1">Todavía no hay páginas</p>
                                            )}
                                        </div>
                                        {/* Single add-page button */}
                                        <button
                                            onClick={() => addBlankPage("image")}
                                            className="shrink-0 flex flex-col items-center justify-center gap-1 w-12 h-[68px] rounded-xl border-2 border-dashed border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/70 transition-all">
                                            <Plus size={16} />
                                            <span className="text-[8px] font-black uppercase">Nueva</span>
                                        </button>
                                    </div>
                                </div>

                                {/* ── Page editor ── */}
                                <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y", overscrollBehavior: "contain" } as React.CSSProperties}>
                                    {selectedPage ? (() => {
                                        const pageIdx = bookPages.findIndex(p => p.id === selectedPage.id);
                                        const allImgSources = [
                                            ...vaultImages.map(v => ({ url: v.url, label: v.model, fav: favorites.has(v.url), inPdf: usedImageUrls.has(v.url) })),
                                            ...iaCatalogs.flatMap(c => c.images.map(i => ({ url: i.url, label: c.name, fav: favorites.has(i.url), inPdf: usedImageUrls.has(i.url) }))),
                                            ...cloudinaryImages.map(c => ({ url: c.url, label: c.publicId.split("/").pop() ?? "", fav: favorites.has(c.url), inPdf: usedImageUrls.has(c.url) })),
                                        ];
                                        const needsImage = selectedPage.type === "image" || selectedPage.type === "both";
                                        const needsText = selectedPage.type === "text" || selectedPage.type === "both";
                                        return (
                                            <div className="p-3 sm:p-4 space-y-4 max-w-xl mx-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 120px)" }}>

                                                {/* ── Page nav + actions ── */}
                                                <div className="flex items-center gap-1.5 pt-1">
                                                    {/* Nav */}
                                                    <span className="text-[11px] font-mono text-neutral-500 shrink-0 mr-1">
                                                        {pageIdx + 1}<span className="text-neutral-700">/{bookPages.length}</span>
                                                    </span>
                                                    <button onClick={() => pageIdx > 0 && setSelectedPageId(bookPages[pageIdx - 1].id)}
                                                        disabled={pageIdx === 0}
                                                        className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white disabled:opacity-20 flex items-center justify-center transition-all">
                                                        <ChevronLeft size={15} />
                                                    </button>
                                                    <button onClick={() => pageIdx < bookPages.length - 1 && setSelectedPageId(bookPages[pageIdx + 1].id)}
                                                        disabled={pageIdx === bookPages.length - 1}
                                                        className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white disabled:opacity-20 flex items-center justify-center transition-all">
                                                        <ChevronRight size={15} />
                                                    </button>
                                                    {selectedPage.type !== "owner" && (
                                                        <button onClick={() => duplicatePage(selectedPage.id)}
                                                            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-neutral-500 hover:text-white flex items-center justify-center transition-all" title="Duplicar página">
                                                            <Copy size={14} />
                                                        </button>
                                                    )}
                                                    {selectedPage.type !== "owner" && (
                                                        <button onClick={() => deletePage(selectedPage.id)}
                                                            className="ml-auto flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all text-[11px] font-black">
                                                            <Trash2 size={13} /><span className="hidden sm:inline">Eliminar</span>
                                                        </button>
                                                    )}
                                                    {selectedPage.type === "owner" && (
                                                        <button onClick={() => { setIncludeOwnerPage(false); deletePage(selectedPage.id); }}
                                                            className="ml-auto flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all text-[11px] font-black">
                                                            <Trash2 size={13} /><span className="hidden sm:inline">Quitar</span>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* ── Owner page special view ── */}
                                                {selectedPage.type === "owner" && (
                                                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <BookOpen size={16} className="text-amber-400 shrink-0" />
                                                            <div>
                                                                <p className="text-xs font-bold text-amber-300">Página de propietario + colores</p>
                                                                <p className="text-[10px] text-neutral-500">Generada automáticamente al crear el PDF</p>
                                                            </div>
                                                        </div>
                                                        <div className="rounded-xl bg-black/30 p-3 space-y-1.5 text-[11px] text-neutral-400">
                                                            <p><span className="text-neutral-300 font-medium">«Este libro pertenece a:»</span> + línea de nombre</p>
                                                            <p><span className="text-neutral-300 font-medium">6 cuadraditos</span> para probar colores</p>
                                                            <p><span className="text-neutral-300 font-medium">Copyright</span> © {new Date().getFullYear()} Emilio Jiménez</p>
                                                        </div>
                                                        <p className="text-[10px] text-neutral-600">Esta página no es editable. Puedes quitarla con el botón «Quitar».</p>
                                                    </div>
                                                )}

                                                {/* ── Type selector (compact pill row) — hidden for owner pages ── */}
                                                {selectedPage.type !== "owner" && (
                                                <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/[0.03] border border-white/8">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600 pl-2 shrink-0">Tipo:</span>
                                                    {([
                                                        ["image", "Solo imagen", ImageIcon],
                                                        ["text", "Solo texto", Type],
                                                        ["both", "Img + Texto", Layers],
                                                    ] as [BookPage["type"], string, React.ElementType][]).map(([type, label, Icon]) => (
                                                        <button key={type} onClick={() => updatePageType(selectedPage.id, type)}
                                                            className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl border text-[10px] font-black transition-all
                                                                ${selectedPage.type === type
                                                                    ? "border-amber-500/60 bg-amber-500/15 text-amber-400"
                                                                    : "border-transparent text-neutral-600 hover:text-neutral-300 hover:bg-white/5"}`}>
                                                            <Icon size={11} />
                                                            <span className="hidden sm:inline">{label}</span>
                                                            <span className="sm:hidden">{label.split(" ")[label.split(" ").length - 1]}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                )}

                                                {/* ── IMAGE SECTION ── */}
                                                {needsImage && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Imagen</p>
                                                            {selectedPage.image && (
                                                                <div className="flex items-center gap-2">
                                                                    <button onClick={() => setShowInlineImagePicker(v => !v)}
                                                                        className={`flex items-center gap-1.5 h-7 px-3 rounded-lg border text-[10px] font-bold transition-all
                                                                            ${showInlineImagePicker
                                                                                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                                                                : "border-white/10 text-neutral-500 hover:text-white"}`}>
                                                                        <ImagePlus size={10} />{showInlineImagePicker ? "Cerrar" : "Cambiar"}
                                                                    </button>
                                                                    <button onClick={() => clearPageImage(selectedPage.id)}
                                                                        className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all text-[10px] font-bold">
                                                                        <X size={10} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {selectedPage.image && (() => {
                                                            const zoom = selectedPage.image.scale ?? 1;
                                                            const hPct = Math.min(35, (previewMargin / Math.max(zoom, 0.1) / previewW) * 100);
                                                            const vPct = Math.min(35, (previewMargin / Math.max(zoom, 0.1) / previewH) * 100);
                                                            const brd = selectedPage.image.border;
                                                            return (
                                                                <div
                                                                    className="relative w-full rounded-xl overflow-hidden border border-white/15 shadow-lg bg-white"
                                                                    style={{
                                                                        aspectRatio: `${previewW}/${previewH}`,
                                                                        ...(brd ? { boxShadow: `inset 0 0 0 ${brd.width}px ${brd.color}` } : {}),
                                                                    }}
                                                                >
                                                                    <div className="absolute" style={{ left: `${hPct}%`, right: `${hPct}%`, top: `${vPct}%`, bottom: `${vPct}%` }}>
                                                                        <img src={selectedPage.image.url} alt="" className="w-full h-full object-contain" />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                        {selectedPage.image && (
                                                            <div className="space-y-2 p-3 rounded-2xl bg-white/[0.03] border border-white/8">
                                                                {/* Zoom */}
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-[9px] font-black uppercase text-neutral-600 shrink-0 w-10">Zoom</span>
                                                                    <input type="range" min={0.5} max={3} step={0.05} value={selectedPage.image.scale}
                                                                        onChange={e => updatePageImageScale(selectedPage.id, Number(e.target.value))}
                                                                        className="flex-1 accent-amber-500 h-1.5" />
                                                                    <span className="text-[10px] font-mono text-amber-400 shrink-0 w-9 text-right">{Math.round(selectedPage.image.scale * 100)}%</span>
                                                                </div>
                                                                {/* Border / Marco */}
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-[9px] font-black uppercase text-neutral-600 shrink-0 w-10">Marco</span>
                                                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                                                            <div className="relative">
                                                                                <input type="checkbox"
                                                                                    checked={!!selectedPage.image.border}
                                                                                    onChange={e => updatePageImageBorder(selectedPage.id, e.target.checked ? { width: 3, color: "#000000" } : undefined)}
                                                                                    className="sr-only peer" />
                                                                                <div className="w-9 h-5 rounded-full bg-white/10 peer-checked:bg-amber-500/80 transition-colors border border-white/10 peer-checked:border-amber-500/50" />
                                                                                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white/60 peer-checked:translate-x-4 peer-checked:bg-white transition-transform" />
                                                                            </div>
                                                                            <span className="text-[10px] font-bold text-neutral-500">{selectedPage.image.border ? "Activo" : "Sin marco"}</span>
                                                                        </label>
                                                                        {selectedPage.image.border && (
                                                                            <label className="ml-auto flex items-center gap-1.5 cursor-pointer" title="Color del marco">
                                                                                <span className="text-[9px] text-neutral-600 font-bold">Color</span>
                                                                                <span className="w-6 h-6 rounded-lg border border-white/20 shadow-inner" style={{ background: selectedPage.image.border.color }} />
                                                                                <input type="color" value={selectedPage.image.border.color}
                                                                                    onChange={e => updatePageImageBorder(selectedPage.id, { ...selectedPage.image!.border!, color: e.target.value })}
                                                                                    className="sr-only" />
                                                                            </label>
                                                                        )}
                                                                    </div>
                                                                    {selectedPage.image.border && (
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-[9px] font-black uppercase text-neutral-600 shrink-0 w-10">Grosor</span>
                                                                            <input type="range" min={1} max={20} step={1}
                                                                                value={selectedPage.image.border.width}
                                                                                onChange={e => updatePageImageBorder(selectedPage.id, { ...selectedPage.image!.border!, width: Number(e.target.value) })}
                                                                                className="flex-1 accent-amber-500 h-1.5" />
                                                                            <span className="text-[10px] font-mono text-amber-400 shrink-0 w-6 text-right">{selectedPage.image.border.width}px</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Gallery: auto-open when no image, toggled when image exists */}
                                                        {(!selectedPage.image || showInlineImagePicker) && (
                                                            <div>
                                                                {allImgSources.length === 0 ? (
                                                                    <div className="flex flex-col items-center gap-3 py-10 rounded-2xl bg-white/[0.02] border border-white/8 text-center">
                                                                        <ImageIcon size={28} strokeWidth={1.2} className="text-neutral-700" />
                                                                        <p className="text-[11px] font-bold text-neutral-600">Sin imágenes disponibles.<br />Genera algunas en el Studio primero.</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto rounded-2xl bg-white/[0.02] border border-white/8 p-2">
                                                                        {allImgSources.map((src, i) => (
                                                                            <button key={i}
                                                                                onClick={() => { setPageImage(selectedPage.id, src.url, src.label); setShowInlineImagePicker(false); }}
                                                                                className={`aspect-square rounded-xl overflow-hidden border-2 relative transition-all active:scale-95
                                                                                    ${selectedPage.image?.url === src.url
                                                                                        ? "border-amber-500 scale-[0.97]"
                                                                                        : src.inPdf && selectedPage.image?.url !== src.url
                                                                                            ? "border-emerald-500/50"
                                                                                            : "border-white/10 hover:border-amber-500/60"}`}>
                                                                                <img src={src.url} alt="" className="w-full h-full object-cover" />
                                                                                {selectedPage.image?.url === src.url && (
                                                                                    <div className="absolute inset-0 bg-amber-500/30 flex items-center justify-center">
                                                                                        <Check size={16} className="text-amber-300" />
                                                                                    </div>
                                                                                )}
                                                                                {src.inPdf && selectedPage.image?.url !== src.url && (
                                                                                    <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-md bg-emerald-500/90 flex items-center justify-center pointer-events-none">
                                                                                        <FileText size={8} className="text-white" />
                                                                                    </div>
                                                                                )}
                                                                                {src.fav && selectedPage.image?.url !== src.url && (
                                                                                    <div className="absolute top-0.5 left-0.5 pointer-events-none">
                                                                                        <Heart size={9} className="fill-rose-400 text-rose-400 drop-shadow" />
                                                                                    </div>
                                                                                )}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ── TEXT SECTION ── */}
                                                {needsText && (() => {
                                                    const vAlign = selectedPage.text.verticalAlign ?? "middle";
                                                    const cssFontFamily = selectedPage.text.fontFamily === "times"
                                                        ? "Georgia, serif"
                                                        : selectedPage.text.fontFamily === "courier"
                                                            ? "'Courier New', monospace"
                                                            : "Helvetica, Arial, sans-serif";
                                                    return (
                                                        <div className="space-y-3">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Texto</p>

                                                            {/* Textarea */}
                                                            <textarea
                                                                value={selectedPage.text.content}
                                                                onChange={e => updatePageText(selectedPage.id, { content: e.target.value })}
                                                                className="w-full min-h-[90px] rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white outline-none focus:border-amber-500/40 resize-y leading-relaxed"
                                                                placeholder="Escribe el contenido de esta página..." />

                                                            {/* ── Toolbar ── */}
                                                            <div className="space-y-2 p-3 rounded-2xl bg-white/[0.03] border border-white/8">
                                                                {/* Row 1: B/I + align + color + size number */}
                                                                <div className="flex items-center gap-1 flex-wrap">
                                                                    <button type="button" onClick={() => updatePageText(selectedPage.id, { bold: !selectedPage.text.bold })}
                                                                        className={`w-9 h-9 rounded-xl text-sm flex items-center justify-center font-black border transition-all
                                                                            ${selectedPage.text.bold ? "bg-amber-500/20 border-amber-500/30 text-amber-300" : "border-white/10 text-neutral-500 hover:bg-white/5 hover:text-white"}`}>B</button>
                                                                    <button type="button" onClick={() => updatePageText(selectedPage.id, { italic: !selectedPage.text.italic })}
                                                                        className={`w-9 h-9 rounded-xl text-sm flex items-center justify-center italic border font-serif transition-all
                                                                            ${selectedPage.text.italic ? "bg-amber-500/20 border-amber-500/30 text-amber-300" : "border-white/10 text-neutral-500 hover:bg-white/5 hover:text-white"}`}>I</button>
                                                                    <div className="w-px h-5 bg-white/10 mx-0.5 shrink-0" />
                                                                    {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as [PageTextStyle["align"], React.ElementType][]).map(([a, Ic]) => (
                                                                        <button key={a} type="button" onClick={() => updatePageText(selectedPage.id, { align: a })}
                                                                            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all
                                                                                ${selectedPage.text.align === a ? "bg-amber-500/20 border-amber-500/30 text-amber-300" : "border-white/10 text-neutral-500 hover:bg-white/5 hover:text-white"}`}>
                                                                            <Ic size={13} />
                                                                        </button>
                                                                    ))}
                                                                    <div className="w-px h-5 bg-white/10 mx-0.5 shrink-0" />
                                                                    <label className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer shrink-0" title="Color de texto">
                                                                        <span className="w-5 h-5 rounded border border-white/20" style={{ background: selectedPage.text.color }} />
                                                                        <input type="color" value={selectedPage.text.color} onChange={e => updatePageText(selectedPage.id, { color: e.target.value })} className="sr-only" />
                                                                    </label>
                                                                    <div className="flex items-center gap-1.5 ml-auto">
                                                                        <span className="text-[9px] font-black uppercase text-neutral-600 shrink-0">pt</span>
                                                                        <input type="number" min={6} max={200} value={selectedPage.text.fontSize}
                                                                            onChange={e => updatePageText(selectedPage.id, { fontSize: Math.max(6, Math.min(200, Number(e.target.value) || 14)) })}
                                                                            className="w-14 h-9 rounded-xl bg-white/5 border border-white/10 text-center text-[13px] font-mono text-amber-400 outline-none focus:border-amber-500/40" />
                                                                    </div>
                                                                </div>

                                                                {/* Row 2: font size slider */}
                                                                <input type="range" min={6} max={200} step={1} value={selectedPage.text.fontSize}
                                                                    onChange={e => updatePageText(selectedPage.id, { fontSize: Number(e.target.value) })}
                                                                    className="w-full accent-amber-500 h-2 cursor-pointer" />

                                                                {/* Row 3: Font family */}
                                                                <div className="flex gap-1.5">
                                                                    {([["helvetica", "Helvetica", "Helvetica, Arial, sans-serif"], ["times", "Times New Roman", "Georgia, serif"], ["courier", "Courier", "'Courier New', monospace"]] as [PageTextStyle["fontFamily"], string, string][]).map(([ff, lbl, cssFf]) => (
                                                                        <button key={ff} type="button" onClick={() => updatePageText(selectedPage.id, { fontFamily: ff })}
                                                                            style={{ fontFamily: cssFf }}
                                                                            className={`flex-1 h-9 rounded-xl border text-[12px] transition-all truncate px-1
                                                                                ${selectedPage.text.fontFamily === ff
                                                                                    ? "bg-amber-500/20 border-amber-500/30 text-amber-300"
                                                                                    : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-white"}`}>{lbl}</button>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* ── A4 Live preview ── */}
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Vista previa de página</p>
                                                                    <span className="text-[9px] text-neutral-600 font-mono">{selectedPage.text.fontSize}pt · {vAlign === "top" ? "Arriba" : vAlign === "middle" ? "Centro" : "Abajo"}</span>
                                                                </div>

                                                                {/* Page mock */}
                                                                <div className="relative w-full rounded-xl overflow-hidden border border-white/15 shadow-2xl"
                                                                    style={{ aspectRatio: `${previewW}/${previewH}` }}>
                                                                    {/* Page background */}
                                                                    <div className="absolute inset-0 bg-white" />
                                                                    {(selectedPage.type === "both" && selectedPage.image) && (() => {
                                                                        const z = selectedPage.image.scale ?? 1;
                                                                        const hP = Math.min(35, (previewMargin / Math.max(z, 0.1) / previewW) * 100);
                                                                        const vP = Math.min(35, (previewMargin / Math.max(z, 0.1) / previewH) * 100);
                                                                        return (
                                                                            <div className="absolute" style={{ left: `${hP}%`, right: `${hP}%`, top: `${vP}%`, bottom: `${vP}%` }}>
                                                                                <img src={selectedPage.image.url} alt="" className="w-full h-full object-contain" />
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    {/* Position click zones (top / middle / bottom) */}
                                                                    {(["top", "middle", "bottom"] as PageTextStyle["verticalAlign"][]).map(v => (
                                                                        <button key={v} type="button"
                                                                            onClick={() => updatePageText(selectedPage.id, { verticalAlign: v })}
                                                                            className={`absolute inset-x-0 h-1/3 transition-all ${v === "top" ? "top-0" : v === "middle" ? "top-1/3" : "top-2/3"
                                                                                } ${vAlign === v ? "ring-2 ring-inset ring-amber-400/70 bg-amber-500/10" : "hover:bg-amber-500/5"}`}
                                                                        />
                                                                    ))}

                                                                    {/* Text rendered in position */}
                                                                    <div className={`absolute inset-[5%] pointer-events-none flex flex-col ${vAlign === "top" ? "justify-start" :
                                                                        vAlign === "middle" ? "justify-center" : "justify-end"
                                                                        }`} style={{ textAlign: selectedPage.text.align }}>
                                                                        <p style={{
                                                                            fontFamily: cssFontFamily,
                                                                            fontSize: `${Math.max(5, selectedPage.text.fontSize * 0.44)}px`,
                                                                            fontWeight: selectedPage.text.bold ? "bold" : "normal",
                                                                            fontStyle: selectedPage.text.italic ? "italic" : "normal",
                                                                            color: (selectedPage.type === "both" && selectedPage.image) ? selectedPage.text.color : selectedPage.text.color,
                                                                            whiteSpace: "pre-wrap",
                                                                            wordBreak: "break-word",
                                                                            lineHeight: 1.35,
                                                                        }}>
                                                                            {selectedPage.text.content || <span style={{ opacity: 0.3 }}>Tu texto aquí...</span>}
                                                                        </p>
                                                                    </div>

                                                                    {/* Position label */}
                                                                    <div className="absolute bottom-1.5 right-2 pointer-events-none">
                                                                        <span className="text-[8px] font-black uppercase text-black/40 bg-white/60 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                                                                            {vAlign === "top" ? "▲ Arriba" : vAlign === "middle" ? "● Centro" : "▼ Abajo"}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <p className="text-[9px] text-neutral-700 text-center">Toca las zonas de la página para cambiar la posición del texto</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })() : (
                                        /* Empty state — no page selected */
                                        <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-5">
                                            <div className="opacity-25">
                                                <BookOpen size={48} className="text-neutral-600 mx-auto" strokeWidth={1} />
                                                <p className="text-[12px] font-black uppercase tracking-widest text-neutral-600 mt-3">Sin páginas todavía</p>
                                                <p className="text-xs text-neutral-700 mt-1">Añade una página con el botón de arriba</p>
                                            </div>
                                            <button onClick={() => addBlankPage("image")}
                                                className="flex items-center gap-2 h-12 px-8 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 hover:border-amber-500/60 active:scale-95 transition-all text-[12px] font-black uppercase tracking-widest">
                                                <Plus size={16} />Nueva página
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── TAB: VISTA PREVIA ── */}
                        {bookEditorTab === "preview" && (() => {
                            const selIdx = bookPages.findIndex(p => p.id === selectedPageId);
                            const curIdx = selIdx >= 0 ? selIdx : 0;
                            const curPage = bookPages[curIdx];

                            /* Renders a page's content correctly — mirrors PDF logic */
                            const renderPageInner = (page: BookPage, scale: number = 1) => {
                                const zoom = page.image?.scale ?? 1;
                                /* Match drawImageCentered: effectiveMargin/zoom pts on selected page size */
                                const mH = (previewMargin / Math.max(zoom, 0.1) / previewW) * 100;
                                const mV = (previewMargin / Math.max(zoom, 0.1) / previewH) * 100;
                                const brd = page.image?.border;
                                const isEmpty = !page.image && !page.text.content.trim();
                                const textFontPx = Math.max(4, page.text.fontSize * scale * 0.42);
                                const cssFf = page.text.fontFamily === "times" ? "Georgia,serif" : page.text.fontFamily === "courier" ? "'Courier New',monospace" : "Helvetica,sans-serif";
                                return (
                                    <div
                                        className="absolute inset-0 bg-white"
                                        style={brd ? { boxShadow: `inset 0 0 0 ${brd.width}px ${brd.color}` } : {}}
                                    >
                                        {isEmpty && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-300/50">
                                                <FileText size={24} strokeWidth={1} />
                                                <span className="text-[8px] uppercase tracking-widest">En blanco</span>
                                            </div>
                                        )}
                                        {page.image && (
                                            <div className="absolute" style={{ left: `${mH}%`, right: `${mH}%`, top: `${mV}%`, bottom: `${mV}%` }}>
                                                <img src={page.image.url} alt="" className="w-full h-full object-contain" />
                                            </div>
                                        )}
                                        {(page.type === "text" || page.type === "both") && page.text.content.trim() && (() => {
                                            const va = page.text.verticalAlign ?? "middle";
                                            const hasImg = !!page.image;
                                            const cls = hasImg
                                                ? `absolute inset-x-0 px-[6%] py-[4%] ${va === "top" ? "top-0 bg-gradient-to-b from-black/60 to-transparent" : va === "middle" ? "top-1/2 -translate-y-1/2" : "bottom-0 bg-gradient-to-t from-black/60 to-transparent"}`
                                                : `absolute inset-x-0 px-[8%] ${va === "top" ? "top-[8%]" : va === "middle" ? "top-1/2 -translate-y-1/2" : "bottom-[8%]"}`;
                                            return (
                                                <div className={cls} style={{ textAlign: page.text.align }}>
                                                    <p style={{ fontSize: `${textFontPx}px`, color: hasImg ? "#fff" : page.text.color, fontWeight: page.text.bold ? "bold" : "normal", fontStyle: page.text.italic ? "italic" : "normal", fontFamily: cssFf, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.4 }}>
                                                        {page.text.content}
                                                    </p>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            };

                            return (
                                <div className="flex-1 flex flex-col min-h-0 bg-[#0f0f11]">

                                    {/* ── Top bar ── */}
                                    <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                                        <span className="text-[11px] text-neutral-500 font-medium truncate max-w-[120px]">{bookFileName || "Sin título"}</span>
                                        {/* Mode pills */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-0.5 p-1 rounded-full bg-white/[0.07]">
                                                <button onClick={() => setBookPreviewMode("single")} title="Una página"
                                                    className={`w-8 h-6 rounded-full flex items-center justify-center transition-all ${bookPreviewMode === "single" ? "bg-white/20 text-white" : "text-neutral-600 hover:text-neutral-400"}`}>
                                                    <FileText size={10} />
                                                </button>
                                                <button onClick={() => setBookPreviewMode("spread")} title="Doble página"
                                                    className={`w-8 h-6 rounded-full flex items-center justify-center transition-all ${bookPreviewMode === "spread" ? "bg-white/20 text-white" : "text-neutral-600 hover:text-neutral-400"}`}>
                                                    <BookOpen size={10} />
                                                </button>
                                            </div>
                                            {/* Download current page image */}
                                            {bookPreviewMode === "single" && (() => {
                                                const selIdx2 = bookPages.findIndex(p => p.id === selectedPageId);
                                                const curPage2 = bookPages[selIdx2 >= 0 ? selIdx2 : 0];
                                                return curPage2?.image?.url ? (
                                                    <button
                                                        onClick={() => {
                                                            const url = curPage2.image!.url;
                                                            const name = url.startsWith("blob:")
                                                                ? `pagina-${(selIdx2 >= 0 ? selIdx2 : 0) + 1}`
                                                                : (url.split("/").pop()?.split("?")[0] ?? "imagen");
                                                            downloadPng(url, name);
                                                        }}
                                                        className="flex items-center gap-1 h-7 px-2.5 rounded-full bg-white/[0.07] border border-white/10 text-[9px] font-black text-neutral-400 hover:text-white hover:bg-white/15 transition-all"
                                                        title="Descargar imagen de esta página"
                                                    >
                                                        <Download size={10} /> Imagen
                                                    </button>
                                                ) : null;
                                            })()}
                                        </div>
                                        {/* Size picker */}
                                        <select
                                            value={bookPdfSize}
                                            onChange={e => setBookPdfSize(e.target.value)}
                                            title="Tamaño de página KDP"
                                            className="h-7 rounded-full bg-white/[0.07] border border-white/10 px-2.5 text-[10px] font-black text-amber-400 outline-none [color-scheme:dark] cursor-pointer hover:bg-white/10 transition-all"
                                        >
                                            {KDP_BOOK_SIZES.map(s => (
                                                <option key={s.id} value={s.id}>{s.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {bookPages.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-30">
                                            <FileText size={44} className="text-neutral-600" strokeWidth={1} />
                                            <p className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest">Sin páginas</p>
                                        </div>
                                    ) : bookPreviewMode === "single" ? (
                                        /* ── Focused single-page reader ── */
                                        <div className="flex-1 flex flex-col min-h-0">
                                            {/* Page viewport */}
                                            <div className="flex-1 flex items-center justify-center px-3 py-3 gap-2 min-h-0">
                                                {/* Prev */}
                                                <button
                                                    onClick={() => curIdx > 0 && setSelectedPageId(bookPages[curIdx - 1].id)}
                                                    disabled={curIdx === 0}
                                                    className="shrink-0 w-9 h-9 rounded-full bg-white/[0.07] border border-white/10 text-neutral-400 hover:text-white hover:bg-white/15 disabled:opacity-20 flex items-center justify-center transition-all">
                                                    <ChevronLeft size={16} />
                                                </button>

                                                {/* A4 page — width from viewport calc, height from aspect-ratio */}
                                                <div className="flex-1 flex items-center justify-center min-w-0">
                                                    <div
                                                        className="relative overflow-hidden rounded-xl shadow-[0_16px_64px_rgba(0,0,0,0.8)] transition-all group"
                                                        style={{ aspectRatio: `${previewW}/${previewH}`, width: `min(100%, calc((min(90vh, 100dvh) - 280px) * ${previewW} / ${previewH}))`, height: "auto" }}
                                                    >
                                                        {curPage && renderPageInner(curPage, 0.5)}
                                                        {/* Overlay actions */}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all pointer-events-none group-hover:pointer-events-auto">
                                                            {/* Edit hint — center */}
                                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                                                onClick={() => { setBookEditorTab("editor"); setShowInlineImagePicker(false); }}>
                                                                <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-white/20">
                                                                    Editar página
                                                                </span>
                                                            </div>
                                                            {/* Download — bottom-right, only when page has image */}
                                                            {curPage?.image?.url && (
                                                                <button
                                                                    onClick={e => {
                                                                        e.stopPropagation();
                                                                        const url = curPage.image!.url;
                                                                        const name = url.startsWith("blob:")
                                                                            ? `pagina-${curIdx + 1}`
                                                                            : (url.split("/").pop()?.split("?")[0] ?? `pagina-${curIdx + 1}`);
                                                                        downloadPng(url, name);
                                                                    }}
                                                                    className="absolute bottom-2 right-2 w-8 h-8 rounded-xl bg-black/70 backdrop-blur-sm border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white/20 flex items-center justify-center"
                                                                    title="Descargar imagen"
                                                                >
                                                                    <Download size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Next */}
                                                <button
                                                    onClick={() => curIdx < bookPages.length - 1 && setSelectedPageId(bookPages[curIdx + 1].id)}
                                                    disabled={curIdx === bookPages.length - 1}
                                                    className="shrink-0 w-9 h-9 rounded-full bg-white/[0.07] border border-white/10 text-neutral-400 hover:text-white hover:bg-white/15 disabled:opacity-20 flex items-center justify-center transition-all">
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>

                                            {/* Page counter + thumbnail strip */}
                                            <div className="shrink-0 pb-3 pt-1 flex flex-col items-center gap-2.5 border-t border-white/[0.05]">
                                                <span className="text-[10px] font-medium text-neutral-600 tabular-nums pt-2">
                                                    {curIdx + 1} / {bookPages.length}
                                                </span>
                                                {/* Thumbnail filmstrip */}
                                                <div className="w-full px-4 overflow-x-auto no-scrollbar">
                                                    <div className="flex gap-2 justify-center min-w-max mx-auto">
                                                        {bookPages.map((page, idx) => {
                                                            const isActive = idx === curIdx;
                                                            const brd = page.image?.border;
                                                            return (
                                                                <button
                                                                    key={page.id}
                                                                    onClick={() => setSelectedPageId(page.id)}
                                                                    className={`shrink-0 w-10 relative rounded-md overflow-hidden transition-all ${isActive ? "ring-2 ring-amber-500 ring-offset-1 ring-offset-[#0f0f11] scale-105" : "opacity-50 hover:opacity-80"}`}
                                                                    style={{ aspectRatio: `${previewW}/${previewH}` }}
                                                                >
                                                                    <div className="w-full h-full bg-white relative"
                                                                        style={brd ? { boxShadow: `inset 0 0 0 1px ${brd.color}` } : {}}>
                                                                        {page.image
                                                                            ? <img src={page.image.url} alt="" className="w-full h-full object-contain" />
                                                                            : <div className="w-full h-full flex items-center justify-center"><FileText size={8} className="text-neutral-300" /></div>
                                                                        }
                                                                    </div>
                                                                    <span className="absolute bottom-0 inset-x-0 text-center text-[6px] font-mono text-white bg-black/50 leading-[1.6]">{idx + 1}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── Spread (double page) view ── */
                                        <div className="flex-1 overflow-y-auto px-3 py-5 space-y-8">
                                            {Array.from({ length: Math.ceil(bookPages.length / 2) }).map((_, spreadIdx) => {
                                                const left = bookPages[spreadIdx * 2];
                                                const right = bookPages[spreadIdx * 2 + 1];
                                                const renderSpreadPage = (page: BookPage | undefined, absIdx: number) => {
                                                    if (!page) return (
                                                        <div className="flex-1 bg-white/[0.03] rounded-lg border border-dashed border-white/8 flex items-center justify-center" style={{ aspectRatio: `${previewW}/${previewH}` }}>
                                                            <span className="text-[8px] text-neutral-700">—</span>
                                                        </div>
                                                    );
                                                    return (
                                                        <div className="flex-1 cursor-pointer group">
                                                            <div className="w-full relative overflow-hidden rounded-l-sm rounded-r-sm shadow-[0_4px_20px_rgba(0,0,0,0.5)] group-hover:shadow-[0_4px_28px_rgba(0,0,0,0.7)] transition-shadow"
                                                                style={{ aspectRatio: `${previewW}/${previewH}` }}
                                                                onClick={() => { setSelectedPageId(page.id); setBookEditorTab("editor"); }}>
                                                                {renderPageInner(page, 0.3)}
                                                                {page.image?.url && (
                                                                    <button
                                                                        onClick={e => {
                                                                            e.stopPropagation();
                                                                            const url = page.image!.url;
                                                                            const name = url.startsWith("blob:")
                                                                                ? `pagina-${absIdx + 1}`
                                                                                : (url.split("/").pop()?.split("?")[0] ?? `pagina-${absIdx + 1}`);
                                                                            downloadPng(url, name);
                                                                        }}
                                                                        className="absolute bottom-1 right-1 w-6 h-6 rounded-lg bg-black/70 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white/20 flex items-center justify-center"
                                                                        title="Descargar imagen"
                                                                    >
                                                                        <Download size={10} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <p className="text-[8px] font-mono text-neutral-700 text-center mt-1.5">{absIdx + 1}</p>
                                                        </div>
                                                    );
                                                };
                                                return (
                                                    <div key={spreadIdx} className="w-full max-w-sm mx-auto">
                                                        <p className="text-[9px] font-medium text-neutral-700 text-center mb-2 tracking-widest uppercase">
                                                            {spreadIdx * 2 + 1}{right ? ` · ${spreadIdx * 2 + 2}` : ""}
                                                        </p>
                                                        <div className="flex rounded-sm overflow-hidden shadow-[0_8px_48px_rgba(0,0,0,0.7)]">
                                                            <div className="flex-1">{renderSpreadPage(left, spreadIdx * 2)}</div>
                                                            {/* Spine */}
                                                            <div className="w-[2px] bg-gradient-to-b from-black/60 via-black/20 to-black/60 shrink-0" />
                                                            <div className="flex-1">{renderSpreadPage(right, spreadIdx * 2 + 1)}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                    </div>
                </div>
            )}

            {/* ── Integration modal ── */}
            {showIntegrationModal && (() => {
                const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
                    { value: "active", label: "Activo",       color: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" },
                    { value: "dev",    label: "En desarrollo", color: "bg-amber-500/15 border-amber-500/30 text-amber-400" },
                    { value: "paused", label: "Pausado",       color: "bg-neutral-500/15 border-neutral-500/30 text-neutral-500" },
                    { value: "study",  label: "En estudio",    color: "bg-sky-500/15 border-sky-500/30 text-sky-400" },
                ];
                const STATUS_LABELS: Record<string, string> = { active: "Activo", dev: "En desarrollo", paused: "Pausado", study: "En estudio" };
                return (
                    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) { setShowIntegrationModal(false); setEditingIntegration(null); setIntegrationDraft({}); } }}>
                        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a0a0b] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="h-px w-full bg-gradient-to-r from-indigo-500/80 via-violet-400/40 to-transparent" />
                            <div className="px-6 pt-5 pb-2 flex items-center justify-between">
                                <div>
                                    <p className="text-[13px] font-black text-white">{editingIntegration ? "Editar integración" : "Nueva integración"}</p>
                                    <p className="text-[10px] text-neutral-600 mt-0.5">Añade un marketplace o plataforma a tu hoja de ruta</p>
                                </div>
                                <button onClick={() => { setShowIntegrationModal(false); setEditingIntegration(null); setIntegrationDraft({}); }} className="w-7 h-7 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white transition-all"><X size={13} /></button>
                            </div>
                            <div className="px-6 py-4 space-y-4">
                                {/* Icon + Name */}
                                <div className="flex gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Icono</label>
                                        <input
                                            type="text"
                                            value={integrationDraft.icon ?? "🔗"}
                                            onChange={e => setIntegrationDraft(d => ({ ...d, icon: e.target.value }))}
                                            className="w-14 h-10 text-center text-xl bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Nombre <span className="text-rose-500">*</span></label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Printful, Redbubble…"
                                            value={integrationDraft.name ?? ""}
                                            onChange={e => setIntegrationDraft(d => ({ ...d, name: e.target.value }))}
                                            className="h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-[12px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                </div>
                                {/* Status */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Estado</label>
                                    <div className="flex flex-wrap gap-2">
                                        {STATUS_OPTIONS.map(opt => (
                                            <button key={opt.value} onClick={() => setIntegrationDraft(d => ({ ...d, status: opt.value as any, statusLabel: STATUS_LABELS[opt.value] }))}
                                                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border transition-all ${integrationDraft.status === opt.value ? opt.color : "bg-white/5 border-white/10 text-neutral-600 hover:text-neutral-400"}`}
                                            >{opt.label}</button>
                                        ))}
                                    </div>
                                </div>
                                {/* Description */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Descripción</label>
                                    <input
                                        type="text"
                                        placeholder="Breve descripción de la integración"
                                        value={integrationDraft.desc ?? ""}
                                        onChange={e => setIntegrationDraft(d => ({ ...d, desc: e.target.value }))}
                                        className="h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-[12px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-indigo-500/50"
                                    />
                                </div>
                                {/* URL */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">URL <span className="text-neutral-700">(opcional)</span></label>
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={integrationDraft.url ?? ""}
                                        onChange={e => setIntegrationDraft(d => ({ ...d, url: e.target.value }))}
                                        className="h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-[12px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-indigo-500/50"
                                    />
                                </div>
                            </div>
                            <div className="px-6 pb-5 flex gap-2 justify-end">
                                <button onClick={() => { setShowIntegrationModal(false); setEditingIntegration(null); setIntegrationDraft({}); }} className="h-9 px-4 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-white transition-all">
                                    Cancelar
                                </button>
                                <button onClick={handleSaveIntegration} disabled={isSavingIntegration || !integrationDraft.name?.trim()} className="h-9 px-5 rounded-xl bg-indigo-600 border border-indigo-500/60 text-[10px] font-black uppercase tracking-wider text-white hover:bg-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                                    {isSavingIntegration && <Loader2 size={11} className="animate-spin" />}
                                    {editingIntegration ? "Guardar" : "Añadir"}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Confirm modals (generic) ── */}
            <ConfirmModal
                open={!!confirmDeleteIntegrationId}
                onClose={() => setConfirmDeleteIntegrationId(null)}
                onConfirm={() => { if (confirmDeleteIntegrationId) { handleDeleteIntegration(confirmDeleteIntegrationId); setConfirmDeleteIntegrationId(null); } }}
                title="¿Eliminar integración?"
                description={<>Se eliminará <span className="text-white font-bold">{integrations.find(i => i.id === confirmDeleteIntegrationId)?.name ?? "esta integración"}</span>. Esta acción no se puede deshacer.</>}
                confirmLabel="Eliminar"
                variant="danger"
                icon={<Trash2 size={24} className="text-red-400" />}
            />
            <ConfirmModal
                open={!!confirmDeleteProductId}
                onClose={() => setConfirmDeleteProductId(null)}
                onConfirm={() => { if (confirmDeleteProductId) { handleDeleteProduct(confirmDeleteProductId); setConfirmDeleteProductId(null); } }}
                title="¿Eliminar producto?"
                description={<>Se eliminará <span className="text-white font-bold">{products.find(p => p.id === confirmDeleteProductId)?.title ?? "este producto"}</span> de tu biblioteca. Esta acción no se puede deshacer.</>}
                confirmLabel="Eliminar"
                variant="danger"
                icon={<Trash2 size={24} className="text-red-400" />}
            />
            <ConfirmModal
                open={!!confirmDeleteCatalogId}
                onClose={() => setConfirmDeleteCatalogId(null)}
                onConfirm={() => { if (confirmDeleteCatalogId) void deleteCatalogConfirmed(confirmDeleteCatalogId); }}
                title="¿Eliminar catálogo?"
                description="Se eliminarán todas las imágenes de Cloudinary. Esta acción no se puede deshacer."
                confirmLabel="Eliminar"
                variant="danger"
                icon={<Trash2 size={24} className="text-red-400" />}
            />
            <ConfirmModal
                open={!!confirmStopCatalogId}
                onClose={() => setConfirmStopCatalogId(null)}
                onConfirm={() => { if (confirmStopCatalogId) { void cancelCatalog(confirmStopCatalogId); setConfirmStopCatalogId(null); } }}
                title="¿Detener generación?"
                description="Se cancelará el catálogo en curso. Las imágenes ya generadas se conservarán."
                confirmLabel="Detener"
                cancelLabel="Seguir generando"
                variant="stop"
                icon={<StopCircle size={24} className="text-orange-400" />}
            />
            <ConfirmModal
                open={!!confirmDeleteDraftId}
                onClose={() => setConfirmDeleteDraftId(null)}
                onConfirm={() => { if (confirmDeleteDraftId) { void deleteBookDraft(confirmDeleteDraftId); setConfirmDeleteDraftId(null); } }}
                title="¿Eliminar borrador?"
                description={<>Se eliminará el borrador <span className="text-white font-bold">"{bookDrafts.find(d => d.id === confirmDeleteDraftId)?.fileName || "libro-kdp"}"</span> y todas sus páginas.</>}
                confirmLabel="Eliminar"
                variant="danger"
                icon={<Trash2 size={24} className="text-red-400" />}
            />
            <ConfirmModal
                open={!!confirmDeleteImageInfo}
                onClose={() => setConfirmDeleteImageInfo(null)}
                onConfirm={() => { if (confirmDeleteImageInfo) void deleteCatalogImageConfirmed(confirmDeleteImageInfo.catalogId, confirmDeleteImageInfo.publicId); }}
                title="¿Eliminar imagen?"
                description="Se eliminará de Cloudinary y del catálogo permanentemente."
                confirmLabel="Eliminar"
                variant="danger"
                icon={<ImageIcon size={24} className="text-red-400" />}
            />
            <ConfirmModal
                open={confirmDeleteVaultIndex !== null}
                onClose={() => setConfirmDeleteVaultIndex(null)}
                onConfirm={() => { if (confirmDeleteVaultIndex !== null) { setVaultImages(prev => prev.filter((_, i) => i !== confirmDeleteVaultIndex)); setConfirmDeleteVaultIndex(null); closePreview(); } }}
                title="¿Eliminar del vault?"
                description="La imagen se eliminará de la sesión actual."
                confirmLabel="Eliminar"
                variant="danger"
                icon={<Trash2 size={24} className="text-red-400" />}
            />

            {/* Save Prompt Dialog */}
            {showSavePromptDialog && (
                <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" role="dialog" aria-modal="true" onClick={() => setShowSavePromptDialog(false)}>
                    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0f0f0f] p-8 space-y-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="space-y-1">
                            <p className="text-base font-black text-white">Guardar prompt</p>
                            <p className="text-sm text-neutral-500">Se guardará el prompt actual con todos sus campos.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Nombre</label>
                                <input
                                    value={savePromptName}
                                    onChange={e => setSavePromptName(e.target.value)}
                                    placeholder="Ej: Mandalas florales pastel"
                                    className="w-full h-11 rounded-2xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-sky-500/40 transition-all placeholder:text-neutral-700"
                                    autoFocus
                                    onKeyDown={e => { if (e.key === "Enter") void saveCurrentPrompt(); }}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Categoría</label>
                                <KdpSelect accent="white"
                                    value={savePromptCategory}
                                    onChange={setSavePromptCategory}
                                    options={[
                                        ...Array.from(new Set([...DEFAULT_PROMPT_CATEGORIES, ...savedPrompts.map(p => p.category)])).map(cat => ({ value: cat, label: cat })),
                                        { value: "__new__", label: "+ Nueva categoría..." },
                                    ]} />
                                {savePromptCategory === "__new__" && (
                                    <div className="flex gap-2">
                                        <input
                                            value={newCategoryInput}
                                            onChange={e => setNewCategoryInput(e.target.value)}
                                            placeholder="Nombre de la nueva categoría"
                                            className="flex-1 h-9 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:border-sky-500/40 transition-all placeholder:text-neutral-700"
                                            autoFocus
                                            onKeyDown={e => {
                                                if (e.key === "Enter" && newCategoryInput.trim()) {
                                                    setSavePromptCategory(newCategoryInput.trim());
                                                    setNewCategoryInput("");
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => { if (newCategoryInput.trim()) { setSavePromptCategory(newCategoryInput.trim()); setNewCategoryInput(""); } }}
                                            className="h-9 px-3 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-[9px] font-black uppercase hover:bg-sky-500/30 transition-all"
                                        >
                                            Crear
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-3 space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Preview del prompt</p>
                                <p className="text-[10px] text-neutral-400 line-clamp-3 font-medium">{promptTheme}{promptSpecs ? ` · ${promptSpecs}` : ""}{promptDetails ? ` · ${promptDetails}` : ""}</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowSavePromptDialog(false)} className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all">Cancelar</button>
                            <button
                                onClick={() => void saveCurrentPrompt()}
                                disabled={isSavingPrompt || !savePromptName.trim()}
                                className="flex-1 h-11 rounded-2xl bg-sky-600 text-white text-sm font-black hover:bg-sky-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSavingPrompt ? <Loader2 size={14} className="animate-spin" /> : <BookMarked size={14} />}
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Niche Form Modal */}
            {nicheFormOpen && (
                <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d0d0d] shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8 shrink-0">
                            <p className="text-base font-black text-white">{nicheEditTarget ? "Editar nicho" : "Nuevo nicho"}</p>
                            <button onClick={() => setNicheFormOpen(false)} className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-white/10 transition-all"><X size={16} /></button>
                        </div>
                        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                            {/* Name */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Nombre *</label>
                                <input value={nicheFormName} onChange={e => setNicheFormName(e.target.value)} placeholder="Ej: Mandalas zen para adultos"
                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/40 transition-all" />
                            </div>
                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Descripción</label>
                                <textarea value={nicheFormDesc} onChange={e => setNicheFormDesc(e.target.value)} rows={2} placeholder="Describe brevemente el nicho…"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/40 transition-all resize-none" />
                            </div>
                            {/* Status */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Estado</label>
                                <div className="flex gap-2 flex-wrap">
                                    {(["found", "research", "active", "archived"] as const).map(s => (
                                        <button key={s} onClick={() => setNicheFormStatus(s)}
                                            className={`flex-1 h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${nicheFormStatus === s ? `${STATUS_LABELS[s].color} ring-1 ring-current/20` : "border-white/10 bg-white/5 text-neutral-600 hover:text-white"}`}>
                                            {STATUS_LABELS[s].label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Product Type */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Tipo de producto</label>
                                <div className="flex gap-2">
                                    {NICHE_PRODUCT_OPTIONS.map(opt => (
                                        <button key={opt.id} onClick={() => setNicheFormProductType(opt.id)}
                                            className={`flex-1 h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${nicheFormProductType === opt.id ? "border-sky-500/40 bg-sky-500/10 text-sky-400 ring-1 ring-violet-500/20" : "border-white/10 bg-white/5 text-neutral-600 hover:text-white"}`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Style Category — multi-select */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Estilo visual</label>
                                    {nicheFormStyles.length > 1 && (
                                        <span className="text-[9px] font-black text-sky-400">{nicheFormStyles.length} seleccionados</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {NICHE_STYLE_OPTIONS.map(opt => {
                                        const active = nicheFormStyles.includes(opt.id);
                                        return (
                                            <button key={opt.id} onClick={() => {
                                                setNicheFormStyles(prev => {
                                                    if (prev.includes(opt.id)) {
                                                        const next = prev.filter(s => s !== opt.id);
                                                        return next.length === 0 ? [opt.id] : next;
                                                    }
                                                    return [...prev, opt.id];
                                                });
                                            }}
                                                className={`h-10 rounded-xl border px-3 text-left transition-all flex items-start gap-2 ${active ? "border-sky-500/40 bg-sky-500/10 ring-1 ring-violet-500/20" : "border-white/8 bg-white/[0.02] hover:bg-white/5"}`}>
                                                <div className={`mt-1.5 w-3 h-3 rounded-sm border-2 flex items-center justify-center shrink-0 transition-all ${active ? "bg-sky-500 border-violet-500" : "border-neutral-600"}`}>
                                                    {active && <Check size={8} className="text-white" strokeWidth={3} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <span className={`block text-[9px] font-black uppercase tracking-widest ${active ? "text-sky-400" : "text-neutral-400"}`}>{opt.label}</span>
                                                    <span className="block text-[8px] text-neutral-600 leading-tight">{opt.desc}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {/* Competition + Demand */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Competencia</label>
                                    <div className="flex flex-col gap-1">
                                        {(["unknown", "low", "medium", "high"] as const).map(v => (
                                            <button key={v} onClick={() => setNicheFormComp(v)}
                                                className={`h-8 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${nicheFormComp === v ? `${COMPETITION_LABELS[v].color}` : "border-white/8 bg-white/[0.02] text-neutral-700 hover:text-neutral-400"}`}>
                                                {COMPETITION_LABELS[v].label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Demanda</label>
                                    <div className="flex flex-col gap-1">
                                        {(["unknown", "low", "medium", "high"] as const).map(v => (
                                            <button key={v} onClick={() => setNicheFormDemand(v)}
                                                className={`h-8 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${nicheFormDemand === v ? `${DEMAND_LABELS[v].color}` : "border-white/8 bg-white/[0.02] text-neutral-700 hover:text-neutral-400"}`}>
                                                {DEMAND_LABELS[v].label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {/* Tags */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Tags <span className="normal-case text-neutral-600">(separados por coma)</span></label>
                                <input value={nicheFormTags} onChange={e => setNicheFormTags(e.target.value)} placeholder="mandala, zen, adultos, colorear…"
                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/40 transition-all" />
                                {nicheFormTags.trim() && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {nicheFormTags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                                            <span key={tag} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-[8px] text-neutral-400">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Etsy URL */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Enlace Etsy <span className="normal-case text-neutral-600">(opcional)</span></label>
                                <input value={nicheFormEtsyUrl} onChange={e => setNicheFormEtsyUrl(e.target.value)} placeholder="https://www.etsy.com/listing/..."
                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/40 transition-all" />
                                {nicheFormEtsyUrl.trim() && (
                                    <a href={nicheFormEtsyUrl.trim()} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[9px] text-sky-400 hover:text-sky-300 transition-colors">
                                        <ExternalLink size={9} /> Ver en Etsy
                                    </a>
                                )}
                            </div>
                            {/* Notes */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Notas</label>
                                <textarea value={nicheFormNotes} onChange={e => setNicheFormNotes(e.target.value)} rows={3} placeholder="Observaciones, ideas, URLs de referencia…"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/40 transition-all resize-none" />
                            </div>
                            {/* Generated Prompt */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                                    Prompt generado <span className="normal-case text-neutral-600">(guardado automáticamente al generar contenido)</span>
                                </label>
                                <textarea value={nicheFormPrompt} onChange={e => setNicheFormPrompt(e.target.value)} rows={4} placeholder="El prompt de imagen se guardará aquí al usar Generar contenido…"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] text-neutral-300 placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/40 transition-all resize-none font-mono leading-relaxed" />
                                {nicheFormPrompt.trim() && (
                                    <button
                                        onClick={() => { setPromptTheme(nicheFormPrompt.trim()); changeTab("creation"); setNicheFormOpen(false); toast.success("Prompt aplicado al generador"); }}
                                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[9px] font-black uppercase tracking-widest hover:bg-sky-500 hover:text-white hover:border-violet-500 transition-all">
                                        <ArrowRight size={10} /> Aplicar en generador
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="px-6 pb-6 pt-4 border-t border-white/8 shrink-0 flex gap-3">
                            <button onClick={() => setNicheFormOpen(false)} className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all">Cancelar</button>
                            <button onClick={() => void saveNiche()} disabled={isSavingNiche || !nicheFormName.trim()}
                                className="flex-1 h-11 rounded-2xl bg-sky-500 text-white text-sm font-black hover:bg-sky-400 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                                {isSavingNiche ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {nicheEditTarget ? "Guardar cambios" : "Crear nicho"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Niche Delete Confirm */}
            {nicheDeleteId && (
                <div className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" role="dialog" aria-modal="true">
                    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0f0f0f] p-8 space-y-6 shadow-2xl">
                        <div className="space-y-2 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto"><Target size={24} className="text-red-400" /></div>
                            <p className="text-base font-black text-white">¿Eliminar nicho?</p>
                            <p className="text-sm text-neutral-500">Esta acción no se puede deshacer.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setNicheDeleteId(null)} className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all">Cancelar</button>
                            <button onClick={() => void deleteNiche(nicheDeleteId)} className="flex-1 h-11 rounded-2xl bg-red-500 text-white text-sm font-black hover:bg-red-400 transition-all">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* KDP Template Source Selector */}
            {kdpTemplateOpen && (
                <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0d0d0d] shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8 shrink-0">
                            <div className="space-y-0.5">
                                <p className="text-base font-black text-white">Plantilla KDP — Seleccionar fuentes</p>
                                <p className="text-[10px] text-neutral-500">Elige qué imágenes incluir en la plantilla de libro de colorear</p>
                            </div>
                            <button onClick={() => setKdpTemplateOpen(false)} className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-white/10 transition-all"><X size={16} /></button>
                        </div>

                        {/* Body — scrollable */}
                        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
                            {/* Title input */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Título del libro</label>
                                <input
                                    value={kdpTemplateTitle}
                                    onChange={e => setKdpTemplateTitle(e.target.value)}
                                    placeholder="Mi Libro de Colorear"
                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-sky-500/40 transition-all"
                                />
                            </div>

                            {/* Vault images */}
                            {vaultImages.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Vault ({vaultImages.length} imágenes)</p>
                                        <button
                                            onClick={() => {
                                                const allSelected = vaultImages.every((_, i) => kdpTemplateVaultSel.has(i));
                                                setKdpTemplateVaultSel(allSelected ? new Set() : new Set(vaultImages.map((_, i) => i)));
                                            }}
                                            className="text-[9px] font-black uppercase tracking-widest text-sky-400 hover:text-sky-300 transition-colors"
                                        >
                                            {vaultImages.every((_, i) => kdpTemplateVaultSel.has(i)) ? "Deseleccionar todo" : "Seleccionar todo"}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                                        {vaultImages.map((img, i) => {
                                            const sel = kdpTemplateVaultSel.has(i);
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => setKdpTemplateVaultSel(prev => {
                                                        const next = new Set(prev);
                                                        sel ? next.delete(i) : next.add(i);
                                                        return next;
                                                    })}
                                                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${sel ? "border-violet-500 ring-1 ring-sky-500/50" : "border-white/10 opacity-40 hover:opacity-70"}`}
                                                >
                                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                                    {sel && (
                                                        <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center">
                                                            <Check size={9} className="text-white" strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Cloudinary — Almacén Persistente */}
                            {cloudinaryImages.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Almacén Cloudinary ({cloudinaryImages.length} imágenes)</p>
                                        <button
                                            onClick={() => {
                                                const allSel = cloudinaryImages.every((_, i) => kdpTemplateCloudSel.has(i));
                                                setKdpTemplateCloudSel(allSel ? new Set() : new Set(cloudinaryImages.map((_, i) => i)));
                                            }}
                                            className="text-[9px] font-black uppercase tracking-widest text-sky-400 hover:text-sky-300 transition-colors"
                                        >
                                            {cloudinaryImages.every((_, i) => kdpTemplateCloudSel.has(i)) ? "Deseleccionar todo" : "Seleccionar todo"}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                                        {cloudinaryImages.map((img, i) => {
                                            const sel = kdpTemplateCloudSel.has(i);
                                            return (
                                                <button
                                                    key={img.publicId}
                                                    onClick={() => setKdpTemplateCloudSel(prev => {
                                                        const next = new Set(prev);
                                                        sel ? next.delete(i) : next.add(i);
                                                        return next;
                                                    })}
                                                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${sel ? "border-violet-500 ring-1 ring-sky-500/50" : "border-white/10 opacity-40 hover:opacity-70"}`}
                                                    title={img.publicId.split("/").pop()}
                                                >
                                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                                    {sel && (
                                                        <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center">
                                                            <Check size={9} className="text-white" strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── Añadir nicho entero de golpe ── */}
                            {niches.length > 0 && iaCatalogs.some(c => c.images.length > 0 && (c.nicheIds?.length ?? 0) > 0) && (
                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="h-px flex-1 bg-white/8" />
                                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                                            <Target size={10} className="text-sky-400" /> Añadir nicho entero
                                        </p>
                                        <div className="h-px flex-1 bg-white/8" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {niches.filter(n => iaCatalogs.some(c => c.images.length > 0 && (c.nicheIds ?? []).includes(n._id))).map(n => {
                                            const nicheCats = iaCatalogs.filter(c => c.images.length > 0 && (c.nicheIds ?? []).includes(n._id));
                                            const nicheImgs = nicheCats.reduce((s, c) => s + c.images.length, 0);
                                            const allSel = nicheCats.every(c => kdpTemplateCatalogSel.has(c._id));
                                            const someSel = nicheCats.some(c => kdpTemplateCatalogSel.has(c._id));
                                            return (
                                                <button key={n._id}
                                                    onClick={() => {
                                                        setKdpTemplateCatalogSel(prev => {
                                                            const next = new Set(prev);
                                                            if (allSel) nicheCats.forEach(c => next.delete(c._id));
                                                            else nicheCats.forEach(c => next.add(c._id));
                                                            return next;
                                                        });
                                                    }}
                                                    className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 transition-all text-left ${allSel ? "border-violet-500/60 bg-sky-500/10" : someSel ? "border-sky-500/30 bg-sky-500/5" : "border-white/8 bg-white/[0.02] hover:border-white/15"}`}>
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${allSel ? "bg-sky-500" : "bg-white/5"}`}>
                                                        {allSel ? <Check size={14} className="text-white" strokeWidth={3} /> : <Target size={14} className="text-neutral-500" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-[11px] font-black truncate ${allSel ? "text-sky-300" : "text-neutral-300"}`}>{n.name}</p>
                                                        <p className="text-[9px] text-neutral-600">{nicheCats.length} cat. · {nicheImgs} imgs completadas</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Completed catalogs */}
                            {iaCatalogs.filter(c => c.images.length > 0).length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Catálogos con imágenes</p>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {niches.length > 0 && (
                                                <>
                                                    <button onClick={() => setKdpTemplateNicheFilter(null)}
                                                        className={`px-2 h-5 rounded-full border text-[8px] font-black uppercase transition-all ${!kdpTemplateNicheFilter ? "bg-sky-500/20 border-sky-500/40 text-sky-300" : "border-white/10 text-neutral-700 hover:text-neutral-400"}`}>
                                                        Todos
                                                    </button>
                                                    {niches.map(n => (
                                                        <button key={n._id} onClick={() => setKdpTemplateNicheFilter(kdpTemplateNicheFilter === n._id ? null : n._id)}
                                                            className={`px-2 h-5 rounded-full border text-[8px] font-bold transition-all truncate max-w-[100px] ${kdpTemplateNicheFilter === n._id ? "bg-sky-500/20 border-sky-500/40 text-sky-300" : "border-white/10 text-neutral-700 hover:text-neutral-400"}`}>
                                                            {n.name}
                                                        </button>
                                                    ))}
                                                </>
                                            )}
                                            <button
                                                onClick={() => {
                                                    const completed = iaCatalogs.filter(c => c.images.length > 0 && (!kdpTemplateNicheFilter || (c.nicheIds ?? []).includes(kdpTemplateNicheFilter)));
                                                    const allSel = completed.every(c => kdpTemplateCatalogSel.has(c._id));
                                                    setKdpTemplateCatalogSel(allSel ? new Set() : new Set(completed.map(c => c._id)));
                                                }}
                                                className="text-[9px] font-black uppercase tracking-widest text-sky-400 hover:text-sky-300 transition-colors"
                                            >
                                                Sel. todo
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {iaCatalogs.filter(c => c.images.length > 0 && (!kdpTemplateNicheFilter || (c.nicheIds ?? []).includes(kdpTemplateNicheFilter))).map(catalog => {
                                            const sel = kdpTemplateCatalogSel.has(catalog._id);
                                            return (
                                                <button
                                                    key={catalog._id}
                                                    onClick={() => setKdpTemplateCatalogSel(prev => {
                                                        const next = new Set(prev);
                                                        sel ? next.delete(catalog._id) : next.add(catalog._id);
                                                        return next;
                                                    })}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${sel ? "border-violet-500/60 bg-sky-500/8" : "border-white/8 bg-white/[0.02] opacity-50 hover:opacity-80"}`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${sel ? "bg-sky-500 border-violet-500" : "border-white/20 bg-white/5"}`}>
                                                        {sel && <Check size={10} className="text-white" strokeWidth={3} />}
                                                    </div>
                                                    {/* Thumbnail strip */}
                                                    <div className="flex gap-1 shrink-0">
                                                        {catalog.images.slice(0, 4).map((img, i) => (
                                                            <img key={i} src={img.url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                                        ))}
                                                        {catalog.images.length > 4 && (
                                                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[8px] font-black text-neutral-400">+{catalog.images.length - 4}</div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-black text-white truncate">{catalog.name}</p>
                                                        <p className="text-[9px] text-neutral-500">{catalog.images.length} imágenes</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 pt-4 border-t border-white/8 shrink-0 space-y-3">
                            {/* Random order toggle */}
                            <button
                                onClick={() => setKdpTemplateRandom(v => !v)}
                                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border transition-all ${kdpTemplateRandom ? "border-sky-500/40 bg-sky-500/8" : "border-white/8 bg-white/[0.02] hover:border-white/12"}`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <RefreshCw size={13} className={kdpTemplateRandom ? "text-sky-400" : "text-neutral-600"} />
                                    <div className="text-left">
                                        <p className={`text-[10px] font-black ${kdpTemplateRandom ? "text-sky-300" : "text-neutral-400"}`}>Orden aleatorio</p>
                                        <p className="text-[9px] text-neutral-600">Mezcla las imágenes aleatoriamente antes de añadirlas al libro</p>
                                    </div>
                                </div>
                                <div className={`w-8 h-4 rounded-full transition-all relative ${kdpTemplateRandom ? "bg-sky-500" : "bg-white/10"}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${kdpTemplateRandom ? "left-4" : "left-0.5"}`} />
                                </div>
                            </button>
                            {/* Owner page toggle */}
                            <button
                                onClick={() => {
                                    const next = !includeOwnerPage;
                                    setIncludeOwnerPage(next);
                                    if (next) {
                                        setBookPages(prev => prev[0]?.type === "owner" ? prev : [{ id: genPageId(), type: "owner", text: defaultTextStyle() }, ...prev]);
                                    } else {
                                        setBookPages(prev => prev.filter(p => p.type !== "owner"));
                                    }
                                }}
                                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border transition-all ${includeOwnerPage ? "border-amber-500/40 bg-amber-500/[0.07]" : "border-white/8 bg-white/[0.02] hover:border-white/12"}`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <BookOpen size={13} className={includeOwnerPage ? "text-amber-400" : "text-neutral-600"} />
                                    <div className="text-left">
                                        <p className={`text-[10px] font-black ${includeOwnerPage ? "text-amber-300" : "text-neutral-400"}`}>Primera página: propietario + colores</p>
                                        <p className="text-[9px] text-neutral-600">«Este libro pertenece a» · cuadraditos de prueba · copyright © {new Date().getFullYear()}</p>
                                    </div>
                                </div>
                                <div className={`w-8 h-4 rounded-full transition-all relative ${includeOwnerPage ? "bg-amber-500" : "bg-white/10"}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${includeOwnerPage ? "left-4" : "left-0.5"}`} />
                                </div>
                            </button>
                            {/* No blank pages toggle */}
                            <button
                                onClick={() => setNoBlankPages(v => !v)}
                                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border transition-all ${noBlankPages ? "border-sky-500/40 bg-sky-500/[0.07]" : "border-white/8 bg-white/[0.02] hover:border-white/12"}`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <Layers size={13} className={noBlankPages ? "text-sky-400" : "text-neutral-600"} />
                                    <div className="text-left">
                                        <p className={`text-[10px] font-black ${noBlankPages ? "text-sky-300" : "text-neutral-400"}`}>No añadir páginas en blanco</p>
                                        <p className="text-[9px] text-neutral-600">Solo imágenes, sin página en blanco al reverso de cada una</p>
                                    </div>
                                </div>
                                <div className={`w-8 h-4 rounded-full transition-all relative ${noBlankPages ? "bg-sky-500" : "bg-white/10"}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${noBlankPages ? "left-4" : "left-0.5"}`} />
                                </div>
                            </button>
                            {/* Summary */}
                            {(() => {
                                const vaultCount = kdpTemplateVaultSel.size;
                                const cloudCount = kdpTemplateCloudSel.size;
                                const catalogCount = iaCatalogs
                                    .filter(c => kdpTemplateCatalogSel.has(c._id))
                                    .reduce((acc, c) => acc + c.images.length, 0);
                                const total = vaultCount + cloudCount + catalogCount;
                                const pageTotal = noBlankPages
                                    ? total + 1 + (includeOwnerPage ? 1 : 0)
                                    : total * 2 + 2 + (includeOwnerPage ? 1 : 0);
                                return total > 0 ? (
                                    <p className="text-[10px] text-neutral-500 text-center">
                                        <span className="text-sky-400 font-black">{total}</span> imágenes · <span className="text-neutral-400 font-black">{pageTotal}</span> páginas
                                        {includeOwnerPage ? <span className="text-amber-400"> (+ pág. propietario)</span> : ""}
                                        {noBlankPages ? <span className="text-sky-400"> · sin blancos</span> : ""}
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-amber-400/70 text-center font-black">Selecciona al menos una imagen</p>
                                );
                            })()}
                            <div className="flex gap-3">
                                <button onClick={() => setKdpTemplateOpen(false)} className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all">Cancelar</button>
                                <button
                                    onClick={() => {
                                        const vaultEntries = vaultImages
                                            .filter((_, i) => kdpTemplateVaultSel.has(i))
                                            .map(v => ({ url: v.url, label: v.model || "Vault" }));
                                        const cloudEntries = cloudinaryImages
                                            .filter((_, i) => kdpTemplateCloudSel.has(i))
                                            .map(c => ({ url: c.url, label: c.publicId.split("/").pop() ?? "Cloud" }));
                                        const catalogEntries = iaCatalogs
                                            .filter(c => kdpTemplateCatalogSel.has(c._id))
                                            .flatMap(c => c.images.map((img, i) => ({ url: img.url, label: `${c.name} #${i + 1}` })));
                                        setKdpTemplateOpen(false);
                                        applyColoringBookTemplate(kdpTemplateTitle || "Mi Libro de Colorear", [...vaultEntries, ...cloudEntries, ...catalogEntries], kdpTemplateRandom);
                                    }}
                                    disabled={kdpTemplateVaultSel.size === 0 && kdpTemplateCatalogSel.size === 0 && kdpTemplateCloudSel.size === 0}
                                    className="flex-1 h-11 rounded-2xl bg-amber-500 text-black text-sm font-black hover:bg-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(245,158,11,0.25)]"
                                >
                                    <BookOpen size={16} /> Aplicar plantilla
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* ── ZIP FACTORY PANEL ── */}
            {zipFactoryOpen && (() => {
                const allImages: { url: string; label: string; source: "vault" | "catalog" | "cloudinary" }[] = [
                    ...vaultImages.map(v => ({ url: v.url, label: v.model || "Vault", source: "vault" as const })),
                    ...iaCatalogs.flatMap(c => c.images.map(img => ({ url: img.url, label: c.name, source: "catalog" as const }))),
                    ...cloudinaryImages.map(img => ({ url: img.url, label: img.publicId.split("/").pop() ?? "Cloud", source: "cloudinary" as const })),
                ];
                const filtered = allImages.filter(img => {
                    if (zipSource === "all") return true;
                    if (zipSource === "favorites") return favorites.has(img.url);
                    return img.source === zipSource;
                });
                const allSel = filtered.length > 0 && filtered.every(img => zipSelection.has(img.url));
                return (
                    <div
                        className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
                        onClick={() => setZipFactoryOpen(false)}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div
                            className="relative w-full max-w-4xl h-[100dvh] sm:h-[90vh] rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0a0a0a] overflow-hidden flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="shrink-0 border-b border-white/8">
                                <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-3 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                        <Archive size={15} className="text-emerald-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-neutral-400">Zip Factory</p>
                                        <p className="text-[10px] sm:text-[11px] text-neutral-600">{zipSelection.size} seleccionada{zipSelection.size !== 1 ? "s" : ""} · {allImages.length} total</p>
                                    </div>
                                    {/* ZIP name — desktop */}
                                    <input
                                        value={zipName}
                                        onChange={e => setZipName(e.target.value)}
                                        className="hidden sm:block w-36 h-9 rounded-xl bg-white/5 border border-white/10 px-2.5 text-[11px] text-white outline-none focus:border-emerald-500/40 shrink-0"
                                        placeholder="imagenes-kdp"
                                    />
                                    <button
                                        onClick={() => void downloadZip()}
                                        disabled={zipSelection.size === 0 || isDownloadingZip}
                                        className="h-9 px-3 sm:px-4 rounded-xl bg-emerald-500 text-black font-black text-[10px] sm:text-[11px] uppercase tracking-widest hover:bg-emerald-400 transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
                                    >
                                        {isDownloadingZip ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                        <span className="hidden sm:inline">{isDownloadingZip ? "Generando…" : `Descargar ZIP (${zipSelection.size})`}</span>
                                        <span className="sm:hidden">{isDownloadingZip ? "…" : `ZIP (${zipSelection.size})`}</span>
                                    </button>
                                    <button
                                        onClick={() => setZipFactoryOpen(false)}
                                        className="w-9 h-9 rounded-xl bg-white/5 text-neutral-400 hover:bg-rose-500 hover:text-white transition-all border border-white/10 shrink-0 flex items-center justify-center"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                                {/* ZIP name — mobile */}
                                <div className="sm:hidden px-3 pb-2.5">
                                    <input
                                        value={zipName}
                                        onChange={e => setZipName(e.target.value)}
                                        className="w-full h-9 rounded-xl bg-white/5 border border-white/10 px-3 text-[12px] text-white outline-none focus:border-emerald-500/40"
                                        placeholder="Nombre del ZIP…"
                                    />
                                </div>
                            </div>

                            {/* Source filter tabs */}
                            <div className="shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2.5 border-b border-white/6 overflow-x-auto no-scrollbar bg-black/20">
                                {([
                                    { id: "all", label: "Todo", count: allImages.length },
                                    { id: "vault", label: "Vault", count: vaultImages.length },
                                    { id: "catalogs", label: "Catálogos", count: iaCatalogs.reduce((s, c) => s + c.images.length, 0) },
                                    { id: "cloudinary", label: "Cloud", count: cloudinaryImages.length },
                                    { id: "favorites", label: "❤️", count: [...favorites.values()].filter(f => allImages.some(i => i.url === f.url)).length },
                                ] as const).map(tab => (
                                    <button key={tab.id} onClick={() => setZipSource(tab.id)}
                                        className={`shrink-0 h-7 px-3 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${zipSource === tab.id ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" : "bg-white/[0.03] border border-white/8 text-neutral-500 hover:text-white"}`}>
                                        {tab.label}
                                        {tab.count > 0 && <span className={`text-[9px] tabular-nums ${zipSource === tab.id ? "text-emerald-400/70" : "text-neutral-700"}`}>{tab.count}</span>}
                                    </button>
                                ))}
                                <div className="ml-auto shrink-0 flex items-center gap-1.5">
                                    <button
                                        onClick={() => {
                                            if (allSel) {
                                                setZipSelection(prev => { const next = new Set(prev); filtered.forEach(i => next.delete(i.url)); return next; });
                                            } else {
                                                setZipSelection(prev => { const next = new Set(prev); filtered.forEach(i => next.add(i.url)); return next; });
                                            }
                                        }}
                                        className="h-7 px-3 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black text-neutral-400 hover:text-white transition-all"
                                    >
                                        {allSel ? "Desel. todo" : "Sel. todo"}
                                    </button>
                                    {zipSelection.size > 0 && (
                                        <button onClick={() => setZipSelection(new Set())} className="h-7 px-3 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black text-neutral-500 hover:text-rose-400 transition-all">
                                            Limpiar
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Niche quick-add row */}
                            {niches.length > 0 && (
                                <div className="shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b border-white/6 overflow-x-auto no-scrollbar">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600 shrink-0">Añadir nicho:</span>
                                    {niches.map(n => {
                                        const nicheImgs = iaCatalogs
                                            .filter(c => (c.nicheIds ?? []).includes(n._id))
                                            .flatMap(c => c.images.map(img => img.url));
                                        if (nicheImgs.length === 0) return null;
                                        const allAdded = nicheImgs.every(url => zipSelection.has(url));
                                        return (
                                            <button key={n._id}
                                                onClick={() => setZipSelection(prev => {
                                                    const next = new Set(prev);
                                                    if (allAdded) nicheImgs.forEach(url => next.delete(url));
                                                    else nicheImgs.forEach(url => next.add(url));
                                                    return next;
                                                })}
                                                className={`shrink-0 h-6 px-2.5 rounded-full text-[9px] font-black border transition-all flex items-center gap-1.5 ${allAdded ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-white/[0.03] border-white/8 text-neutral-500 hover:text-white hover:border-white/20"}`}>
                                                {allAdded ? <Check size={9} strokeWidth={3} /> : <Plus size={9} />}
                                                {n.name}
                                                <span className="text-[8px] opacity-60">{nicheImgs.length}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Image grid */}
                            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                                {filtered.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-40">
                                        <Archive size={40} className="text-neutral-700" strokeWidth={1.5} />
                                        <p className="text-[11px] font-black uppercase tracking-widest text-neutral-600">Sin imágenes en esta fuente</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 gap-1.5 sm:gap-2">
                                        {filtered.map(img => {
                                            const isSel = zipSelection.has(img.url);
                                            const isFav = favorites.has(img.url);
                                            return (
                                                <div
                                                    key={img.url}
                                                    onClick={() => setZipSelection(prev => { const next = new Set(prev); isSel ? next.delete(img.url) : next.add(img.url); return next; })}
                                                    className={`aspect-square rounded-xl overflow-hidden relative cursor-pointer group border transition-all ${isSel ? "border-emerald-500/70 ring-2 ring-emerald-500/25" : "border-white/8 hover:border-emerald-500/40"}`}
                                                >
                                                    <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                    <div className={`absolute top-1 right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSel ? "bg-emerald-500 border-emerald-500" : "bg-black/40 border-white/30 opacity-0 group-hover:opacity-100"}`}>
                                                        {isSel && <Check size={9} className="text-black" strokeWidth={3} />}
                                                    </div>
                                                    {isFav && <div className="absolute top-1 left-1 p-0.5 rounded-md bg-rose-500/80"><Heart size={7} className="fill-white text-white" /></div>}
                                                    {isSel && <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />}
                                                    <div className="absolute bottom-0 inset-x-0 py-1 px-1 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <p className="text-[7px] sm:text-[8px] font-bold text-white/70 truncate">{img.label}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Custom Catalog from Cloudinary Modal */}
            {showCustomCatalogModal && (
                <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" role="dialog" aria-modal="true" onClick={() => setShowCustomCatalogModal(false)}>
                    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0f0f0f] p-8 space-y-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="space-y-3 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto">
                                <Layers size={24} className="text-cyan-400" />
                            </div>
                            <p className="text-base font-black text-white">Catálogo Personalizado</p>
                            <p className="text-sm text-neutral-500 leading-relaxed">
                                Se creará un catálogo con <span className="text-white font-bold">{selectedCloudUrls.size} imagen{selectedCloudUrls.size !== 1 ? "es" : ""}</span> de tu almacén Cloudinary.
                            </p>
                        </div>
                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-widest text-neutral-500 mb-2">Nombre del catálogo</label>
                            <input
                                autoFocus
                                value={customCatalogName}
                                onChange={e => setCustomCatalogName(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && customCatalogName.trim()) void createCustomCatalogFromCloud(); }}
                                placeholder="Mi catálogo personalizado…"
                                className="w-full h-11 bg-white/5 border border-white/10 rounded-2xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-cyan-500/40 transition-all"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowCustomCatalogModal(false)} className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all">Cancelar</button>
                            <button
                                onClick={() => void createCustomCatalogFromCloud()}
                                disabled={!customCatalogName.trim() || isCreatingCustomCatalog}
                                className="flex-1 h-11 rounded-2xl bg-cyan-500 text-black text-sm font-black hover:bg-cyan-400 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                                {isCreatingCustomCatalog ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CONTENT GENERATOR MODAL ── */}
            <Modal open={contentGeneratorOpen} onClose={() => setContentGeneratorOpen(false)} maxWidth="max-w-2xl" showClose zIndex={120}>
                <div className="overflow-hidden rounded-3xl">
                    <div className="h-px w-full bg-gradient-to-r from-amber-500/80 via-orange-400/40 to-transparent" />
                    <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="space-y-1">
                            <h2 className="text-xl font-black bg-gradient-to-r from-amber-400 to-orange-300 bg-clip-text text-transparent flex items-center gap-2.5">
                                <Sparkles size={20} className="text-amber-400" /> Generador de Contenido
                            </h2>
                            <p className="text-xs text-neutral-500">Metadatos listos para publicar en KDP y Etsy</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* ── Left: type selector + inputs ── */}
                            <div className="space-y-3">
                                {/* KDP Physical Book — primary card */}
                                <button
                                    onClick={() => { setContentType("kdp-physical-book"); setContentResult(null); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all text-left ${contentType === "kdp-physical-book" ? "border-amber-500/40 bg-amber-500/[0.07]" : "border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.03]"}`}>
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${contentType === "kdp-physical-book" ? "bg-amber-500/20" : "bg-white/5"}`}>
                                        <BookOpen size={16} className={contentType === "kdp-physical-book" ? "text-amber-400" : "text-neutral-600"} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-black leading-tight ${contentType === "kdp-physical-book" ? "text-amber-300" : "text-neutral-400"}`}>Libro físico KDP</p>
                                        <p className="text-[10px] text-neutral-600 mt-0.5">Título · Subtítulo · Descripción · 7 keywords</p>
                                    </div>
                                    {contentType === "kdp-physical-book" && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                                </button>

                                {/* Secondary types */}
                                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                                    {CONTENT_TYPES_SECONDARY.map(ct => (
                                        <button key={ct.id} onClick={() => { setContentType(ct.id as any); setContentResult(null); }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all shrink-0 ${contentType === ct.id ? "border-white/25 bg-white/10 text-white" : "border-white/8 bg-white/[0.02] text-neutral-600 hover:border-white/15 hover:text-neutral-400"}`}>
                                            {ct.icon}
                                            <span className="text-[9px] font-bold whitespace-nowrap">{ct.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Inputs */}
                                {contentType === "kdp-physical-book" ? (
                                    <div className="space-y-3">
                                        <textarea
                                            value={contentNiche} onChange={e => setContentNiche(e.target.value)} rows={3}
                                            placeholder="Describe tu libro: temática, género, público objetivo, estilo visual…&#10;ej: libro de colorear de mandalas zen para adultos, estilo minimalista"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/40 resize-none leading-relaxed transition-all" />
                                        <div className="flex items-center gap-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600 shrink-0">Idioma</p>
                                            <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl">
                                                {(["en", "es"] as const).map(lang => (
                                                    <button key={lang} onClick={() => setContentLanguage(lang)}
                                                        className={`px-4 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${contentLanguage === lang ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}>
                                                        {lang === "en" ? "🇬🇧 EN" : "🇪🇸 ES"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <input value={contentNiche} onChange={e => setContentNiche(e.target.value)}
                                            placeholder="Nicho / Tema — ej: zen mandalas, cats for beginners..."
                                            onKeyDown={e => { if (e.key === "Enter") void generateContent(); }}
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/40 transition-all" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Tipo de producto</p>
                                                <KdpSelect accent="amber" value={contentProductType} onChange={setContentProductType}
                                                    options={CONTENT_PRODUCT_TYPES.map(pt => ({ value: pt, label: pt }))} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Idioma</p>
                                                <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl h-[38px]">
                                                    {(["en", "es"] as const).map(lang => (
                                                        <button key={lang} onClick={() => setContentLanguage(lang)}
                                                            className={`flex-1 rounded-lg text-[10px] font-black uppercase transition-all ${contentLanguage === lang ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}>
                                                            {lang === "en" ? "🇬🇧 EN" : "🇪🇸 ES"}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <textarea value={contentExtras} onChange={e => setContentExtras(e.target.value)} rows={2}
                                            placeholder="Contexto adicional: estilo, audiencia, ocasión... (opcional)"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/40 resize-none transition-all" />
                                    </div>
                                )}

                                {/* Generate button */}
                                <div className="space-y-1.5">
                                    <button onClick={() => void generateContent()} disabled={isGeneratingContent || !contentNiche.trim()}
                                        className="w-full h-11 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500">
                                        {isGeneratingContent ? <><Loader2 size={13} className="animate-spin" /> Generando...</> : <><Sparkles size={13} /> Generar con IA</>}
                                    </button>
                                    <p className="text-center text-[9px] text-neutral-700 flex items-center justify-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 inline-block" />
                                        <span className="font-mono">gemini-2.5-flash</span> · gratuito
                                    </p>
                                </div>
                            </div>

                            {/* ── Right: result ── */}
                            <div className="overflow-y-auto max-h-[60vh]">
                                {isGeneratingContent && (
                                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                                        <Loader2 size={24} className="animate-spin text-amber-400" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Generando con IA...</p>
                                    </div>
                                )}
                                {!contentResult && !isGeneratingContent && (
                                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 opacity-20">
                                        <Wand2 size={24} strokeWidth={1.5} className="text-neutral-600" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">El resultado aparecerá aquí</p>
                                    </div>
                                )}
                                {contentResult && !isGeneratingContent && (
                                    <div className="space-y-2.5 pr-1">
                                        {contentType === "kdp-physical-book" && typeof contentResult === "object" && (
                                            <div className="space-y-2.5">
                                                {(contentResult.title || contentResult.description || contentResult.keywords?.length) && (
                                                    <button onClick={() => { const parts: string[] = []; if (contentResult.title) parts.push(`TÍTULO: ${contentResult.title}${contentResult.subtitle ? `\nSUBTÍTULO: ${contentResult.subtitle}` : ""}`); if (contentResult.description) parts.push(`\nDESCRIPCIÓN:\n${contentResult.description}`); if (Array.isArray(contentResult.keywords) && contentResult.keywords.length > 0) parts.push(`\nKEYWORDS: ${contentResult.keywords.join(", ")}`); copyText(parts.join("\n")); }}
                                                        className="w-full flex items-center justify-center gap-2 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black transition-all text-[10px] font-black uppercase tracking-widest">
                                                        <Copy size={12} /> Copiar listing completo
                                                    </button>
                                                )}
                                                {contentResult.title && (
                                                    <div className="bg-amber-500/[0.04] border border-amber-500/15 rounded-2xl p-4 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/80">Título</p>
                                                            <button onClick={() => copyText(`${contentResult.title}${contentResult.subtitle ? `: ${contentResult.subtitle}` : ""}`)} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-neutral-500 hover:text-white text-[9px] transition-colors"><Copy size={9} /> Copiar</button>
                                                        </div>
                                                        <p className="text-[15px] font-black text-white leading-tight">{contentResult.title}</p>
                                                        {contentResult.subtitle && <p className="text-[11px] text-amber-200/60 leading-snug border-t border-amber-500/10 pt-2">{contentResult.subtitle}</p>}
                                                    </div>
                                                )}
                                                {contentResult.description && (
                                                    <div className="bg-white/[0.02] border border-white/6 rounded-2xl p-4 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/80">Descripción</p>
                                                            <button onClick={() => copyText(contentResult.description)} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-neutral-500 hover:text-white text-[9px] transition-colors"><Copy size={9} /> Copiar</button>
                                                        </div>
                                                        <p className="text-[10px] text-neutral-300 leading-relaxed whitespace-pre-line">{contentResult.description}</p>
                                                    </div>
                                                )}
                                                {Array.isArray(contentResult.keywords) && contentResult.keywords.length > 0 && (
                                                    <div className="bg-white/[0.02] border border-white/6 rounded-2xl p-4 space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/80">{contentResult.keywords.length} Palabras clave</p>
                                                            <button onClick={() => copyText(contentResult.keywords.join("\n"))} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-neutral-500 hover:text-white text-[9px] transition-colors"><Copy size={9} /> Copiar todo</button>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {contentResult.keywords.map((k: string, i: number) => (
                                                                <div key={i} className="flex items-center gap-2 group">
                                                                    <span className="text-[9px] font-black text-amber-500/50 w-4 shrink-0 tabular-nums">{i + 1}</span>
                                                                    <p className="flex-1 text-[10px] text-neutral-300">{k}</p>
                                                                    <button onClick={() => copyText(k)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-neutral-600 hover:text-white transition-all"><Copy size={9} /></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <button onClick={() => void generateContent()} className="w-full flex items-center justify-center gap-1.5 py-2 text-[9px] font-black uppercase tracking-widest text-neutral-700 hover:text-neutral-400 transition-colors">
                                                    <Sparkles size={9} /> Regenerar
                                                </button>
                                            </div>
                                        )}
                                        {contentType === "full-listing" && typeof contentResult === "object" && (
                                            <>
                                                {contentResult.title && <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Título</p><button onClick={() => copyText(contentResult.title)} className="p-1 rounded text-neutral-600 hover:text-white transition-colors"><Copy size={10} /></button></div><p className="text-sm text-white font-medium">{contentResult.title}</p>{contentResult.subtitle && <p className="text-[10px] text-neutral-500">{contentResult.subtitle}</p>}</div>}
                                                {contentResult.description && <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Descripción</p><button onClick={() => copyText(contentResult.description)} className="p-1 rounded text-neutral-600 hover:text-white transition-colors"><Copy size={10} /></button></div><p className="text-[10px] text-neutral-300 leading-relaxed whitespace-pre-line">{contentResult.description}</p></div>}
                                                {Array.isArray(contentResult.bullets) && contentResult.bullets.length > 0 && <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1"><p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Bullets</p><ul className="space-y-0.5">{contentResult.bullets.map((b: string, i: number) => <li key={i} className="text-[10px] text-neutral-300 flex gap-1.5"><span className="text-amber-400/60 shrink-0">▸</span>{b}</li>)}</ul></div>}
                                                {Array.isArray(contentResult.keywords) && <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1.5"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Keywords ({contentResult.keywords.length})</p><button onClick={() => copyText(contentResult.keywords.join(", "))} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-neutral-400 hover:text-white text-[9px] transition-colors"><Copy size={9} /> Copiar</button></div><div className="flex flex-wrap gap-1">{contentResult.keywords.map((k: string, i: number) => <button key={i} onClick={() => copyText(k)} className="text-[8px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors">{k}</button>)}</div></div>}
                                                {contentResult.price_suggestion_usd && <div className="flex items-center gap-3 px-3 py-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl"><DollarSign size={13} className="text-emerald-400 shrink-0" /><div><p className="text-[8px] text-neutral-600 uppercase">Precio sugerido</p><p className="text-sm font-black text-emerald-400">${contentResult.price_suggestion_usd}</p></div></div>}
                                            </>
                                        )}
                                        {contentType === "titles" && Array.isArray(contentResult) && (
                                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Títulos ({contentResult.length})</p>
                                                {contentResult.map((t: string, i: number) => (
                                                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                                                        <span className="text-[9px] text-neutral-700 w-4">{i + 1}.</span>
                                                        <p className="text-[11px] text-neutral-200 flex-1">{t}</p>
                                                        <button onClick={() => copyText(t)} className="p-1 rounded text-neutral-600 hover:text-white shrink-0"><Copy size={10} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {contentType === "description" && typeof contentResult === "object" && (
                                            <>
                                                {contentResult.description && <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Descripción</p><button onClick={() => copyText(contentResult.description)} className="p-1 rounded text-neutral-600 hover:text-white"><Copy size={10} /></button></div><p className="text-[10px] text-neutral-300 leading-relaxed whitespace-pre-line">{contentResult.description}</p></div>}
                                                {Array.isArray(contentResult.bullets) && <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1"><p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Bullets</p>{contentResult.bullets.map((b: string, i: number) => <p key={i} className="text-[10px] text-neutral-300 flex gap-1.5"><span className="text-amber-400/60 shrink-0">▸</span>{b}</p>)}</div>}
                                            </>
                                        )}
                                        {contentType === "keywords" && Array.isArray(contentResult) && (
                                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2">
                                                <div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Keywords ({contentResult.length})</p><button onClick={() => copyText(contentResult.join(", "))} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-neutral-400 hover:text-white text-[9px]"><Copy size={9} /> Copiar todos</button></div>
                                                <div className="flex flex-wrap gap-1.5">{contentResult.map((k: string, i: number) => <button key={i} onClick={() => copyText(k)} className="text-[9px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors">{k}</button>)}</div>
                                            </div>
                                        )}
                                        {contentType === "back-cover" && typeof contentResult === "object" && contentResult.back_cover && (
                                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1.5">
                                                <div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Contraportada</p><button onClick={() => copyText(contentResult.back_cover)} className="p-1 rounded text-neutral-600 hover:text-white"><Copy size={10} /></button></div>
                                                <p className="text-[11px] text-neutral-200 leading-relaxed whitespace-pre-line">{contentResult.back_cover}</p>
                                            </div>
                                        )}
                                        {contentType === "series" && typeof contentResult === "object" && contentResult.series_name && (
                                            <div className="space-y-2">
                                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3"><p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Serie</p><p className="text-base font-black text-white mt-0.5">{contentResult.series_name}</p>{contentResult.concept && <p className="text-[10px] text-neutral-400 mt-0.5">{contentResult.concept}</p>}</div>
                                                {Array.isArray(contentResult.volumes) && contentResult.volumes.map((v: any, i: number) => (
                                                    <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex gap-2">
                                                        <span className="text-[9px] font-black text-amber-400 w-4 shrink-0 mt-0.5">{i + 1}</span>
                                                        <div><p className="text-[11px] font-bold text-white">{v.title}</p><p className="text-[9px] text-neutral-500">{v.theme} — {v.angle}</p></div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {typeof contentResult === "string" && (
                                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                                                <div className="flex justify-end mb-1"><button onClick={() => copyText(contentResult)} className="p-1 rounded text-neutral-600 hover:text-white"><Copy size={10} /></button></div>
                                                <p className="text-[10px] text-neutral-300 whitespace-pre-wrap">{contentResult}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Confirm Delete Cloudinary Image Dialog */}
            {confirmDeleteCloudinaryId && (
                <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" role="dialog" aria-modal="true">
                    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0f0f0f] p-8 space-y-6 shadow-2xl">
                        <div className="space-y-2 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto"><Cloud size={24} className="text-red-400" /></div>
                            <p className="text-base font-black text-white">¿Eliminar de Cloudinary?</p>
                            <p className="text-sm text-neutral-500">La imagen se eliminará permanentemente del almacén en la nube.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDeleteCloudinaryId(null)} className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all">Cancelar</button>
                            <button onClick={() => { void deleteFromCloudinary(confirmDeleteCloudinaryId); setConfirmDeleteCloudinaryId(null); closePreview(); }} className="flex-1 h-11 rounded-2xl bg-red-500 text-white text-sm font-black hover:bg-red-400 transition-all">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
