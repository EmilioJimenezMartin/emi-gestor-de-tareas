"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createApiSocket } from "@/lib/socket";

interface ProductPlatform {
    name: string;
    earnings: number;
}

interface DigitalProduct {
    id: string;
    type: string;
    title: string;
    description: string;
    platforms: ProductPlatform[];
    totalEarnings: number;
    createdAt: string;
}

const PRODUCT_TYPES = [
    { id: "kdp-color-book", name: "KDP Color Book", icon: <BookOpen size={18} />, color: "text-blue-400", bg: "bg-blue-500/10" },
    { id: "poster-digital", name: "Poster Digital", icon: <ImageIcon size={18} />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { id: "clothing", name: "Patrones para Ropa", icon: <Shirt size={18} />, color: "text-purple-400", bg: "bg-purple-500/10" },
    { id: "frames", name: "Cuadros Imprimibles", icon: <Frame size={18} />, color: "text-rose-400", bg: "bg-rose-500/10" },
    { id: "etsy-products", name: "Productos Etsy", icon: <Store size={18} />, color: "text-orange-400", bg: "bg-orange-500/10" },
    { id: "landing-page-template", name: "Landing Page Template", icon: <FileText size={18} />, color: "text-cyan-400", bg: "bg-cyan-500/10" }
];

const AI_MODELS = [
    // Mantener los modelos originales (algunos pueden estar más rate-limited / con licencias no-OSS).
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

type TabID = "insights" | "catalog" | "creation" | "studio" | "niches";
type PeriodID = "month" | "6months" | "year" | "all";

type NicheStatus = "found" | "active" | "research" | "archived";
type NicheProductType = "coloring-book" | "printable-poster" | "other";
type NicheStyle = "generic" | "anime" | "illustration" | "children" | "realistic" | "watercolor" | "abstract";

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
    notes: string;
    generatedPrompt?: string;
    catalogIds?: string[];
    phase?: "niche" | "catalog" | "pdf" | "published";
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
    type: "image" | "text" | "both";
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
    const ringCls = accent === "violet" ? "border-violet-500/50 bg-violet-500/5" : accent === "amber" ? "border-amber-500/50 bg-amber-500/5" : "border-white/20 bg-white/5";
    const activeCls = accent === "violet" ? "text-violet-300 bg-violet-500/10" : accent === "amber" ? "text-amber-300 bg-amber-500/10" : "text-white bg-white/10";
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


export function KdpFactoryApp() {
    const [activeTab, setActiveTab] = useState<TabID>(() => {
        if (typeof window === "undefined") return "insights";
        const saved = localStorage.getItem("kdp-active-tab");
        return (saved && ["insights", "catalog", "creation", "studio"].includes(saved)) ? saved as TabID : "insights";
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

    const [products, setProducts] = useState<DigitalProduct[]>([
        {
            id: "prod_001",
            type: "KDP Color Book",
            title: "Ocean Wonders: Extreme Mandala",
            description: "Libro de colorear premium con 50 diseños de mandalas marinos.",
            platforms: [
                { name: "Amazon KDP", earnings: 450.20 },
                { name: "Etsy", earnings: 120.50 }
            ],
            totalEarnings: 570.70,
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: "prod_002",
            type: "Poster Digital",
            title: "Cyberpunk Cityscape Vol.1",
            description: "Poster digital en alta resolución para decoración gamer.",
            platforms: [
                { name: "Etsy", earnings: 230.15 },
                { name: "Creative Fabrica", earnings: 45.00 }
            ],
            totalEarnings: 275.15,
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: "prod_003",
            type: "Patrones para Ropa",
            title: "Boho Floral Textile Set",
            description: "Colección de patrones repetibles para impresión en tela.",
            platforms: [
                { name: "Printify", earnings: 890.00 },
                { name: "Etsy", earnings: 140.00 }
            ],
            totalEarnings: 1030.00,
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        }
    ]);

    const [selectedType, setSelectedType] = useState(PRODUCT_TYPES[0].id);
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [catalogFilter, setCatalogFilter] = useState("all");

    const stats = useMemo(() => {
        const total = products.reduce((acc, p) => acc + p.totalEarnings, 0);
        const count = products.length;
        const avg = count > 0 ? total / count : 0;
        return { total, count, avg };
    }, [products]);

    const filteredProducts = useMemo(() => {
        if (catalogFilter === "all") return products;
        const typeName = PRODUCT_TYPES.find(t => t.id === catalogFilter)?.name;
        return products.filter(p => p.type === typeName);
    }, [products, catalogFilter]);

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
    const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<string | null>(null);
    const [confirmDeleteImageInfo, setConfirmDeleteImageInfo] = useState<{ catalogId: string; publicId: string } | null>(null);
    const [bookPages, setBookPages] = useState<BookPage[]>([]);
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
    const [nicheFormPrompt, setNicheFormPrompt] = useState("");
    const [isSavingNiche, setIsSavingNiche] = useState(false);
    const [nicheDeleteId, setNicheDeleteId] = useState<string | null>(null);
    const [nicheStatusFilter, setNicheStatusFilter] = useState<"all" | NicheStatus>("all");
    const [nicheGeneratingId, setNicheGeneratingId] = useState<string | null>(null);
    const [nicheFormProductType, setNicheFormProductType] = useState<NicheProductType>("coloring-book");
    const [nicheFormStyle, setNicheFormStyle] = useState<NicheStyle>("generic");
    const [kdpTemplateOpen, setKdpTemplateOpen] = useState(false);
    const [kdpTemplateTitle, setKdpTemplateTitle] = useState("Mi Libro de Colorear");
    const [kdpTemplateVaultSel, setKdpTemplateVaultSel] = useState<Set<number>>(new Set());
    const [kdpTemplateCatalogSel, setKdpTemplateCatalogSel] = useState<Set<string>>(new Set());
    const [kdpTemplateCloudSel, setKdpTemplateCloudSel] = useState<Set<number>>(new Set());
    // Feature: retry failed slots
    const [retryingCatalogId, setRetryingCatalogId] = useState<string | null>(null);
    // Feature: compare catalogs
    const [compareSel, setCompareSel] = useState<Set<string>>(new Set());
    const [compareOpen, setCompareOpen] = useState(false);
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
            const res = await fetch(`${API_BASE_URL}/catalogs/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Error al eliminar");
            setIaCatalogs((prev) => prev.filter((c) => c._id !== id));
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
            setNicheFormStyle(niche.styleCategory ?? "generic");
            setNicheFormNotes(niche.notes);
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
            setNicheFormStyle("generic");
            setNicheFormNotes("");
            setNicheFormPrompt("");
        }
        setNicheFormOpen(true);
    };

    const generateNicheContent = async (niche: NicheFE) => {
        setNicheGeneratingId(niche._id);
        try {
            // 1. Generate an image prompt for this niche
            const promptRes = await fetch(`${API_BASE_URL}/ai/generate-text`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "image-prompt",
                    niche: niche.name,
                    productType: niche.productType === "coloring-book" ? "KDP coloring book" : niche.productType === "printable-poster" ? "printable poster" : niche.name,
                    language: "en",
                    model: "gemini-2.5-flash",
                }),
            });
            const promptData = await promptRes.json();
            if (!promptRes.ok) throw new Error(promptData.error ?? "Error generando prompt");
            const imagePrompt: string = typeof promptData.result === "object"
                ? (promptData.result.prompt ?? niche.name)
                : (promptData.result ?? niche.name);

            // 2. Pick AI model based on style category
            const modelId = NICHE_STYLE_MODEL[niche.styleCategory ?? "generic"];
            const model = AI_MODELS.find(m => m.id === modelId) ?? AI_MODELS.find(m => m.id === "pollinations-flux")!;

            // 3. Create catalog with 5 images
            const catalogRes = await fetch(`${API_BASE_URL}/catalogs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: niche.name,
                    prompt: imagePrompt,
                    promptParts: { theme: niche.name, specs: "", details: "", particulars: "" },
                    productType: niche.productType ?? "coloring-book",
                    aiModel: { id: model.id, name: model.name, provider: model.provider, modelId: model.modelId },
                    width: 1024,
                    height: 1024,
                    totalImages: 5,
                }),
            });
            const catalogData = await catalogRes.json();
            if (!catalogRes.ok) throw new Error(catalogData.error ?? "Error al crear catálogo");
            setIaCatalogs(prev => [catalogData.catalog, ...prev]);

            // 4. Save prompt + catalogId back to niche
            const newCatalogIds = [...(niche.catalogIds ?? []), catalogData.catalog._id];
            await fetch(`${API_BASE_URL}/niches/${niche._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generatedPrompt: imagePrompt, catalogIds: newCatalogIds }),
            });
            const nextPhase = (niche.phase === "niche" || !niche.phase) ? "catalog" : niche.phase;
            if (nextPhase !== niche.phase) {
                await fetch(`${API_BASE_URL}/niches/${niche._id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phase: nextPhase }),
                });
            }
            setNiches(prev => prev.map(n => n._id === niche._id
                ? { ...n, generatedPrompt: imagePrompt, catalogIds: newCatalogIds, phase: nextPhase }
                : n
            ));

            toast.success(`Catálogo iniciado · ${niche.name} · ${model.name}`);
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
                styleCategory: nicheFormStyle,
                notes: nicheFormNotes.trim(),
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
        const phasePts = { niche: 0, catalog: 5, pdf: 10, published: 15 }[n.phase ?? "niche"] ?? 0;
        const statusPts = n.status === "active" ? 5 : n.status === "research" ? 3 : 0;
        return demandPts + compPts + catalogPts + phasePts + statusPts;
    };

    const advanceNichePhase = async (niche: NicheFE) => {
        const order: NicheFE["phase"][] = ["niche", "catalog", "pdf", "published"];
        const cur = order.indexOf(niche.phase ?? "niche");
        if (cur >= order.length - 1) return;
        const next = order[cur + 1];
        try {
            await fetch(`${API_BASE_URL}/niches/${niche._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phase: next }),
            });
            setNiches(prev => prev.map(n => n._id === niche._id ? { ...n, phase: next } : n));
        } catch { toast.error("Error al avanzar fase"); }
    };

    const setNichePhase = async (niche: NicheFE, phase: NicheFE["phase"]) => {
        if (phase === (niche.phase ?? "niche")) return;
        try {
            await fetch(`${API_BASE_URL}/niches/${niche._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phase }),
            });
            setNiches(prev => prev.map(n => n._id === niche._id ? { ...n, phase } : n));
        } catch { toast.error("Error al cambiar fase"); }
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
        setKdpTemplateVaultSel(new Set(vaultImages.map((_, i) => i)));
        setKdpTemplateCatalogSel(new Set(completedCatalogs.map(c => c._id)));
        setKdpTemplateCloudSel(new Set());
        setKdpTemplateOpen(true);
    };

    const applyColoringBookTemplate = (titleText = "Mi Libro de Colorear", imageEntries?: { url: string; label: string }[]) => {
        const entries = imageEntries ?? [
            ...vaultImages.map(v => ({ url: v.url, label: v.model || "Vault" })),
            ...iaCatalogs
                .filter(c => c.status === "completed" && c.images.length > 0)
                .flatMap(c => c.images.map((img, i) => ({ url: img.url, label: `${c.name} #${i + 1}` }))),
        ];

        if (entries.length === 0) {
            toast.error("No hay imágenes seleccionadas");
            return;
        }

        const pages: BookPage[] = [];

        // Title page + blank back
        const titleStyle = defaultTextStyle();
        titleStyle.content = titleText;
        titleStyle.fontSize = 24;
        titleStyle.bold = true;
        titleStyle.verticalAlign = "middle";
        titleStyle.align = "center";
        pages.push({ id: genPageId(), type: "text", text: titleStyle });
        pages.push({ id: genPageId(), type: "text", text: defaultTextStyle() }); // blank back

        // Image + blank pairs
        for (const { url, label } of entries) {
            pages.push({ id: genPageId(), type: "image", image: { url, scale: 1, label }, text: defaultTextStyle() });
            pages.push({ id: genPageId(), type: "text", text: defaultTextStyle() }); // blank back
        }

        setBookPages(pages);
        setSelectedPageId(pages[0].id);
        setBookEditorOpen(true);
        toast.success(`Plantilla KDP · ${pages.length} páginas (${entries.length} imágenes)`);
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
    const [vaultImages, setVaultImages] = useState<{ url: string, model: string, dim: string }[]>([]);
    const generatedImageObjectUrlRef = useRef<string | null>(null);
    const previewImageObjectUrlRef = useRef<string | null>(null);

    const [bookEditorOpen, setBookEditorOpen] = useState(false);
    const [bookFileName, setBookFileName] = useState("libro-kdp");
    const [isBuildingPdf, setIsBuildingPdf] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
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
            await fetch(`${API_BASE_URL}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{ key: "kdp-book-draft", value: { pages: serializablePages, fileName: bookFileName } }]),
            });
            toast.success("Borrador guardado");
        } catch {
            toast.error("Error al guardar el borrador");
        } finally {
            setIsSavingDraft(false);
        }
    };

    const deleteBookDraft = async () => {
        try {
            await fetch(`${API_BASE_URL}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{ key: "kdp-book-draft", value: { pages: [], fileName: "" } }]),
            });
        } catch {
            // silent — local state is already cleared
        }
    };

    const buildBookPdf = async () => {
        if (bookPages.length === 0) return;
        setIsBuildingPdf(true);
        try {
            const pdf = await PDFDocument.create();
            const pageWidth = 595.28;
            const pageHeight = 841.89;
            const margin = 48;

            const embedImage = async (url: string) => {
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

            const getFontKey = (style: PageTextStyle): StandardFonts => {
                const { bold, italic, fontFamily } = style;
                if (fontFamily === "times") {
                    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
                    if (bold) return StandardFonts.TimesRomanBold;
                    if (italic) return StandardFonts.TimesRomanItalic;
                    return StandardFonts.TimesRoman;
                }
                if (fontFamily === "courier") {
                    if (bold && italic) return StandardFonts.CourierBoldOblique;
                    if (bold) return StandardFonts.CourierBold;
                    if (italic) return StandardFonts.CourierOblique;
                    return StandardFonts.Courier;
                }
                if (bold && italic) return StandardFonts.HelveticaBoldOblique;
                if (bold) return StandardFonts.HelveticaBold;
                if (italic) return StandardFonts.HelveticaOblique;
                return StandardFonts.Helvetica;
            };

            const drawTextOnPage = async (pdfPage: any, style: PageTextStyle) => {
                const text = style.content.trim();
                if (!text) return;
                const font = await pdf.embedFont(getFontKey(style));
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

            for (const bookPage of bookPages) {
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
            const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            downloadFile(url, `${(bookFileName.trim() || "libro-kdp")}.pdf`);
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
            toast.success("PDF generado");
        } catch (e) {
            console.error(e);
            toast.error("No se pudo generar el PDF");
        } finally {
            setIsBuildingPdf(false);
        }
    };

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

                // Book draft
                const draftFound = (data.settings ?? []).find((s: any) => s.key === "kdp-book-draft");
                if (draftFound?.value?.pages && Array.isArray(draftFound.value.pages) && draftFound.value.pages.length > 0) {
                    setBookPages(draftFound.value.pages as BookPage[]);
                    setSelectedPageId((draftFound.value.pages as BookPage[])[0].id);
                    if (draftFound.value.fileName) setBookFileName(draftFound.value.fileName);
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

    // Fetch Cloudinary images + saved prompts when entering the creation tab
    useEffect(() => {
        if (activeTab === "creation") {
            void fetchCloudinaryImages();
            void fetchSavedPrompts();
        }
        if (activeTab === "studio" && niches.length === 0) {
            void fetchNiches();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

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

    // Fetch catalogs + connect socket when entering the creation tab
    useEffect(() => {
        if (activeTab !== "creation") return;
        void fetchCatalogs();

        const socket = createApiSocket(API_BASE_URL);
        catalogSocketRef.current = socket;

        socket.on("catalog:progress", (data: { catalogId: string; status: string; current: number; total: number; image?: CatalogImageFE; lastError?: string; skipped?: number }) => {
            setIaCatalogs((prev) =>
                prev.map((c) => {
                    if (c._id !== data.catalogId) return c;
                    const updated: IACatalogFE = {
                        ...c,
                        status: data.status as IACatalogFE["status"],
                        lastError: data.lastError !== undefined ? data.lastError : c.lastError,
                        skippedImages: data.skipped !== undefined ? data.skipped : c.skippedImages,
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
            setIaCatalogs((prev) =>
                prev.map((c) => (c._id === data.catalogId ? { ...c, status: "completed", lastError: "" } : c))
            );
            toast.success("Catálogo completado");
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
                dim: dimName
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
            platforms: mockPlatforms,
            totalEarnings,
            createdAt: new Date().toISOString()
        };

        setProducts([newProduct, ...products]);
        setNewTitle("");
        setNewDesc("");
        toast.success("Producto creado. ¡Revísalo en el catálogo!");
        changeTab("catalog");
    };

    const handleDeleteProduct = (id: string) => {
        setProducts(products.filter(p => p.id !== id));
        toast.success("Producto eliminado");
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
        found: { label: "Encontrado", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
        research: { label: "Investigando", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
        active: { label: "Activo", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
        archived: { label: "Archivado", color: "text-neutral-500 bg-neutral-500/10 border-neutral-500/20" },
    };


    const renderInsights = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-indigo-500/30 hover:shadow-[0_0_30px_rgba(99,102,241,0.12)] transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/10 blur-2xl rounded-full transition-all group-hover:scale-150" />
                    <div className="flex items-center justify-between relative">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Ganancias Totales</span>
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><TrendingUp size={16} /></div>
                    </div>
                    <div className="space-y-1 relative">
                        <p className="text-3xl font-black italic tracking-tighter text-white tabular-nums">{stats.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€</p>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400"><ArrowUpRight size={12} /><span>+12.5% vs mes anterior</span></div>
                    </div>
                </Card>
                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.12)] transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 blur-2xl rounded-full transition-all group-hover:scale-150" />
                    <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Promedio / Asset</span><div className="p-2 rounded-xl bg-blue-500/10 text-blue-400"><BarChart size={16} /></div></div>
                    <div className="space-y-1"><p className="text-3xl font-black italic tracking-tighter text-white tabular-nums">{stats.avg.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€</p><div className="text-[10px] font-bold text-blue-400 italic">Rendimiento Saludable</div></div>
                </Card>
                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.12)] transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 blur-2xl rounded-full transition-all group-hover:scale-150" />
                    <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Market Reach</span><div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400"><Globe size={16} /></div></div>
                    <div className="space-y-1 text-3xl font-black italic tracking-tighter text-white">4/4 <span className="text-xs uppercase text-neutral-500 tracking-widest not-italic ml-2">Platforms</span></div>
                </Card>
                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.12)] transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-purple-500/10 blur-2xl rounded-full transition-all group-hover:scale-150" />
                    <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Top Nicho</span><div className="p-2 rounded-xl bg-purple-500/10 text-purple-400"><Activity size={16} /></div></div>
                    <div className="space-y-1 text-xl font-black italic tracking-tighter text-white flex flex-col"><span>Mandala Art</span><span className="text-[11px] uppercase font-black text-purple-400 tracking-widest">+45% Demand</span></div>
                </Card>
            </div>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card variant="glass" className="lg:col-span-2 p-8 border-white/5 bg-white/[0.01] space-y-8 relative overflow-hidden hover:shadow-[0_0_40px_rgba(99,102,241,0.08)] transition-all duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2"><Activity size={14} className="text-indigo-400" />Evolución de Tendencias</h3>
                            <p className="text-[10px] text-neutral-500 font-medium tracking-tight">Análisis predictivo basado en volumen de ventas</p>
                        </div>
                        <div className="w-full md:w-48">
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
                        <div className="space-y-1"><h3 className="text-sm font-black text-white italic tracking-widest uppercase">Platform Split</h3><p className="text-[10px] text-neutral-500 font-medium tracking-tight">Distribución por canales de venta</p></div>
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
        </div>
    );

    const renderCatalog = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Catalog Filters Refined */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-2">
                <div className="flex-1 w-full md:w-auto space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-500 ml-1">Filtrar por Categoría</label>
                    <KdpSelect value={catalogFilter} onChange={setCatalogFilter}
                        options={[{ value: "all", label: "Todos los Activos" }, ...PRODUCT_TYPES.map(t => ({ value: t.id, label: t.name }))]} />
                </div>

                <div className="w-full md:w-auto space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-500 ml-1">Búsqueda rápida</label>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-white transition-colors" size={14} />
                        <input
                            type="text"
                            placeholder="Ej: Cyberpunk Series"
                            className="h-12 w-full md:w-72 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-[10px] font-bold text-white focus:outline-none focus:border-white/20 transition-all placeholder:text-neutral-700"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
                {filteredProducts.length === 0 ? (
                    <Card variant="outline" className="p-20 border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center text-center space-y-4">
                        <div className="p-6 rounded-[32px] bg-white/5 text-neutral-700">
                            <Box size={48} strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xl font-black text-white italic tracking-tighter uppercase">Sin coincidencias</p>
                            <p className="text-sm text-neutral-500 font-medium tracking-tight">Prueba con otra categoría o término de búsqueda.</p>
                        </div>
                    </Card>
                ) : (
                    filteredProducts.map((product) => (
                        <Card key={product.id} variant="glass" className="group relative p-6 border-white/5 bg-white/[0.01] hover:border-white/20 transition-all duration-300 overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-blue-500 to-cyan-500 opacity-30 group-hover:opacity-100 transition-opacity" />

                            <div className="flex flex-col md:flex-row gap-6 relative">
                                <div className="flex-1 space-y-5">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="neutral" className="bg-indigo-500/10 border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.05em] px-2.5">
                                                    {product.type}
                                                </Badge>
                                                <span className="text-[10px] font-medium text-neutral-700 font-mono">#{product.id.slice(-6)}</span>
                                            </div>
                                            <h3 className="text-xl font-black text-white italic tracking-tight">{product.title}</h3>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setConfirmDeleteProductId(product.id)}
                                            className="h-9 w-9 p-0 rounded-xl text-neutral-700 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>

                                    <p className="text-sm text-neutral-500 leading-relaxed max-w-2xl font-medium tracking-tight">{product.description}</p>

                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {product.platforms.map((plat) => (
                                            <div key={plat.name} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all group/plat cursor-default">
                                                <span className="text-[10px] font-black uppercase text-neutral-600 group-hover/plat:text-neutral-400 tracking-tighter transition-colors">{plat.name}</span>
                                                <div className="w-px h-2.5 bg-white/10" />
                                                <span className="text-[11px] font-black italic tracking-tighter text-emerald-400 tabular-nums">
                                                    {plat.earnings.toFixed(2)}€
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex md:flex-col justify-between items-end md:items-end gap-4 md:gap-6 md:w-48 md:border-l border-white/5 md:pl-8 pt-5 md:pt-0 border-t md:border-t-0">
                                    <div className="text-right space-y-0.5">
                                        <span className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-600 block">Total Profit</span>
                                        <span className="text-2xl md:text-3xl font-black italic tracking-tighter text-white tabular-nums">{product.totalEarnings.toFixed(2)}€</span>
                                    </div>
                                    <Button variant="outline" className="h-9 md:h-10 px-4 md:w-full rounded-xl border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all shadow-xl shadow-white/5">
                                        Informe
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );

    const renderAIStudio = () => {
        const currentModel = AI_MODELS.find(m => m.id === selectedModel);
        const currentDim = AI_DIMENSIONS.find(d => d.id === selectedDim);
        const providerColor: Record<string, string> = {
            "Pollinations": "emerald",
            "Hugging Face": "amber",
            "Google": "sky",
            "Leonardo": "orange",
            "Ideogram": "violet",
        };
        const pColor = providerColor[currentModel?.provider || ""] || "neutral";

        return (
            <div className="lg:col-span-12 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 mt-8 pb-12">
                {/* Header */}
                <div className="flex items-center gap-4 px-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Zap size={14} className="text-amber-400 fill-amber-400/20" />
                        </div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-300">IA Asset Studio</h3>
                        <button
                            onClick={() => setShowSafeArea(v => !v)}
                            className={`px-3 h-7 rounded-xl border transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${showSafeArea ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-white/5 border-white/10 text-neutral-600 hover:text-amber-400 hover:border-amber-500/25"}`}
                        >
                            <Maximize size={11} /> Safe area
                        </button>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* ─── LEFT CARD: Controls ─── */}
                    <div className="relative rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
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
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-white/6 border border-white/12 text-[9px] font-black text-neutral-500 flex items-center justify-center shrink-0">02</span>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Prompt del Activo</p>
                                </div>
                                {imagePrompt && (
                                    <div className="flex items-center gap-1.5">
                                        <button type="button"
                                            onClick={() => navigator.clipboard.writeText(imagePrompt).then(() => toast.success("Prompt copiado"))}
                                            className="p-1.5 rounded-lg bg-white/5 text-neutral-600 hover:text-white hover:bg-white/10 transition-all border border-white/8" title="Copiar">
                                            <Copy size={10} />
                                        </button>
                                        <button type="button"
                                            onClick={() => { setSavePromptName(""); setSavePromptCategory("General"); setShowSavePromptDialog(true); }}
                                            className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-all border border-violet-500/20" title="Guardar en biblioteca">
                                            <BookMarked size={10} />
                                        </button>
                                    </div>
                                )}
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
                                        className="w-full h-10 bg-violet-500/[0.06] border border-violet-500/20 rounded-xl px-4 pr-20 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/40 focus:bg-violet-500/[0.09] transition-all font-medium"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black uppercase tracking-widest text-violet-500/50 pointer-events-none flex items-center gap-1">
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
                                            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-violet-500/[0.06] border border-violet-500/20">
                                                <div className="relative shrink-0">
                                                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                                                    <div className="absolute inset-0 rounded-full bg-violet-400/40 animate-ping" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black text-violet-300 leading-tight">
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
                                                    className="text-[9px] font-black uppercase tracking-widest text-violet-400/60 hover:text-violet-300 transition-colors shrink-0"
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
                                <span className="w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/20 text-[9px] font-black text-violet-400 flex items-center justify-center shrink-0">04</span>
                                <div className="flex-1 text-left">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-neutral-200 transition-colors">Generar catálogo</p>
                                    <p className="text-[9px] text-neutral-600 mt-0.5">Producción masiva con estos ajustes</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {iaCatalogs.some(c => c.status === "running" || c.status === "queued") && (
                                        <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
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
                                                    className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl border transition-all ${catalogProductType === pt.id ? "border-violet-500/40 bg-violet-500/[0.08] text-violet-300" : "border-white/8 bg-white/[0.02] text-neutral-600 hover:border-white/15 hover:text-neutral-400"}`}
                                                >
                                                    <span className="text-[9px] font-black uppercase tracking-wide">{pt.label}</span>
                                                    <span className={`text-[8px] ${catalogProductType === pt.id ? "text-violet-500/60" : "text-neutral-700"}`}>{pt.desc}</span>
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
                                            <span className={`text-[9px] font-black tabular-nums ${catalogCreativity <= 10 ? "text-neutral-700" : catalogCreativity <= 35 ? "text-sky-400/70" : catalogCreativity <= 65 ? "text-violet-400/70" : catalogCreativity <= 85 ? "text-amber-400/70" : "text-rose-400/70"}`}>
                                                {catalogCreativity <= 10 ? "Sin variación" : catalogCreativity <= 35 ? "Sutil" : catalogCreativity <= 65 ? "Moderada" : catalogCreativity <= 85 ? "Alta" : "Máxima"}
                                            </span>
                                        </div>
                                        <input type="range" min={0} max={100} step={5} value={catalogCreativity}
                                            onChange={e => setCatalogCreativity(Number(e.target.value))}
                                            className="w-full accent-violet-500 h-1.5 rounded-full cursor-pointer" />
                                        <div className="flex justify-between text-[8px] text-neutral-700"><span>Idénticas</span><span>Diferentes</span></div>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                        <input value={catalogFormName} onChange={e => setCatalogFormName(e.target.value)}
                                            placeholder="Nombre del catálogo (opcional)"
                                            className="flex-1 min-w-0 h-10 bg-white/4 border border-white/8 rounded-xl px-3 text-sm text-white outline-none focus:border-violet-500/30 transition-all placeholder:text-neutral-700"
                                        />
                                        <div className="flex gap-2">
                                            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="5"
                                                value={catalogFormCount === 0 ? "" : String(catalogFormCount)}
                                                onChange={e => { const raw = e.target.value.replace(/\D/g, ""); setCatalogFormCount(raw === "" ? 0 : Math.min(50, Number(raw))); }}
                                                className="w-14 h-10 bg-white/4 border border-white/8 rounded-xl px-2 text-sm font-bold text-white outline-none focus:border-violet-500/30 transition-all text-center"
                                            />
                                            <button onClick={() => void createCatalogFromStudio()}
                                                disabled={isCreatingCatalog || !promptTheme.trim()}
                                                className="flex-1 sm:flex-none h-10 px-5 bg-violet-600/80 hover:bg-violet-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(139,92,246,0.2)]"
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
                            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                                        <Wand2 size={14} className="text-violet-400" />
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
                                        className="flex-1 h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 transition-all"
                                    />
                                    <button
                                        onClick={() => void generateImagePromptSuggestion()}
                                        disabled={isGeneratingImagePrompt || !contentNiche.trim()}
                                        className="h-10 px-4 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                                        {isGeneratingImagePrompt ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                        {isGeneratingImagePrompt ? "..." : "Generar"}
                                    </button>
                                </div>
                                {isGeneratingImagePrompt && (
                                    <div className="h-12 rounded-xl bg-white/5 border border-white/8 animate-pulse flex items-center justify-center">
                                        <Loader2 size={12} className="animate-spin text-violet-400" />
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
                                                className="flex-1 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]">
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
                                    <BookMarked size={14} className="text-violet-400" />
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Biblioteca de Prompts</h3>
                                </div>
                                <button onClick={() => void fetchSavedPrompts()} disabled={isLoadingSavedPrompts} className="p-2 rounded-xl bg-white/5 border border-white/10 text-neutral-500 hover:text-violet-400 hover:border-violet-500/30 transition-all disabled:opacity-40">
                                    {isLoadingSavedPrompts ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                </button>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            </div>

                            {savedPrompts.length > 0 && (
                                <div className="flex gap-2 flex-wrap px-2">
                                    <button
                                        onClick={() => setPromptCategoryFilter("all")}
                                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${promptCategoryFilter === "all" ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-white/5 border-white/10 text-neutral-500 hover:text-white"}`}
                                    >
                                        Todos ({savedPrompts.length})
                                    </button>
                                    {Array.from(new Set(savedPrompts.map(p => p.category))).map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setPromptCategoryFilter(cat)}
                                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${promptCategoryFilter === cat ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-white/5 border-white/10 text-neutral-500 hover:text-white"}`}
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
                                                    className="group relative rounded-2xl border border-white/8 bg-white/[0.03] hover:border-violet-500/25 hover:bg-white/[0.05] transition-all overflow-hidden">
                                                    <div className="h-0.5 w-full bg-gradient-to-r from-violet-500/60 via-violet-400/30 to-transparent" />
                                                    <div className="p-4 space-y-3">
                                                        <div className="flex items-start gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                {isFullEdit ? (
                                                                    <input autoFocus value={(fe.name ?? p.name)} onChange={e => setFullEditingPrompt(prev => ({ ...prev, name: e.target.value }))}
                                                                        className="w-full bg-white/5 border border-violet-500/40 rounded-lg px-2 py-1 text-[12px] font-black text-white outline-none mb-1" />
                                                                ) : (
                                                                    <p className="text-[12px] font-black text-white truncate leading-tight">{p.name}</p>
                                                                )}
                                                                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                                                    <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[8px] font-black uppercase tracking-widest text-violet-400">{p.category}</span>
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
                                                                        className="p-1.5 rounded-lg text-neutral-600 hover:text-violet-400 hover:bg-violet-500/10 transition-all">
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
                                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 resize-none font-mono" />
                                                                <select value={(fe.aiModel?.id ?? p.aiModel?.id ?? "")}
                                                                    onChange={e => {
                                                                        const m = AI_MODELS.find(m => m.id === e.target.value);
                                                                        setFullEditingPrompt(prev => ({ ...prev, aiModel: m ? { id: m.id, name: m.name, provider: m.provider, modelId: m.modelId } : undefined }));
                                                                    }}
                                                                    className="w-full h-8 bg-white/5 border border-white/10 rounded-xl px-3 text-[10px] text-white focus:outline-none focus:border-violet-500/40">
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
                                                                        className="flex-1 h-8 rounded-xl bg-violet-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-violet-400 transition-all flex items-center justify-center gap-1.5">
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
                                                                    className="w-full h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest hover:bg-violet-500 hover:text-white hover:border-violet-500 transition-all flex items-center justify-center gap-1.5">
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

                {/* ── BOOK FACTORY CARD ── */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <Card variant="outline" className="relative overflow-hidden border-white/8 bg-gradient-to-br from-white/[0.02] to-transparent">
                        {/* Ambient glow */}
                        <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/8 blur-[60px] pointer-events-none" />
                        <div className="p-5 space-y-4">
                            {/* Header */}
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10 shrink-0">
                                    <BookOpen size={19} className="text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-black text-white tracking-tight italic leading-tight">Book Factory</h4>
                                    <p className="text-[10px] text-neutral-500 font-medium">
                                        {bookPages.length === 0 ? "Sin páginas todavía" : `${bookPages.length} página${bookPages.length !== 1 ? "s" : ""} en el libro`}
                                    </p>
                                </div>
                            </div>
                            {/* Action buttons — own row, full width on mobile */}
                            <div className="flex items-center gap-2">
                                {bookPages.length > 0 && (
                                    confirmClearBook ? (
                                        <>
                                            <button
                                                onClick={() => { setBookPages([]); setSelectedPageId(null); setConfirmClearBook(false); void deleteBookDraft(); }}
                                                className="h-9 px-3 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase active:scale-95 transition-all">
                                                Sí, borrar
                                            </button>
                                            <button
                                                onClick={() => setConfirmClearBook(false)}
                                                className="h-9 px-3 rounded-xl border border-white/10 text-neutral-400 text-[10px] font-black uppercase active:scale-95 transition-all">
                                                Cancelar
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => setConfirmClearBook(true)} className="h-9 px-4 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all text-[10px] font-black uppercase active:scale-95">
                                            Borrar
                                        </button>
                                    )
                                )}
                                {!confirmClearBook && (
                                    <>
                                        <Button
                                            onClick={() => {
                                                if (vaultImages.length > 0 && bookPages.length === 0) {
                                                    const pages: BookPage[] = vaultImages.map(v => ({ id: genPageId(), type: "image" as const, image: { url: v.url, scale: 1, label: v.model }, text: defaultTextStyle() }));
                                                    setBookPages(pages);
                                                    setSelectedPageId(pages[0]?.id ?? null);
                                                }
                                                setBookEditorOpen(true);
                                            }}
                                            className="h-9 px-4 rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(245,158,11,0.3)] active:scale-95"
                                        >
                                            <Pencil size={13} />
                                            {bookPages.length === 0 ? "Crear" : "Editar"}
                                        </Button>
                                        <button
                                            onClick={() => openKdpTemplateSelector()}
                                            className="h-9 px-4 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500 hover:text-white hover:border-violet-500 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95"
                                            title="Selecciona imágenes del vault y catálogos para la plantilla KDP"
                                        >
                                            <BookOpen size={13} />
                                            Plantilla KDP
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Page thumbnails preview or empty state */}
                            {bookPages.length === 0 ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/6">
                                        <div className="flex gap-1.5">
                                            {[0, 1, 2, 3].map(i => (
                                                <div key={i} className="w-8 h-11 rounded-md bg-white/5 border border-dashed border-white/10" style={{ opacity: 1 - i * 0.2 }} />
                                            ))}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Libro vacío</p>
                                            <p className="text-[9px] text-neutral-700">Pulsa "Crear" para empezar o importa las imágenes del vault automáticamente</p>
                                        </div>
                                    </div>
                                    {/* KDP template preview */}
                                    <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-3 space-y-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-violet-400/70">Plantilla KDP — Libro de colorear</p>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {[
                                                { label: "Título", color: "bg-amber-500/30 border-amber-500/40 text-amber-300" },
                                                { label: "Blanco", color: "bg-white/5 border-white/10 text-neutral-600" },
                                                { label: "Imagen", color: "bg-violet-500/20 border-violet-500/30 text-violet-300" },
                                                { label: "Blanco", color: "bg-white/5 border-white/10 text-neutral-600" },
                                                { label: "Imagen", color: "bg-violet-500/20 border-violet-500/30 text-violet-300" },
                                                { label: "…", color: "bg-transparent border-white/5 text-neutral-700" },
                                            ].map((p, i) => (
                                                <div key={i} className={`flex flex-col items-center justify-center w-9 h-12 rounded-lg border text-[7px] font-black uppercase ${p.color}`}>
                                                    {p.label}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[8px] text-neutral-700">Usa las imágenes del vault · página en blanco detrás de cada imagen para evitar sangrado de tinta</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Mini thumbnail strip */}
                                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                                        {bookPages.map((page, idx) => (
                                            <div key={page.id} className="shrink-0 w-9 h-[50px] rounded-lg overflow-hidden bg-white/5 border border-white/10 relative">
                                                {page.image
                                                    ? <img src={page.image.url} alt="" className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full flex items-center justify-center"><Type size={10} className="text-neutral-700" /></div>
                                                }
                                                <div className="absolute bottom-0 inset-x-0 h-3 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-end px-0.5">
                                                    <span className="text-[5px] font-mono text-white/50">{idx + 1}</span>
                                                </div>
                                            </div>
                                        ))}
                                        <button onClick={() => { setBookEditorTab("editor"); setBookEditorOpen(true); }}
                                            className="shrink-0 w-9 h-[50px] rounded-lg border border-dashed border-amber-500/30 text-amber-500/50 hover:border-amber-500/60 hover:text-amber-400 flex items-center justify-center transition-all">
                                            <Plus size={12} />
                                        </button>
                                    </div>
                                    {/* Quick stats */}
                                    <div className="flex items-center gap-3">
                                        {[
                                            ["Imágenes", bookPages.filter(p => p.image).length],
                                            ["Texto", bookPages.filter(p => p.text.content.trim()).length],
                                            ["En blanco", bookPages.filter(p => !p.image && !p.text.content.trim()).length],
                                        ].map(([label, count]) => (
                                            <div key={label as string} className="flex items-center gap-1">
                                                <span className="text-[9px] font-black text-neutral-400">{count as number}</span>
                                                <span className="text-[9px] text-neutral-600">{label as string}</span>
                                            </div>
                                        ))}
                                        <div className="ml-auto flex items-center gap-1.5">
                                            <span className="text-[9px] text-neutral-600">Nombre:</span>
                                            <input value={bookFileName} onChange={e => setBookFileName(e.target.value)}
                                                className="h-5 w-24 rounded-md bg-white/5 border border-white/10 px-1.5 text-[9px] text-white outline-none focus:border-amber-500/40"
                                                placeholder="libro-kdp" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* ── ZIP FACTORY CARD ── */}
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

                {/* Asset Vault / Carousel — always visible */}
                <div className="space-y-6 animate-in fade-in slide-in-from-left-8 duration-700 pb-4">
                    <div className="flex items-center px-2 gap-3">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/5">
                                <Box size={16} />
                            </div>
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-neutral-400">Vault de Activos Digitales</h4>
                                <p className="text-[10px] text-neutral-600 font-medium italic">Sesión actual: {vaultImages.length} activos conservados</p>
                            </div>
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
                                    className="h-7 bg-neutral-900 border border-white/10 rounded-xl px-2 text-[10px] font-black text-white outline-none focus:border-violet-500/40"
                                >
                                    <option value="6x9">6"×9"</option>
                                    <option value="8x10">8"×10"</option>
                                    <option value="8.5x11">8.5"×11"</option>
                                    <option value="a4">A4</option>
                                </select>
                                <button
                                    onClick={() => void exportKdpPdf()}
                                    disabled={isExportingKdpPdf}
                                    className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-violet-600 hover:bg-violet-500 text-white transition-all border border-violet-500/50 flex items-center gap-1.5 disabled:opacity-40"
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
                            <div className="flex items-center gap-4 px-2">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                <div className="flex items-center gap-3">
                                    <Layers size={14} className="text-violet-400" />
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Catálogos IA</h3>
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            </div>
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
                        const activeCatalogs = iaCatalogs.filter(c => c.status === "running" || c.status === "pending" || c.status === "queued");
                        const doneCatalogs = iaCatalogs.filter(c => c.status === "completed" || c.status === "failed" || c.status === "cancelled");
                        const totalImages = iaCatalogs.reduce((sum, c) => sum + c.images.length, 0);

                        const renderCard = (catalog: IACatalogFE) => {
                            const progress = catalog.totalImages > 0 ? (catalog.images.length / catalog.totalImages) * 100 : 0;
                            const isActive = catalog.status === "running" || catalog.status === "pending" || catalog.status === "queued";
                            const queuedList = iaCatalogs.filter(c => c.status === "queued");
                            const queuePos = catalog.status === "queued" ? queuedList.indexOf(catalog) + 1 : 0;
                            const remainingImages = Math.max(0, catalog.totalImages - catalog.images.length - (catalog.skippedImages ?? 0));
                            const estMin = Math.round(remainingImages * 1.5);
                            const timeStr = estMin > 60 ? `~${Math.floor(estMin / 60)}h ${estMin % 60}m` : estMin > 0 ? `~${estMin}m` : "";
                            const providerColor = catalog.aiModel?.provider === "Google" ? { bar: "bg-blue-500/50", badge: "bg-blue-500/10 border-blue-500/20 text-blue-300", dot: "bg-blue-400" }
                                : catalog.aiModel?.provider === "Leonardo" ? { bar: "bg-amber-500/50", badge: "bg-amber-500/10 border-amber-500/20 text-amber-300", dot: "bg-amber-400" }
                                    : catalog.aiModel?.provider === "Pollinations" ? { bar: "bg-emerald-500/50", badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300", dot: "bg-emerald-400" }
                                        : { bar: "bg-violet-500/50", badge: "bg-violet-500/10 border-violet-500/20 text-violet-300", dot: "bg-violet-400" };
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
                                    className={`border-white/5 bg-white/[0.01] overflow-hidden transition-all duration-300 hover:border-white/10 ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragOver ? "ring-1 ring-orange-500/50 border-orange-500/30" : ""} ${draggingId === catalog._id ? "opacity-50" : ""}`}
                                >
                                    {/* Provider accent bar */}
                                    <div className={`h-px w-full ${providerColor.bar}`} />
                                    <div className="p-4 space-y-3">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    {isDraggable && <GripVertical size={12} className="text-neutral-700 shrink-0" />}
                                                    <h4 className="font-black text-white text-sm leading-tight truncate">{catalog.name}</h4>
                                                </div>
                                                <p className="text-[10px] text-neutral-500 line-clamp-1 leading-relaxed">{catalog.prompt}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                {statusBadge(catalog.status)}
                                                <span className="text-[9px] text-neutral-600 font-mono">{new Date(catalog.createdAt).toLocaleDateString("es-ES")}</span>
                                            </div>
                                        </div>
                                        {/* Model badge + meta */}
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${providerColor.badge}`}>
                                                <div className={`w-2 h-2 rounded-full ${providerColor.dot} shrink-0`} />
                                                <span className="text-[10px] font-black leading-none truncate max-w-[200px]">{catalog.aiModel?.name}</span>
                                                <span className="text-[9px] opacity-60 shrink-0">{catalog.aiModel?.provider}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] font-mono text-neutral-600">
                                                <span>{catalog.width}×{catalog.height}</span>
                                                <span className="text-neutral-700">·</span>
                                                <span className="font-black text-neutral-400">{catalog.images.length}/{catalog.totalImages}</span>
                                                {isActive && catalog.status !== "queued" && <Loader2 size={9} className="text-blue-400 animate-spin" />}
                                                {(catalog.skippedImages ?? 0) > 0 && <span className="text-amber-500/70 not-mono">· {catalog.skippedImages} omit.</span>}
                                                {isActive && catalog.status === "running" && timeStr && <span className="text-violet-400/70 not-mono">· {timeStr}</span>}
                                            </div>
                                        </div>
                                        {/* Error */}
                                        {catalog.lastError && (
                                            <p className="text-[9px] text-red-400/70 font-mono break-all leading-relaxed bg-red-500/5 border border-red-500/10 rounded-lg px-2 py-1.5">
                                                ⚠ {catalog.lastError.length > 100 ? catalog.lastError.slice(0, 100) + "…" : catalog.lastError}
                                            </p>
                                        )}
                                        {/* Action buttons */}
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    if (catalog.promptParts?.theme) {
                                                        setPromptTheme(catalog.promptParts.theme);
                                                        setPromptSpecs(catalog.promptParts.specs ?? "");
                                                        setPromptDetails(catalog.promptParts.details ?? "");
                                                        setPromptParticulars(catalog.promptParts.particulars ?? "");
                                                    } else {
                                                        // Old catalog without parts — strip the composed prefix so
                                                        // imagePrompt doesn't double-wrap it
                                                        const prefix = "Genera una imagen con la siguiente temática: ";
                                                        let raw = catalog.prompt;
                                                        if (raw.startsWith(prefix)) raw = raw.slice(prefix.length);
                                                        // Strip style suffix added by coloring-book modifier
                                                        const styleIdx = raw.indexOf(". Style:");
                                                        if (styleIdx >= 0) raw = raw.slice(0, styleIdx);
                                                        // Take only up to the first sub-clause separator
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
                                                <button
                                                    onClick={() => { const pages: BookPage[] = catalog.images.map((img, i) => ({ id: genPageId(), type: "image" as const, image: { url: img.url, scale: 1, label: `${catalog.name} #${i + 1}` }, text: defaultTextStyle() })); setBookPages(pages); setSelectedPageId(pages[0]?.id ?? null); setBookEditorOpen(true); }}
                                                    title="Editar PDF"
                                                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/20 text-[9px] font-black uppercase tracking-widest"
                                                >
                                                    <FileText size={11} /> PDF
                                                </button>
                                            )}
                                            {(catalog.skippedImages ?? 0) > 0 && !isActive && (
                                                <button
                                                    onClick={() => void retryFailedSlots(catalog._id)}
                                                    disabled={retryingCatalogId === catalog._id}
                                                    title={`Reintentar ${catalog.skippedImages} slot${(catalog.skippedImages ?? 0) > 1 ? "s" : ""} fallados`}
                                                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/20 text-[9px] font-black uppercase tracking-widest disabled:opacity-50"
                                                >
                                                    {retryingCatalogId === catalog._id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                                                    {catalog.skippedImages} fallidos
                                                </button>
                                            )}
                                            {catalog.images.length > 0 && (
                                                <button
                                                    onClick={() => setCompareSel(prev => {
                                                        const next = new Set(prev);
                                                        next.has(catalog._id) ? next.delete(catalog._id) : next.add(catalog._id);
                                                        return next;
                                                    })}
                                                    title="Seleccionar para comparar"
                                                    className={`flex items-center gap-1 h-8 px-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${compareSel.has(catalog._id) ? "bg-sky-500/20 border-sky-500/40 text-sky-300" : "bg-white/5 border-white/10 text-neutral-600 hover:text-sky-400 hover:border-sky-500/30"}`}
                                                >
                                                    <Copy size={10} />
                                                </button>
                                            )}
                                            {isActive && (
                                                <button
                                                    onClick={() => void cancelCatalog(catalog._id)}
                                                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest"
                                                >
                                                    <StopCircle size={11} /> Detener
                                                </button>
                                            )}
                                            <button onClick={() => setConfirmDeleteCatalogId(catalog._id)} disabled={deletingCatalogId === catalog._id} title="Eliminar" className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20 disabled:opacity-50">
                                                {deletingCatalogId === catalog._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                            </button>
                                        </div>
                                    </div>
                                    {/* Progress bar */}
                                    {isActive && (
                                        <div className="px-4 pb-3 space-y-1.5 border-t border-white/5 pt-3">
                                            <div className="flex justify-between text-[9px] uppercase tracking-widest text-neutral-600">
                                                <span className="flex items-center gap-1.5"><Loader2 size={8} className="animate-spin text-blue-400" />{catalog.status === "queued" ? `En cola · posición ${queuePos}` : catalog.status === "pending" ? "Iniciando..." : "Generando"}</span>
                                                {catalog.status !== "queued" && <span className="font-black text-neutral-400">{Math.round(progress)}% {timeStr && <span className="text-violet-400/80 normal-case">{timeStr}</span>}</span>}
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                {catalog.status === "queued"
                                                    ? <div className="h-full w-1/3 bg-gradient-to-r from-orange-500/30 to-orange-400/60 rounded-full animate-pulse" />
                                                    : <div className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                                                }
                                            </div>
                                        </div>
                                    )}
                                    {/* Image grid */}
                                    {catalog.images.length > 0 && (
                                        <div className="px-4 pb-4 border-t border-white/5 pt-3">
                                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                                                {catalog.images.map((img, imgIdx) => {
                                                    const isCatSelected = selectedImageUrls.has(img.url);
                                                    return (
                                                        <div
                                                            key={img.publicId}
                                                            className={`aspect-square rounded-lg overflow-hidden bg-white/5 border transition-all relative group ${isVaultSelectMode ? (isCatSelected ? "border-violet-500 ring-1 ring-violet-500/50 cursor-pointer" : "border-white/10 hover:border-violet-500/50 cursor-pointer") : "border-white/5 cursor-zoom-in hover:border-violet-500/40"}`}
                                                            onClick={() => isVaultSelectMode ? toggleImageSelect(img.url) : openCatalogImagePreview(catalog.images, imgIdx, catalog._id)}
                                                        >
                                                            <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                            {isVaultSelectMode && (
                                                                <div className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isCatSelected ? "bg-violet-500 border-violet-500" : "bg-black/50 border-white/30 backdrop-blur-sm"}`}>
                                                                    {isCatSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                                                                </div>
                                                            )}
                                                            {!isVaultSelectMode && (
                                                                <button
                                                                    onClick={e => { e.stopPropagation(); toggleFavorite(img.url, { label: `${catalog.name} #${imgIdx + 1}`, source: "catalog" }); }}
                                                                    className={`absolute top-0.5 left-0.5 p-0.5 rounded-md backdrop-blur-sm transition-all ${favorites.has(img.url) ? "bg-rose-500/80 text-white opacity-100" : "bg-black/50 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-rose-400"}`}
                                                                >
                                                                    <Heart size={8} className={favorites.has(img.url) ? "fill-white" : ""} />
                                                                </button>
                                                            )}
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
                                <div className="flex items-center gap-4 px-2">
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                    <div className="flex items-center gap-3">
                                        <Layers size={14} className="text-violet-400" />
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Catálogos IA</h3>
                                        {totalImages > 0 && (
                                            <span className="text-[9px] font-black text-violet-400/60 tabular-nums">{totalImages} imgs</span>
                                        )}
                                    </div>
                                    <button onClick={() => void fetchCatalogs()} disabled={isLoadingCatalogs} className="p-2 rounded-xl bg-white/5 border border-white/10 text-neutral-500 hover:text-violet-400 hover:border-violet-500/30 transition-all disabled:opacity-40">
                                        {isLoadingCatalogs ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    </button>
                                    {compareSel.size >= 2 && (
                                        <button onClick={() => setCompareOpen(true)}
                                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[9px] font-black uppercase tracking-widest hover:bg-sky-500/25 transition-all">
                                            <Copy size={10} /> Comparar ({compareSel.size})
                                        </button>
                                    )}
                                    {compareSel.size > 0 && (
                                        <button onClick={() => setCompareSel(new Set())} className="text-[9px] text-neutral-600 hover:text-white transition-colors uppercase font-black">Limpiar</button>
                                    )}
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                </div>

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

    const renderStudio = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">

            {/* ══ RADAR IA ══ */}
            <div className="rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                <div className="h-px w-full bg-gradient-to-r from-amber-500/60 via-orange-400/20 to-transparent rounded-t-3xl" />
                <div className="p-6 space-y-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-xl font-black bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent flex items-center gap-2.5">
                                <TrendingUp size={20} className="text-amber-400" /> Radar de Nichos
                            </h2>
                            <p className="text-xs text-neutral-500">Tendencias de mercado analizadas con IA para KDP, Etsy y Printify</p>
                        </div>
                        <button onClick={() => void fetchTrends()} disabled={isLoadingTrends}
                            className="h-10 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0">
                            {isLoadingTrends ? <Loader2 size={13} className="animate-spin" /> : <TrendingUp size={13} />}
                            {isLoadingTrends ? "Analizando..." : "Analizar"}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <KdpSelect accent="amber" value={trendsPlatform} onChange={v => setTrendsPlatform(v as any)}
                            options={[{ value: "all", label: "Todas las plataformas" }, { value: "kdp", label: "Amazon KDP" }, { value: "etsy", label: "Etsy" }, { value: "printify", label: "Printify" }]} />
                        <KdpSelect accent="amber" value={trendsCategory} onChange={v => setTrendsCategory(v)}
                            options={TREND_CATEGORIES.map(c => ({ value: c, label: c === "all" ? "Todas las categorías" : c }))} />
                    </div>
                    {isLoadingTrends && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <Loader2 size={28} className="animate-spin text-amber-400" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Analizando mercado con IA...</p>
                        </div>
                    )}
                    {!isLoadingTrends && !trendsData && (
                        <div className="flex flex-col items-center justify-center py-16 text-center space-y-2 opacity-25">
                            <TrendingUp size={32} strokeWidth={1.5} className="text-neutral-600" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Pulsa Analizar para ver tendencias</p>
                        </div>
                    )}
                    {trendsData && !isLoadingTrends && (
                        <div className="space-y-3">
                            {trendsData.summary && (
                                <div className="flex items-start gap-2.5 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                                    <Newspaper size={13} className="text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-neutral-400 leading-relaxed">{trendsData.summary}</p>
                                </div>
                            )}
                            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                                {(trendsData.trends ?? []).map((t: any) => {
                                    const isHot = trendsData.hot_picks?.includes(t.id);
                                    const isSelected = selectedTrend?.id === t.id;
                                    return (
                                        <button key={t.id} onClick={() => setSelectedTrend(isSelected ? null : t)}
                                            className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? "border-amber-500/40 bg-amber-500/8" : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.03]"}`}>
                                            <div className="flex items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[12px] font-bold text-white">{t.niche}</span>
                                                        {isHot && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-black uppercase border border-amber-500/30 shrink-0">🔥 Hot</span>}
                                                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-black uppercase shrink-0 ${COMPETITION_COLORS[t.competition] ?? "text-neutral-400 bg-white/5 border-white/10"}`}>{t.competition}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] text-neutral-600">{t.category}</span>
                                                        {DEMAND_ICONS[t.demand_trend] && <span className="flex items-center gap-0.5 ml-1">{DEMAND_ICONS[t.demand_trend]}<span className="text-[9px] text-neutral-600">{t.demand_trend}</span></span>}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="flex items-center gap-0.5 justify-end">
                                                        <Star size={9} className="text-amber-400" />
                                                        <span className="text-[11px] font-black text-amber-400">{t.trend_score}</span>
                                                    </div>
                                                    <p className="text-[8px] text-neutral-600">${t.avg_price_usd}</p>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="mt-2.5 pt-2.5 border-t border-white/5 space-y-2" onClick={e => e.stopPropagation()}>
                                                    {t.angle && <p className="text-[10px] text-neutral-400 italic">{t.angle}</p>}
                                                    {Array.isArray(t.product_ideas) && (
                                                        <ul className="space-y-0.5">
                                                            {t.product_ideas.map((idea: string, i: number) => (
                                                                <li key={i} className="text-[10px] text-neutral-300 flex gap-1.5"><span className="text-amber-400 shrink-0">▸</span>{idea}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    {Array.isArray(t.keywords) && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {t.keywords.map((k: string, i: number) => (
                                                                <span key={i} className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/8 text-neutral-500">{k}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex gap-1.5 pt-0.5">
                                                        <button onClick={() => { setContentNiche(t.niche); toast.success("Nicho cargado en Contenido →"); }}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[9px] font-black uppercase hover:bg-violet-500/20 transition-colors">
                                                            <Send size={9} /> Usar en Contenido →
                                                        </button>
                                                        <button onClick={() => { setPromptTheme(t.niche); changeTab("creation"); toast.success("Cargado en Imágenes"); }}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black uppercase hover:bg-amber-500/20 transition-colors">
                                                            <ImageIcon size={9} /> Imágenes
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* ══ MIS NICHOS + CONTENIDO ══ */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

                {/* ── MIS NICHOS ── */}
                <div className="rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                    <div className="h-px w-full bg-gradient-to-r from-violet-500/60 via-violet-400/20 to-transparent rounded-t-3xl" />
                    <div className="p-6 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-white flex items-center gap-2.5">
                                    <Target size={20} className="text-violet-400" /> Mis Nichos
                                </h2>
                                <p className="text-xs text-neutral-500">Pipeline de nichos · fases y generación de contenido</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => void fetchNiches()} disabled={isLoadingNiches} className="p-2.5 rounded-xl bg-white/5 border border-white/8 text-neutral-500 hover:text-violet-400 hover:border-violet-500/30 transition-all disabled:opacity-40">
                                    {isLoadingNiches ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                                </button>
                                <button onClick={() => openNicheForm()} className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_4px_12px_rgba(139,92,246,0.3)]">
                                    <Plus size={13} /> Nuevo
                                </button>
                            </div>
                        </div>
                        {/* Segmented filter */}
                        <div className="flex p-1.5 bg-white/[0.03] border border-white/8 rounded-2xl gap-0.5">
                            {(["all", "found", "research", "active", "archived"] as const).map(s => {
                                const cnt = s === "all" ? niches.length : niches.filter(n => n.status === s).length;
                                const isAct = nicheStatusFilter === s;
                                const dot: Record<string, string> = { found: "bg-blue-400", research: "bg-amber-400", active: "bg-emerald-400", archived: "bg-neutral-600" };
                                return (
                                    <button key={s} onClick={() => setNicheStatusFilter(s)}
                                        className={`flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${isAct ? "bg-white/10 text-white" : "text-neutral-600 hover:text-neutral-400"}`}>
                                        {s !== "all" && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[s]}`} />}
                                        <span className="truncate">{s === "all" ? "Todo" : STATUS_LABELS[s].label}</span>
                                        {cnt > 0 && <span className={`text-[8px] tabular-nums ${isAct ? "text-white/50" : "text-neutral-700"}`}>{cnt}</span>}
                                    </button>
                                );
                            })}
                            <button onClick={() => setNicheSortBy(p => p === "score" ? "date" : "score")}
                                className="ml-1 h-8 px-3 rounded-xl bg-white/5 border border-white/8 text-[9px] font-black uppercase text-neutral-500 hover:text-white transition-all shrink-0">
                                {nicheSortBy === "score" ? "★" : "↓"}
                            </button>
                        </div>
                        {/* Loading */}
                        {isLoadingNiches && (
                            <div className="space-y-2">
                                {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-white/[0.03] animate-pulse border border-white/5" />)}
                            </div>
                        )}
                        {/* Empty */}
                        {!isLoadingNiches && (nicheStatusFilter === "all" ? niches : niches.filter(n => n.status === nicheStatusFilter)).length === 0 && (
                            <div className="flex flex-col items-center gap-3 py-8 opacity-40">
                                <Target size={24} strokeWidth={1.2} className="text-neutral-600" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                                    {niches.length === 0 ? "Sin nichos aún" : "Sin resultados"}
                                </p>
                            </div>
                        )}
                        {/* List */}
                        {!isLoadingNiches && (nicheStatusFilter === "all" ? niches : niches.filter(n => n.status === nicheStatusFilter)).length > 0 && (
                            <div className="space-y-2">
                                {(nicheStatusFilter === "all" ? niches : niches.filter(n => n.status === nicheStatusFilter))
                                    .slice()
                                    .sort((a, b) => nicheSortBy === "score" ? nicheScore(b) - nicheScore(a) : 0)
                                    .map(niche => {
                                        const score = nicheScore(niche);
                                        const scoreColor = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-neutral-500";
                                        const PHASES: { id: NicheFE["phase"]; label: string }[] = [
                                            { id: "niche", label: "Nicho" },
                                            { id: "catalog", label: "Catálogo" },
                                            { id: "pdf", label: "PDF" },
                                            { id: "published", label: "Publicado" },
                                        ];
                                        const phaseIdx = PHASES.findIndex(p => p.id === (niche.phase ?? "niche"));
                                        const statusDot: Record<string, string> = { found: "bg-blue-400", research: "bg-amber-400", active: "bg-emerald-400", archived: "bg-neutral-600" };
                                        return (
                                            <div key={niche._id} className="group relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] hover:border-white/14 hover:from-white/[0.06] hover:to-white/[0.02] transition-all overflow-hidden">
                                                {/* Glass shimmer line */}
                                                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                                                <div className="p-4 space-y-4 relative">
                                                    {/* Header */}
                                                    <div className="flex items-start gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-sm font-bold text-white leading-tight">{niche.name}</span>
                                                                <span className="flex items-center gap-1.5">
                                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[niche.status] ?? "bg-neutral-600"}`} />
                                                                    <span className="text-[10px] text-neutral-500">{STATUS_LABELS[niche.status].label}</span>
                                                                </span>
                                                                <span className={`text-xs font-bold tabular-nums ${scoreColor}`}>★ {score}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                <span className="text-xs text-neutral-600">
                                                                    {NICHE_PRODUCT_OPTIONS.find(p => p.id === (niche.productType ?? "coloring-book"))?.label ?? niche.productType}
                                                                </span>
                                                                <span className="text-xs text-neutral-700">·</span>
                                                                <span className="text-xs text-neutral-600">
                                                                    {NICHE_STYLE_OPTIONS.find(s => s.id === (niche.styleCategory ?? "generic"))?.label ?? niche.styleCategory}
                                                                </span>
                                                            </div>
                                                            {niche.description && <p className="text-xs text-neutral-600 mt-1 line-clamp-1">{niche.description}</p>}
                                                        </div>
                                                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {niche.generatedPrompt && (
                                                                <button onClick={() => saveNichePromptToLibrary(niche)} title="Guardar prompt"
                                                                    className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-white/8 transition-all">
                                                                    <BookMarked size={13} />
                                                                </button>
                                                            )}
                                                            <button onClick={() => openNicheForm(niche)} className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-white/8 transition-all"><Pencil size={13} /></button>
                                                            <button onClick={() => setNicheDeleteId(niche._id)} className="p-1.5 rounded-lg text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"><Trash2 size={13} /></button>
                                                        </div>
                                                    </div>

                                                    {/* Pipeline timeline */}
                                                    <div className="relative">
                                                        {/* Background track */}
                                                        <div className="absolute top-[10px] left-4 right-4 h-px bg-white/[0.08]" />
                                                        {/* Completed track */}
                                                        {phaseIdx > 0 && (
                                                            <div
                                                                className="absolute top-[10px] left-4 h-px bg-gradient-to-r from-white/30 to-white/15 transition-all"
                                                                style={{ width: `calc(${(phaseIdx / (PHASES.length - 1)) * 100}% - 32px)` }}
                                                            />
                                                        )}
                                                        <div className="flex items-start justify-between relative">
                                                            {PHASES.map((ph, i) => {
                                                                const done = i <= phaseIdx;
                                                                const isCurrent = i === phaseIdx;
                                                                const isNext = i === phaseIdx + 1;
                                                                return (
                                                                    <button key={ph.id}
                                                                        onClick={() => {
                                                                            if (isNext) void advanceNichePhase(niche);
                                                                            else if (done && !isCurrent) void setNichePhase(niche, ph.id);
                                                                        }}
                                                                        title={isCurrent ? ph.label : isNext ? `Avanzar → ${ph.label}` : done ? `Volver a ${ph.label}` : ph.label}
                                                                        className={`flex flex-col items-center gap-1.5 transition-all ${isCurrent ? "cursor-default" : (done || isNext) ? "cursor-pointer group/step" : "cursor-default"}`}
                                                                    >
                                                                        {/* Dot */}
                                                                        <span className={`relative flex items-center justify-center w-5 h-5 rounded-full transition-all ${isCurrent
                                                                                ? "bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.15),0_0_12px_rgba(255,255,255,0.35)]"
                                                                                : done
                                                                                    ? "bg-white/20 border border-white/20 group-hover/step:bg-white/30"
                                                                                    : isNext
                                                                                        ? "bg-transparent border border-dashed border-white/25 group-hover/step:border-white/50"
                                                                                        : "bg-transparent border border-white/8"
                                                                            }`}>
                                                                            {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white/30" />}
                                                                            {done && !isCurrent && <Check size={9} className="text-white/60" />}
                                                                        </span>
                                                                        {/* Label */}
                                                                        <span className={`text-[10px] font-semibold whitespace-nowrap transition-all ${isCurrent ? "text-white"
                                                                                : done ? "text-neutral-500 group-hover/step:text-neutral-300"
                                                                                    : isNext ? "text-neutral-600 group-hover/step:text-neutral-400"
                                                                                        : "text-neutral-800"
                                                                            }`}>{ph.label}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Footer: meta + action */}
                                                    <div className="flex items-center gap-2 justify-between pt-0.5">
                                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                            {niche.competition !== "unknown" && (
                                                                <span className="text-[10px] text-neutral-600">
                                                                    Comp <span className={`font-bold ${COMPETITION_LABELS[niche.competition].color.split(" ")[0]}`}>{COMPETITION_LABELS[niche.competition].label}</span>
                                                                </span>
                                                            )}
                                                            {niche.demand !== "unknown" && (
                                                                <span className="text-[10px] text-neutral-600">
                                                                    · Dem <span className={`font-bold ${DEMAND_LABELS[niche.demand].color.split(" ")[0]}`}>{DEMAND_LABELS[niche.demand].label}</span>
                                                                </span>
                                                            )}
                                                            {(niche.catalogIds?.length ?? 0) > 0 && (
                                                                <span className="text-[10px] font-bold text-emerald-500">✓ {niche.catalogIds!.length} cat.</span>
                                                            )}
                                                            {niche.tags.slice(0, 1).map(tag => (
                                                                <span key={tag} className="text-[10px] text-neutral-700">#{tag}</span>
                                                            ))}
                                                        </div>
                                                        <button
                                                            onClick={() => void generateNicheContent(niche)}
                                                            disabled={nicheGeneratingId === niche._id}
                                                            className="flex items-center gap-1.5 px-3 h-7 rounded-xl bg-white/[0.05] border border-white/10 text-[10px] font-black text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                                        >
                                                            {nicheGeneratingId === niche._id
                                                                ? <><Loader2 size={10} className="animate-spin" /> IA...</>
                                                                : <><Sparkles size={10} /> Generar</>}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── CONTENIDO ── */}
                <div className="rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                    <div className="h-px w-full bg-gradient-to-r from-amber-500/40 via-violet-400/20 to-transparent rounded-t-3xl" />
                    <div className="p-6 space-y-4">
                        <div className="space-y-1">
                            <h2 className="text-xl font-black bg-gradient-to-r from-amber-400 to-violet-400 bg-clip-text text-transparent flex items-center gap-2.5">
                                <Sparkles size={20} className="text-amber-400" /> Generador de Contenido
                            </h2>
                            <p className="text-xs text-neutral-500">Metadatos listos para publicar en KDP y Etsy</p>
                        </div>

                        {/* ── KDP Physical Book — primary card ── */}
                        <button
                            onClick={() => { setContentType("kdp-physical-book"); setContentResult(null); }}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all text-left ${contentType === "kdp-physical-book" ? "border-amber-500/40 bg-amber-500/[0.07]" : "border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.03]"}`}>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${contentType === "kdp-physical-book" ? "bg-amber-500/20" : "bg-white/5"}`}>
                                <BookOpen size={16} className={contentType === "kdp-physical-book" ? "text-amber-400" : "text-neutral-600"} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-black leading-tight ${contentType === "kdp-physical-book" ? "text-amber-300" : "text-neutral-400"}`}>Libro físico KDP</p>
                                <p className="text-[10px] text-neutral-600 mt-0.5">Título · Subtítulo · Descripción · 7 palabras clave</p>
                            </div>
                            {contentType === "kdp-physical-book" && (
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            )}
                        </button>

                        {/* ── Secondary types ── */}
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                            {CONTENT_TYPES_SECONDARY.map(ct => (
                                <button key={ct.id} onClick={() => { setContentType(ct.id as any); setContentResult(null); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all shrink-0 ${contentType === ct.id ? "border-white/25 bg-white/10 text-white" : "border-white/8 bg-white/[0.02] text-neutral-600 hover:border-white/15 hover:text-neutral-400"}`}>
                                    {ct.icon}
                                    <span className="text-[9px] font-bold whitespace-nowrap">{ct.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* ── Inputs — adapt by type ── */}
                        {contentType === "kdp-physical-book" ? (
                            <div className="space-y-3">
                                <textarea
                                    value={contentNiche} onChange={e => setContentNiche(e.target.value)} rows={3}
                                    placeholder="Describe tu libro: temática, género, público objetivo, estilo visual…&#10;ej: libro de colorear de mandalas zen para adultos, estilo minimalista"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/40 resize-none leading-relaxed transition-all" />
                                <div className="flex items-center gap-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600 shrink-0">Idioma del listing</p>
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

                        {/* ── Generate button ── */}
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

                        {isGeneratingContent && (
                            <div className="flex flex-col items-center justify-center py-10 gap-3">
                                <div className="relative">
                                    <Loader2 size={24} className="animate-spin text-amber-400" />
                                </div>
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
                            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">

                                {/* ── KDP Physical Book result ── */}
                                {contentType === "kdp-physical-book" && typeof contentResult === "object" && (
                                    <div className="space-y-2.5">
                                        {/* Copy all listing */}
                                        {(contentResult.title || contentResult.description || contentResult.keywords?.length) && (
                                            <button
                                                onClick={() => {
                                                    const parts: string[] = [];
                                                    if (contentResult.title) parts.push(`TÍTULO: ${contentResult.title}${contentResult.subtitle ? `\nSUBTÍTULO: ${contentResult.subtitle}` : ""}`);
                                                    if (contentResult.description) parts.push(`\nDESCRIPCIÓN:\n${contentResult.description}`);
                                                    if (Array.isArray(contentResult.keywords) && contentResult.keywords.length > 0) parts.push(`\nKEYWORDS: ${contentResult.keywords.join(", ")}`);
                                                    copyText(parts.join("\n"));
                                                }}
                                                className="w-full flex items-center justify-center gap-2 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black transition-all text-[10px] font-black uppercase tracking-widest"
                                            >
                                                <Copy size={12} /> Copiar listing completo
                                            </button>
                                        )}
                                        {/* Title + Subtitle */}
                                        {contentResult.title && (
                                            <div className="bg-amber-500/[0.04] border border-amber-500/15 rounded-2xl p-4 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/80">Título</p>
                                                    <button onClick={() => copyText(`${contentResult.title}${contentResult.subtitle ? `: ${contentResult.subtitle}` : ""}`)} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-neutral-500 hover:text-white text-[9px] transition-colors"><Copy size={9} /> Copiar</button>
                                                </div>
                                                <p className="text-[15px] font-black text-white leading-tight">{contentResult.title}</p>
                                                {contentResult.subtitle && (
                                                    <p className="text-[11px] text-amber-200/60 leading-snug border-t border-amber-500/10 pt-2">{contentResult.subtitle}</p>
                                                )}
                                            </div>
                                        )}
                                        {/* Description */}
                                        {contentResult.description && (
                                            <div className="bg-white/[0.02] border border-white/6 rounded-2xl p-4 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-violet-400/80">Descripción</p>
                                                    <button onClick={() => copyText(contentResult.description)} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-neutral-500 hover:text-white text-[9px] transition-colors"><Copy size={9} /> Copiar</button>
                                                </div>
                                                <p className="text-[10px] text-neutral-300 leading-relaxed whitespace-pre-line">{contentResult.description}</p>
                                            </div>
                                        )}
                                        {/* 7 Keywords */}
                                        {Array.isArray(contentResult.keywords) && contentResult.keywords.length > 0 && (
                                            <div className="bg-white/[0.02] border border-white/6 rounded-2xl p-4 space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-violet-400/80">
                                                        {contentResult.keywords.length} Palabras clave
                                                    </p>
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
                                        {/* Regenerate hint */}
                                        <button onClick={() => void generateContent()} className="w-full flex items-center justify-center gap-1.5 py-2 text-[9px] font-black uppercase tracking-widest text-neutral-700 hover:text-neutral-400 transition-colors">
                                            <Sparkles size={9} /> Regenerar
                                        </button>
                                    </div>
                                )}

                                {contentType === "full-listing" && typeof contentResult === "object" && (
                                    <>
                                        {contentResult.title && (
                                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
                                                <div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Título</p><button onClick={() => copyText(contentResult.title)} className="p-1 rounded text-neutral-600 hover:text-white transition-colors"><Copy size={10} /></button></div>
                                                <p className="text-sm text-white font-medium">{contentResult.title}</p>
                                                {contentResult.subtitle && <p className="text-[10px] text-neutral-500">{contentResult.subtitle}</p>}
                                            </div>
                                        )}
                                        {contentResult.description && (
                                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
                                                <div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Descripción</p><button onClick={() => copyText(contentResult.description)} className="p-1 rounded text-neutral-600 hover:text-white transition-colors"><Copy size={10} /></button></div>
                                                <p className="text-[10px] text-neutral-300 leading-relaxed whitespace-pre-line">{contentResult.description}</p>
                                            </div>
                                        )}
                                        {Array.isArray(contentResult.bullets) && contentResult.bullets.length > 0 && (
                                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Bullets</p>
                                                <ul className="space-y-0.5">{contentResult.bullets.map((b: string, i: number) => <li key={i} className="text-[10px] text-neutral-300 flex gap-1.5"><span className="text-violet-400 shrink-0">▸</span>{b}</li>)}</ul>
                                            </div>
                                        )}
                                        {Array.isArray(contentResult.keywords) && (
                                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1.5">
                                                <div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Keywords ({contentResult.keywords.length})</p><button onClick={() => copyText(contentResult.keywords.join(", "))} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-neutral-400 hover:text-white text-[9px] transition-colors"><Copy size={9} /> Copiar</button></div>
                                                <div className="flex flex-wrap gap-1">{contentResult.keywords.map((k: string, i: number) => <button key={i} onClick={() => copyText(k)} className="text-[8px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 transition-colors">{k}</button>)}</div>
                                            </div>
                                        )}
                                        {contentResult.price_suggestion_usd && (
                                            <div className="flex items-center gap-3 px-3 py-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                                                <DollarSign size={13} className="text-emerald-400 shrink-0" />
                                                <div><p className="text-[8px] text-neutral-600 uppercase">Precio sugerido</p><p className="text-sm font-black text-emerald-400">${contentResult.price_suggestion_usd}</p></div>
                                                {contentResult.series_name && <div className="ml-auto"><p className="text-[8px] text-neutral-600 uppercase">Serie</p><p className="text-[10px] text-neutral-300">{contentResult.series_name}</p></div>}
                                            </div>
                                        )}
                                    </>
                                )}
                                {contentType === "titles" && Array.isArray(contentResult) && (
                                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Títulos ({contentResult.length})</p>
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
                                        {contentResult.description && <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Descripción</p><button onClick={() => copyText(contentResult.description)} className="p-1 rounded text-neutral-600 hover:text-white"><Copy size={10} /></button></div><p className="text-[10px] text-neutral-300 leading-relaxed whitespace-pre-line">{contentResult.description}</p></div>}
                                        {Array.isArray(contentResult.bullets) && <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1"><p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Bullets</p>{contentResult.bullets.map((b: string, i: number) => <p key={i} className="text-[10px] text-neutral-300 flex gap-1.5"><span className="text-violet-400 shrink-0">▸</span>{b}</p>)}</div>}
                                    </>
                                )}
                                {contentType === "keywords" && Array.isArray(contentResult) && (
                                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Keywords ({contentResult.length})</p><button onClick={() => copyText(contentResult.join(", "))} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-neutral-400 hover:text-white text-[9px]"><Copy size={9} /> Copiar todos</button></div>
                                        <div className="flex flex-wrap gap-1.5">{contentResult.map((k: string, i: number) => <button key={i} onClick={() => copyText(k)} className="text-[9px] px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 transition-colors">{k}</button>)}</div>
                                    </div>
                                )}
                                {contentType === "back-cover" && typeof contentResult === "object" && contentResult.back_cover && (
                                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1.5">
                                        <div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Contraportada</p><button onClick={() => copyText(contentResult.back_cover)} className="p-1 rounded text-neutral-600 hover:text-white"><Copy size={10} /></button></div>
                                        <p className="text-[11px] text-neutral-200 leading-relaxed whitespace-pre-line">{contentResult.back_cover}</p>
                                    </div>
                                )}
                                {contentType === "series" && typeof contentResult === "object" && contentResult.series_name && (
                                    <div className="space-y-2">
                                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3"><p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Serie</p><p className="text-base font-black text-white mt-0.5">{contentResult.series_name}</p>{contentResult.concept && <p className="text-[10px] text-neutral-400 mt-0.5">{contentResult.concept}</p>}</div>
                                        {Array.isArray(contentResult.volumes) && contentResult.volumes.map((v: any, i: number) => (
                                            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex gap-2">
                                                <span className="text-[9px] font-black text-violet-400 w-4 shrink-0 mt-0.5">{i + 1}</span>
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
    );

    return (
        <div className="space-y-12 pb-24">
            {/* Sub-Navigation Tabs - Floating Style */}
            <div className="sticky top-[90px] z-[50] w-full flex justify-center pointer-events-none px-4">
                <div className="pointer-events-auto flex p-1.5 bg-[#111111]/90 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] max-w-full overflow-x-auto no-scrollbar">
                    {[
                        { id: "insights", name: "Insights", icon: <Activity size={15} /> },
                        { id: "catalog", name: "Productos", icon: <Box size={15} /> },
                        { id: "creation", name: "Imágenes", icon: <ImageIcon size={15} /> },
                        { id: "studio", name: "Studio IA", icon: <Sparkles size={15} /> },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => changeTab(tab.id as TabID)}
                            className={`flex items-center gap-2 md:gap-3 px-4 md:px-8 py-3.5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-500 whitespace-nowrap justify-center ${activeTab === tab.id
                                ? "bg-white text-black shadow-lg scale-[1.05] z-10"
                                : "text-neutral-500 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {tab.icon}
                            <span className="hidden md:inline">{tab.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area Rendering Based on Active Tab */}
            <div className="relative pt-6">
                {activeTab === "insights" && renderInsights()}
                {activeTab === "catalog" && renderCatalog()}
                {activeTab === "creation" && renderCreation()}
                {activeTab === "studio" && renderStudio()}
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
                        {/* Image — centered, bottom padding leaves room for toolbar */}
                        <div
                            className="absolute inset-x-0 top-0 flex items-center justify-center px-4 pt-4"
                            style={{ bottom: "calc(env(safe-area-inset-bottom) + 160px)" }}
                            onClick={closePreview}
                        >
                            <div
                                className="relative flex items-center justify-center w-full max-w-6xl h-full gap-3"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {previewContext && previewContext.index > 0 ? (
                                    <button onClick={() => navigatePreview(-1)}
                                        className="shrink-0 w-11 h-11 rounded-2xl bg-black/60 backdrop-blur-md text-white border border-white/10 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center">
                                        <ChevronLeft size={20} />
                                    </button>
                                ) : previewContext ? <div className="shrink-0 w-11" /> : null}
                                <img
                                    key={previewImage}
                                    src={previewImage}
                                    alt="Vista previa"
                                    className="flex-1 min-w-0 max-w-full max-h-full w-auto h-auto object-contain rounded-2xl"
                                    onClick={(e) => e.stopPropagation()}
                                />
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
                            {previewContext && (
                                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                                    {previewContext.index + 1} / {previewContext.urls.length}
                                </span>
                            )}
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
                                            {bookPages.map((page, idx) => (
                                                <div key={page.id}
                                                    data-page-idx={idx}
                                                    draggable
                                                    onDragStart={() => handleBookDragStart(idx)}
                                                    onDragOver={e => handleBookDragOver(e, idx)}
                                                    onDrop={() => handleBookDrop(idx)}
                                                    onDragEnd={handleBookDragEnd}
                                                    onTouchStart={e => handleThumbnailTouchStart(e, idx)}
                                                    onTouchMove={handleThumbnailTouchMove}
                                                    onTouchEnd={handleThumbnailTouchEnd}
                                                    onClick={() => { setSelectedPageId(page.id); setShowInlineImagePicker(false); }}
                                                    className={`group shrink-0 w-14 h-[80px] sm:w-12 sm:h-[68px] rounded-xl border-2 cursor-grab active:cursor-grabbing relative overflow-hidden transition-all select-none touch-none
                                                        ${selectedPageId === page.id
                                                            ? "border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                                                            : bookDragOverIdx === idx && bookDragIdx !== idx
                                                                ? "border-amber-500/40 scale-105"
                                                                : bookDragIdx === idx
                                                                    ? "border-white/10 opacity-25"
                                                                    : "border-white/10 hover:border-white/30"}`}>
                                                    <div className="w-full h-full bg-[#1a1a1a]">
                                                        {page.image
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
                                                    {/* Delete — always visible on mobile, hover-only on desktop */}
                                                    <button onClick={e => { e.stopPropagation(); deletePage(page.id); }}
                                                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-black/80 text-red-400 sm:opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                                        title="Eliminar">
                                                        <X size={9} />
                                                    </button>
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
                                                    <button onClick={() => duplicatePage(selectedPage.id)}
                                                        className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-neutral-500 hover:text-white flex items-center justify-center transition-all" title="Duplicar página">
                                                        <Copy size={14} />
                                                    </button>
                                                    <button onClick={() => deletePage(selectedPage.id)}
                                                        className="ml-auto flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all text-[11px] font-black">
                                                        <Trash2 size={13} /><span className="hidden sm:inline">Eliminar</span>
                                                    </button>
                                                </div>

                                                {/* ── Type selector (compact pill row) ── */}
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
                                                            const hPct = Math.min(35, (48 / Math.max(zoom, 0.1) / 595.28) * 100);
                                                            const vPct = Math.min(35, (48 / Math.max(zoom, 0.1) / 841.89) * 100);
                                                            const brd = selectedPage.image.border;
                                                            return (
                                                                <div
                                                                    className="relative w-full rounded-xl overflow-hidden border border-white/15 shadow-lg bg-white"
                                                                    style={{
                                                                        aspectRatio: "595/842",
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

                                                                {/* A4 page mock */}
                                                                <div className="relative w-full rounded-xl overflow-hidden border border-white/15 shadow-2xl"
                                                                    style={{ aspectRatio: "595/842" }}>
                                                                    {/* Page background */}
                                                                    <div className="absolute inset-0 bg-white" />
                                                                    {(selectedPage.type === "both" && selectedPage.image) && (() => {
                                                                        const z = selectedPage.image.scale ?? 1;
                                                                        const hP = Math.min(35, (48 / Math.max(z, 0.1) / 595.28) * 100);
                                                                        const vP = Math.min(35, (48 / Math.max(z, 0.1) / 841.89) * 100);
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
                                /* Match drawImageCentered: effectiveMargin = 48/zoom pts on 595×842 page */
                                const mH = (48 / Math.max(zoom, 0.1) / 595.28) * 100;
                                const mV = (48 / Math.max(zoom, 0.1) / 841.89) * 100;
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
                                        {/* PDF button */}
                                        <button onClick={() => void buildBookPdf()} disabled={isBuildingPdf || bookPages.length === 0}
                                            className="h-7 px-3 rounded-full bg-amber-500 text-black text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-40">
                                            {isBuildingPdf ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                            <span>PDF</span>
                                        </button>
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
                                                        className="relative overflow-hidden rounded-xl shadow-[0_16px_64px_rgba(0,0,0,0.8)] transition-all cursor-pointer group"
                                                        style={{ aspectRatio: "595/842", width: "min(100%, calc((min(90vh, 100dvh) - 280px) * 595 / 842))", height: "auto" }}
                                                        onClick={() => { setBookEditorTab("editor"); setShowInlineImagePicker(false); }}
                                                    >
                                                        {curPage && renderPageInner(curPage, 0.5)}
                                                        {/* Edit hint */}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-white/20">
                                                                Editar página
                                                            </span>
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
                                                                    style={{ aspectRatio: "595/842" }}
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
                                                        <div className="flex-1 aspect-[595/842] bg-white/[0.03] rounded-lg border border-dashed border-white/8 flex items-center justify-center">
                                                            <span className="text-[8px] text-neutral-700">—</span>
                                                        </div>
                                                    );
                                                    return (
                                                        <div className="flex-1 cursor-pointer group" onClick={() => { setSelectedPageId(page.id); setBookEditorTab("editor"); }}>
                                                            <div className="w-full aspect-[595/842] relative overflow-hidden rounded-l-sm rounded-r-sm shadow-[0_4px_20px_rgba(0,0,0,0.5)] group-hover:shadow-[0_4px_28px_rgba(0,0,0,0.7)] transition-shadow">
                                                                {renderPageInner(page, 0.3)}
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

            {/* Confirm Delete Product Dialog */}
            {confirmDeleteProductId && (
                <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" role="dialog" aria-modal="true">
                    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0f0f0f] p-8 space-y-6 shadow-2xl">
                        <div className="space-y-3 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto">
                                <Trash2 size={24} className="text-rose-400" />
                            </div>
                            <p className="text-base font-black text-white">¿Eliminar producto?</p>
                            <p className="text-sm text-neutral-500 leading-relaxed">
                                Se eliminará <span className="text-white font-bold">{products.find(p => p.id === confirmDeleteProductId)?.title ?? "este producto"}</span> de tu biblioteca. Esta acción no se puede deshacer.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDeleteProductId(null)} className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all">
                                Cancelar
                            </button>
                            <button onClick={() => { handleDeleteProduct(confirmDeleteProductId); setConfirmDeleteProductId(null); }} className="flex-1 h-11 rounded-2xl bg-rose-500 text-white text-sm font-black hover:bg-rose-400 transition-all">
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Catalog Dialog */}
            {confirmDeleteCatalogId && (
                <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" role="dialog" aria-modal="true">
                    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0f0f0f] p-8 space-y-6 shadow-2xl">
                        <div className="space-y-2 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto"><Trash2 size={24} className="text-red-400" /></div>
                            <p className="text-base font-black text-white">¿Eliminar catálogo?</p>
                            <p className="text-sm text-neutral-500">Se eliminarán todas las imágenes de Cloudinary. Esta acción no se puede deshacer.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDeleteCatalogId(null)} className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all">Cancelar</button>
                            <button onClick={() => void deleteCatalogConfirmed(confirmDeleteCatalogId)} className="flex-1 h-11 rounded-2xl bg-red-500 text-white text-sm font-black hover:bg-red-400 transition-all">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Image Dialog */}
            {confirmDeleteImageInfo && (
                <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" role="dialog" aria-modal="true">
                    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0f0f0f] p-8 space-y-6 shadow-2xl">
                        <div className="space-y-2 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto"><ImageIcon size={24} className="text-red-400" /></div>
                            <p className="text-base font-black text-white">¿Eliminar imagen?</p>
                            <p className="text-sm text-neutral-500">Se eliminará de Cloudinary y del catálogo.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDeleteImageInfo(null)} className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all">Cancelar</button>
                            <button onClick={() => void deleteCatalogImageConfirmed(confirmDeleteImageInfo.catalogId, confirmDeleteImageInfo.publicId)} className="flex-1 h-11 rounded-2xl bg-red-500 text-white text-sm font-black hover:bg-red-400 transition-all">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Vault Image Dialog */}
            {confirmDeleteVaultIndex !== null && (
                <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" role="dialog" aria-modal="true">
                    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0f0f0f] p-8 space-y-6 shadow-2xl">
                        <div className="space-y-2 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto"><Trash2 size={24} className="text-red-400" /></div>
                            <p className="text-base font-black text-white">¿Eliminar del vault?</p>
                            <p className="text-sm text-neutral-500">La imagen se eliminará de la sesión actual.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDeleteVaultIndex(null)} className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all">Cancelar</button>
                            <button onClick={() => { setVaultImages(prev => prev.filter((_, i) => i !== confirmDeleteVaultIndex)); setConfirmDeleteVaultIndex(null); closePreview(); }} className="flex-1 h-11 rounded-2xl bg-red-500 text-white text-sm font-black hover:bg-red-400 transition-all">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

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
                                    className="w-full h-11 rounded-2xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-violet-500/40 transition-all placeholder:text-neutral-700"
                                    autoFocus
                                    onKeyDown={e => { if (e.key === "Enter") void saveCurrentPrompt(); }}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Categoría</label>
                                <KdpSelect accent="violet"
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
                                            className="flex-1 h-9 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:border-violet-500/40 transition-all placeholder:text-neutral-700"
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
                                            className="h-9 px-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-400 text-[9px] font-black uppercase hover:bg-violet-500/30 transition-all"
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
                                className="flex-1 h-11 rounded-2xl bg-violet-500 text-white text-sm font-black hover:bg-violet-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 transition-all" />
                            </div>
                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Descripción</label>
                                <textarea value={nicheFormDesc} onChange={e => setNicheFormDesc(e.target.value)} rows={2} placeholder="Describe brevemente el nicho…"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 transition-all resize-none" />
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
                                            className={`flex-1 h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${nicheFormProductType === opt.id ? "border-violet-500/40 bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20" : "border-white/10 bg-white/5 text-neutral-600 hover:text-white"}`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Style Category */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Estilo visual</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {NICHE_STYLE_OPTIONS.map(opt => (
                                        <button key={opt.id} onClick={() => setNicheFormStyle(opt.id)}
                                            className={`h-10 rounded-xl border px-3 text-left transition-all ${nicheFormStyle === opt.id ? "border-violet-500/40 bg-violet-500/10 ring-1 ring-violet-500/20" : "border-white/8 bg-white/[0.02] hover:bg-white/5"}`}>
                                            <span className={`block text-[9px] font-black uppercase tracking-widest ${nicheFormStyle === opt.id ? "text-violet-400" : "text-neutral-400"}`}>{opt.label}</span>
                                            <span className="block text-[8px] text-neutral-600 leading-tight">{opt.desc}</span>
                                        </button>
                                    ))}
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
                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 transition-all" />
                                {nicheFormTags.trim() && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {nicheFormTags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                                            <span key={tag} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-[8px] text-neutral-400">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Notes */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Notas</label>
                                <textarea value={nicheFormNotes} onChange={e => setNicheFormNotes(e.target.value)} rows={3} placeholder="Observaciones, ideas, URLs de referencia…"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 transition-all resize-none" />
                            </div>
                            {/* Generated Prompt */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                                    Prompt generado <span className="normal-case text-neutral-600">(guardado automáticamente al generar contenido)</span>
                                </label>
                                <textarea value={nicheFormPrompt} onChange={e => setNicheFormPrompt(e.target.value)} rows={4} placeholder="El prompt de imagen se guardará aquí al usar Generar contenido…"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] text-neutral-300 placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 transition-all resize-none font-mono leading-relaxed" />
                                {nicheFormPrompt.trim() && (
                                    <button
                                        onClick={() => { setPromptTheme(nicheFormPrompt.trim()); changeTab("creation"); setNicheFormOpen(false); toast.success("Prompt aplicado al generador"); }}
                                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[9px] font-black uppercase tracking-widest hover:bg-violet-500 hover:text-white hover:border-violet-500 transition-all">
                                        <ArrowRight size={10} /> Aplicar en generador
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="px-6 pb-6 pt-4 border-t border-white/8 shrink-0 flex gap-3">
                            <button onClick={() => setNicheFormOpen(false)} className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all">Cancelar</button>
                            <button onClick={() => void saveNiche()} disabled={isSavingNiche || !nicheFormName.trim()}
                                className="flex-1 h-11 rounded-2xl bg-violet-500 text-white text-sm font-black hover:bg-violet-400 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
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
                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 transition-all"
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
                                            className="text-[9px] font-black uppercase tracking-widest text-violet-400 hover:text-violet-300 transition-colors"
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
                                                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${sel ? "border-violet-500 ring-1 ring-violet-500/50" : "border-white/10 opacity-40 hover:opacity-70"}`}
                                                >
                                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                                    {sel && (
                                                        <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
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
                                            className="text-[9px] font-black uppercase tracking-widest text-violet-400 hover:text-violet-300 transition-colors"
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
                                                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${sel ? "border-violet-500 ring-1 ring-violet-500/50" : "border-white/10 opacity-40 hover:opacity-70"}`}
                                                    title={img.publicId.split("/").pop()}
                                                >
                                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                                    {sel && (
                                                        <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                                                            <Check size={9} className="text-white" strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Completed catalogs */}
                            {iaCatalogs.filter(c => c.status === "completed" && c.images.length > 0).length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Catálogos completados</p>
                                        <button
                                            onClick={() => {
                                                const completed = iaCatalogs.filter(c => c.status === "completed" && c.images.length > 0);
                                                const allSel = completed.every(c => kdpTemplateCatalogSel.has(c._id));
                                                setKdpTemplateCatalogSel(allSel ? new Set() : new Set(completed.map(c => c._id)));
                                            }}
                                            className="text-[9px] font-black uppercase tracking-widest text-violet-400 hover:text-violet-300 transition-colors"
                                        >
                                            {iaCatalogs.filter(c => c.status === "completed" && c.images.length > 0).every(c => kdpTemplateCatalogSel.has(c._id)) ? "Deseleccionar todo" : "Seleccionar todo"}
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {iaCatalogs.filter(c => c.status === "completed" && c.images.length > 0).map(catalog => {
                                            const sel = kdpTemplateCatalogSel.has(catalog._id);
                                            return (
                                                <button
                                                    key={catalog._id}
                                                    onClick={() => setKdpTemplateCatalogSel(prev => {
                                                        const next = new Set(prev);
                                                        sel ? next.delete(catalog._id) : next.add(catalog._id);
                                                        return next;
                                                    })}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${sel ? "border-violet-500/60 bg-violet-500/8" : "border-white/8 bg-white/[0.02] opacity-50 hover:opacity-80"}`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${sel ? "bg-violet-500 border-violet-500" : "border-white/20 bg-white/5"}`}>
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
                            {/* Summary */}
                            {(() => {
                                const vaultCount = kdpTemplateVaultSel.size;
                                const cloudCount = kdpTemplateCloudSel.size;
                                const catalogCount = iaCatalogs
                                    .filter(c => kdpTemplateCatalogSel.has(c._id))
                                    .reduce((acc, c) => acc + c.images.length, 0);
                                const total = vaultCount + cloudCount + catalogCount;
                                return total > 0 ? (
                                    <p className="text-[10px] text-neutral-500 text-center">
                                        <span className="text-violet-400 font-black">{total}</span> imágenes seleccionadas · <span className="text-neutral-400 font-black">{total * 2 + 2}</span> páginas totales (portada + blanco + imagen + blanco × {total})
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
                                        applyColoringBookTemplate(kdpTemplateTitle || "Mi Libro de Colorear", [...vaultEntries, ...cloudEntries, ...catalogEntries]);
                                    }}
                                    disabled={kdpTemplateVaultSel.size === 0 && kdpTemplateCatalogSel.size === 0 && kdpTemplateCloudSel.size === 0}
                                    className="flex-1 h-11 rounded-2xl bg-violet-500 text-white text-sm font-black hover:bg-violet-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <BookOpen size={16} /> Aplicar plantilla
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── COMPARE CATALOGS MODAL ── */}
            {compareOpen && compareSel.size >= 1 && (() => {
                const cats = iaCatalogs.filter(c => compareSel.has(c._id));
                return (
                    <div className="fixed inset-0 z-[170] bg-black/85 backdrop-blur-md flex flex-col" role="dialog" aria-modal="true">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
                            <div className="flex items-center gap-3">
                                <Copy size={15} className="text-sky-400" />
                                <p className="text-sm font-black text-white">Comparando {cats.length} catálogos</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { setCompareSel(new Set()); setCompareOpen(false); }}
                                    className="text-[9px] font-black uppercase text-neutral-500 hover:text-white transition-colors px-3">
                                    Limpiar selección
                                </button>
                                <button onClick={() => setCompareOpen(false)}
                                    className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-white/10 transition-all">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        {/* Body — horizontal scroll of catalog panels */}
                        <div className="flex-1 overflow-hidden flex gap-0">
                            {cats.map((cat, ci) => (
                                <div key={cat._id} className={`flex-1 min-w-0 flex flex-col border-white/8 ${ci > 0 ? "border-l" : ""}`}>
                                    {/* Catalog header */}
                                    <div className="px-4 py-3 border-b border-white/8 shrink-0">
                                        <p className="text-[11px] font-black text-white truncate">{cat.name}</p>
                                        <p className="text-[9px] text-neutral-500 truncate">{cat.aiModel?.name} · {cat.images.length} imágenes</p>
                                    </div>
                                    {/* Image grid — scrollable */}
                                    <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
                                        {cat.images.map((img, ii) => (
                                            <div key={img.publicId} className="relative aspect-square rounded-xl overflow-hidden group/img border border-white/5 hover:border-white/20 transition-all">
                                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                                    <a href={img.url} target="_blank" rel="noreferrer"
                                                        className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all"
                                                        onClick={e => e.stopPropagation()}>
                                                        <ExternalLink size={12} />
                                                    </a>
                                                </div>
                                                <span className="absolute bottom-1 left-1 text-[7px] font-black text-white/50 bg-black/40 rounded px-1">#{ii + 1}</span>
                                            </div>
                                        ))}
                                        {cat.images.length === 0 && (
                                            <p className="col-span-2 text-[10px] text-neutral-600 text-center py-8">Sin imágenes aún</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

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
