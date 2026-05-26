"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Database, Download, Copy, Check, ChevronDown, ChevronRight,
    FileJson, Package, ExternalLink, BookOpen, Info,
    Star, ImageIcon, RefreshCw, X, Layers,
    BarChart2, Zap, Trophy, Upload, CloudUpload, Loader2,
    AlertTriangle, CheckCircle, Settings, Store, Globe, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { AppTabNav, type AppTab } from "./shared/app-tab-nav";
import { EarningsStats, type EarningsProduct } from "./shared/earnings-stats";
import { DigitalProductsTable, DEFAULT_PRODUCT_TYPES } from "./shared/digital-products-table";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Types ────────────────────────────────────────────────────────────────────

type TabID = "insights" | "motor" | "huggingface";

interface CatalogImage {
    publicId: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
    createdAt: string;
}

interface Catalog {
    _id: string;
    name: string;
    prompt: string;
    promptParts?: { theme: string; specs: string; details: string; particulars: string };
    productType: string;
    aiModel?: { id: string; name: string; provider: string; modelId: string };
    images: CatalogImage[];
    status: string;
    createdAt: string;
}

interface DatasetSettings {
    hf:     { configured: boolean; username: string };
    kaggle: { configured: boolean; username: string };
}

type License = "cc-by-4.0" | "cc-by-sa-4.0" | "cc0-1.0" | "openrail" | "mit";
type QualityRating = 1 | 2 | 3;

interface DatasetConfig {
    name: string;
    description: string;
    license: License;
    tags: string;
    captionField: "prompt" | "theme" | "particulars";
}

// ── Constants ────────────────────────────────────────────────────────────────

const LICENSES: { id: License; label: string; desc: string }[] = [
    { id: "cc-by-4.0",    label: "CC BY 4.0",          desc: "Permite uso comercial con atribución" },
    { id: "cc0-1.0",      label: "CC0 (Dominio público)", desc: "Sin restricciones, máxima difusión" },
    { id: "openrail",     label: "OpenRAIL",             desc: "Estándar HuggingFace para datos IA" },
    { id: "cc-by-sa-4.0", label: "CC BY-SA 4.0",        desc: "Copyleft: derivados con misma licencia" },
];

const CAPTION_FIELDS = [
    { id: "particulars" as const, label: "Particulars (detalle IA)", desc: "Prompt específico — mayor diversidad" },
    { id: "theme"       as const, label: "Theme (temática)",          desc: "Nombre del nicho — más conciso" },
    { id: "prompt"      as const, label: "Prompt completo",           desc: "Prompt íntegro enviado al modelo" },
];

const INSTRUCTIONS_STEPS = [
    { n: 1, text: "Verás todos tus catálogos con imágenes cargados automáticamente en la pestaña Motor." },
    { n: 2, text: "Haz clic en un catálogo para expandirlo → aparece el grid de imágenes." },
    { n: 3, text: "Checkbox en cada imagen para incluirla (o el checkbox del catálogo para seleccionar todas)." },
    { n: 4, text: "Estrellas debajo de cada imagen para marcar calidad 1–3. Filtra el export por \"★★★ mínimo\"." },
    { n: 5, text: "Panel izquierdo: configura nombre, descripción, licencia y qué campo usar como caption (recomendado: \"Particulars\")." },
    { n: 6, text: "Descargar metadata.jsonl → archivo con una línea JSON por imagen: { file_name, url, text, style, quality }." },
    { n: 7, text: "Copiar script Python → descarga todas las imágenes de Cloudinary a una carpeta local." },
    { n: 8, text: "Ve a la pestaña HuggingFace para subir el dataset directamente desde aquí con un clic." },
];

// ── Component ────────────────────────────────────────────────────────────────

