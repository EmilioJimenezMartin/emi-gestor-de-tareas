"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
    Cpu,
    Sparkles,
    Wand2,
    Zap,
    TrendingUp,
    Layers,
    Target,
    Globe,
    Search,
    BookOpen,
    BarChart3,
    CheckCircle2,
    AlertCircle,
    Settings,
    Plus,
    Trash2,
    DollarSign,
    Box,
    ShoppingCart,
    Palette,
    FileText,
    Image as ImageIcon,
    Shirt,
    Frame,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    BarChart,
    PieChart,
    ChevronDown,
    Calendar,
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
    Activity,
    Lightbulb,
    Download,
    Store,
    RefreshCw,
    StopCircle,
    PlayCircle,
    ImagePlus,
    Copy,
    BookMarked,
    ChevronUp
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

type TabID = "insights" | "catalog" | "creation";
type PeriodID = "month" | "6months" | "year" | "all";

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
    aiModel: { id: string; name: string; provider: string; modelId: string };
    width: number;
    height: number;
    totalImages: number;
    images: CatalogImageFE[];
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    lastError?: string;
    skippedImages?: number;
    createdAt: string;
}

interface SavedPromptFE {
    _id: string;
    name: string;
    category: string;
    promptParts: { theme: string; specs: string; details: string; particulars: string };
    createdAt: string;
}

const DEFAULT_PROMPT_CATEGORIES = ["General", "Anime", "Mandala", "Acuarela", "Ilustración", "Arte Digital", "Coloring Book", "Fotografía", "Retrato", "Paisaje", "Abstracto", "Cómic"];

interface QueuedCatalog {
    queueId: string;
    name: string;
    prompt: string;
    promptParts: { theme: string; specs: string; details: string; particulars: string };
    model: typeof AI_MODELS[number];
    dim: typeof AI_DIMENSIONS[number];
    totalImages: number;
}

