"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    Database, Download, Copy, Check, ChevronDown, ChevronRight,
    Sparkles, Star, ImageIcon, FileJson, Package, ExternalLink,
    Layers, Tag, RefreshCw, X, Info, BookOpen, Cpu
} from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Types ────────────────────────────────────────────────────────────────────

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
    nicheIds?: string[];
    createdAt: string;
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
    { id: "cc-by-4.0", label: "CC BY 4.0", desc: "Permite uso comercial con atribución" },
    { id: "cc0-1.0", label: "CC0 (Dominio público)", desc: "Sin restricciones, máxima difusión" },
    { id: "openrail", label: "OpenRAIL", desc: "Estándar HuggingFace para modelos/datos IA" },
    { id: "cc-by-sa-4.0", label: "CC BY-SA 4.0", desc: "Copyleft: derivados con misma licencia" },
];

const CAPTION_FIELDS = [
    { id: "particulars" as const, label: "Particulars (detalle IA)", desc: "Prompt específico de cada imagen — mayor diversidad" },
    { id: "theme" as const, label: "Theme (temática)", desc: "Nombre del nicho/temática — más conciso" },
    { id: "prompt" as const, label: "Prompt completo", desc: "Prompt íntegro enviado al modelo" },
];

// ── Component ────────────────────────────────────────────────────────────────

