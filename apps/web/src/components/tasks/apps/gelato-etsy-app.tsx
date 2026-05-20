"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Store, Package, ShoppingBag, Truck, Link2, Link2Off,
    RefreshCw, Plus, ExternalLink, Check, X, ChevronRight,
    Download, Upload, Eye, Trash2, Tag, DollarSign,
    AlertCircle, Loader2, Globe, Zap, FileText, Image as ImageIcon,
    BookOpen, ArrowRight, Settings, BadgeCheck, Clock, LayoutTemplate,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Types ────────────────────────────────────────────────────────────────────

interface GelatoStatus { ok: boolean; stores?: any[] }
interface EtsyStatus { connected: boolean; shopId?: string; user?: any }

interface GelatoProductDoc {
    _id: string;
    gelatoProductId: string;
    title: string;
    description?: string;
    status: "active" | "draft" | "deleted";
    productType: "physical" | "digital";
    catalogId?: string;
    nicheId?: string;
    retailPrice?: number;
    currency?: string;
    gelatoCost?: number;
    etsyListingId?: string;
    etsyListingUrl?: string;
    printFileUrl?: string;
    createdAt: string;
}

interface GelatoStoreProduct {
    id: string;
    title: string;
    status: string;
    isReadyToPublish: boolean;
    publishedAt: string | null;
    externalId: string | null;
    previewUrl: string | null;
    variants: any[];
    createdAt: string;
}

interface EtsyListingDoc {
    _id: string;
    etsyListingId: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    listingType: "physical" | "download";
    status: string;
    tags: string[];
    views?: number;
    favCount?: number;
    soldCount?: number;
    images: { url: string }[];
    digitalFiles: { filename: string }[];
    createdAt: string;
}

interface GelCatalog {
    _id: string;
    name: string;
    images: { url: string }[];
    status: string;
    nicheIds?: string[];
}

interface EtsyTransaction {
    transaction_id: number;
    title: string;
    quantity: number;
    price: { amount: number; divisor: number; currency_code: string };
    create_timestamp: number;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useApi<T>(url: string | null, deps: any[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!url) return;
        setLoading(true); setError(null);
        try {
            const res = await fetch(`${API}${url}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Error");
            setData(json);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, [url]);

    useEffect(() => { load(); }, [load, ...deps]);
    return { data, loading, error, reload: load };
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const Chip = ({ label, color = "neutral" }: { label: string; color?: "green" | "amber" | "red" | "sky" | "neutral" }) => {
    const c = {
        green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        red: "bg-red-500/15 text-red-400 border-red-500/30",
        sky: "bg-sky-500/15 text-sky-400 border-sky-500/30",
        neutral: "bg-white/8 text-neutral-400 border-white/10",
    }[color];
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${c}`}>{label}</span>;
};

const statusColor = (s: string): "green" | "amber" | "red" | "sky" | "neutral" => {
    if (s === "active") return "green";
    if (s === "draft") return "amber";
    if (s === "inactive" || s === "expired") return "red";
    return "neutral";
};

// ── Connection status cards ───────────────────────────────────────────────────

function GelatoStatusCard({ status, loading, onRecheck }: { status: GelatoStatus | null; loading: boolean; onRecheck: () => void }) {
    return (
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
                    <Package size={16} className="text-orange-400" />
                </div>
                <div>
                    <p className="text-sm font-bold text-white">Gelato</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Print On Demand</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {loading
                        ? <Loader2 size={14} className="text-neutral-400 animate-spin" />
                        : status?.ok
                            ? <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px] text-emerald-400 font-bold">Conectado</span></div>
                            : <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="text-[10px] text-red-400 font-bold">Sin conexión</span></div>
                    }
                    <button onClick={onRecheck} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
                        <RefreshCw size={11} className="text-neutral-500" />
                    </button>
                </div>
            </div>
            {status?.ok && status.stores?.length ? (
                <div className="text-[11px] text-neutral-500">
                    {status.stores.length} tienda{status.stores.length > 1 ? "s" : ""} conectada{status.stores.length > 1 ? "s" : ""}
                </div>
            ) : status?.ok ? (
                <p className="text-[11px] text-amber-400">API OK · Configura GELATO_STORE_ID en Ajustes</p>
            ) : (
                <p className="text-[11px] text-neutral-500">Configura GELATO_API_KEY en Ajustes</p>
            )}
        </div>
    );
}

function EtsyStatusCard({
    status, loading, onConnect, onDisconnect, onRecheck
}: {
    status: EtsyStatus | null; loading: boolean;
    onConnect: () => void; onDisconnect: () => void; onRecheck: () => void;
}) {
    return (
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                    <ShoppingBag size={16} className="text-amber-400" />
                </div>
                <div>
                    <p className="text-sm font-bold text-white">Etsy</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Marketplace</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {loading
                        ? <Loader2 size={14} className="text-neutral-400 animate-spin" />
                        : status?.connected
                            ? <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px] text-emerald-400 font-bold">Conectado</span></div>
                            : <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-neutral-600" /><span className="text-[10px] text-neutral-400 font-bold">No conectado</span></div>
                    }
                    <button onClick={onRecheck} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
                        <RefreshCw size={11} className="text-neutral-500" />
                    </button>
                </div>
            </div>
            {status?.connected ? (
                <div className="flex items-center justify-between">
                    <p className="text-[11px] text-neutral-400">Shop ID: <span className="text-white font-mono">{status.shopId}</span></p>
                    <button onClick={onDisconnect} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors">
                        <Link2Off size={10} /> Desconectar
                    </button>
                </div>
            ) : (
                <button
                    onClick={onConnect}
                    className="w-full mt-1 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                    <Link2 size={12} /> Conectar con Etsy
                </button>
            )}
        </div>
    );
}

