"use client";
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Package, Printer, RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LuluPodPackage { id: string; label: string; inches: string; }
interface LuluPrintJob {
    id: string;
    status: { name: string };
    date_created: string;
    line_items?: Array<{ title: string; quantity: number; pod_package_id: string }>;
}

const SHIPPING_OPTIONS = [
    { id: "MAIL",     label: "Correo estándar (~15 días)" },
    { id: "PRIORITY_MAIL", label: "Correo prioritario (~10 días)" },
    { id: "GROUND",   label: "Transporte terrestre (~7 días)" },
    { id: "EXPEDITED", label: "Exprés (~3-5 días)" },
];

const JOB_STATUS_COLORS: Record<string, string> = {
    CREATED:   "text-sky-400",
    UNPAID:    "text-amber-400",
    PAYMENT_IN_PROGRESS: "text-amber-400",
    PRODUCTION_DELAYED: "text-orange-400",
    IN_PRODUCTION: "text-blue-400",
    SHIPPED:   "text-emerald-400",
    REJECTED:  "text-rose-400",
    CANCELLED: "text-neutral-500",
    FULFILLED: "text-emerald-400",
};

// ── Main Panel ────────────────────────────────────────────────────────────────

interface LuluPanelProps {
    bookPdfUrl?: string;
    coverUrl?: string;
    bookTitle?: string;
    pageCount?: number;
}

