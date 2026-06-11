// Modal de subida a Gelato (impresión bajo demanda) con troceo de PDFs grandes.
// Extraído de kdp-factory-app.tsx sin cambios de lógica.
"use client";
import { useState } from "react";
import { Loader2, Check, AlertTriangle, Zap, Package, ExternalLink, Download, X } from "lucide-react";
import type { BookPage } from "./types";

const WIRE_O_UID = "wire-o-multi-page-brochures_pf_a4_pt_115-gsm-uncoated_cl_4-4_bt_wire-o-left_cpt_300-gsm-uncoated_ver";

const MAX_GELATO_PAGES = 148; // max even image pages per PDF (+ owner page = 149 total, within 150 limit)

export function GelatoUploadModal({
    bookPages,
    bookFileName,
    buildPdf,
    apiUrl,
    onClose,
}: {
    bookPages: BookPage[];
    bookFileName: string;
    buildPdf: (pages?: BookPage[], forceNoOwnerPage?: boolean) => Promise<Uint8Array | null>;
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
                let chunkPages = firstIsBlank ? chunks[i] : [blankSeparator, ...chunks[i]];
                // ensure blank after first image in this chunk
                const fii = chunkPages.findIndex(p => p.image);
                if (fii !== -1 && chunkPages[fii + 1]?.image) {
                    chunkPages = [...chunkPages.slice(0, fii + 1), blankSeparator, ...chunkPages.slice(fii + 1)];
                }
                const pagesForPdf = chunkPages;
                const bytes = await buildPdf(pagesForPdf, i > 0);
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
                        <p className="text-sm text-neutral-500">Impresión Wire-O bajo demanda</p>
                    </div>
                    <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/8">
                        <X size={14} className="text-neutral-400" />
                    </button>
                </div>

                {pageCount < 20 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2 mb-4">
                        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-300">Wire-O requiere mínimo 20 páginas. Tu libro tiene {pageCount}.</p>
                    </div>
                )}
                {needsSplit && (
                    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 flex gap-2 mb-4">
                        <AlertTriangle size={14} className="text-sky-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-sky-300 space-y-1">
                            <p className="font-bold">Tu libro tiene {pageCount} páginas — máximo {MAX_GELATO_PAGES} imágenes por PDF en Gelato.</p>
                            <p>Se dividirá en <span className="font-bold">{chunks.length} archivos</span>. Cada uno: <span className="font-mono text-white/70">prueba colores + blanco + {chunks.map(c => c.length).join(" / ")} imágenes</span> = <span className="font-bold">{chunks.map(c => 2 + c.length).join(" / ")} páginas totales (par ✓)</span>.</p>
                        </div>
                    </div>
                )}

                {/* Specs strip */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 mb-4">
                    {SPECS.map(([k, v]) => (
                        <div key={k} className="flex items-baseline gap-1">
                            <span className="text-sm text-neutral-600">{k}:</span>
                            <span className="text-sm text-neutral-300 font-medium">{v}</span>
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
                            <span className="ml-auto text-sm font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-2 py-0.5">Disponible</span>
                        </div>
                        <ol className="space-y-2 mb-4">
                            {MANUAL_STEPS.map(({ n, text }) => (
                                <li key={n} className="flex gap-2.5 items-start">
                                    <span className="w-4 h-4 rounded-full bg-white/8 flex items-center justify-center text-sm font-black text-neutral-400 shrink-0 mt-0.5">{n}</span>
                                    <span className="text-sm text-neutral-400 leading-relaxed">{text}</span>
                                </li>
                            ))}
                        </ol>
                        {manualError && <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2 mb-3">{manualError}</p>}
                        {manualDone && (
                            <div className="flex items-center gap-2 text-sm text-emerald-400 mb-3">
                                <Check size={12} /> {needsSplit ? `${chunks.length} PDFs descargados` : "PDF descargado"} — continúa en Gelato Dashboard
                            </div>
                        )}
                        {multiProgress && (
                            <div className="flex items-center gap-2 text-sm text-sky-400 mb-3">
                                <Loader2 size={12} className="animate-spin" /> Generando parte {multiProgress.current} de {multiProgress.total}...
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={needsSplit ? handleDownloadMultiple : handleDownload}
                                disabled={manualGenerating || !isValidForWireO}
                                className="flex-1 py-2.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                            >
                                {manualGenerating ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                {manualGenerating ? (multiProgress ? `Parte ${multiProgress.current}/${multiProgress.total}...` : "Generando...") : needsSplit ? `1. Descargar ${chunks.length} PDFs` : "1. Descargar PDF"}
                            </button>
                            <a
                                href="https://dashboard.gelato.com/price-navigator/prices"
                                target="_blank" rel="noreferrer"
                                className="flex-1 py-2.5 rounded-2xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 font-bold text-sm flex items-center justify-center gap-2 transition-all"
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
                            <span className="ml-auto text-sm font-black uppercase tracking-widest text-neutral-500 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">Próximamente</span>
                        </div>
                        <p className="text-sm text-neutral-600 pl-7">
                            Cuando alguien compre en Etsy, generará el PDF y creará el pedido en Gelato automáticamente. Requiere servidor en producción y webhooks de Etsy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