export function DataRefineryApp() {
    const [activeTab, setActiveTab] = useState<TabID>(() => {
        try { return (localStorage.getItem("datarefinery-tab") ?? "insights") as TabID; } catch { return "insights"; }
    });

    // Core state
    const [catalogs, setCatalogs]       = useState<Catalog[]>([]);
    const [isLoading, setIsLoading]     = useState(true);
    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
    const [qualityMap, setQualityMap]   = useState<Map<string, QualityRating>>(new Map());
    const [captionOverrides]            = useState<Map<string, string>>(new Map());
    const [expandedCatalogs, setExpandedCatalogs] = useState<Set<string>>(new Set());
    const [config, setConfig]           = useState<DatasetConfig>({
        name: "coloring-book-dataset",
        description: "Curated coloring book illustrations with text captions, generated with AI for fine-tuning image models.",
        license: "openrail",
        tags: "coloring-book, line-art, illustration, ai-generated",
        captionField: "particulars",
    });
    const [filterType, setFilterType]   = useState<string>("all");
    const [minQuality, setMinQuality]   = useState<QualityRating | 0>(0);
    const [isExporting, setIsExporting] = useState(false);
    const [showGuide, setShowGuide]     = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);

    // Insights — digital products (populated by DigitalProductsTable callback)
    const [insightsProducts, setInsightsProducts] = useState<EarningsProduct[]>([]);

    // Integration settings
    const [dsSettings, setDsSettings] = useState<DatasetSettings | null>(null);

    // HuggingFace state
    const [hfRepoName, setHfRepoName]   = useState(config.name);
    const [hfIsPrivate, setHfIsPrivate] = useState(false);
    const [isUploadingHF, setIsUploadingHF] = useState(false);
    const [hfResult, setHfResult]       = useState<string | null>(null);

    const changeTab = (id: string) => {
        localStorage.setItem("datarefinery-tab", id);
        setActiveTab(id as TabID);
    };

    const tabs: AppTab[] = [
        { id: "insights",    name: "Insights",    icon: <BarChart2 size={15} /> },
        { id: "motor",       name: "Motor",        icon: <Database size={15} /> },
        { id: "huggingface", name: "HuggingFace",  icon: <Zap size={15} /> },
    ];

    // ── Load data ─────────────────────────────────────────────────────────────

    useEffect(() => {
        void (async () => {
            setIsLoading(true);
            try {
                const res  = await fetch(`${API_BASE_URL}/catalogs?limit=200`);
                const data = await res.json();
                const completed = (data.catalogs ?? []).filter((c: Catalog) => c.images?.length > 0);
                setCatalogs(completed);
                setExpandedCatalogs(new Set(completed.slice(0, 3).map((c: Catalog) => c._id)));
            } catch { toast.error("Error cargando catálogos"); }
            finally { setIsLoading(false); }
        })();
        void loadDsSettings();
    }, []);

    const loadDsSettings = useCallback(async () => {
        try {
            const res  = await fetch(`${API_BASE_URL}/datasets/settings`);
            const data = await res.json();
            setDsSettings(data);
        } catch { /* non-fatal */ }
    }, []);

    // ── Derived ───────────────────────────────────────────────────────────────

    const allImages = useMemo(() =>
        catalogs.flatMap(c => c.images.map(img => ({ ...img, catalog: c }))),
    [catalogs]);

    const exportImages = useMemo(() =>
        allImages.filter(img => {
            if (!selectedImages.has(img.publicId)) return false;
            const q = qualityMap.get(img.publicId) ?? 2;
            return minQuality === 0 || q >= minQuality;
        }),
    [allImages, selectedImages, qualityMap, minQuality]);

    const productTypes = useMemo(() => {
        const types = new Set(catalogs.map(c => c.productType ?? "other"));
        return ["all", ...Array.from(types)];
    }, [catalogs]);

    const filteredCatalogs = useMemo(() =>
        filterType === "all" ? catalogs : catalogs.filter(c => c.productType === filterType),
    [catalogs, filterType]);

    const totalImages   = allImages.length;
    const totalSelected = exportImages.length;

    // ── Helpers ───────────────────────────────────────────────────────────────

    const getCaption = (img: { publicId: string; catalog: Catalog }): string => {
        const override = captionOverrides.get(img.publicId);
        if (override) return override;
        const pp = img.catalog.promptParts;
        if (config.captionField === "particulars" && pp?.particulars) return pp.particulars;
        if (config.captionField === "theme" && pp?.theme) return pp.theme;
        return img.catalog.prompt ?? "";
    };

    const buildJsonl = (): string =>
        exportImages.map(img => JSON.stringify({
            file_name: `${img.publicId.replace(/\//g, "_")}.jpg`,
            url:       img.url,
            text:      getCaption(img),
            style:     img.catalog.productType ?? "coloring-book",
            catalog:   img.catalog.name,
            quality:   qualityMap.get(img.publicId) ?? 2,
            width:     img.width,
            height:    img.height,
        })).join("\n");

    const buildReadme = (): string => {
        const tags   = config.tags.split(",").map(t => t.trim()).filter(Boolean);
        const sizeLabel = exportImages.length < 100 ? "n<1K" : exportImages.length < 1000 ? "1K<n<10K" : "10K<n<100K";
        return `---
license: ${config.license}
tags:
${tags.map(t => `  - ${t}`).join("\n")}
task_categories:
  - text-to-image
pretty_name: ${config.name}
size_categories:
  - ${sizeLabel}
---

# ${config.name}

${config.description}

## Dataset Structure

Each row contains:
- \`file_name\`: image filename
- \`url\`: Cloudinary CDN URL
- \`text\`: caption / generation prompt
- \`style\`: product type (coloring-book, printable-poster…)
- \`catalog\`: source catalog name
- \`quality\`: quality rating (1-3)

## Stats

- **Total images:** ${exportImages.length}
- **Catalogs:** ${new Set(exportImages.map(i => i.catalog._id)).size}
- **License:** ${config.license}

## Generation

Images were generated with AI using Pollinations FLUX and similar open models via DataRefinery.
`;
    };

    const toggleCatalog = (id: string) => {
        setExpandedCatalogs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAllInCatalog = (catalog: Catalog) => {
        const ids = catalog.images.map(i => i.publicId);
        const allSelected = ids.every(id => selectedImages.has(id));
        setSelectedImages(prev => {
            const next = new Set(prev);
            if (allSelected) ids.forEach(id => next.delete(id));
            else ids.forEach(id => next.add(id));
            return next;
        });
    };

    const selectAllFiltered = () => {
        const allIds = filteredCatalogs.flatMap(c => c.images.map(i => i.publicId));
        const allSelected = allIds.every(id => selectedImages.has(id));
        setSelectedImages(prev => {
            const next = new Set(prev);
            if (allSelected) allIds.forEach(id => next.delete(id));
            else allIds.forEach(id => next.add(id));
            return next;
        });
    };

    const setQuality = (publicId: string, rating: QualityRating) => {
        setQualityMap(prev => new Map(prev).set(publicId, rating));
    };

    // ── Export (download) ─────────────────────────────────────────────────────

    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    const exportMetadata = async () => {
        if (exportImages.length === 0) { toast.error("Selecciona al menos una imagen"); return; }
        setIsExporting(true);
        try {
            downloadFile(buildJsonl(), `${config.name.replace(/\s+/g, "-")}_metadata.jsonl`, "application/jsonl");
            toast.success(`${exportImages.length} registros exportados`);
        } finally { setIsExporting(false); }
    };

    const exportUrls = () => {
        if (exportImages.length === 0) { toast.error("Selecciona al menos una imagen"); return; }
        downloadFile(exportImages.map(i => i.url).join("\n"), `${config.name.replace(/\s+/g, "-")}_urls.txt`, "text/plain");
        toast.success(`${exportImages.length} URLs exportadas`);
    };

    const exportDatasetCard = () => {
        if (exportImages.length === 0) { toast.error("Selecciona al menos una imagen"); return; }
        downloadFile(buildReadme(), "README.md", "text/markdown");
        toast.success("Dataset card descargada");
    };

    const copyPythonScript = () => {
        const script = `import requests, os, json
from pathlib import Path

OUTPUT_DIR = Path("dataset_images")
OUTPUT_DIR.mkdir(exist_ok=True)

with open("${config.name.replace(/\s+/g, "-")}_metadata.jsonl") as f:
    records = [json.loads(line) for line in f]

for i, rec in enumerate(records):
    fname = rec["file_name"]
    url   = rec["url"]
    dest  = OUTPUT_DIR / fname
    if dest.exists():
        print(f"[SKIP] {fname}")
        continue
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    dest.write_bytes(r.content)
    print(f"[{i+1}/{len(records)}] {fname}")

print(f"\\nDone — {len(records)} images saved to {OUTPUT_DIR}/")
`;
        navigator.clipboard.writeText(script);
        toast.success("Script Python copiado al portapapeles");
    };

    // ── API uploads ───────────────────────────────────────────────────────────

    const uploadToHuggingFace = async () => {
        if (exportImages.length === 0) {
            toast.error("Selecciona imágenes en el Motor primero");
            changeTab("motor");
            return;
        }
        if (!hfRepoName.trim()) { toast.error("Escribe un nombre de repositorio"); return; }
        setIsUploadingHF(true);
        setHfResult(null);
        try {
            const res  = await fetch(`${API_BASE_URL}/datasets/hf-upload`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    repoName:  hfRepoName.trim(),
                    isPrivate: hfIsPrivate,
                    files: [
                        { path: "metadata.jsonl", content: buildJsonl() },
                        { path: "README.md",       content: buildReadme() },
                    ],
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setHfResult(data.url);
            toast.success("Dataset subido a HuggingFace Hub");
        } catch (e: any) {
            toast.error(e.message ?? "Error subiendo a HuggingFace");
        } finally { setIsUploadingHF(false); }
    };

    // ── Render: Insights ──────────────────────────────────────────────────────

    const DATASET_PRODUCT_TYPES = DEFAULT_PRODUCT_TYPES.filter(t =>
        ["ai-dataset", "kdp-color-book", "other"].includes(t.id)
    );

    const renderInsights = () => (
        <div className="space-y-6">
            {/* Earnings stats */}
            <EarningsStats products={insightsProducts} />

            {/* Dataset stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Catálogos",        value: catalogs.length, color: "text-indigo-400" },
                    { label: "Imágenes totales",  value: totalImages,     color: "text-sky-400" },
                    { label: "Seleccionadas",     value: totalSelected,   color: "text-emerald-400" },
                    { label: "Dataset size est.", value: totalSelected > 0
                        ? `~${(exportImages.reduce((a, i) => a + (i.bytes ?? 0), 0) / 1024 / 1024).toFixed(1)} MB`
                        : "—", color: "text-amber-400" },
                ].map(s => (
                    <div key={s.label} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">{s.label}</p>
                        <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* HuggingFace Hub status */}
            <button onClick={() => changeTab("huggingface")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all text-left ${dsSettings?.hf.configured ? "border-emerald-500/20 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]" : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-center shrink-0">
                    <Zap size={13} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-white">HuggingFace Hub</p>
                    <p className="text-[9px] text-neutral-600">{dsSettings?.hf.configured ? `@${dsSettings.hf.username}` : "Sin configurar — ir a Ajustes"}</p>
                </div>
                {dsSettings?.hf.configured
                    ? <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                    : <AlertTriangle size={12} className="text-neutral-700 shrink-0" />
                }
            </button>

            {/* Digital products table */}
            <DigitalProductsTable
                apiBase={API_BASE_URL}
                productTypes={DATASET_PRODUCT_TYPES}
                defaultPlatform="HuggingFace Hub"
                filterTypes={DATASET_PRODUCT_TYPES.map(t => t.id)}
                onProductsChange={setInsightsProducts}
            />
        </div>
    );

    // ── Render: Motor ─────────────────────────────────────────────────────────

    const renderMotor = () => (
        <div className="space-y-4">
            {/* Selection summary bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-2 flex-wrap flex-1">
                    <div className="px-3 py-1.5 rounded-xl border border-white/8 bg-white/[0.02] text-[10px] font-black text-neutral-500">
                        <span className="text-sky-400">{totalImages}</span> imágenes · <span className="text-emerald-400">{totalSelected}</span> seleccionadas
                    </div>
                    {totalSelected > 0 && (
                        <div className="px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] text-[10px] font-black text-emerald-400">
                            ~{(exportImages.reduce((a, i) => a + (i.bytes ?? 0), 0) / 1024 / 1024).toFixed(1)} MB
                        </div>
                    )}
                </div>
                <button onClick={() => setShowInstructions(true)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] text-[9px] font-black text-indigo-400 hover:bg-indigo-500/15 transition-all">
                    <Info size={11} /> Cómo funciona
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Config + Export */}
                <div className="space-y-4">
                    {/* Dataset Config */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                            <Database size={13} className="text-indigo-400" />
                            <span className="text-[11px] font-black text-white uppercase tracking-widest">Configuración</span>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Nombre del dataset</label>
                                <input value={config.name} onChange={e => setConfig(p => ({ ...p, name: e.target.value }))}
                                    className="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-xl text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-indigo-500/40" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Descripción</label>
                                <textarea value={config.description} onChange={e => setConfig(p => ({ ...p, description: e.target.value }))}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-indigo-500/40 resize-none leading-relaxed" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Tags (separados por coma)</label>
                                <input value={config.tags} onChange={e => setConfig(p => ({ ...p, tags: e.target.value }))}
                                    className="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-xl text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-indigo-500/40" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Licencia</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {LICENSES.map(l => (
                                        <button key={l.id} onClick={() => setConfig(p => ({ ...p, license: l.id }))} title={l.desc}
                                            className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-black transition-all text-left ${config.license === l.id ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-300" : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-white"}`}>
                                            {l.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Caption =</label>
                                <div className="space-y-1">
                                    {CAPTION_FIELDS.map(f => (
                                        <button key={f.id} onClick={() => setConfig(p => ({ ...p, captionField: f.id }))}
                                            className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-all ${config.captionField === f.id ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300" : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-white"}`}>
                                            <div className={`w-3 h-3 rounded-full border-2 mt-0.5 shrink-0 ${config.captionField === f.id ? "border-indigo-400 bg-indigo-400" : "border-neutral-700"}`} />
                                            <div>
                                                <p className="text-[9px] font-black">{f.label}</p>
                                                <p className={`text-[8px] ${config.captionField === f.id ? "text-indigo-400/70" : "text-neutral-700"}`}>{f.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Calidad mínima</label>
                                <div className="flex gap-1.5">
                                    {([0, 1, 2, 3] as const).map(q => (
                                        <button key={q} onClick={() => setMinQuality(q)}
                                            className={`flex-1 h-8 rounded-lg border text-[9px] font-black transition-all ${minQuality === q ? "border-amber-500/50 bg-amber-500/15 text-amber-300" : "border-white/8 bg-white/[0.02] text-neutral-600 hover:text-white"}`}>
                                            {q === 0 ? "Todas" : "★".repeat(q)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Export */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                            <Package size={13} className="text-emerald-400" />
                            <span className="text-[11px] font-black text-white uppercase tracking-widest">Exportar</span>
                            {totalSelected > 0 && (
                                <span className="ml-auto text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    {totalSelected} imgs
                                </span>
                            )}
                        </div>
                        <div className="p-4 space-y-2">
                            <button onClick={() => void exportMetadata()} disabled={isExporting || totalSelected === 0}
                                className="w-full flex items-center gap-2 h-10 px-4 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-[10px] font-black text-indigo-300 hover:bg-indigo-500/30 transition-all disabled:opacity-40">
                                <FileJson size={13} /> Descargar metadata.jsonl
                            </button>
                            <button onClick={exportUrls} disabled={totalSelected === 0}
                                className="w-full flex items-center gap-2 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] font-black text-neutral-400 hover:text-white hover:bg-white/8 transition-all disabled:opacity-40">
                                <ExternalLink size={13} /> Exportar URLs (.txt)
                            </button>
                            <button onClick={exportDatasetCard} disabled={totalSelected === 0}
                                className="w-full flex items-center gap-2 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] font-black text-neutral-400 hover:text-white hover:bg-white/8 transition-all disabled:opacity-40">
                                <BookOpen size={13} /> Dataset Card (README.md)
                            </button>
                            <button onClick={copyPythonScript}
                                className="w-full flex items-center gap-2 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] font-black text-neutral-400 hover:text-white hover:bg-white/8 transition-all">
                                <Copy size={13} /> Copiar script Python
                            </button>
                            <div className="pt-1 border-t border-white/[0.05]">
                                <button onClick={() => changeTab("huggingface")} disabled={totalSelected === 0}
                                    className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-[9px] font-black text-yellow-400 hover:bg-yellow-500/20 transition-all disabled:opacity-40">
                                    <Zap size={11} /> Subir a HuggingFace Hub
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* HF quick guide accordion */}
                    <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] overflow-hidden">
                        <button onClick={() => setShowGuide(v => !v)}
                            className="w-full flex items-center gap-2 px-4 py-3">
                            <Info size={12} className="text-amber-400 shrink-0" />
                            <span className="text-[10px] font-black text-amber-300 flex-1 text-left">Guía: subir manualmente a HuggingFace</span>
                            <ChevronDown size={12} className={`text-amber-500 transition-transform ${showGuide ? "rotate-180" : ""}`} />
                        </button>
                        {showGuide && (
                            <div className="px-4 pb-4 space-y-2 text-[10px] text-amber-200/70 leading-relaxed">
                                <p>1. Descarga <code className="text-amber-300 bg-amber-500/10 px-1 rounded">metadata.jsonl</code> y ejecuta el script Python.</p>
                                <p>2. <code className="text-amber-300 bg-amber-500/10 px-1 rounded">pip install huggingface_hub && huggingface-cli login</code></p>
                                <p>3. Sube la carpeta con imágenes + JSONL + README al Hub como Dataset.</p>
                                <p>4. Activa <strong>Gated Access</strong> para cobrar (manual).</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Catalog browser */}
                <div className="lg:col-span-2 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex gap-1 flex-wrap">
                            {productTypes.map(t => (
                                <button key={t} onClick={() => setFilterType(t)}
                                    className={`h-7 px-2.5 rounded-lg border text-[9px] font-black transition-all ${filterType === t ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-white/8 bg-white/[0.02] text-neutral-600 hover:text-white"}`}>
                                    {t === "all" ? "Todos" : t}
                                </button>
                            ))}
                        </div>
                        <button onClick={selectAllFiltered}
                            className="ml-auto flex items-center gap-1 h-7 px-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-[9px] font-black text-neutral-500 hover:text-white transition-all">
                            <Check size={9} />
                            {filteredCatalogs.flatMap(c => c.images).every(i => selectedImages.has(i.publicId)) ? "Deseleccionar todo" : "Seleccionar todo"}
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="space-y-2">
                            {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-2xl bg-white/[0.03] animate-pulse" />)}
                        </div>
                    ) : filteredCatalogs.length === 0 ? (
                        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-12 flex flex-col items-center gap-3 text-center">
                            <Database size={32} className="text-neutral-700" />
                            <p className="text-[11px] font-black text-neutral-600">No hay catálogos con imágenes todavía</p>
                            <p className="text-[10px] text-neutral-700">Genera catálogos desde KDP Factory para empezar</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                            {filteredCatalogs.map(catalog => {
                                const isExpanded   = expandedCatalogs.has(catalog._id);
                                const catImages    = catalog.images;
                                const selectedCount = catImages.filter(i => selectedImages.has(i.publicId)).length;
                                const allCatSel    = catImages.length > 0 && selectedCount === catImages.length;

                                return (
                                    <div key={catalog._id} className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                                        <div className="flex items-center gap-2 px-3 py-2.5">
                                            <button onClick={() => selectAllInCatalog(catalog)}
                                                className={`w-5 h-5 rounded-lg border-2 shrink-0 flex items-center justify-center transition-all ${allCatSel ? "border-emerald-500 bg-emerald-500" : selectedCount > 0 ? "border-emerald-500/60 bg-emerald-500/20" : "border-white/20 bg-white/[0.03] hover:border-white/40"}`}>
                                                {allCatSel && <Check size={10} className="text-black" />}
                                                {!allCatSel && selectedCount > 0 && <div className="w-2 h-2 rounded-sm bg-emerald-400" />}
                                            </button>
                                            <button onClick={() => toggleCatalog(catalog._id)} className="flex-1 flex items-center gap-2 min-w-0 text-left">
                                                <ChevronRight size={12} className={`text-neutral-600 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                                <p className="text-[11px] font-black text-white truncate">{catalog.name}</p>
                                                <span className="text-[8px] text-neutral-600 bg-white/[0.04] border border-white/8 rounded-full px-1.5 py-0.5 shrink-0">{catalog.productType ?? "other"}</span>
                                            </button>
                                            <span className="text-[9px] text-neutral-600 tabular-nums shrink-0">
                                                {selectedCount > 0 ? <span className="text-emerald-400">{selectedCount}/</span> : ""}{catImages.length} imgs
                                            </span>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t border-white/[0.05] p-3">
                                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                                    {catImages.map(img => {
                                                        const isSel  = selectedImages.has(img.publicId);
                                                        const quality = qualityMap.get(img.publicId) ?? 2;
                                                        return (
                                                            <div key={img.publicId} className="relative group">
                                                                <button
                                                                    onClick={() => setSelectedImages(prev => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(img.publicId)) next.delete(img.publicId);
                                                                        else next.add(img.publicId);
                                                                        return next;
                                                                    })}
                                                                    className={`relative w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${isSel ? "border-emerald-500/70" : "border-white/10 hover:border-white/30"}`}>
                                                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                                                    {isSel && (
                                                                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                                                                            <Check size={8} className="text-black" />
                                                                        </div>
                                                                    )}
                                                                </button>
                                                                <div className="flex justify-center gap-0.5 mt-1">
                                                                    {([1, 2, 3] as QualityRating[]).map(q => (
                                                                        <button key={q} onClick={() => setQuality(img.publicId, q)}
                                                                            className={`text-[9px] transition-all ${quality >= q ? "text-amber-400" : "text-neutral-700 hover:text-amber-600"}`}>★</button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {catalog.promptParts && (
                                                    <div className="mt-3 p-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                                                        <p className="text-[8px] font-black uppercase tracking-widest text-neutral-700 mb-1">Caption preview ({config.captionField})</p>
                                                        <p className="text-[9px] text-neutral-500 leading-relaxed line-clamp-2">
                                                            {config.captionField === "particulars" ? catalog.promptParts.particulars
                                                             : config.captionField === "theme" ? catalog.promptParts.theme
                                                             : catalog.prompt}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // ── Render: HuggingFace ───────────────────────────────────────────────────

    const renderHuggingFace = () => {
        const configured = dsSettings?.hf.configured;
        return (
            <div className="max-w-2xl mx-auto space-y-5">
                {/* Status banner */}
                <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${configured ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-amber-500/20 bg-amber-500/[0.04]"}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${configured ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
                        {configured ? <CheckCircle size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
                    </div>
                    <div className="flex-1">
                        <p className={`text-[11px] font-black ${configured ? "text-emerald-300" : "text-amber-300"}`}>
                            {configured ? `HuggingFace Hub · @${dsSettings?.hf.username}` : "HuggingFace Hub sin configurar"}
                        </p>
                        <p className={`text-[9px] ${configured ? "text-emerald-500/70" : "text-amber-500/60"}`}>
                            {configured ? "Listo para subir datasets" : "Añade HUGGINGFACE_WRITE_TOKEN y HUGGINGFACE_USERNAME en Ajustes"}
                        </p>
                    </div>
                    {!configured && (
                        <a href="/ajustes" className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-xl bg-amber-500/15 border border-amber-500/20 text-[9px] font-black text-amber-300 hover:bg-amber-500/25 transition-all">
                            <Settings size={11} /> Ajustes
                        </a>
                    )}
                    {configured && (
                        <button onClick={() => void loadDsSettings()} className="shrink-0 text-neutral-600 hover:text-white transition-colors p-1">
                            <RefreshCw size={12} />
                        </button>
                    )}
                </div>

                {/* Selection summary */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${totalSelected > 0 ? "border-indigo-500/20 bg-indigo-500/[0.04]" : "border-white/8 bg-white/[0.02]"}`}>
                    <ImageIcon size={13} className={totalSelected > 0 ? "text-indigo-400" : "text-neutral-700"} />
                    <div className="flex-1">
                        <p className={`text-[11px] font-black ${totalSelected > 0 ? "text-white" : "text-neutral-600"}`}>
                            {totalSelected > 0 ? `${totalSelected} imágenes seleccionadas` : "Ninguna imagen seleccionada"}
                        </p>
                        <p className="text-[9px] text-neutral-700">
                            {totalSelected > 0 ? `De ${new Set(exportImages.map(i => i.catalog._id)).size} catálogos · Se subirá metadata.jsonl + README.md` : "Ve al Motor para seleccionar imágenes"}
                        </p>
                    </div>
                    {totalSelected === 0 && (
                        <button onClick={() => changeTab("motor")} className="shrink-0 flex items-center gap-1.5 h-7 px-3 rounded-xl border border-white/10 bg-white/[0.04] text-[9px] font-black text-neutral-500 hover:text-white transition-all">
                            Motor →
                        </button>
                    )}
                </div>

                {/* Upload form */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                        <Zap size={13} className="text-yellow-400" />
                        <span className="text-[11px] font-black text-white uppercase tracking-widest">Subir a HuggingFace Hub</span>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Nombre del repositorio</label>
                            <input value={hfRepoName} onChange={e => setHfRepoName(e.target.value)}
                                placeholder="mi-dataset-coloring-books"
                                className="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-xl text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-yellow-500/40 font-mono" />
                            {dsSettings?.hf.username && hfRepoName && (
                                <p className="text-[9px] text-neutral-700 font-mono">
                                    → huggingface.co/datasets/{dsSettings.hf.username}/{hfRepoName}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setHfIsPrivate(false)}
                                className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border text-[10px] font-black transition-all ${!hfIsPrivate ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-white"}`}>
                                <Globe size={12} /> Público
                            </button>
                            <button onClick={() => setHfIsPrivate(true)}
                                className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border text-[10px] font-black transition-all ${hfIsPrivate ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-white"}`}>
                                <Tag size={12} /> Privado
                            </button>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Archivos que se subirán</p>
                            {[
                                { name: "metadata.jsonl", desc: `${totalSelected} registros · imagen + caption + calidad` },
                                { name: "README.md",      desc: "Dataset card con metadata y licencia" },
                            ].map(f => (
                                <div key={f.name} className="flex items-center gap-2">
                                    <Check size={10} className="text-emerald-500 shrink-0" />
                                    <code className="text-[9px] text-indigo-300">{f.name}</code>
                                    <span className="text-[9px] text-neutral-700">{f.desc}</span>
                                </div>
                            ))}
                            <p className="text-[8px] text-neutral-700 mt-1 pt-1 border-t border-white/[0.04]">
                                Las imágenes permanecen en Cloudinary y se referencian por URL — no se duplican.
                            </p>
                        </div>

                        {hfResult && (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
                                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-emerald-300">Dataset subido correctamente</p>
                                    <a href={hfResult} target="_blank" rel="noreferrer" className="text-[9px] text-emerald-500/70 hover:text-emerald-400 truncate block transition-colors">{hfResult}</a>
                                </div>
                                <a href={hfResult} target="_blank" rel="noreferrer" className="shrink-0 p-1 text-emerald-500 hover:text-emerald-300 transition-colors">
                                    <ExternalLink size={13} />
                                </a>
                            </div>
                        )}

                        <button onClick={() => void uploadToHuggingFace()} disabled={isUploadingHF || !configured || totalSelected === 0}
                            className="w-full h-12 rounded-2xl bg-gradient-to-r from-yellow-600/80 to-orange-600/80 hover:from-yellow-500/80 hover:to-orange-500/80 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-[0_4px_20px_rgba(234,179,8,0.2)]">
                            {isUploadingHF ? <><Loader2 size={14} className="animate-spin" />Subiendo…</> : <><CloudUpload size={14} />Subir a HuggingFace Hub</>}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ── Main render ───────────────────────────────────────────────────────────

    return (
        <div className="space-y-12 pb-24">
            {/* Instructions modal */}
            {showInstructions && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowInstructions(false)} />
                    <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-[28px] p-7 shadow-2xl animate-in zoom-in-95 duration-300 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                                    <BookOpen size={14} className="text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-[14px] font-black text-white italic">DataRefinery</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Cómo se usa</p>
                                </div>
                            </div>
                            <button onClick={() => setShowInstructions(false)} className="w-7 h-7 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white transition-all">
                                <X size={12} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {INSTRUCTIONS_STEPS.map(step => (
                                <div key={step.n} className="flex gap-3">
                                    <div className="w-5 h-5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-[8px] font-black text-indigo-400">{step.n}</span>
                                    </div>
                                    <p className="text-[11px] text-neutral-400 leading-relaxed">{step.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <AppTabNav tabs={tabs} activeTab={activeTab} onChange={changeTab} storageKey="datarefinery-tab" />
            <div className="relative pt-6">
                {activeTab === "insights"    && renderInsights()}
                {activeTab === "motor"       && renderMotor()}
                {activeTab === "huggingface" && renderHuggingFace()}
            </div>
        </div>
    );
}