// ── Etsy OAuth Modal ──────────────────────────────────────────────────────────

function EtsyOAuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [step, setStep] = useState<"init" | "waiting" | "code" | "done">("init");
    const [authUrl, setAuthUrl] = useState("");
    const [state, setState] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const startAuth = async () => {
        setLoading(true); setError("");
        try {
            const res = await fetch(`${API}/etsy/auth/url`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setAuthUrl(data.url);
            setState(data.state);
            window.open(data.url, "_blank", "width=600,height=700");
            setStep("code");
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const submitCode = async () => {
        if (!code.trim()) return;
        setLoading(true); setError("");
        try {
            const res = await fetch(`${API}/etsy/auth/callback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: code.trim(), state }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setStep("done");
            setTimeout(() => { onSuccess(); onClose(); }, 1500);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-neutral-950/95 p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                        <ShoppingBag size={18} className="text-amber-400" />
                    </div>
                    <div>
                        <p className="font-bold text-white">Conectar Etsy</p>
                        <p className="text-[11px] text-neutral-500">Autoriza acceso a tu tienda</p>
                    </div>
                    <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/8"><X size={14} className="text-neutral-400" /></button>
                </div>

                {step === "init" && (
                    <div className="space-y-4">
                        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 space-y-2">
                            <p className="text-xs text-neutral-300 font-medium">Permisos que se solicitarán:</p>
                            {["Ver y gestionar listings", "Ver y gestionar tu tienda", "Ver transacciones"].map(p => (
                                <div key={p} className="flex items-center gap-2 text-[11px] text-neutral-400">
                                    <Check size={10} className="text-emerald-400 shrink-0" /> {p}
                                </div>
                            ))}
                        </div>
                        {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}
                        <button
                            onClick={startAuth}
                            disabled={loading}
                            className="w-full py-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-sm transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                            Abrir Etsy para autorizar
                        </button>
                    </div>
                )}

                {step === "code" && (
                    <div className="space-y-4">
                        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
                            <p className="text-xs text-amber-300 font-medium mb-1">Pasos:</p>
                            <ol className="text-[11px] text-neutral-400 space-y-1.5 list-decimal list-inside">
                                <li>Etsy se ha abierto en una nueva pestaña</li>
                                <li>Autoriza el acceso a tu tienda</li>
                                <li>Etsy te redirigirá — copia el código de la URL</li>
                                <li>Pega el código aquí abajo</li>
                            </ol>
                        </div>
                        <div>
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5">Código de autorización</p>
                            <input
                                type="text"
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                placeholder="Pega el código aquí..."
                                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/50"
                            />
                            <p className="text-[10px] text-neutral-600 mt-1">La URL de callback tiene el parámetro <code className="text-neutral-400">?code=...</code></p>
                        </div>
                        {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setStep("init"); setCode(""); setError(""); }}
                                className="flex-1 py-2.5 rounded-2xl border border-white/10 text-neutral-400 text-sm hover:bg-white/5 transition-all"
                            >
                                Volver
                            </button>
                            <button
                                onClick={submitCode}
                                disabled={loading || !code.trim()}
                                className="flex-1 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                Confirmar
                            </button>
                        </div>
                    </div>
                )}

                {step === "done" && (
                    <div className="flex flex-col items-center gap-3 py-4">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                            <BadgeCheck size={28} className="text-emerald-400" />
                        </div>
                        <p className="font-bold text-white">¡Conectado!</p>
                        <p className="text-xs text-neutral-400">Etsy ya está vinculado a tu cuenta</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Create Etsy Listing Modal ─────────────────────────────────────────────────

function CreateListingModal({
    catalogs, onClose, onCreated
}: {
    catalogs: GelCatalog[];
    onClose: () => void;
    onCreated: () => void;
}) {
    const [step, setStep] = useState<"form" | "uploading" | "done">("form");
    const [form, setForm] = useState({
        title: "",
        description: "",
        price: "",
        tags: "",
        listingType: "download" as "download" | "physical",
        catalogId: "",
    });
    const [error, setError] = useState("");
    const [log, setLog] = useState<string[]>([]);

    const addLog = (msg: string) => setLog(p => [...p, msg]);

    const selectedCatalog = catalogs.find(c => c._id === form.catalogId);

    const submit = async () => {
        if (!form.title || !form.description || !form.price) {
            setError("Título, descripción y precio son obligatorios");
            return;
        }
        setError(""); setStep("uploading");

        try {
            addLog("Creando listing en Etsy...");
            const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 13);
            const res = await fetch(`${API}/etsy/listings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: form.title,
                    description: form.description,
                    price: parseFloat(form.price),
                    tags,
                    listingType: form.listingType,
                    catalogId: form.catalogId || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            addLog(`✓ Listing creado: #${data.listing?.etsyListingId}`);

            const listingId = data.listing?.etsyListingId;

            // Upload cover image from catalog
            if (selectedCatalog?.images?.[0]?.url && listingId) {
                addLog("Subiendo imagen de portada...");
                const imgRes = await fetch(`${API}/etsy/listings/${listingId}/images`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageUrl: selectedCatalog.images[0].url, rank: 1 }),
                });
                if (imgRes.ok) addLog("✓ Imagen subida");
                else addLog("⚠ No se pudo subir la imagen");
            }

            addLog("✓ Listing listo como borrador en Etsy");
            setStep("done");
            setTimeout(() => { onCreated(); onClose(); }, 2000);
        } catch (e: any) {
            setError(e.message);
            setStep("form");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-neutral-950/95 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                        <Plus size={16} className="text-amber-400" />
                    </div>
                    <div>
                        <p className="font-bold text-white">Nuevo Listing en Etsy</p>
                        <p className="text-[11px] text-neutral-500">Producto digital descargable</p>
                    </div>
                    <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/8"><X size={14} className="text-neutral-400" /></button>
                </div>

                {step === "form" && (
                    <div className="space-y-4">
                        {/* Type selector */}
                        <div className="grid grid-cols-2 gap-2">
                            {(["download", "physical"] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setForm(p => ({ ...p, listingType: t }))}
                                    className={`py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${form.listingType === t ? "border-amber-500/50 bg-amber-500/15 text-amber-300" : "border-white/8 text-neutral-500 hover:text-neutral-300"}`}
                                >
                                    {t === "download" ? <><Download size={12} /> Digital PDF</> : <><Package size={12} /> Físico (Gelato)</>}
                                </button>
                            ))}
                        </div>

                        {/* Catalog selector */}
                        {catalogs.length > 0 && (
                            <div>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5">Catálogo vinculado (opcional)</p>
                                <select
                                    value={form.catalogId}
                                    onChange={e => {
                                        const cat = catalogs.find(c => c._id === e.target.value);
                                        setForm(p => ({
                                            ...p,
                                            catalogId: e.target.value,
                                            title: cat ? p.title || cat.name : p.title,
                                        }));
                                    }}
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 appearance-none"
                                >
                                    <option value="">Sin catálogo</option>
                                    {catalogs.map(c => (
                                        <option key={c._id} value={c._id}>{c.name} ({c.images.length} imgs)</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5">Título <span className="text-red-400">*</span></p>
                            <input
                                value={form.title}
                                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                maxLength={140}
                                placeholder="Ej: Cute Animals Coloring Book PDF - 30 Pages"
                                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/50"
                            />
                            <p className="text-[10px] text-neutral-600 mt-0.5">{form.title.length}/140</p>
                        </div>

                        <div>
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5">Descripción <span className="text-red-400">*</span></p>
                            <textarea
                                value={form.description}
                                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                rows={4}
                                placeholder="Describe tu producto..."
                                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/50 resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5">Precio (€) <span className="text-red-400">*</span></p>
                                <input
                                    type="number"
                                    value={form.price}
                                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                                    step="0.01"
                                    min="0.01"
                                    placeholder="4.99"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/50"
                                />
                            </div>
                            <div>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5">Tags (hasta 13)</p>
                                <input
                                    value={form.tags}
                                    onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                                    placeholder="coloring, pdf, printable"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/50"
                                />
                            </div>
                        </div>

                        {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}

                        <div className="flex gap-2 pt-1">
                            <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl border border-white/10 text-neutral-400 text-sm hover:bg-white/5">
                                Cancelar
                            </button>
                            <button
                                onClick={submit}
                                className="flex-1 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-sm flex items-center justify-center gap-2"
                            >
                                <Upload size={13} /> Crear Listing
                            </button>
                        </div>
                    </div>
                )}

                {step === "uploading" && (
                    <div className="space-y-3 py-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Loader2 size={16} className="text-amber-400 animate-spin" />
                            <p className="text-sm font-bold text-white">Creando listing...</p>
                        </div>
                        {log.map((l, i) => (
                            <p key={i} className={`text-xs font-mono ${l.startsWith("✓") ? "text-emerald-400" : l.startsWith("⚠") ? "text-amber-400" : "text-neutral-400"}`}>{l}</p>
                        ))}
                    </div>
                )}

                {step === "done" && (
                    <div className="flex flex-col items-center gap-3 py-6">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                            <BadgeCheck size={28} className="text-emerald-400" />
                        </div>
                        <p className="font-bold text-white">¡Listing creado!</p>
                        <p className="text-xs text-neutral-400">Aparece como borrador en tu tienda Etsy</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
    { id: "overview", label: "Estado", icon: Zap },
    { id: "listings", label: "Listings Etsy", icon: ShoppingBag },
    { id: "gelato", label: "Productos Gelato", icon: Package },
    { id: "orders", label: "Pedidos", icon: Truck },
] as const;
type TabId = typeof TABS[number]["id"];

// ── Main App ──────────────────────────────────────────────────────────────────

export function GelatoEtsyApp() {
    const [activeTab, setActiveTab] = useState<TabId>("overview");
    const [gelatoStatus, setGelatoStatus] = useState<GelatoStatus | null>(null);
    const [gelatoLoading, setGelatoLoading] = useState(false);
    const [etsyStatus, setEtsyStatus] = useState<EtsyStatus | null>(null);
    const [etsyLoading, setEtsyLoading] = useState(false);
    const [showOAuth, setShowOAuth] = useState(false);
    const [showCreateListing, setShowCreateListing] = useState(false);
    const [catalogs, setCatalogs] = useState<GelCatalog[]>([]);

    // Tab-specific data
    const { data: myListings, loading: listingsLoading, reload: reloadListings } =
        useApi<{ listings: EtsyListingDoc[] }>(activeTab === "listings" ? "/etsy/my-listings" : null);
    const { data: myProducts, loading: productsLoading, reload: reloadProducts } =
        useApi<{ products: GelatoProductDoc[] }>(activeTab === "gelato" ? "/gelato/my-products" : null);
    const { data: storeProductsData, loading: storeProductsLoading, reload: reloadStoreProducts } =
        useApi<{ products: GelatoStoreProduct[] }>(activeTab === "gelato" ? "/gelato/store/products" : null);
    const { data: ordersData, loading: ordersLoading, reload: reloadOrders } =
        useApi<any>(activeTab === "orders" ? "/gelato/orders?limit=20" : null);
    const { data: transactionsData, loading: txLoading, reload: reloadTx } =
        useApi<any>(activeTab === "orders" ? "/etsy/transactions?limit=20" : null);

    const checkGelato = useCallback(async () => {
        setGelatoLoading(true);
        try {
            const res = await fetch(`${API}/gelato/ping`);
            const data = await res.json();
            setGelatoStatus(data);
        } catch { setGelatoStatus({ ok: false }); }
        finally { setGelatoLoading(false); }
    }, []);

    const checkEtsy = useCallback(async () => {
        setEtsyLoading(true);
        try {
            const res = await fetch(`${API}/etsy/auth/status`);
            const data = await res.json();
            setEtsyStatus(data);
        } catch { setEtsyStatus({ connected: false }); }
        finally { setEtsyLoading(false); }
    }, []);

    const loadCatalogs = useCallback(async () => {
        try {
            const res = await fetch(`${API}/catalogs`);
            const data = await res.json();
            if (Array.isArray(data?.catalogs)) setCatalogs(data.catalogs.filter((c: GelCatalog) => c.images.length > 0));
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        checkGelato();
        checkEtsy();
        loadCatalogs();
    }, []);

    const disconnectEtsy = async () => {
        await fetch(`${API}/etsy/auth/disconnect`, { method: "POST" });
        setEtsyStatus({ connected: false });
    };

    const listings = myListings?.listings ?? [];
    const products = myProducts?.products ?? [];
    const storeProducts = storeProductsData?.products ?? [];
    const orders = ordersData?.orders ?? [];
    const transactions = (transactionsData?.results ?? []) as EtsyTransaction[];

    return (
        <div className="min-h-screen bg-neutral-950 text-white">
            {/* Header */}
            <div className="relative overflow-hidden border-b border-white/8 bg-neutral-950/80 backdrop-blur-xl sticky top-0 z-10">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-orange-500/5 pointer-events-none" />
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-500/25 border border-amber-500/30 flex items-center justify-center">
                            <Store size={18} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="font-black text-lg bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent">Etsy + Gelato</p>
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Plataforma de ventas</p>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        {etsyStatus?.connected && (
                            <button
                                onClick={() => setShowCreateListing(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
                            >
                                <Plus size={13} /> Nuevo listing
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="max-w-6xl mx-auto px-6 pb-0 flex gap-1">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${active
                                    ? "text-amber-300 border-amber-400"
                                    : "text-neutral-500 border-transparent hover:text-neutral-300"
                                    }`}
                            >
                                <Icon size={12} /> {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6">

                {/* ── TAB: OVERVIEW ──────────────────────────────────────────── */}
                {activeTab === "overview" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <GelatoStatusCard
                                status={gelatoStatus}
                                loading={gelatoLoading}
                                onRecheck={checkGelato}
                            />
                            <EtsyStatusCard
                                status={etsyStatus}
                                loading={etsyLoading}
                                onConnect={() => setShowOAuth(true)}
                                onDisconnect={disconnectEtsy}
                                onRecheck={checkEtsy}
                            />
                        </div>

                        {/* Quick stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: "Listings activos", value: listings.filter(l => l.status === "active").length, icon: ShoppingBag },
                                { label: "Borradores Etsy", value: listings.filter(l => l.status === "draft").length, icon: FileText },
                                { label: "Productos Gelato", value: storeProducts.length, icon: Package },
                                { label: "Pedidos Etsy", value: transactions.length, icon: Truck },
                            ].map(s => (
                                <div key={s.label} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                                    <p className="text-2xl font-black text-white">{s.value}</p>
                                    <p className="text-[10px] text-neutral-500 mt-0.5">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Setup checklist */}
                        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                            <p className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4">Setup</p>
                            <div className="space-y-3">
                                {[
                                    { done: gelatoStatus?.ok, label: "Gelato API key configurada", action: "Ajustes → GELATO_API_KEY" },
                                    { done: !!gelatoStatus?.stores?.length, label: "Tienda EmiJCreaciones detectada", action: "Auto-detectada al conectar API key" },
                                    { done: etsyStatus?.connected, label: "Etsy vinculado a Gelato", action: "La tienda Etsy se conecta en el Gelato Dashboard → Channels" },
                                    { done: storeProducts.length > 0, label: "Primer producto Wire-O creado", action: "Ir a Productos Gelato → Crear en Gelato Dashboard" },
                                    { done: storeProducts.some(p => p.externalId != null), label: "Producto publicado en Etsy", action: "Publicar el producto desde el Gelato Dashboard" },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.done ? "bg-emerald-500 border-emerald-500" : "border-white/20"}`}>
                                            {item.done && <Check size={10} className="text-white" strokeWidth={3} />}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-xs font-medium ${item.done ? "text-white" : "text-neutral-500"}`}>{item.label}</p>
                                            {!item.done && <p className="text-[10px] text-neutral-600">{item.action}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Wire-O info banner */}
                        <div className="rounded-3xl border border-orange-500/20 bg-orange-500/5 p-5 flex gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
                                <BookOpen size={16} className="text-orange-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-white mb-1">Libros físicos: Wire-O via Gelato Dashboard</p>
                                <p className="text-xs text-neutral-400 leading-relaxed mb-2">
                                    Crea tus libros de colorear Wire-O directamente desde el Gelato Dashboard. Gelato los sincroniza automáticamente
                                    a tu tienda Etsy EmiJCreaciones cuando los publicas. Specs PDF: A4, 300 DPI, CMYK, 4mm bleed, 12mm zona segura en encuadernado.
                                </p>
                                <div className="flex items-center gap-4 mb-3">
                                    {[["Wire-O", "28–150 págs"], ["A4", "Tamaño"], ["CMYK", "Color"], ["4mm bleed", "Sangría"]].map(([k, v]) => (
                                        <div key={k}>
                                            <p className="text-[10px] font-black text-orange-400">{k}</p>
                                            <p className="text-[10px] text-neutral-500">{v}</p>
                                        </div>
                                    ))}
                                </div>
                                <a
                                    href="https://dashboard.gelato.com/store-products/product-list"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 text-[11px] font-bold transition-all"
                                >
                                    <ExternalLink size={11} /> Crear producto Wire-O →
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB: LISTINGS ──────────────────────────────────────────── */}
                {activeTab === "listings" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">
                                Listings Etsy <span className="text-neutral-600">({listings.length})</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <button onClick={reloadListings} className="p-2 rounded-xl hover:bg-white/8 transition-colors">
                                    <RefreshCw size={13} className="text-neutral-400" />
                                </button>
                                {etsyStatus?.connected && (
                                    <button
                                        onClick={() => setShowCreateListing(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
                                    >
                                        <Plus size={12} /> Nuevo
                                    </button>
                                )}
                            </div>
                        </div>

                        {!etsyStatus?.connected && (
                            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
                                <ShoppingBag size={24} className="text-amber-400 mx-auto mb-2" />
                                <p className="text-sm font-bold text-white mb-1">Etsy no conectado</p>
                                <p className="text-xs text-neutral-400 mb-3">Conecta tu cuenta de Etsy para ver y gestionar listings</p>
                                <button onClick={() => setShowOAuth(true)} className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                                    Conectar ahora
                                </button>
                            </div>
                        )}

                        {listingsLoading && (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={20} className="text-neutral-500 animate-spin" />
                            </div>
                        )}

                        {!listingsLoading && etsyStatus?.connected && listings.length === 0 && (
                            <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-8 text-center">
                                <ShoppingBag size={28} className="text-neutral-600 mx-auto mb-3" />
                                <p className="text-sm font-medium text-neutral-400 mb-1">Sin listings todavía</p>
                                <p className="text-xs text-neutral-600 mb-4">Crea tu primer listing de producto digital</p>
                                <button onClick={() => setShowCreateListing(true)} className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                                    <Plus size={12} className="inline mr-1" /> Crear listing
                                </button>
                            </div>
                        )}

                        <div className="space-y-2">
                            {listings.map(listing => (
                                <div key={listing._id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex items-center gap-4">
                                    {listing.images[0] ? (
                                        <img src={listing.images[0].url} className="w-12 h-12 rounded-xl object-cover shrink-0" alt="" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                                            <ImageIcon size={16} className="text-neutral-600" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{listing.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Chip label={listing.status} color={statusColor(listing.status)} />
                                            <Chip label={listing.listingType === "download" ? "Digital" : "Físico"} color={listing.listingType === "download" ? "sky" : "orange" as any} />
                                            {listing.digitalFiles.length > 0 && <Chip label={`${listing.digitalFiles.length} archivo${listing.digitalFiles.length > 1 ? "s" : ""}`} color="neutral" />}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-base font-black text-white">€{listing.price.toFixed(2)}</p>
                                        {listing.views != null && <p className="text-[10px] text-neutral-500">{listing.views} visitas · {listing.favCount} favs</p>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <a
                                            href={`https://www.etsy.com/listing/${listing.etsyListingId}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-2 rounded-lg hover:bg-white/8 transition-colors"
                                        >
                                            <ExternalLink size={13} className="text-neutral-400" />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── TAB: GELATO PRODUCTS ───────────────────────────────────── */}
                {activeTab === "gelato" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">
                                Productos en Gelato Store <span className="text-neutral-600">({storeProducts.length})</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { reloadProducts(); reloadStoreProducts(); }}
                                    className="p-2 rounded-xl hover:bg-white/8 transition-colors"
                                >
                                    <RefreshCw size={13} className="text-neutral-400" />
                                </button>
                                <a
                                    href="https://dashboard.gelato.com/store-products/product-list"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-xs font-bold transition-all"
                                >
                                    <ExternalLink size={12} /> Abrir Gelato
                                </a>
                            </div>
                        </div>

                        {/* How to create Wire-O products */}
                        <div className="rounded-3xl border border-orange-500/20 bg-orange-500/5 p-5">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0 mt-0.5">
                                    <LayoutTemplate size={14} className="text-orange-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-white mb-1.5">Cómo crear un libro Wire-O en Gelato</p>
                                    <ol className="text-[11px] text-neutral-400 space-y-1 list-decimal list-inside">
                                        <li>Abre el <strong className="text-neutral-300">Gelato Dashboard</strong> → Store → Products → New Product</li>
                                        <li>Selecciona <strong className="text-neutral-300">Notebooks → Wire-O Multi-page Brochures</strong></li>
                                        <li>Elige A4, 115gsm uncoated, 4+4 color, Wire-O left binding</li>
                                        <li>Sube tu PDF de interior + portada (300 DPI, CMYK, 4mm bleed)</li>
                                        <li>Publica → Gelato lo sincroniza automáticamente a Etsy</li>
                                    </ol>
                                    <a
                                        href="https://dashboard.gelato.com/store-products/product-list"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 text-[11px] font-bold transition-all"
                                    >
                                        <ExternalLink size={11} /> Crear producto en Gelato →
                                    </a>
                                </div>
                            </div>
                        </div>

                        {!gelatoStatus?.ok && (
                            <div className="rounded-3xl border border-orange-500/20 bg-orange-500/5 p-6 text-center">
                                <Package size={24} className="text-orange-400 mx-auto mb-2" />
                                <p className="text-sm font-bold text-white mb-1">Gelato no conectado</p>
                                <p className="text-xs text-neutral-400">Configura GELATO_API_KEY en Ajustes</p>
                            </div>
                        )}

                        {(storeProductsLoading || productsLoading) && (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={20} className="text-neutral-500 animate-spin" />
                            </div>
                        )}

                        {!storeProductsLoading && gelatoStatus?.ok && storeProducts.length === 0 && (
                            <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-8 text-center">
                                <Package size={28} className="text-neutral-600 mx-auto mb-3" />
                                <p className="text-sm font-medium text-neutral-400 mb-1">Tu tienda Gelato está vacía</p>
                                <p className="text-xs text-neutral-600 mb-4">Crea tu primer producto en el Gelato Dashboard y aparecerá aquí</p>
                                <a
                                    href="https://dashboard.gelato.com/store-products/product-list"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-bold"
                                >
                                    <ExternalLink size={12} /> Ir al Gelato Dashboard
                                </a>
                            </div>
                        )}

                        {/* Real Gelato store products */}
                        {storeProducts.length > 0 && (
                            <div className="space-y-2">
                                {storeProducts.map(sp => (
                                    <div key={sp.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex items-center gap-4">
                                        {sp.previewUrl ? (
                                            <img src={sp.previewUrl} className="w-12 h-12 rounded-xl object-cover shrink-0" alt="" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                                                <Package size={16} className="text-orange-400" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{sp.title}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Chip label={sp.status} color={statusColor(sp.status)} />
                                                <Chip label={`${sp.variants.length} variant${sp.variants.length !== 1 ? "es" : "e"}`} color="neutral" />
                                                {sp.externalId && <Chip label="En Etsy" color="amber" />}
                                                {sp.isReadyToPublish && !sp.publishedAt && <Chip label="Listo para publicar" color="sky" />}
                                            </div>
                                        </div>
                                        <a
                                            href={`https://dashboard.gelato.com/store-products/product-list`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-2 rounded-lg hover:bg-white/8 transition-colors shrink-0"
                                        >
                                            <ExternalLink size={13} className="text-neutral-400" />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: ORDERS ────────────────────────────────────────────── */}
                {activeTab === "orders" && (
                    <div className="space-y-6">
                        {/* Etsy transactions */}
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">
                                Ventas Etsy <span className="text-neutral-600">({transactions.length})</span>
                            </p>

                            {!etsyStatus?.connected && (
                                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-center">
                                    <p className="text-xs text-neutral-500">Conecta Etsy para ver las ventas</p>
                                </div>
                            )}

                            {txLoading && <div className="flex items-center gap-2 text-xs text-neutral-500 py-4"><Loader2 size={12} className="animate-spin" /> Cargando...</div>}

                            {!txLoading && etsyStatus?.connected && transactions.length === 0 && (
                                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 text-center">
                                    <p className="text-xs text-neutral-500">Sin transacciones todavía</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                {transactions.map(tx => (
                                    <div key={tx.transaction_id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                            <ShoppingBag size={12} className="text-emerald-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{tx.title}</p>
                                            <p className="text-[10px] text-neutral-500">
                                                {new Date(tx.create_timestamp * 1000).toLocaleDateString("es-ES")} · x{tx.quantity}
                                            </p>
                                        </div>
                                        <p className="text-sm font-black text-emerald-400">
                                            €{((tx.price.amount / tx.price.divisor) * tx.quantity).toFixed(2)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gelato orders */}
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">
                                Pedidos Gelato <span className="text-neutral-600">({orders.length})</span>
                            </p>
                            {ordersLoading && <div className="flex items-center gap-2 text-xs text-neutral-500 py-2"><Loader2 size={12} className="animate-spin" /> Cargando...</div>}
                            {!ordersLoading && orders.length === 0 && (
                                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-center">
                                    <p className="text-xs text-neutral-500">Sin pedidos de impresión todavía</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showOAuth && (
                <EtsyOAuthModal
                    onClose={() => setShowOAuth(false)}
                    onSuccess={() => { checkEtsy(); setActiveTab("listings"); }}
                />
            )}

            {showCreateListing && (
                <CreateListingModal
                    catalogs={catalogs}
                    onClose={() => setShowCreateListing(false)}
                    onCreated={() => { reloadListings(); setActiveTab("listings"); }}
                />
            )}
        </div>
    );
}