export function KdpFactoryApp() {
    const [activeTab, setActiveTab] = useState<TabID>("insights");
    const [chartPeriod, setChartPeriod] = useState<PeriodID>("month");

    // State for mock chart data
    const [chartData, setChartData] = useState<number[]>([]);

    useEffect(() => {
        // Generate mock data based on period
        let dataLength = 14;
        if (chartPeriod === "6months") dataLength = 24;
        if (chartPeriod === "year") dataLength = 12;
        if (chartPeriod === "all") dataLength = 20;

        const newData = Array.from({ length: dataLength }, () => Math.floor(Math.random() * 150) + 20);
        setChartData(newData);
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
    const [isCreatingCatalog, setIsCreatingCatalog] = useState(false);
    const [deletingCatalogId, setDeletingCatalogId] = useState<string | null>(null);
    const [confirmDeleteCatalogId, setConfirmDeleteCatalogId] = useState<string | null>(null);
    const [confirmDeleteImageInfo, setConfirmDeleteImageInfo] = useState<{ catalogId: string; publicId: string } | null>(null);
    const [bookPdfMode, setBookPdfMode] = useState<"colored" | "full">("colored");
    const [bookEditorImages, setBookEditorImages] = useState<{ url: string; label?: string; scale: number }[]>([]);
    const [previewContext, setPreviewContext] = useState<{ urls: string[]; index: number; catalogCtx?: { id: string; images: CatalogImageFE[] }; vaultCtx?: true; cloudinaryCtx?: true } | null>(null);
    const [confirmDeleteVaultIndex, setConfirmDeleteVaultIndex] = useState<number | null>(null);
    const [confirmDeleteCloudinaryId, setConfirmDeleteCloudinaryId] = useState<string | null>(null);
    const [catalogQueue, setCatalogQueue] = useState<QueuedCatalog[]>([]);
    const catalogQueueRef = useRef<QueuedCatalog[]>([]);
    const [savedPrompts, setSavedPrompts] = useState<SavedPromptFE[]>([]);
    const [isLoadingSavedPrompts, setIsLoadingSavedPrompts] = useState(false);
    const [showSavePromptDialog, setShowSavePromptDialog] = useState(false);
    const [savePromptName, setSavePromptName] = useState("");
    const [savePromptCategory, setSavePromptCategory] = useState("General");
    const [newCategoryInput, setNewCategoryInput] = useState("");
    const [promptCategoryFilter, setPromptCategoryFilter] = useState("all");
    const [isSavingPrompt, setIsSavingPrompt] = useState(false);
    const catalogSocketRef = useRef<ReturnType<typeof createApiSocket> | null>(null);

    // Keep queue ref in sync so socket handlers always see the latest queue
    useEffect(() => { catalogQueueRef.current = catalogQueue; }, [catalogQueue]);

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
            toast.success(`Catálogo iniciado — ${catalogFormCount} imágenes en segundo plano`);
        } catch (e: any) {
            toast.error(e.message ?? "Error al crear catálogo");
        } finally {
            setIsCreatingCatalog(false);
        }
    };

    const launchQueuedCatalog = async (item: QueuedCatalog) => {
        try {
            const res = await fetch(`${API_BASE_URL}/catalogs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: item.name || undefined,
                    prompt: item.prompt,
                    promptParts: item.promptParts,
                    aiModel: { id: item.model.id, name: item.model.name, provider: item.model.provider, modelId: item.model.modelId },
                    width: item.dim.width,
                    height: item.dim.height,
                    totalImages: item.totalImages,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            setIaCatalogs((prev) => [data.catalog, ...prev]);
            toast.success(`Catálogo "${item.name || "de cola"}" iniciado`);
        } catch (e: any) {
            toast.error(`Error al iniciar catálogo en cola: ${e.message}`);
        }
    };

    const processQueue = () => {
        if (catalogQueueRef.current.length === 0) return;
        const [next, ...rest] = catalogQueueRef.current;
        catalogQueueRef.current = rest;
        setCatalogQueue(rest);
        toast.info("Siguiente catálogo comenzará en 2 minutos...");
        setTimeout(() => void launchQueuedCatalog(next), 2 * 60 * 1000);
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

    const saveCurrentPrompt = async () => {
        if (!promptTheme.trim()) { toast.error("La temática está vacía"); return; }
        if (!savePromptName.trim()) { toast.error("Dale un nombre al prompt"); return; }
        setIsSavingPrompt(true);
        try {
            const res = await fetch(`${API_BASE_URL}/saved-prompts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: savePromptName.trim(),
                    category: savePromptCategory,
                    promptParts: { theme: promptTheme.trim(), specs: promptSpecs.trim(), details: promptDetails.trim(), particulars: promptParticulars.trim() },
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

    const loadSavedPrompt = (p: SavedPromptFE) => {
        setPromptTheme(p.promptParts.theme);
        setPromptSpecs(p.promptParts.specs);
        setPromptDetails(p.promptParts.details);
        setPromptParticulars(p.promptParts.particulars);
        toast.success("Prompt cargado");
    };

    const addToQueue = () => {
        if (!promptTheme.trim()) { toast.error("Escribe la temática primero"); return; }
        if (!catalogFormCount || catalogFormCount < 1) { toast.error("Indica cuántas imágenes (mínimo 1)"); return; }
        const model = AI_MODELS.find((m) => m.id === selectedModel);
        const dim = AI_DIMENSIONS.find((d) => d.id === selectedDim);
        if (!model || !dim) return;
        const item: QueuedCatalog = {
            queueId: `q-${Date.now()}`,
            name: catalogFormName.trim(),
            prompt: imagePrompt.trim(),
            promptParts: { theme: promptTheme.trim(), specs: promptSpecs.trim(), details: promptDetails.trim(), particulars: promptParticulars.trim() },
            model,
            dim,
            totalImages: catalogFormCount,
        };
        setCatalogQueue((prev) => [...prev, item]);
        setCatalogFormName("");
        toast.success("Catálogo añadido a la cola");
    };

    const deleteCatalogImageConfirmed = async (catalogId: string, publicId: string) => {
        setConfirmDeleteImageInfo(null);
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

    const moveBookImage = (idx: number, dir: -1 | 1) => {
        setBookEditorImages(prev => {
            const target = idx + dir;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[target]] = [next[target], next[idx]];
            return next;
        });
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
    const [bookFooterText, setBookFooterText] = useState("");
    const [bookFileName, setBookFileName] = useState("libro-kdp");
    const [isBuildingPdf, setIsBuildingPdf] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [showModelParams, setShowModelParams] = useState(false);
    const [negativePrompt, setNegativePrompt] = useState("");
    const [inferenceSteps, setInferenceSteps] = useState(28);
    const [guidanceScale, setGuidanceScale] = useState(7.5);
    const [fixedSeed, setFixedSeed] = useState("");
    const [ideogramStyle, setIdeogramStyle] = useState("AUTO");
    const [initImageDataUrl, setInitImageDataUrl] = useState<string | null>(null);
    const [initImageStrength, setInitImageStrength] = useState(0.6);

    const downloadFile = (url: string, filename: string) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const downloadPng = (url: string, filenameBase: string) => {
        downloadFile(url, `${filenameBase}.png`);
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

    const upscaleImageMax = async (
        url: string,
        opts?: { setAsGenerated?: boolean; setAsPreview?: boolean }
    ) => {
        setIsUpscaling(true);
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            if (!blob.type.startsWith("image/")) {
                toast.error("La fuente no es una imagen válida");
                return;
            }

            const srcUrl = URL.createObjectURL(blob);
            try {
                const img = new Image();
                img.decoding = "async";
                img.src = srcUrl;
                await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
                });

                const srcW = img.naturalWidth || img.width;
                const srcH = img.naturalHeight || img.height;
                if (!srcW || !srcH) {
                    toast.error("No se pudo leer el tamaño de la imagen");
                    return;
                }

                const maxSide = Math.max(srcW, srcH);
                const maxDim = 4096; // límite razonable para navegador/memoria
                const maxFactorByDim = Math.max(1, Math.floor(maxDim / maxSide));
                const factor = Math.min(4, maxFactorByDim);

                if (factor <= 1) {
                    toast.info("La imagen ya está al máximo razonable");
                    return;
                }

                const outW = Math.round(srcW * factor);
                const outH = Math.round(srcH * factor);

                const canvas = document.createElement("canvas");
                canvas.width = outW;
                canvas.height = outH;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    toast.error("No se pudo inicializar el canvas");
                    return;
                }
                ctx.imageSmoothingEnabled = true;
                if ("imageSmoothingQuality" in ctx) (ctx as any).imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, outW, outH);

                const outBlob: Blob | null = await new Promise((resolve) =>
                    canvas.toBlob((b) => resolve(b), "image/png", 1)
                );
                if (!outBlob) {
                    toast.error("No se pudo exportar la imagen");
                    return;
                }

                const outUrl = URL.createObjectURL(outBlob);
                if (opts?.setAsGenerated) {
                    if (generatedImageObjectUrlRef.current) {
                        URL.revokeObjectURL(generatedImageObjectUrlRef.current);
                        generatedImageObjectUrlRef.current = null;
                    }
                    generatedImageObjectUrlRef.current = outUrl;
                    setIsImageLoading(true);
                    setGeneratedImage(outUrl);
                }
                if (opts?.setAsPreview) {
                    if (previewImageObjectUrlRef.current) {
                        URL.revokeObjectURL(previewImageObjectUrlRef.current);
                        previewImageObjectUrlRef.current = null;
                    }
                    previewImageObjectUrlRef.current = outUrl;
                    setPreviewImage(outUrl);
                }
                toast.success(`Upscale x${factor} aplicado`);
            } finally {
                URL.revokeObjectURL(srcUrl);
            }
        } catch (e) {
            console.error(e);
            toast.error("No se pudo mejorar la calidad");
        } finally {
            setIsUpscaling(false);
        }
    };

    const ensureObjectUrl = async (url: string) => {
        if (url.startsWith("blob:")) return url;
        const res = await fetch(url);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        return objectUrl;
    };

    const buildBookPdf = async () => {
        if (bookEditorImages.length === 0) return;

        setIsBuildingPdf(true);
        try {
            const pdf = await PDFDocument.create();
            const pageWidth = 595.28;
            const pageHeight = 841.89;
            const margin = 48;
            const font = await pdf.embedFont(StandardFonts.Helvetica);

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
                page.drawImage(embedded, {
                    x: (pageWidth - embedded.width * imgScale) / 2,
                    y: (pageHeight - embedded.height * imgScale) / 2,
                    width: embedded.width * imgScale,
                    height: embedded.height * imgScale,
                });
            };

            if (bookPdfMode === "colored") {
                // Page 1 (blank + text), then blank + image alternating
                const totalPages = 1 + bookEditorImages.length * 2;
                const pages = Array.from({ length: totalPages }, () => pdf.addPage([pageWidth, pageHeight]));
                if (bookFooterText.trim()) {
                    const text = bookFooterText.trim();
                    const textWidth = font.widthOfTextAtSize(text, 12);
                    pages[0].drawText(text, { x: Math.max(margin, pageWidth - margin - textWidth), y: margin, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
                }
                for (let i = 0; i < bookEditorImages.length; i++) {
                    const embedded = await embedImage(bookEditorImages[i].url);
                    drawImageCentered(pages[2 + i * 2], embedded, bookEditorImages[i].scale ?? 1);
                }
            } else {
                // Full: page 1 text only, then one image per page
                const totalPages = 1 + bookEditorImages.length;
                const pages = Array.from({ length: totalPages }, () => pdf.addPage([pageWidth, pageHeight]));
                if (bookFooterText.trim()) {
                    const text = bookFooterText.trim();
                    const textWidth = font.widthOfTextAtSize(text, 12);
                    pages[0].drawText(text, { x: Math.max(margin, pageWidth - margin - textWidth), y: margin, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
                }
                for (let i = 0; i < bookEditorImages.length; i++) {
                    const embedded = await embedImage(bookEditorImages[i].url);
                    drawImageCentered(pages[1 + i], embedded, bookEditorImages[i].scale ?? 1);
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
            processQueue();
        });

        socket.on("catalog:error", (data: { catalogId: string; error: string }) => {
            setIaCatalogs((prev) =>
                prev.map((c) => (c._id === data.catalogId ? { ...c, status: "failed", lastError: data.error } : c))
            );
            toast.error(`Error en catálogo: ${data.error}`);
            processQueue();
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

        // Pollinations: URL directa, sin pasar por el backend
        if (model?.provider === "Pollinations") {
            const seed = fixedSeed ? Number(fixedSeed) : Math.floor(Math.random() * 999999);
            const negParam = negativePrompt.trim() ? `&negative=${encodeURIComponent(negativePrompt.trim())}` : "";
            const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt.trim())}?width=${dimensions?.width ?? 1024}&height=${dimensions?.height ?? 1024}&seed=${seed}&model=${encodeURIComponent(model.modelId || "flux")}&nologo=true&enhance=false${negParam}`;
            const img = new Image();
            img.src = url;
            img.onload = () => {
                setGeneratedImage(url);
                setIsGenerating(false);
                toast.success("Imagen generada con Pollinations");
            };
            img.onerror = () => {
                setIsGenerating(false);
                setIsImageLoading(false);
                toast.error("Error generando imagen con Pollinations");
            };
            return;
        }

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

            // Fallback: Pollinations sin modelo específico
            const seed = Math.floor(Math.random() * 999999);
            const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt.trim())}?width=${dimensions?.width ?? 1024}&height=${dimensions?.height ?? 1024}&seed=${seed}&nologo=true&enhance=false`;
            const img = new Image();
            img.src = url;
            img.onload = () => {
                setGeneratedImage(url);
                setIsGenerating(false);
                toast.success("Generado con Pollinations (fallback)");
            };
            img.onerror = () => {
                setIsGenerating(false);
                setIsImageLoading(false);
                toast.error("Error en la generación");
            };

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
        setActiveTab("catalog");
    };

    const handleDeleteProduct = (id: string) => {
        setProducts(products.filter(p => p.id !== id));
        toast.success("Producto eliminado");
    };

    const renderInsights = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-indigo-500/30 transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/10 blur-2xl rounded-full transition-all group-hover:scale-150" />
                    <div className="flex items-center justify-between relative">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Ganancias Totales</span>
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <div className="space-y-1 relative">
                        <p className="text-3xl font-black italic tracking-tighter text-white tabular-nums">
                            {stats.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                            <ArrowUpRight size={12} />
                            <span>+12.5% vs mes anterior</span>
                        </div>
                    </div>
                </Card>

                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-blue-500/30 transition-all duration-500 group relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Promedio / Asset</span>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                            <BarChart size={16} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-3xl font-black italic tracking-tighter text-white tabular-nums">
                            {stats.avg.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
                        </p>
                        <div className="text-[10px] font-bold text-blue-400 italic">Rendimiento Saludable</div>
                    </div>
                </Card>

                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-emerald-500/30 transition-all duration-500 group relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Market Reach</span>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <Globe size={16} />
                        </div>
                    </div>
                    <div className="space-y-1 text-3xl font-black italic tracking-tighter text-white">
                        4/4 <span className="text-xs uppercase text-neutral-500 tracking-widest not-italic ml-2">Platforms</span>
                    </div>
                </Card>

                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-purple-500/30 transition-all duration-500 group relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Top Nicho</span>
                        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                            <Activity size={16} />
                        </div>
                    </div>
                    <div className="space-y-1 text-xl font-black italic tracking-tighter text-white flex flex-col">
                        <span>Mandala Art</span>
                        <span className="text-[11px] uppercase font-black text-purple-400 tracking-widest">+45% Demand</span>
                    </div>
                </Card>
            </div>

            {/* Charts Section */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card variant="glass" className="lg:col-span-2 p-8 border-white/5 bg-white/[0.01] space-y-8 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2">
                                <Activity size={14} className="text-indigo-400" />
                                Evolución de Tendencias
                            </h3>
                            <p className="text-[10px] text-neutral-500 font-medium tracking-tight">Análisis predictivo basado en volumen de ventas</p>
                        </div>

                        {/* Period Filter Dropdown */}
                        <div className="relative inline-block w-full md:w-48">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                                <Calendar size={12} />
                            </div>
                            <select
                                value={chartPeriod}
                                onChange={(e) => setChartPeriod(e.target.value as PeriodID)}
                                className="w-full h-10 bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer hover:bg-white/[0.08] transition-all"
                            >
                                <option value="month" className="bg-[#0a0a0a]">Último Mes</option>
                                <option value="6months" className="bg-6months">Últimos 6 Meses</option>
                                <option value="year" className="bg-[#0a0a0a]">Último Año</option>
                                <option value="all" className="bg-[#0a0a0a]">Histórico Total</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
                                <ChevronDown size={14} />
                            </div>
                        </div>
                    </div>

                    {/* Mock Chart Area with Dynamic Data */}
                    <div className="h-[250px] w-full flex items-end justify-between gap-1 sm:gap-2 pt-14 mt-4">
                        {chartData.map((height, i) => (
                            <div key={i} className="flex-1 group relative h-full flex items-end">
                                <div
                                    className="w-full bg-gradient-to-t from-indigo-500/10 via-indigo-500/30 to-indigo-500/50 rounded-t-sm sm:rounded-t-lg group-hover:from-indigo-500/30 group-hover:to-indigo-400 transition-all duration-700 relative overflow-hidden"
                                    style={{ height: `${height}%` }}
                                >
                                    <div className="absolute inset-x-0 top-0 h-0.5 bg-white/40 blur-[1px]" />
                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                </div>
                                {/* Tooltip */}
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-[10px] font-black text-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 pointer-events-none shadow-2xl z-20">
                                    {height}€
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between px-2 text-[10px] font-black text-neutral-600 uppercase tracking-widest pt-3 border-t border-white/5">
                        {chartPeriod === "month" && (
                            <>
                                <span>Semana 1</span>
                                <span>Semana 2</span>
                                <span>Semana 3</span>
                                <span>Semana 4</span>
                            </>
                        )}
                        {chartPeriod === "6months" && (
                            <>
                                <span>Mes 1</span>
                                <span>Mes 3</span>
                                <span>Mes 6</span>
                            </>
                        )}
                        {chartPeriod === "year" && (
                            <>
                                <span>Trimestre 1</span>
                                <span>Trimestre 2</span>
                                <span>Trimestre 3</span>
                                <span>Trimestre 4</span>
                            </>
                        )}
                        {chartPeriod === "all" && (
                            <>
                                <span>2024</span>
                                <span>2025</span>
                                <span>2026</span>
                            </>
                        )}
                    </div>
                </Card>

                <Card variant="glass" className="p-8 border-white/5 bg-white/[0.01] space-y-8 flex flex-col justify-between relative overflow-hidden">
                    <div className="space-y-6 relative">
                        <div className="space-y-1">
                            <h3 className="text-sm font-black text-white italic tracking-widest uppercase">Platform Split</h3>
                            <p className="text-[10px] text-neutral-500 font-medium tracking-tight">Distribución por canales de venta</p>
                        </div>

                        <div className="space-y-5">
                            {[
                                { name: "Amazon KDP", percent: 65, color: "bg-orange-500" },
                                { name: "Etsy", percent: 25, color: "bg-indigo-500" },
                                { name: "Creative Fabrica", percent: 10, color: "bg-blue-500" }
                            ].map((plat: { name: string, percent: number, color: string, earnings?: number }) => (
                                <div key={plat.name} className="space-y-2.5">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-neutral-400">{plat.name}</span>
                                        <span className="text-white italic tabular-nums">{(plat.earnings || plat.percent)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[2px]">
                                        <div className={`h-full ${plat.color} rounded-full flex items-center justify-end px-1`} style={{ width: `${plat.percent}%` }}>
                                            <div className="w-1 h-1 bg-white/40 rounded-full blur-[1px]" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-3 relative group/alert">
                        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover/alert:opacity-100 transition-opacity duration-500" />
                        <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.05em] flex items-center gap-2">
                            <Lightbulb size={10} /> Smart Insight
                        </p>
                        <p className="text-[11px] text-neutral-400 leading-relaxed italic relative">
                            "Los posters digitales de la serie 'Cyberpunk' están rindiendo un 25% mejor en Etsy que en otras plataformas este mes."
                        </p>
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
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-hover:text-indigo-400 transition-colors">
                            <Filter size={14} />
                        </div>
                        <select
                            value={catalogFilter}
                            onChange={(e) => setCatalogFilter(e.target.value)}
                            className="w-full md:w-64 h-12 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-10 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-indigo-500/40 appearance-none cursor-pointer hover:bg-white/[0.08] transition-all"
                        >
                            <option value="all" className="bg-[#0a0a0a]">Todos los Activos</option>
                            {PRODUCT_TYPES.map(type => (
                                <option key={type.id} value={type.id} className="bg-[#0a0a0a]">{type.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
                            <ChevronDown size={16} />
                        </div>
                    </div>
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
                                            onClick={() => handleDeleteProduct(product.id)}
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

    const renderAIStudio = () => (
        <div className="lg:col-span-12 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 mt-8 pb-12">
            <div className="flex items-center gap-4 px-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Zap size={16} className="text-amber-400 fill-amber-400/20" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">IA Asset Studio</h3>
                    </div>
                    <button
                        onClick={() => setShowAdvancedOptions((v) => !v)}
                        className={`p-2 rounded-xl border transition-all ${showAdvancedOptions ? "bg-white/10 border-white/20 text-white" : "bg-white/5 border-white/10 text-neutral-500 hover:text-white"}`}
                        title="Opciones avanzadas"
                        aria-label="Opciones avanzadas"
                    >
                        <ImageIcon size={14} />
                    </button>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Generation Control */}
                <Card variant="glass" className="p-6 md:p-8 border-white/5 bg-white/[0.01] space-y-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-700">
                        <ImageIcon size={200} />
                    </div>

                    <div className="space-y-6 relative z-10">
                        {/* Model & Dim Selectors Wrapper */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Model picker */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Modelo I.A.</label>
                                <div className="relative">
                                    {showModelPicker && (
                                        <div className="fixed inset-0 z-40" onClick={() => setShowModelPicker(false)} />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => { setShowModelPicker(v => !v); setShowDimPicker(false); }}
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 flex items-center justify-between gap-3 hover:bg-white/10 transition-all focus:outline-none focus:border-amber-500/40"
                                    >
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-sm font-bold text-white truncate leading-tight">{AI_MODELS.find(m => m.id === selectedModel)?.name}</p>
                                            <p className="text-[10px] text-neutral-500 truncate leading-tight">{AI_MODELS.find(m => m.id === selectedModel)?.provider} · {AI_MODELS.find(m => m.id === selectedModel)?.type}</p>
                                        </div>
                                        <ChevronDown size={16} className={`text-neutral-500 shrink-0 transition-transform duration-200 ${showModelPicker ? "rotate-180" : ""}`} />
                                    </button>
                                    {showModelPicker && (
                                        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-[#111]/98 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-72 overflow-y-auto">
                                            {AI_MODELS.map(m => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                                                    className={`w-full px-4 py-3.5 flex items-center gap-3 transition-all text-left border-b border-white/5 last:border-0 ${selectedModel === m.id ? "bg-white/8" : "hover:bg-white/5"}`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-white leading-tight">{m.name}</p>
                                                        <p className="text-[11px] text-neutral-500 leading-tight mt-0.5">{m.provider} · {m.type}</p>
                                                    </div>
                                                    {selectedModel === m.id && <Check size={16} className="text-emerald-400 shrink-0" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Dimension picker */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Dimensiones</label>
                                {/* Quick presets */}
                                <div className="grid grid-cols-4 gap-2">
                                    {AI_DIMENSIONS.filter((d) => ["sq", "pt", "p23", "p34"].includes(d.id)).map((d) => (
                                        <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => setSelectedDim(d.id)}
                                            className={`h-12 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${selectedDim === d.id ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-neutral-500 hover:bg-white/10"}`}
                                        >
                                            {d.id === "sq" ? <Monitor size={13} /> : <Maximize size={13} />}
                                            <span className="text-[9px] font-black uppercase">{d.ratio}</span>
                                        </button>
                                    ))}
                                </div>
                                {/* Full list — custom dropdown */}
                                <div className="relative">
                                    {showDimPicker && (
                                        <div className="fixed inset-0 z-40" onClick={() => setShowDimPicker(false)} />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => { setShowDimPicker(v => !v); setShowModelPicker(false); }}
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 flex items-center justify-between gap-3 hover:bg-white/10 transition-all focus:outline-none focus:border-amber-500/40"
                                    >
                                        {(() => { const d = AI_DIMENSIONS.find(d => d.id === selectedDim); return (
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="text-sm font-bold text-white truncate leading-tight">{d?.name} <span className="font-normal text-neutral-400">({d?.ratio})</span></p>
                                                <p className="text-[10px] text-neutral-500 leading-tight">{d?.width}×{d?.height} px</p>
                                            </div>
                                        ); })()}
                                        <ChevronDown size={16} className={`text-neutral-500 shrink-0 transition-transform duration-200 ${showDimPicker ? "rotate-180" : ""}`} />
                                    </button>
                                    {showDimPicker && (
                                        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-[#111]/98 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-64 overflow-y-auto">
                                            {AI_DIMENSIONS.map(d => (
                                                <button
                                                    key={d.id}
                                                    type="button"
                                                    onClick={() => { setSelectedDim(d.id); setShowDimPicker(false); }}
                                                    className={`w-full px-4 py-3.5 flex items-center gap-3 transition-all text-left border-b border-white/5 last:border-0 ${selectedDim === d.id ? "bg-white/8" : "hover:bg-white/5"}`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-white leading-tight">{d.name} <span className="font-normal text-neutral-400">({d.ratio})</span></p>
                                                        <p className="text-[11px] text-neutral-500 leading-tight mt-0.5">{d.width}×{d.height} px</p>
                                                    </div>
                                                    {selectedDim === d.id && <Check size={16} className="text-emerald-400 shrink-0" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Multi-field prompt */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Prompt del Activo</span>
                                {imagePrompt && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => navigator.clipboard.writeText(imagePrompt).then(() => toast.success("Prompt copiado"))}
                                            className="p-1 rounded-lg bg-white/5 text-neutral-600 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                                            title="Copiar prompt completo"
                                        >
                                            <Copy size={10} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSavePromptName(""); setSavePromptCategory("General"); setShowSavePromptDialog(true); }}
                                            className="p-1 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-all border border-violet-500/20"
                                            title="Guardar prompt en biblioteca"
                                        >
                                            <BookMarked size={10} />
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <input
                                    value={promptTheme}
                                    onChange={(e) => setPromptTheme(e.target.value)}
                                    placeholder="Temática · Ej: Vintage botanical illustration"
                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/40 transition-all font-medium"
                                />
                                <input
                                    value={promptSpecs}
                                    onChange={(e) => setPromptSpecs(e.target.value)}
                                    placeholder="Especificaciones · Ej: watercolor style, high detail"
                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/40 transition-all font-medium"
                                />
                                <input
                                    value={promptDetails}
                                    onChange={(e) => setPromptDetails(e.target.value)}
                                    placeholder="Detalles · Ej: lavender field, soft pastel palette"
                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/40 transition-all font-medium"
                                />
                                <div className="relative">
                                    <input
                                        value={promptParticulars}
                                        onChange={(e) => setPromptParticulars(e.target.value)}
                                        placeholder="Particularidades · editable por IA en catálogo"
                                        className="w-full h-10 bg-violet-500/5 border border-violet-500/20 rounded-xl px-4 pr-24 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 transition-all font-medium"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black uppercase tracking-widest text-violet-500/60 pointer-events-none">IA varies</span>
                                </div>
                            </div>
                            {imagePrompt && (
                                <p className="text-[9px] text-neutral-600 font-mono truncate px-1" title={imagePrompt}>{imagePrompt}</p>
                            )}
                            {promptTheme.trim() && (
                                <button
                                    type="button"
                                    onClick={() => { setSavePromptName(""); setSavePromptCategory("General"); setShowSavePromptDialog(true); }}
                                    className="w-full h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <BookMarked size={13} /> Guardar prompt en biblioteca
                                </button>
                            )}
                        </div>

                        {/* Advanced options */}
                        <div className="space-y-3">


                            {showAdvancedOptions && (
                                <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-300">Imagen de referencia</p>
                                        <p className="text-[10px] text-neutral-600 font-medium italic">Pegar (Ctrl/⌘+V) o arrastrar</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 items-start">
                                        {/* Small paste box */}
                                        <div
                                            className="rounded-2xl border border-dashed border-white/15 bg-black/20 w-full sm:w-[140px] aspect-square flex items-center justify-center text-center focus:outline-none focus:ring-2 focus:ring-amber-500/40 overflow-hidden"
                                            tabIndex={0}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const file = e.dataTransfer.files?.[0];
                                                if (file) void setInitImageFromFile(file);
                                            }}
                                            onPaste={(e) => {
                                                const items = Array.from(e.clipboardData?.items || []);
                                                const imageItem = items.find((it) => it.kind === "file" && it.type.startsWith("image/"));
                                                const file = imageItem?.getAsFile() || null;
                                                if (file) void setInitImageFromFile(file);
                                            }}
                                            title="Pega (Ctrl/⌘+V) o arrastra una imagen"
                                        >
                                            {initImageDataUrl ? (
                                                <img src={initImageDataUrl} alt="Referencia" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="px-3 space-y-1">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-300">Referencia</p>
                                                    <p className="text-[10px] text-neutral-600 font-medium italic">Pegar / Arrastrar</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Controls */}
                                        <div className="space-y-3">
                                            <div className="text-[10px] text-neutral-500 font-medium italic">
                                                Se enviará junto al prompt (Gemini/Leonardo).
                                            </div>

                                            {initImageDataUrl && (
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={() => setInitImageDataUrl(null)}
                                                        variant="outline"
                                                        className="h-11 rounded-2xl border-white/10 bg-white/5 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10"
                                                    >
                                                        Quitar imagen
                                                    </Button>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Fuerza (Leonardo)</label>
                                                <input
                                                    type="range"
                                                    min={0.1}
                                                    max={0.9}
                                                    step={0.05}
                                                    value={initImageStrength}
                                                    onChange={(e) => setInitImageStrength(Number(e.target.value))}
                                                    className="w-full"
                                                />
                                                <div className="text-[10px] text-neutral-500 font-medium italic">{initImageStrength.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Model-specific advanced params */}
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => setShowModelParams(v => !v)}
                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-600 hover:text-neutral-300 transition-all"
                            >
                                <Settings size={11} />
                                Parámetros del modelo
                                <ChevronDown size={11} className={`transition-transform ${showModelParams ? "rotate-180" : ""}`} />
                            </button>
                            {showModelParams && (() => {
                                const prov = AI_MODELS.find(m => m.id === selectedModel)?.provider;
                                return (
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
                                        {/* Negative prompt — all providers */}
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Prompt negativo</label>
                                            <input
                                                value={negativePrompt}
                                                onChange={e => setNegativePrompt(e.target.value)}
                                                placeholder="Ej: ugly, deformed, blurry, watermark"
                                                className="w-full h-9 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-rose-500/30 transition-all font-medium"
                                            />
                                        </div>

                                        {/* Steps — HF + Leonardo */}
                                        {(prov === "Hugging Face" || prov === "Leonardo") && (
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Pasos de inferencia</label>
                                                    <span className="text-[10px] font-mono text-amber-400">{inferenceSteps}</span>
                                                </div>
                                                <input type="range" min={10} max={50} step={1} value={inferenceSteps} onChange={e => setInferenceSteps(Number(e.target.value))} className="w-full accent-amber-500 h-1" />
                                                <div className="flex justify-between text-[8px] text-neutral-700 font-mono"><span>10 rápido</span><span>50 calidad</span></div>
                                            </div>
                                        )}

                                        {/* Guidance scale — HF + Leonardo */}
                                        {(prov === "Hugging Face" || prov === "Leonardo") && (
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Guidance Scale (CFG)</label>
                                                    <span className="text-[10px] font-mono text-amber-400">{guidanceScale.toFixed(1)}</span>
                                                </div>
                                                <input type="range" min={1} max={20} step={0.5} value={guidanceScale} onChange={e => setGuidanceScale(Number(e.target.value))} className="w-full accent-amber-500 h-1" />
                                                <div className="flex justify-between text-[8px] text-neutral-700 font-mono"><span>1 creativo</span><span>20 fiel al prompt</span></div>
                                            </div>
                                        )}

                                        {/* Fixed seed — Pollinations */}
                                        {prov === "Pollinations" && (
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Seed fijo (vacío = aleatorio)</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={fixedSeed}
                                                    onChange={e => setFixedSeed(e.target.value.replace(/\D/g, ""))}
                                                    placeholder="Ej: 42069"
                                                    className="w-full h-9 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-amber-500/30 transition-all font-mono"
                                                />
                                            </div>
                                        )}

                                        {/* Style — Ideogram */}
                                        {prov === "Ideogram" && (
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Estilo</label>
                                                <div className="relative">
                                                    <select value={ideogramStyle} onChange={e => setIdeogramStyle(e.target.value)} className="w-full h-9 bg-white/5 border border-white/10 rounded-xl px-3 pr-8 text-sm text-white outline-none focus:border-amber-500/30 transition-all appearance-none">
                                                        {["AUTO", "REALISTIC", "DESIGN", "RENDER_3D", "ANIME"].map(s => (
                                                            <option key={s} value={s} className="bg-[#0f0f0f]">{s}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {(() => {
                            const isCatalogActive = iaCatalogs.some(c => c.status === "running" || c.status === "pending");
                            return (
                                <Button
                                    onClick={() => handleGenerateImage()}
                                    disabled={isGenerating || !imagePrompt.trim() || isCatalogActive}
                                    className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all duration-500 ${isGenerating
                                        ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                                        : isCatalogActive
                                            ? "bg-white/5 text-neutral-500 border border-white/10 cursor-not-allowed"
                                            : "bg-amber-500 text-black hover:bg-amber-400 hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_30px_rgba(245,158,11,0.2)]"
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
                            );
                        })()}

                        {/* Catalog launch — reuses studio model/dim/prompt */}
                        <div className="border-t border-white/5 pt-5 space-y-3">
                            <div className="flex items-center gap-2 text-neutral-500">
                                <Layers size={12} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Generar catálogo con estos ajustes</span>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                <input
                                    value={catalogFormName}
                                    onChange={(e) => setCatalogFormName(e.target.value)}
                                    placeholder="Nombre del catálogo (opcional)"
                                    className="flex-1 min-w-0 h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white outline-none focus:border-violet-500/40 transition-all placeholder:text-neutral-700"
                                />
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        placeholder="5"
                                        value={catalogFormCount === 0 ? "" : String(catalogFormCount)}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/\D/g, "");
                                            setCatalogFormCount(raw === "" ? 0 : Math.min(50, Number(raw)));
                                        }}
                                        className="w-16 h-10 bg-white/5 border border-white/10 rounded-xl px-2 text-sm font-bold text-white outline-none focus:border-violet-500/40 transition-all text-center"
                                    />
                                    {(() => {
                                        const catalogBusy = iaCatalogs.some(c => c.status === "running" || c.status === "pending");
                                        return catalogBusy ? (
                                            <button
                                                onClick={addToQueue}
                                                disabled={isCreatingCatalog || !promptTheme.trim()}
                                                className="flex-1 sm:flex-none h-10 px-5 bg-amber-600/80 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                                title="Añadir a la cola — se lanzará cuando el actual termine"
                                            >
                                                {isCreatingCatalog ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} />Añadir a cola</>}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => void createCatalogFromStudio()}
                                                disabled={isCreatingCatalog || !promptTheme.trim()}
                                                className="flex-1 sm:flex-none h-10 px-5 bg-violet-600/80 hover:bg-violet-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {isCreatingCatalog ? <Loader2 size={13} className="animate-spin" /> : <><Layers size={13} />Lanzar</>}
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                            {/* Queue list */}
                            {catalogQueue.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/70 flex items-center gap-1.5">
                                        <Layers size={9} /> Cola de catálogos ({catalogQueue.length})
                                    </p>
                                    {catalogQueue.map((item, idx) => (
                                        <div key={item.queueId} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/15">
                                            <span className="text-[9px] font-black text-amber-400/60 w-4 shrink-0">#{idx + 1}</span>
                                            <span className="text-[10px] text-neutral-400 flex-1 truncate">{item.name || item.promptParts.theme || "Sin nombre"}</span>
                                            <span className="text-[9px] text-neutral-600 font-mono shrink-0">{item.totalImages} imgs · {item.dim.ratio}</span>
                                            <button onClick={() => setCatalogQueue(prev => prev.filter(q => q.queueId !== item.queueId))} className="p-1 rounded-md text-neutral-600 hover:text-rose-400 transition-all shrink-0"><X size={10} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {iaCatalogs.some(c => c.status === "running" || c.status === "pending") && (
                                <p className="text-[10px] text-amber-500/70 italic flex items-center gap-1.5">
                                    <Loader2 size={9} className="animate-spin" />
                                    Catálogo en progreso{catalogQueue.length > 0 ? ` · ${catalogQueue.length} en cola` : " · puedes añadir más a la cola"}
                                </p>
                            )}
                            <p className="text-[10px] text-neutral-600 italic">
                                ~{Math.ceil(catalogFormCount * 1.5)} min · {catalogFormCount} imágenes · {AI_MODELS.find(m => m.id === selectedModel)?.name} · {AI_DIMENSIONS.find(d => d.id === selectedDim)?.ratio}
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Preview Area */}
                <Card
                    variant="glass"
                    className="relative border-white/5 bg-white/[0.01] overflow-hidden min-h-[400px] flex items-center justify-center group rounded-[40px] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
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
                                                onClick={() => upscaleImageMax(generatedImage, { setAsGenerated: true })}
                                                disabled={isUpscaling}
                                                className="p-3 rounded-2xl bg-black/40 backdrop-blur-md text-white hover:bg-white/10 transition-all border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                                aria-label="Mejorar calidad (Upscale)"
                                                title="Mejorar calidad"
                                            >
                                                <Sparkles size={18} />
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
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-12 space-y-6">
                            {isGenerating ? (
                                <div className="space-y-6 animate-pulse">
                                    <div className="relative w-24 h-24 mx-auto">
                                        <div className="absolute inset-0 blur-3xl bg-amber-500/20 animate-pulse rounded-full" />
                                        <div className="w-full h-full rounded-[32px] border-2 border-amber-500/30 flex items-center justify-center bg-amber-500/5">
                                            <Zap size={40} className="text-amber-500 animate-bounce" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-black uppercase tracking-widest text-white">Sintetizando Neuronas</p>
                                        <p className="text-[10px] text-neutral-500 italic font-medium">El modelo está interpretando tu prompt...</p>
                                    </div>
                                </div>
                            ) : (
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
                            )}
                        </div>
                    )}
                </Card>
            </div>

            {/* Asset Vault / Carousel — always visible */}
            <div className="space-y-6 animate-in fade-in slide-in-from-left-8 duration-700 pb-4">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/5">
                            <Box size={16} />
                        </div>
                        <div>
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-neutral-400">Vault de Activos Digitales</h4>
                            <p className="text-[10px] text-neutral-600 font-medium italic">Sesión actual: {vaultImages.length} activos conservados</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => { setBookEditorImages(vaultImages.map(v => ({ url: v.url, label: v.model, scale: 1 }))); setBookEditorOpen(true); }}
                        disabled={vaultImages.length === 0}
                        className="h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-100 hover:bg-amber-500 hover:text-black transition-all text-[10px] font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(245,158,11,0.12)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-amber-500/20 disabled:hover:text-amber-100"
                    >
                        Crear Libro PDF
                    </Button>
                </div>

                {vaultImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 opacity-40">
                        <Box size={32} className="text-neutral-600" strokeWidth={1.5} />
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                            Vault vacío · Genera y conserva imágenes para crear libros PDF
                        </p>
                    </div>
                ) : (
                <div className="flex gap-5 overflow-x-auto pb-4 pt-2 no-scrollbar px-2">
                    {vaultImages.map((img, i) => (
                        <div
                            key={i}
                            className="shrink-0 w-56 h-64 md:w-64 md:h-80 rounded-[32px] overflow-hidden border border-white/10 hover:border-amber-500/50 transition-all shadow-2xl relative bg-neutral-900 cursor-zoom-in"
                            onClick={() => openVaultImagePreview(i)}
                        >
                            <img
                                src={img.url}
                                alt={`Vault ${i}`}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}
                    </div>
                )}
            </div>

            {/* Cloudinary Persistent Gallery */}
            <div className="space-y-6 pb-4">
                <div className="flex items-center gap-4 px-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <div className="flex items-center gap-3">
                        <Cloud size={14} className="text-cyan-400" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Cloudinary · Almacén Persistente</h3>
                    </div>
                    <button
                        onClick={() => void fetchCloudinaryImages()}
                        disabled={isLoadingCloudinary}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-neutral-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-40"
                        title="Actualizar galería"
                    >
                        {isLoadingCloudinary ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    </button>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>

                {cloudinaryImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 opacity-40">
                        <Cloud size={32} className="text-neutral-600" strokeWidth={1.5} />
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                            {isLoadingCloudinary ? "Cargando..." : "Sin imágenes en Cloudinary · Sube assets desde el vault"}
                        </p>
                    </div>
                ) : (
                    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 no-scrollbar px-2">
                        {cloudinaryImages.map((img, cldIdx) => (
                            <div
                                key={img.publicId}
                                className="shrink-0 w-44 h-52 md:w-52 md:h-64 rounded-[28px] overflow-hidden border border-white/10 hover:border-cyan-500/40 transition-all shadow-xl relative bg-neutral-900 cursor-zoom-in"
                                onClick={() => openCloudinaryImagePreview(cldIdx)}
                            >
                                <img
                                    src={img.url}
                                    alt={img.publicId}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* IA Catalog list */}
            {iaCatalogs.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-4 px-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <div className="flex items-center gap-3">
                            <Layers size={14} className="text-violet-400" />
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Catálogos IA</h3>
                        </div>
                        <button onClick={() => void fetchCatalogs()} disabled={isLoadingCatalogs} className="p-2 rounded-xl bg-white/5 border border-white/10 text-neutral-500 hover:text-violet-400 hover:border-violet-500/30 transition-all disabled:opacity-40">
                            {isLoadingCatalogs ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        </button>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>
                    <div className="space-y-3">
                        {iaCatalogs.map((catalog) => {
                            const progress = catalog.totalImages > 0 ? (catalog.images.length / catalog.totalImages) * 100 : 0;
                            const isActive = catalog.status === "running" || catalog.status === "pending";
                            return (
                                <Card key={catalog._id} variant="outline" className="border-white/5 bg-white/[0.01] overflow-hidden">
                                    <div className="p-4 flex items-start justify-between gap-4 border-b border-white/5">
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-black text-white truncate text-sm">{catalog.name}</h4>
                                                {statusBadge(catalog.status)}
                                                {isActive && <Loader2 size={11} className="text-blue-400 animate-spin shrink-0" />}
                                            </div>
                                            <p className="text-[10px] text-neutral-500 truncate">{catalog.prompt}</p>
                                            <p className="text-[10px] text-neutral-600 font-mono">{catalog.aiModel?.name} · {catalog.width}×{catalog.height} · {catalog.images.length}/{catalog.totalImages} imgs{(catalog.skippedImages ?? 0) > 0 ? ` · ${catalog.skippedImages} omitidas` : ""} · {new Date(catalog.createdAt).toLocaleDateString("es-ES")}</p>
                                            {catalog.lastError && (
                                                <p className="text-[9px] text-red-400/80 font-mono break-all leading-relaxed mt-0.5" title={catalog.lastError}>
                                                    ⚠ {catalog.lastError.length > 120 ? catalog.lastError.slice(0, 120) + "…" : catalog.lastError}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => {
                                                    if (catalog.promptParts?.theme) {
                                                        setPromptTheme(catalog.promptParts.theme);
                                                        setPromptSpecs(catalog.promptParts.specs ?? "");
                                                        setPromptDetails(catalog.promptParts.details ?? "");
                                                        setPromptParticulars(catalog.promptParts.particulars ?? "");
                                                    } else {
                                                        setPromptTheme(catalog.prompt);
                                                        setPromptSpecs("");
                                                        setPromptDetails("");
                                                        setPromptParticulars("");
                                                    }
                                                    // Restore model
                                                    const matchModel = AI_MODELS.find(m => m.id === catalog.aiModel?.id);
                                                    if (matchModel) setSelectedModel(matchModel.id);
                                                    // Restore dimension
                                                    const matchDim = AI_DIMENSIONS.find(d => d.width === catalog.width && d.height === catalog.height);
                                                    if (matchDim) setSelectedDim(matchDim.id);
                                                    toast.success("Prompt, modelo y resolución cargados");
                                                }}
                                                title="Cargar prompt, modelo y resolución"
                                                className="p-2 rounded-xl bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white transition-all border border-white/10"
                                            >
                                                <Copy size={13} />
                                            </button>
                                            {catalog.images.length > 0 && (
                                                <button
                                                    onClick={() => {
                                                        setBookEditorImages(catalog.images.map((img, i) => ({ url: img.url, label: `${catalog.name} #${i + 1}`, scale: 1 })));
                                                        setBookEditorOpen(true);
                                                    }}
                                                    title="Editar PDF"
                                                    className="p-2 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/20"
                                                >
                                                    <FileText size={13} />
                                                </button>
                                            )}
                                            <button onClick={() => setConfirmDeleteCatalogId(catalog._id)} disabled={deletingCatalogId === catalog._id} title="Eliminar" className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20 disabled:opacity-50">
                                                {deletingCatalogId === catalog._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                            </button>
                                        </div>
                                    </div>
                                    {isActive && (
                                        <div className="px-4 pt-3 pb-3 space-y-2.5 border-b border-white/5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex-1 space-y-1.5">
                                                    <div className="flex justify-between text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                                                        <span className="flex items-center gap-1.5">
                                                            <Loader2 size={9} className="animate-spin text-blue-400" />
                                                            {catalog.status === "pending" ? "En cola..." : "Generando"}
                                                        </span>
                                                        <span>{catalog.images.length}/{catalog.totalImages}</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => void cancelCatalog(catalog._id)}
                                                    className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all text-[9px] font-black uppercase tracking-widest"
                                                    title="Detener generación"
                                                >
                                                    <StopCircle size={12} />
                                                    Detener
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {catalog.images.length > 0 && (
                                        <div className="p-4 pt-2">
                                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                                                {catalog.images.map((img, imgIdx) => (
                                                    <div
                                                        key={img.publicId}
                                                        className="aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/5 cursor-zoom-in hover:border-violet-500/40 transition-all"
                                                        onClick={() => openCatalogImagePreview(catalog.images, imgIdx, catalog._id)}
                                                    >
                                                        <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                    </div>
                                                ))}
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
                        })}
                    </div>
                </div>
            )}

            {iaCatalogs.length === 0 && !isLoadingCatalogs && (
                <div className="flex items-center gap-4 px-2 opacity-30">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 flex items-center gap-2"><Layers size={12} />Sin catálogos aún</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>
            )}

            {/* Saved Prompts Library */}
            <div className="space-y-4">
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
                    <div className="flex items-center gap-4 px-2 opacity-30">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 flex items-center gap-2"><BookMarked size={12} />Sin prompts guardados aún</span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {savedPrompts
                            .filter(p => promptCategoryFilter === "all" || p.category === promptCategoryFilter)
                            .map(p => (
                                <div key={p._id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-3 hover:border-violet-500/20 transition-all group">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-1 min-w-0">
                                            <p className="text-[11px] font-black text-white truncate">{p.name}</p>
                                            <span className="inline-block px-2 py-0.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[9px] font-black uppercase tracking-widest text-violet-400">{p.category}</span>
                                        </div>
                                        <button onClick={() => void deleteSavedPrompt(p._id)} className="p-1.5 rounded-lg text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0 opacity-0 group-hover:opacity-100">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-neutral-500 line-clamp-2 font-medium leading-relaxed">{p.promptParts.theme}</p>
                                    <button
                                        onClick={() => loadSavedPrompt(p)}
                                        className="w-full h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[9px] font-black uppercase tracking-widest hover:bg-violet-500/20 transition-all"
                                    >
                                        Cargar prompt
                                    </button>
                                </div>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderCreation = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="lg:col-span-12 space-y-8">
                <Card variant="glass" className="p-6 md:p-14 border-primary/20 bg-primary/5 space-y-10 shadow-[0_0_100px_rgba(25,113,255,0.08)] relative overflow-hidden rounded-[24px] md:rounded-[48px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start relative z-10">
                        <div className="space-y-10 order-2 md:order-1">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-[20px] bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                                        <Wand2 size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">Generador Maestro</h2>
                                        <p className="text-[11px] font-black tracking-widest text-primary uppercase mt-1 italic">Industrial Quality Engine v2.0</p>
                                    </div>
                                </div>
                                <p className="text-sm text-neutral-400 font-medium leading-relaxed max-w-sm">
                                    Nuestro motor de IA generará automáticamente el esquema, los metadatos y la estrategia de lanzamiento para tu activo.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-5">
                                {[
                                    { step: "01", text: "Definición del Nicho Maestro", done: true, desc: "Segmentación algorítmica de audiencia." },
                                    { step: "02", text: "Título Estratégico SEO", done: newTitle.length > 5, desc: "Keywords de alta conversión integradas." },
                                    { step: "03", text: "Carga de Parámetros I.A.", done: newDesc.length > 10, desc: "Configuración del motor de generación." }
                                ].map((s) => (
                                    <div key={s.step} className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                        <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center text-xs font-black ${s.done ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-neutral-600 border border-white/5"}`}>
                                            {s.done ? <CheckCircle2 size={18} /> : s.step}
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className={`text-[11px] font-black uppercase tracking-tight ${s.done ? "text-neutral-200" : "text-neutral-600"}`}>{s.text}</p>
                                            <p className="text-[10px] text-neutral-600 font-medium italic">{s.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 rounded-[32px] bg-indigo-500/10 border border-indigo-500/20 flex gap-5 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/10 blur-2xl group-hover:bg-indigo-400/20 transition-all" />
                                <div className="p-4 rounded-2xl bg-indigo-500/20 text-indigo-400 h-fit">
                                    <Lightbulb size={24} />
                                </div>
                                <div className="space-y-1.5 relative">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-indigo-400 italic">Smart Context Tip</p>
                                    <p className="text-xs text-neutral-400 leading-relaxed italic font-medium">
                                        "Los mercados europeos (DE/FR/ES) muestran una saturación baja en la categoría 'Cuadros Imprimibles'. Ideal para lanzamientos flash."
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8 p-6 md:p-10 rounded-[32px] md:rounded-[48px] bg-white/[0.04] border border-white/10 shadow-3xl backdrop-blur-3xl relative order-1 md:order-2 overflow-hidden">
                            <div className="absolute -inset-1 bg-gradient-to-br from-primary/10 via-transparent to-indigo-500/10 blur-xl opacity-30" />
                            <div className="space-y-8 relative">
                                <div className="space-y-4">
                                    <label className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-500 ml-1">Tipo de Activo Digital</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {PRODUCT_TYPES.map((type) => (
                                            <button
                                                key={type.id}
                                                onClick={() => setSelectedType(type.id)}
                                                className={`flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 ${selectedType === type.id
                                                    ? "bg-white/10 border-white/20 shadow-xl scale-[1.02] ring-1 ring-primary/30"
                                                    : "bg-white/[0.02] border-white/5 opacity-50 hover:opacity-100 hover:bg-white/[0.05]"
                                                    }`}
                                            >
                                                <div className={`p-3 rounded-xl ${type.bg} ${type.color} shadow-inner`}>
                                                    {type.icon}
                                                </div>
                                                <span className="text-[11px] font-black uppercase tracking-[0.05em] text-left leading-none">{type.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-500 ml-1 block mb-1">Proyecto Master Title</label>
                                    <input
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        placeholder="Ej: Minimalist Japanese Art Set"
                                        className="w-full h-12 md:h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all font-medium"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-500 ml-1 block mb-1">Descripción de Lanzamiento</label>
                                    <textarea
                                        value={newDesc}
                                        onChange={(e) => setNewDesc(e.target.value)}
                                        placeholder="Define el concepto central y el nicho demográfico..."
                                        rows={2}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all resize-none font-medium leading-relaxed"
                                    />
                                </div>

                                <Button
                                    onClick={handleAddProduct}
                                    className="w-full h-16 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-neutral-100 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_15px_40px_rgba(255,255,255,0.15)]"
                                >
                                    <Sparkles size={18} className="mr-3" /> Lanzar Generación Maestro
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>

                {renderAIStudio()}
            </div>
        </div>
    );

    const statusBadge = (status: IACatalogFE["status"]) => {
        const map: Record<IACatalogFE["status"], { label: string; cls: string }> = {
            pending:   { label: "En cola",       cls: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20" },
            running:   { label: "Generando...",  cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            completed: { label: "Completado",    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
            failed:    { label: "Error",         cls: "bg-red-500/10 text-red-400 border-red-500/20" },
            cancelled: { label: "Cancelado",     cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
        };
        const { label, cls } = map[status] ?? { label: status, cls: "bg-white/5 text-neutral-400 border-white/10" };
        return <Badge variant="neutral" className={`text-[9px] font-black uppercase ${cls}`}>{label}</Badge>;
    };

    return (
        <div className="space-y-12 pb-24">
            {/* Sub-Navigation Tabs - Floating Style */}
            <div className="sticky top-[90px] z-[50] w-full flex justify-center pointer-events-none px-4">
                <div className="pointer-events-auto flex p-1.5 bg-[#111111]/90 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] max-w-full overflow-x-auto no-scrollbar">
                    {[
                        { id: "insights", name: "Insights", icon: <BarChart3 size={15} /> },
                        { id: "catalog", name: "Productos", icon: <Box size={15} /> },
                        { id: "creation", name: "Generador", icon: <Plus size={15} /> }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabID)}
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
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 gap-4"
                    onClick={closePreview}
                    role="dialog"
                    aria-modal="true"
                >
                    {/* Toolbar */}
                    <div
                        className="flex items-center gap-2 flex-wrap justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {previewContext && (
                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-2">
                                {previewContext.index + 1} / {previewContext.urls.length}
                            </span>
                        )}
                        {/* Download */}
                        <button
                            onClick={() => {
                                const modelName = AI_MODELS.find(m => m.id === selectedModel)?.name || "ai-image";
                                const dimName = AI_DIMENSIONS.find(d => d.id === selectedDim)?.ratio || "1x1";
                                downloadPng(previewImage, `${modelName}-${dimName}`.replaceAll(" ", "_"));
                            }}
                            className="p-2.5 rounded-2xl bg-black/60 backdrop-blur-md text-white hover:bg-white/10 transition-all border border-white/10"
                            title="Descargar"
                        >
                            <Download size={16} />
                        </button>

                        {/* Upscale */}
                        <button
                            onClick={() => upscaleImageMax(previewImage, { setAsPreview: true })}
                            disabled={isUpscaling}
                            className="p-2.5 rounded-2xl bg-black/60 backdrop-blur-md text-white hover:bg-white/10 transition-all border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Mejorar calidad"
                        >
                            <Sparkles size={16} />
                        </button>

                        {/* Vault-specific actions */}
                        {(() => {
                            if (!previewContext?.vaultCtx) return null;
                            const vaultIdx = previewContext.index;
                            const vaultImg = vaultImages[vaultIdx];
                            if (!vaultImg) return null;
                            return (
                                <>
                                    <button
                                        onClick={() => void uploadToCloudinary(vaultIdx)}
                                        disabled={uploadingToCloud === vaultIdx}
                                        className="p-2.5 rounded-2xl bg-black/60 backdrop-blur-md text-cyan-400 hover:bg-cyan-500/20 transition-all border border-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Guardar en Cloudinary"
                                    >
                                        {uploadingToCloud === vaultIdx ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                                    </button>
                                    <button
                                        onClick={() => setConfirmDeleteVaultIndex(vaultIdx)}
                                        className="p-2.5 rounded-2xl bg-black/60 backdrop-blur-md text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/20"
                                        title="Eliminar del vault"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            );
                        })()}

                        {/* Cloudinary-specific actions */}
                        {(() => {
                            if (!previewContext?.cloudinaryCtx) return null;
                            const cldImg = cloudinaryImages[previewContext.index];
                            if (!cldImg) return null;
                            return (
                                <>
                                    <button
                                        onClick={() => {
                                            const ratio = cldImg.width && cldImg.height ? `${cldImg.width}×${cldImg.height}` : "1:1";
                                            setVaultImages(prev => [{ url: cldImg.url, model: "Cloudinary", dim: ratio }, ...prev]);
                                            toast.success("Añadida al vault");
                                        }}
                                        className="p-2.5 rounded-2xl bg-black/60 backdrop-blur-md text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/20"
                                        title="Añadir al Vault"
                                    >
                                        <Plus size={16} />
                                    </button>
                                    <button
                                        onClick={() => setConfirmDeleteCloudinaryId(cldImg.publicId)}
                                        disabled={deletingFromCloud === cldImg.publicId}
                                        className="p-2.5 rounded-2xl bg-black/60 backdrop-blur-md text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/20 disabled:opacity-40"
                                        title="Eliminar de Cloudinary"
                                    >
                                        {deletingFromCloud === cldImg.publicId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    </button>
                                </>
                            );
                        })()}

                        {/* Catalog-specific actions */}
                        {(() => {
                            const catalogImg = previewContext?.catalogCtx?.images[previewContext.index];
                            if (!catalogImg) return null;
                            return (
                                <>
                                    <button
                                        onClick={() => addCatalogImageToVault(catalogImg)}
                                        className="p-2.5 rounded-2xl bg-black/60 backdrop-blur-md text-emerald-400 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                                        title="Añadir al Vault"
                                    >
                                        <ImagePlus size={16} />
                                    </button>
                                    <button
                                        onClick={() => setConfirmDeleteImageInfo({ catalogId: previewContext!.catalogCtx!.id, publicId: catalogImg.publicId })}
                                        className="p-2.5 rounded-2xl bg-black/60 backdrop-blur-md text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/20"
                                        title="Eliminar imagen del catálogo"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            );
                        })()}

                        {/* Close */}
                        <button
                            onClick={closePreview}
                            className="p-2.5 rounded-2xl bg-black/60 backdrop-blur-md text-white hover:bg-rose-500 transition-all border border-white/10"
                            title="Cerrar"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Image + nav arrows */}
                    <div
                        className="relative flex items-center justify-center w-full max-w-6xl gap-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Prev arrow */}
                        {previewContext && previewContext.index > 0 && (
                            <button
                                onClick={() => navigatePreview(-1)}
                                className="shrink-0 w-12 h-12 rounded-2xl bg-black/60 backdrop-blur-md text-white border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center"
                                title="Anterior"
                            >
                                <ChevronLeft size={22} />
                            </button>
                        )}
                        {previewContext && previewContext.index === 0 && (
                            <div className="shrink-0 w-12" />
                        )}

                        <img
                            key={previewImage}
                            src={previewImage}
                            alt="Vista previa"
                            className="block max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-2xl bg-black flex-1 min-w-0"
                        />

                        {/* Next arrow */}
                        {previewContext && previewContext.index < previewContext.urls.length - 1 && (
                            <button
                                onClick={() => navigatePreview(1)}
                                className="shrink-0 w-12 h-12 rounded-2xl bg-black/60 backdrop-blur-md text-white border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center"
                                title="Siguiente"
                            >
                                <ChevronRight size={22} />
                            </button>
                        )}
                        {previewContext && previewContext.index === previewContext.urls.length - 1 && (
                            <div className="shrink-0 w-12" />
                        )}
                    </div>
                </div>
            )}

            {/* Book Editor Modal */}
            {bookEditorOpen && (
                <div
                    className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
                    onClick={() => setBookEditorOpen(false)}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="relative w-full max-w-6xl max-h-[95vh] rounded-3xl border border-white/10 bg-[#0a0a0a]/95 overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 md:p-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Editor de Libro PDF</p>
                                <p className="text-xs text-neutral-500 font-medium">{bookEditorImages.length} imágenes · {bookPdfMode === "colored" ? `${1 + bookEditorImages.length * 2} páginas (doble hoja)` : `${1 + bookEditorImages.length} páginas (una por imagen)`}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Mode toggle */}
                                <div className="flex rounded-xl border border-white/10 overflow-hidden">
                                    <button
                                        onClick={() => setBookPdfMode("colored")}
                                        className={`px-3 h-9 text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${bookPdfMode === "colored" ? "bg-amber-500 text-black" : "bg-white/5 text-neutral-500 hover:text-white"}`}
                                    >
                                        <BookMarked size={11} /> Colored
                                    </button>
                                    <button
                                        onClick={() => setBookPdfMode("full")}
                                        className={`px-3 h-9 text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${bookPdfMode === "full" ? "bg-amber-500 text-black" : "bg-white/5 text-neutral-500 hover:text-white"}`}
                                    >
                                        <ImageIcon size={11} /> Full
                                    </button>
                                </div>
                                <Button
                                    onClick={buildBookPdf}
                                    disabled={isBuildingPdf || bookEditorImages.length === 0}
                                    className="h-9 rounded-2xl bg-amber-500 text-black hover:bg-amber-400 transition-all text-[10px] font-black uppercase tracking-widest"
                                >
                                    {isBuildingPdf ? <><Loader2 size={13} className="animate-spin mr-2" />Generando...</> : "Descargar PDF"}
                                </Button>
                                <button
                                    onClick={() => setBookEditorOpen(false)}
                                    className="p-2.5 rounded-2xl bg-white/5 text-white hover:bg-rose-500 transition-all border border-white/10"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden" style={{ maxHeight: "calc(95vh - 80px)" }}>
                            {/* Left panel: settings + vault images to add */}
                            <div className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 p-4 space-y-4 overflow-y-auto">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Nombre del archivo</label>
                                    <input
                                        value={bookFileName}
                                        onChange={(e) => setBookFileName(e.target.value)}
                                        className="w-full h-9 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:border-amber-500/40"
                                        placeholder="libro-kdp"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Texto página 1</label>
                                    <textarea
                                        value={bookFooterText}
                                        onChange={(e) => setBookFooterText(e.target.value)}
                                        className="w-full min-h-[80px] rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white outline-none focus:border-amber-500/40 resize-none"
                                        placeholder="Ej: © 2026 Tu Marca"
                                    />
                                </div>

                                {/* Vault images to add */}
                                {vaultImages.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2"><Box size={10} />Añadir del Vault</p>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {vaultImages.map((vi, idx) => {
                                                const alreadyAdded = bookEditorImages.some(b => b.url === vi.url);
                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => !alreadyAdded && setBookEditorImages(prev => [...prev, { url: vi.url, label: vi.model, scale: 1 }])}
                                                        disabled={alreadyAdded}
                                                        className={`aspect-square rounded-lg overflow-hidden border transition-all relative ${alreadyAdded ? "border-emerald-500/40 opacity-50" : "border-white/10 hover:border-amber-500/50"}`}
                                                        title={alreadyAdded ? "Ya añadida" : "Añadir al editor"}
                                                    >
                                                        <img src={vi.url} alt="" className="w-full h-full object-cover" />
                                                        {alreadyAdded && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Check size={12} className="text-emerald-400" /></div>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Catalog images to add */}
                                {iaCatalogs.filter(c => c.images.length > 0).length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2"><Layers size={10} />Añadir de Catálogos</p>
                                        {iaCatalogs.filter(c => c.images.length > 0).map(cat => (
                                            <div key={cat._id} className="space-y-1.5">
                                                <p className="text-[9px] text-neutral-600 truncate pl-0.5">{cat.name}</p>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {cat.images.map((ci) => {
                                                        const alreadyAdded = bookEditorImages.some(b => b.url === ci.url);
                                                        return (
                                                            <button
                                                                key={ci.publicId}
                                                                onClick={() => !alreadyAdded && setBookEditorImages(prev => [...prev, { url: ci.url, label: `${cat.name}`, scale: 1 }])}
                                                                disabled={alreadyAdded}
                                                                className={`aspect-square rounded-lg overflow-hidden border transition-all relative ${alreadyAdded ? "border-emerald-500/40 opacity-50" : "border-white/10 hover:border-amber-500/50"}`}
                                                                title={alreadyAdded ? "Ya añadida" : "Añadir al editor"}
                                                            >
                                                                <img src={ci.url} alt="" className="w-full h-full object-cover" />
                                                                {alreadyAdded && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Check size={12} className="text-emerald-400" /></div>}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Cloudinary images to add */}
                                {cloudinaryImages.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2"><Cloud size={10} />Añadir de Cloudinary</p>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {cloudinaryImages.map((ci) => {
                                                const alreadyAdded = bookEditorImages.some(b => b.url === ci.url);
                                                return (
                                                    <button
                                                        key={ci.publicId}
                                                        onClick={() => !alreadyAdded && setBookEditorImages(prev => [...prev, { url: ci.url, label: ci.publicId.split("/").pop() ?? "Cloudinary", scale: 1 }])}
                                                        disabled={alreadyAdded}
                                                        className={`aspect-square rounded-lg overflow-hidden border transition-all relative ${alreadyAdded ? "border-emerald-500/40 opacity-50" : "border-white/10 hover:border-cyan-500/50"}`}
                                                        title={alreadyAdded ? "Ya añadida" : "Añadir al editor"}
                                                    >
                                                        <img src={ci.url} alt="" className="w-full h-full object-cover" />
                                                        {alreadyAdded && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Check size={12} className="text-emerald-400" /></div>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Editor image list with remove + scale */}
                                {bookEditorImages.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2"><Layers size={10} />Imágenes en PDF</p>
                                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                            {bookEditorImages.map((bi, idx) => (
                                                <div key={idx} className="rounded-lg bg-white/[0.02] border border-white/5 p-1.5 space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <img src={bi.url} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
                                                        <span className="text-[9px] text-neutral-500 flex-1 truncate">{bi.label || `#${idx + 1}`}</span>
                                                        <div className="flex flex-col gap-0.5">
                                                            <button
                                                                onClick={() => moveBookImage(idx, -1)}
                                                                disabled={idx === 0}
                                                                className="p-0.5 rounded text-neutral-600 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                <ChevronUp size={10} />
                                                            </button>
                                                            <button
                                                                onClick={() => moveBookImage(idx, 1)}
                                                                disabled={idx === bookEditorImages.length - 1}
                                                                className="p-0.5 rounded text-neutral-600 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                <ChevronDown size={10} />
                                                            </button>
                                                        </div>
                                                        <button
                                                            onClick={() => setBookEditorImages(prev => prev.filter((_, i) => i !== idx))}
                                                            className="p-1 rounded-md text-neutral-600 hover:text-rose-400 transition-all"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-2 px-0.5">
                                                        <span className="text-[8px] text-neutral-600 shrink-0 w-6">Zoom</span>
                                                        <input
                                                            type="range"
                                                            min={1}
                                                            max={2}
                                                            step={0.05}
                                                            value={bi.scale ?? 1}
                                                            onChange={(e) => setBookEditorImages(prev => prev.map((img, i) => i === idx ? { ...img, scale: Number(e.target.value) } : img))}
                                                            className="flex-1 accent-amber-500 h-1"
                                                        />
                                                        <span className="text-[8px] font-mono text-amber-400 w-8 text-right">{Math.round((bi.scale ?? 1) * 100)}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right panel: preview */}
                            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Previsualización · modo {bookPdfMode === "colored" ? "Colored Book" : "Full"}</p>
                                {bookEditorImages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-2 opacity-30">
                                        <FileText size={32} className="text-neutral-600" strokeWidth={1.5} />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Sin imágenes · añade desde catálogos o vault</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {bookPdfMode === "colored" ? (
                                            Array.from({ length: 1 + bookEditorImages.length }).map((_, spreadIndex) => {
                                                const img = spreadIndex === 0 ? null : bookEditorImages[spreadIndex - 1];
                                                const zoom = img?.scale ?? 1;
                                                const pct = Math.min(98, Math.round(90 * zoom));
                                                return (
                                                    <div key={spreadIndex} className="grid grid-cols-2 gap-2">
                                                        <div className="aspect-[1/1.414] rounded-xl bg-white/[0.02] border border-white/10" />
                                                        <div className="aspect-[1/1.414] rounded-xl bg-white/[0.02] border border-white/10 relative overflow-hidden flex items-center justify-center">
                                                            {spreadIndex === 0 ? (
                                                                <div className="absolute bottom-2 right-2 text-[8px] font-bold text-neutral-500">{bookFooterText.trim() || "Pág. 1"}</div>
                                                            ) : img ? (
                                                                <img src={img.url} alt="" style={{ maxWidth: `${pct}%`, maxHeight: `${pct}%` }} className="object-contain" />
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            [null, ...bookEditorImages].map((img, pageIdx) => {
                                                const zoom = img?.scale ?? 1;
                                                const pct = Math.min(98, Math.round(90 * zoom));
                                                return (
                                                    <div key={pageIdx} className="aspect-[1/1.414] rounded-xl bg-white/[0.02] border border-white/10 relative overflow-hidden flex items-center justify-center max-w-xs mx-auto">
                                                        {pageIdx === 0 ? (
                                                            <div className="absolute bottom-2 right-2 text-[8px] font-bold text-neutral-500">{bookFooterText.trim() || "Pág. 1"}</div>
                                                        ) : img ? (
                                                            <img src={img.url} alt="" style={{ maxWidth: `${pct}%`, maxHeight: `${pct}%` }} className="object-contain" />
                                                        ) : null}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
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
                                <div className="relative">
                                    <select
                                        value={savePromptCategory === "__new__" ? "__new__" : savePromptCategory}
                                        onChange={e => setSavePromptCategory(e.target.value)}
                                        className="w-full h-11 rounded-2xl bg-white/5 border border-white/10 px-4 pr-10 text-sm text-white outline-none focus:border-violet-500/40 transition-all appearance-none cursor-pointer"
                                    >
                                        {Array.from(new Set([...DEFAULT_PROMPT_CATEGORIES, ...savedPrompts.map(p => p.category)])).map(cat => (
                                            <option key={cat} value={cat} className="bg-[#0f0f0f]">{cat}</option>
                                        ))}
                                        <option value="__new__" className="bg-[#0f0f0f]">+ Nueva categoría...</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                                </div>
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
                            <button onClick={() => { void deleteFromCloudinary(confirmDeleteCloudinaryId); setConfirmDeleteCloudinaryId(null); }} className="flex-1 h-11 rounded-2xl bg-red-500 text-white text-sm font-black hover:bg-red-400 transition-all">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