export default function LuluPanel({ bookPdfUrl, coverUrl, bookTitle, pageCount }: LuluPanelProps) {
    const [connected, setConnected] = useState<boolean | null>(null);
    const [packages, setPackages] = useState<Record<string, LuluPodPackage>>({});
    const [checking, setChecking] = useState(false);

    // Credentials
    const [clientKey, setClientKey] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [savingCreds, setSavingCreds] = useState(false);

    // Cost calculator
    const [calcPkg, setCalcPkg] = useState("");
    const [calcPages, setCalcPages] = useState(String(pageCount ?? 50));
    const [calcQty, setCalcQty] = useState("1");
    const [calcCountry, setCalcCountry] = useState("ES");
    const [calcShipping, setCalcShipping] = useState("MAIL");
    const [costResult, setCostResult] = useState<any>(null);
    const [calculating, setCalculating] = useState(false);

    // Print job form
    const [jobTitle, setJobTitle] = useState(bookTitle ?? "");
    const [jobInteriorUrl, setJobInteriorUrl] = useState(bookPdfUrl ?? "");
    const [jobCoverUrl, setJobCoverUrl] = useState(coverUrl ?? "");
    const [jobPkg, setJobPkg] = useState("");
    const [jobPages, setJobPages] = useState(String(pageCount ?? 50));
    const [jobQty, setJobQty] = useState("1");
    const [jobEmail, setJobEmail] = useState("elputoemi91@hotmail.com");
    const [jobShipping, setJobShipping] = useState("MAIL");
    const [jobName, setJobName] = useState("");
    const [jobStreet, setJobStreet] = useState("");
    const [jobCity, setJobCity] = useState("");
    const [jobState, setJobState] = useState("");
    const [jobPostcode, setJobPostcode] = useState("");
    const [jobCountry, setJobCountry] = useState("ES");
    const [creatingJob, setCreatingJob] = useState(false);

    // Jobs list
    const [jobs, setJobs] = useState<LuluPrintJob[]>([]);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [expandedJob, setExpandedJob] = useState<string | null>(null);

    const [section, setSection] = useState<"setup" | "calculator" | "print" | "jobs">("setup");

    const checkConnection = useCallback(async () => {
        setChecking(true);
        try {
            const res = await fetch(`${API_BASE_URL}/lulu/ping`);
            const data = await res.json();
            setConnected(data.ok);
            if (data.packages) setPackages(data.packages);
            if (data.ok && !calcPkg) setCalcPkg(Object.keys(data.packages)[0] ?? "");
            if (data.ok && !jobPkg) setJobPkg(Object.keys(data.packages)[0] ?? "");
        } catch {
            setConnected(false);
        } finally {
            setChecking(false);
        }
    }, [calcPkg, jobPkg]);

    useEffect(() => { checkConnection(); }, []);

    useEffect(() => { if (bookPdfUrl) setJobInteriorUrl(bookPdfUrl); }, [bookPdfUrl]);
    useEffect(() => { if (coverUrl) setJobCoverUrl(coverUrl); }, [coverUrl]);
    useEffect(() => { if (bookTitle) setJobTitle(bookTitle); }, [bookTitle]);
    useEffect(() => { if (pageCount) { setCalcPages(String(pageCount)); setJobPages(String(pageCount)); } }, [pageCount]);

    const saveCredentials = async () => {
        if (!clientKey.trim() || !clientSecret.trim()) { toast.error("Introduce Client Key y Client Secret"); return; }
        setSavingCreds(true);
        try {
            const res = await fetch(`${API_BASE_URL}/lulu/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientKey: clientKey.trim(), clientSecret: clientSecret.trim() }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success("Credenciales guardadas");
            await checkConnection();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSavingCreds(false);
        }
    };

    const calculateCost = async () => {
        if (!calcPkg || !calcPages) { toast.error("Selecciona formato y páginas"); return; }
        setCalculating(true);
        setCostResult(null);
        try {
            const res = await fetch(`${API_BASE_URL}/lulu/cost-calculation`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pod_package_id: packages[calcPkg]?.id ?? calcPkg,
                    page_count: Number(calcPages),
                    quantity: Number(calcQty),
                    shipping_country: calcCountry,
                    shipping_option: calcShipping,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setCostResult(data);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setCalculating(false);
        }
    };

    const createPrintJob = async () => {
        if (!jobInteriorUrl || !jobCoverUrl) { toast.error("Necesitas URL del interior y de la portada"); return; }
        if (!jobName || !jobStreet || !jobCity || !jobPostcode || !jobCountry) { toast.error("Completa la dirección de envío"); return; }
        setCreatingJob(true);
        try {
            const res = await fetch(`${API_BASE_URL}/lulu/print-jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: jobTitle || "Libro KDP",
                    interior_url: jobInteriorUrl,
                    cover_url: jobCoverUrl,
                    pod_package_id: packages[jobPkg]?.id ?? jobPkg,
                    page_count: Number(jobPages),
                    quantity: Number(jobQty),
                    contact_email: jobEmail,
                    shipping_option: jobShipping,
                    shipping_address: {
                        name: jobName,
                        street1: jobStreet,
                        city: jobCity,
                        state_code: jobState || undefined,
                        postcode: jobPostcode,
                        country_code: jobCountry,
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(`Pedido de impresión creado — ID: ${data.id}`);
            setSection("jobs");
            loadJobs();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setCreatingJob(false);
        }
    };

    const loadJobs = async () => {
        setLoadingJobs(true);
        try {
            const res = await fetch(`${API_BASE_URL}/lulu/print-jobs?limit=20`);
            const data = await res.json();
            setJobs(data.results ?? []);
        } catch { /* silent */ } finally {
            setLoadingJobs(false);
        }
    };

    useEffect(() => { if (section === "jobs") loadJobs(); }, [section]);

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const tabs: Array<{ id: typeof section; label: string }> = [
        { id: "setup",      label: "Conexión" },
        { id: "calculator", label: "Calculadora" },
        { id: "print",      label: "Imprimir" },
        { id: "jobs",       label: "Pedidos" },
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Printer size={16} className="text-violet-400" />
                    <h3 className="text-sm font-black text-white tracking-tight">Lulu Print-on-Demand</h3>
                    {connected === true && <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={8} /> Conectado</span>}
                    {connected === false && <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"><XCircle size={8} /> Sin conectar</span>}
                </div>
                <button onClick={checkConnection} disabled={checking} className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-white/8 transition-all" title="Recheck">
                    <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setSection(t.id)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${section === t.id ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-neutral-600 hover:text-neutral-400"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Setup ── */}
            {section === "setup" && (
                <div className="space-y-3">
                    <p className="text-xs text-neutral-500 leading-relaxed">
                        Lulu Direct API permite imprimir y enviar libros físicos. Obtén tus credenciales en{" "}
                        <a href="https://developers.lulu.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline inline-flex items-center gap-0.5">
                            developers.lulu.com <ExternalLink size={9} />
                        </a>
                    </p>
                    <div className="space-y-2">
                        <div>
                            <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Client Key (API Key)</label>
                            <input value={clientKey} onChange={e => setClientKey(e.target.value)} type="text" placeholder="tu-client-key"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                        </div>
                        <div>
                            <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Client Secret</label>
                            <input value={clientSecret} onChange={e => setClientSecret(e.target.value)} type="password" placeholder="tu-client-secret"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                        </div>
                        <button onClick={saveCredentials} disabled={savingCreds}
                            className="w-full py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-black hover:bg-violet-500/30 transition-all disabled:opacity-50">
                            {savingCreds ? "Guardando…" : "Guardar y conectar"}
                        </button>
                    </div>
                    {connected === true && (
                        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1">
                            <p className="text-xs font-black text-emerald-400">Formatos disponibles</p>
                            {Object.entries(packages).map(([key, pkg]) => (
                                <div key={key} className="text-xs text-neutral-400 flex items-center gap-2">
                                    <Package size={10} className="text-neutral-600 shrink-0" />
                                    {pkg.label}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Calculator ── */}
            {section === "calculator" && (
                <div className="space-y-3">
                    <p className="text-xs text-neutral-500">Calcula el coste de impresión + envío antes de crear un pedido.</p>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Formato</label>
                            <select value={calcPkg} onChange={e => setCalcPkg(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40">
                                {Object.entries(packages).map(([key, pkg]) => (
                                    <option key={key} value={key}>{pkg.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Páginas</label>
                            <input value={calcPages} onChange={e => setCalcPages(e.target.value)} type="number" min={24} max={740}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
                        </div>
                        <div>
                            <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Unidades</label>
                            <input value={calcQty} onChange={e => setCalcQty(e.target.value)} type="number" min={1}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
                        </div>
                        <div>
                            <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">País destino</label>
                            <input value={calcCountry} onChange={e => setCalcCountry(e.target.value.toUpperCase())} maxLength={2} placeholder="ES"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Envío</label>
                        <select value={calcShipping} onChange={e => setCalcShipping(e.target.value)}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40">
                            {SHIPPING_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </div>
                    <button onClick={calculateCost} disabled={calculating || !connected}
                        className="w-full py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-black hover:bg-violet-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {calculating ? <><Loader2 size={14} className="animate-spin" /> Calculando…</> : "Calcular coste"}
                    </button>
                    {costResult && (
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
                            <p className="text-xs font-black text-white">Desglose de costes</p>
                            {costResult.line_items?.map((item: any, i: number) => (
                                <div key={i} className="space-y-1 text-xs">
                                    <div className="flex justify-between text-neutral-400">
                                        <span>Impresión ({item.quantity}u)</span>
                                        <span className="font-black text-white">{item.unit_tier_cost?.unit_cost ?? "—"} {costResult.currency}</span>
                                    </div>
                                </div>
                            ))}
                            {costResult.shipping_cost && (
                                <div className="flex justify-between text-xs text-neutral-400">
                                    <span>Envío</span>
                                    <span className="font-black text-white">{costResult.shipping_cost.cost_excl_tax} {costResult.currency}</span>
                                </div>
                            )}
                            {costResult.total_cost_excl_tax && (
                                <div className="flex justify-between text-sm border-t border-white/[0.06] pt-2 mt-1">
                                    <span className="text-neutral-400 font-black">Total (sin IVA)</span>
                                    <span className="font-black text-emerald-400">{costResult.total_cost_excl_tax} {costResult.currency}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Print Job ── */}
            {section === "print" && (
                <div className="space-y-3">
                    <p className="text-xs text-neutral-500">Crea un pedido de impresión. Las URLs deben ser públicas (usa Cloudinary).</p>
                    <div className="space-y-2">
                        <div>
                            <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Título del libro</label>
                            <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                        </div>
                        <div>
                            <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">URL PDF interior {bookPdfUrl && <span className="text-emerald-500 normal-case">(cargado)</span>}</label>
                            <input value={jobInteriorUrl} onChange={e => setJobInteriorUrl(e.target.value)} placeholder="https://res.cloudinary.com/…/libro.pdf"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                        </div>
                        <div>
                            <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">URL portada {coverUrl && <span className="text-emerald-500 normal-case">(cargada)</span>}</label>
                            <input value={jobCoverUrl} onChange={e => setJobCoverUrl(e.target.value)} placeholder="https://res.cloudinary.com/…/portada.pdf"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Formato</label>
                                <select value={jobPkg} onChange={e => setJobPkg(e.target.value)}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40">
                                    {Object.entries(packages).map(([key, pkg]) => (
                                        <option key={key} value={key}>{pkg.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Páginas</label>
                                <input value={jobPages} onChange={e => setJobPages(e.target.value)} type="number"
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Cantidad</label>
                                <input value={jobQty} onChange={e => setJobQty(e.target.value)} type="number" min={1}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
                            </div>
                            <div>
                                <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Envío</label>
                                <select value={jobShipping} onChange={e => setJobShipping(e.target.value)}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40">
                                    {SHIPPING_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-neutral-600 uppercase font-black mb-1 block">Email de contacto</label>
                            <input value={jobEmail} onChange={e => setJobEmail(e.target.value)} type="email"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
                        </div>
                        <p className="text-[10px] text-neutral-600 uppercase font-black pt-1">Dirección de envío</p>
                        <input value={jobName} onChange={e => setJobName(e.target.value)} placeholder="Nombre completo"
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                        <input value={jobStreet} onChange={e => setJobStreet(e.target.value)} placeholder="Calle y número"
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                        <div className="grid grid-cols-2 gap-2">
                            <input value={jobCity} onChange={e => setJobCity(e.target.value)} placeholder="Ciudad"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                            <input value={jobPostcode} onChange={e => setJobPostcode(e.target.value)} placeholder="Código postal"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <input value={jobState} onChange={e => setJobState(e.target.value)} placeholder="Provincia/Estado (opcional)"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                            <input value={jobCountry} onChange={e => setJobCountry(e.target.value.toUpperCase())} placeholder="ES" maxLength={2}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40" />
                        </div>
                        <button onClick={createPrintJob} disabled={creatingJob || !connected}
                            className="w-full py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/40 text-violet-300 text-sm font-black hover:bg-violet-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {creatingJob ? <><Loader2 size={14} className="animate-spin" /> Enviando a Lulu…</> : <><Printer size={14} /> Crear pedido de impresión</>}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Jobs ── */}
            {section === "jobs" && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-neutral-500">Historial de pedidos Lulu</p>
                        <button onClick={loadJobs} disabled={loadingJobs} className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-white/8 transition-all">
                            <RefreshCw size={12} className={loadingJobs ? "animate-spin" : ""} />
                        </button>
                    </div>
                    {loadingJobs && <div className="text-center py-6 text-neutral-700 text-sm">Cargando…</div>}
                    {!loadingJobs && jobs.length === 0 && <div className="text-center py-6 text-neutral-700 text-sm">No hay pedidos todavía</div>}
                    {jobs.map(job => (
                        <div key={job.id} className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                            <button onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                                className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.02] transition-all">
                                <div className="flex items-center gap-3">
                                    <Package size={14} className="text-neutral-600 shrink-0" />
                                    <div>
                                        <p className="text-xs font-black text-white">#{job.id}</p>
                                        <p className="text-[10px] text-neutral-600">{new Date(job.date_created).toLocaleDateString("es-ES")}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black ${JOB_STATUS_COLORS[job.status?.name] ?? "text-neutral-400"}`}>
                                        {job.status?.name ?? "—"}
                                    </span>
                                    {expandedJob === job.id ? <ChevronUp size={12} className="text-neutral-600" /> : <ChevronDown size={12} className="text-neutral-600" />}
                                </div>
                            </button>
                            {expandedJob === job.id && job.line_items && (
                                <div className="px-3 pb-3 space-y-1 border-t border-white/[0.04] pt-2">
                                    {job.line_items.map((item, i) => (
                                        <div key={i} className="text-xs text-neutral-400 flex justify-between">
                                            <span className="truncate">{item.title}</span>
                                            <span className="shrink-0 ml-2 text-neutral-600">×{item.quantity}</span>
                                        </div>
                                    ))}
                                    <a href={`https://developers.lulu.com/print-jobs/${job.id}`} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 mt-1">
                                        Ver en Lulu <ExternalLink size={9} />
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