export function DataRefineryApp() {
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
    const [qualityMap, setQualityMap] = useState<Map<string, QualityRating>>(new Map());
    const [captionOverrides, setCaptionOverrides] = useState<Map<string, string>>(new Map());
    const [expandedCatalogs, setExpandedCatalogs] = useState<Set<string>>(new Set());
    const [config, setConfig] = useState<DatasetConfig>({
        name: "coloring-book-dataset",
        description: "Curated coloring book illustrations with text captions, generated with AI for fine-tuning image models.",
        license: "openrail",
        tags: "coloring-book, line-art, illustration, ai-generated",
        captionField: "particulars",
    });
    const [filterType, setFilterType] = useState<string>("all");
    const [minQuality, setMinQuality] = useState<QualityRating | 0>(0);
    const [isExporting, setIsExporting] = useState(false);
    const [showGuide, setShowGuide] = useState(false);

    // Load catalogs
    useEffect(() => {
        void (async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${API_BASE_URL}/catalogs?limit=200`);
                const data = await res.json();
                const completed = (data.catalogs ?? []).filter((c: Catalog) => c.images?.length > 0);
                setCatalogs(completed);
                // Auto-expand first 3
                const first3 = completed.slice(0, 3).map((c: Catalog) => c._id);
                setExpandedCatalogs(new Set(first3));
            } catch {
                toast.error("Error cargando catálogos");
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    // All images flat list
    const allImages = useMemo(() => {
        return catalogs.flatMap(c =>
            c.images.map(img => ({ ...img, catalog: c }))
        );
    }, [catalogs]);

    // Filtered selected images (respecting quality filter)
    const exportImages = useMemo(() => {
        return allImages.filter(img => {
            if (!selectedImages.has(img.publicId)) return false;
            const q = qualityMap.get(img.publicId) ?? 2;
            return minQuality === 0 || q >= minQuality;
        });
    }, [allImages, selectedImages, qualityMap, minQuality]);

    const productTypes = useMemo(() => {
        const types = new Set(catalogs.map(c => c.productType ?? "other"));
        return ["all", ...Array.from(types)];
    }, [catalogs]);

    const filteredCatalogs = useMemo(() => {
        return filterType === "all" ? catalogs : catalogs.filter(c => c.productType === filterType);
    }, [catalogs, filterType]);

    const toggleCatalog = (catalogId: string) => {
        setExpandedCatalogs(prev => {
            const next = new Set(prev);
            if (next.has(catalogId)) next.delete(catalogId); else next.add(catalogId);
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

    const getCaption = (img: { publicId: string; catalog: Catalog }): string => {
        const override = captionOverrides.get(img.publicId);
        if (override) return override;
        const pp = img.catalog.promptParts;
        if (config.captionField === "particulars" && pp?.particulars) return pp.particulars;
        if (config.captionField === "theme" && pp?.theme) return pp.theme;
        return img.catalog.prompt ?? "";
    };

    const exportMetadata = async () => {
        if (exportImages.length === 0) { toast.error("Selecciona al menos una imagen"); return; }
        setIsExporting(true);
        try {
            const lines = exportImages.map(img => JSON.stringify({
                file_name: `${img.publicId.replace(/\//g, "_")}.jpg`,
                url: img.url,
                text: getCaption(img),
                style: img.catalog.productType ?? "coloring-book",
                catalog: img.catalog.name,
                quality: qualityMap.get(img.publicId) ?? 2,
                width: img.width,
                height: img.height,
            }));
            const blob = new Blob([lines.join("\n")], { type: "application/jsonl" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${config.name.replace(/\s+/g, "-")}_metadata.jsonl`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            toast.success(`${exportImages.length} registros exportados como JSONL`);
        } finally {
            setIsExporting(false);
        }
    };

    const exportUrls = () => {
        if (exportImages.length === 0) { toast.error("Selecciona al menos una imagen"); return; }
        const lines = exportImages.map(img => img.url).join("\n");
        const blob = new Blob([lines], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${config.name.replace(/\s+/g, "-")}_urls.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast.success(`${exportImages.length} URLs exportadas`);
    };

    const exportDatasetCard = () => {
        const tags = config.tags.split(",").map(t => t.trim()).filter(Boolean);
        const card = `---
license: ${config.license}
tags:
${tags.map(t => `  - ${t}`).join("\n")}
task_categories:
  - text-to-image
pretty_name: ${config.name}
size_categories:
  - ${exportImages.length < 100 ? "n<1K" : exportImages.length < 1000 ? "1K<n<10K" : "10K<n<100K"}
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

Images were generated with AI using Pollinations FLUX and similar open models.
`;
        const blob = new Blob([card], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "README.md";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast.success("Dataset card (README.md) descargada");
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
    url = rec["url"]
    dest = OUTPUT_DIR / fname
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

    const totalImages = allImages.length;
    const totalSelected = exportImages.length;

    return (
        <div className="space-y-6">

            {/* ── Stats bar ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Catálogos", value: catalogs.length, color: "text-indigo-400" },
                    { label: "Imágenes totales", value: totalImages, color: "text-sky-400" },
                    { label: "Seleccionadas", value: totalSelected, color: "text-emerald-400" },
                    { label: "Dataset size est.", value: totalSelected > 0 ? `~${(exportImages.reduce((a, i) => a + (i.bytes ?? 0), 0) / 1024 / 1024).toFixed(1)} MB` : "—", color: "text-amber-400" },
                ].map(s => (
                    <div key={s.label} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">{s.label}</p>
                        <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── Left: Dataset config + Export ── */}
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
                                        <button key={l.id} onClick={() => setConfig(p => ({ ...p, license: l.id }))}
                                            title={l.desc}
                                            className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-black transition-all text-left ${config.license === l.id ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-300" : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-white hover:bg-white/6"}`}>
                                            {l.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Caption = </label>
                                <div className="space-y-1">
                                    {CAPTION_FIELDS.map(f => (
                                        <button key={f.id} onClick={() => setConfig(p => ({ ...p, captionField: f.id }))}
                                            className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-all ${config.captionField === f.id ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300" : "border-white/8 bg-white/[0.02] text-neutral-500 hover:text-white hover:bg-white/6"}`}>
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

                    {/* Export buttons */}
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
                                <FileJson size={13} />
                                Descargar metadata.jsonl
                            </button>
                            <button onClick={exportUrls} disabled={totalSelected === 0}
                                className="w-full flex items-center gap-2 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] font-black text-neutral-400 hover:text-white hover:bg-white/8 transition-all disabled:opacity-40">
                                <ExternalLink size={13} />
                                Exportar URLs (.txt)
                            </button>
                            <button onClick={exportDatasetCard} disabled={totalSelected === 0}
                                className="w-full flex items-center gap-2 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] font-black text-neutral-400 hover:text-white hover:bg-white/8 transition-all disabled:opacity-40">
                                <BookOpen size={13} />
                                Dataset Card (README.md)
                            </button>
                            <button onClick={copyPythonScript}
                                className="w-full flex items-center gap-2 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] font-black text-neutral-400 hover:text-white hover:bg-white/8 transition-all">
                                <Copy size={13} />
                                Copiar script Python (descarga imgs)
                            </button>
                        </div>
                    </div>

                    {/* HF Guide */}
                    <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] overflow-hidden">
                        <button onClick={() => setShowGuide(v => !v)}
                            className="w-full flex items-center gap-2 px-4 py-3">
                            <Info size={12} className="text-amber-400 shrink-0" />
                            <span className="text-[10px] font-black text-amber-300 flex-1 text-left">Guía: subir a HuggingFace Hub</span>
                            <ChevronDown size={12} className={`text-amber-500 transition-transform ${showGuide ? "rotate-180" : ""}`} />
                        </button>
                        {showGuide && (
                            <div className="px-4 pb-4 space-y-2 text-[10px] text-amber-200/70 leading-relaxed">
                                <p>1. Descarga <code className="text-amber-300 bg-amber-500/10 px-1 rounded">metadata.jsonl</code> y ejecuta el script Python para tener las imágenes localmente.</p>
                                <p>2. Instala la CLI: <code className="text-amber-300 bg-amber-500/10 px-1 rounded">pip install huggingface_hub</code></p>
                                <p>3. Login: <code className="text-amber-300 bg-amber-500/10 px-1 rounded">huggingface-cli login</code></p>
                                <p>4. Sube con el dataset card en la raíz junto a <code className="text-amber-300 bg-amber-500/10 px-1 rounded">metadata.jsonl</code> e imágenes.</p>
                                <p>5. En HuggingFace Hub, crea el repo como <strong>Dataset</strong> y activa <strong>Gated Access</strong> si quieres cobrar.</p>
                                <a href="https://huggingface.co/docs/hub/datasets-image-classification" target="_blank" rel="noreferrer"
                                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors">
                                    <ExternalLink size={10} /> Documentación oficial
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Catalog browser ── */}
                <div className="lg:col-span-2 space-y-3">
                    {/* Toolbar */}
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

                    {/* Catalog list */}
                    {isLoading ? (
                        <div className="space-y-2">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-14 rounded-2xl bg-white/[0.03] animate-pulse" />
                            ))}
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
                                const isExpanded = expandedCatalogs.has(catalog._id);
                                const catImages = catalog.images;
                                const selectedCount = catImages.filter(i => selectedImages.has(i.publicId)).length;
                                const allCatSelected = catImages.length > 0 && selectedCount === catImages.length;

                                return (
                                    <div key={catalog._id} className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                                        {/* Catalog header */}
                                        <div className="flex items-center gap-2 px-3 py-2.5">
                                            <button onClick={() => selectAllInCatalog(catalog)}
                                                className={`w-5 h-5 rounded-lg border-2 shrink-0 flex items-center justify-center transition-all ${allCatSelected ? "border-emerald-500 bg-emerald-500" : selectedCount > 0 ? "border-emerald-500/60 bg-emerald-500/20" : "border-white/20 bg-white/[0.03] hover:border-white/40"}`}>
                                                {allCatSelected && <Check size={10} className="text-black" />}
                                                {!allCatSelected && selectedCount > 0 && <div className="w-2 h-2 rounded-sm bg-emerald-400" />}
                                            </button>
                                            <button onClick={() => toggleCatalog(catalog._id)} className="flex-1 flex items-center gap-2 min-w-0 text-left">
                                                <ChevronRight size={12} className={`text-neutral-600 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                                <p className="text-[11px] font-black text-white truncate">{catalog.name}</p>
                                                <span className="text-[8px] text-neutral-600 bg-white/[0.04] border border-white/8 rounded-full px-1.5 py-0.5 shrink-0">
                                                    {catalog.productType ?? "other"}
                                                </span>
                                            </button>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[9px] text-neutral-600 tabular-nums">
                                                    {selectedCount > 0 ? <span className="text-emerald-400">{selectedCount}/</span> : ""}{catImages.length} imgs
                                                </span>
                                            </div>
                                        </div>

                                        {/* Image grid */}
                                        {isExpanded && (
                                            <div className="border-t border-white/[0.05] p-3">
                                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                                    {catImages.map(img => {
                                                        const isSelected = selectedImages.has(img.publicId);
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
                                                                    className={`relative w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${isSelected ? "border-emerald-500/70" : "border-white/10 hover:border-white/30"}`}
                                                                >
                                                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                                                    {isSelected && (
                                                                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                                                                            <Check size={8} className="text-black" />
                                                                        </div>
                                                                    )}
                                                                </button>
                                                                {/* Quality stars */}
                                                                <div className="flex justify-center gap-0.5 mt-1">
                                                                    {([1, 2, 3] as QualityRating[]).map(q => (
                                                                        <button key={q} onClick={() => setQuality(img.publicId, q)}
                                                                            className={`text-[9px] transition-all ${quality >= q ? "text-amber-400" : "text-neutral-700 hover:text-amber-600"}`}>
                                                                            ★
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {/* Caption preview */}
                                                {catalog.promptParts && (
                                                    <div className="mt-3 p-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                                                        <p className="text-[8px] font-black uppercase tracking-widest text-neutral-700 mb-1">Caption preview ({config.captionField})</p>
                                                        <p className="text-[9px] text-neutral-500 leading-relaxed line-clamp-2">
                                                            {config.captionField === "particulars"
                                                                ? catalog.promptParts.particulars
                                                                : config.captionField === "theme"
                                                                    ? catalog.promptParts.theme
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
}
