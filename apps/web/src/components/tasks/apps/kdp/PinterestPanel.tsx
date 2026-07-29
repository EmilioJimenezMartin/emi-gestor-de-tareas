"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Copy, Check, Send, Sparkles, X, Download, Trash2, Loader2, ChevronDown, Pencil, Save } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface CatalogImage { url: string; publicId: string; }
interface Catalog { _id: string; prompt: string; name: string; images: CatalogImage[]; status: string; }
interface Niche { _id: string; name: string; nickname?: string; catalogIds?: string[]; }
interface Board { id: string; name: string; }
interface PinDraft {
    imageUrl: string;
    prompt: string;
    nicheName: string;
    title: string;
    description: string;
    hashtags: string;
    generating: boolean;
    copied: boolean;
}
interface QueuedPin {
    _id: string;
    nicheId: string;
    nicheName: string;
    imageUrl: string;
    title: string;
    description: string;
    hashtags: string[];
    amazonUrl: string;
    status: "pending" | "posted" | "skipped" | "scheduled" | "failed";
    boardSuggestion: string;
    error?: string;
    createdAt: string;
}
const STATUS_LABEL: Record<QueuedPin["status"], string> = {
    pending: "Pendiente", posted: "Publicado", skipped: "Omitido", scheduled: "Programado", failed: "Fallido",
};
const STATUS_CLASS: Record<QueuedPin["status"], string> = {
    pending:   "bg-amber-500/15 text-amber-400 border-amber-500/25",
    posted:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    skipped:   "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
    scheduled: "bg-sky-500/15 text-sky-400 border-sky-500/25",
    failed:    "bg-rose-500/15 text-rose-400 border-rose-500/25",
};

export function PinterestPanel() {
    const [niches, setNiches] = useState<Niche[]>([]);
    const [selectedNicheId, setSelectedNicheId] = useState("");
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [loadingNiches, setLoadingNiches] = useState(true);
    const [loadingCatalogs, setLoadingCatalogs] = useState(false);
    const [nicheSearch, setNicheSearch] = useState("");
    const [nicheOpen, setNicheOpen] = useState(false);
    const nicheRef = useRef<HTMLDivElement>(null);
    const [drafts, setDrafts] = useState<PinDraft[]>([]);
    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
    const [boards, setBoards] = useState<Board[]>([]);
    const [connected, setConnected] = useState(false);
    const [selectedBoard, setSelectedBoard] = useState("");
    const [publishing, setPublishing] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const [queuedPins, setQueuedPins] = useState<QueuedPin[]>([]);
    const [loadingQueue, setLoadingQueue] = useState(true);
    const [deletingPin, setDeletingPin] = useState<string | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

    // Inline editor for a saved/queued pin — lets you see & edit everything
    // (title, description, hashtags), not just the title.
    const [expandedPinId, setExpandedPinId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editHashtags, setEditHashtags] = useState("");
    const [editGenerating, setEditGenerating] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [editCopied, setEditCopied] = useState(false);

    const fetchQueue = useCallback(async () => {
        try {
            const r = await fetch(`${API}/pinterest/queue?limit=200`);
            if (r.ok) { const d = await r.json(); setQueuedPins(d.pins ?? []); }
        } finally { setLoadingQueue(false); }
    }, []);

    // Load niches + Pinterest status + saved pins queue
    useEffect(() => {
        const load = async () => {
            try {
                const [rn, rs] = await Promise.all([fetch(`${API}/niches`), fetch(`${API}/pinterest/status`)]);
                if (rn.ok) { const d = await rn.json(); setNiches((d.niches ?? []).filter((n: Niche) => (n.catalogIds?.length ?? 0) > 0)); }
                if (rs.ok) {
                    const d = await rs.json();
                    setConnected(d.connected);
                    if (d.connected) {
                        const rb = await fetch(`${API}/pinterest/boards`);
                        if (rb.ok) { const db = await rb.json(); setBoards(db.boards ?? []); }
                    }
                }
            } finally { setLoadingNiches(false); }
        };
        void load();
        void fetchQueue();
    }, [fetchQueue]);

    // Load catalogs when niche changes
    useEffect(() => {
        if (!selectedNicheId) { setCatalogs([]); return; }
        setLoadingCatalogs(true);
        setCatalogs([]);
        fetch(`${API}/catalogs?nicheId=${selectedNicheId}&limit=30`)
            .then(r => r.ok ? r.json() : { catalogs: [] })
            .then(d => setCatalogs((d.catalogs ?? []).filter((c: Catalog) => c.images?.length > 0)))
            .finally(() => setLoadingCatalogs(false));
    }, [selectedNicheId]);

    const selectedNiche = niches.find(n => n._id === selectedNicheId);
    const allImages = catalogs.flatMap(c => c.images.map(img => ({ url: img.url, prompt: c.prompt, catalogName: c.name })));

    const toggleImage = (url: string) => {
        setSelectedImages(prev => {
            const next = new Set(prev);
            if (next.has(url)) { next.delete(url); setDrafts(d => d.filter(x => x.imageUrl !== url)); }
            else next.add(url);
            return next;
        });
    };

    const confirmSelection = () => {
        const nicheName = selectedNiche?.nickname?.trim() || selectedNiche?.name || "";
        const newDrafts: PinDraft[] = [];
        for (const url of selectedImages) {
            if (drafts.some(d => d.imageUrl === url)) continue;
            const img = allImages.find(i => i.url === url);
            newDrafts.push({ imageUrl: url, prompt: img?.prompt ?? "", nicheName, title: "", description: "", hashtags: "", generating: false, copied: false });
        }
        if (newDrafts.length > 0) setDrafts(p => [...p, ...newDrafts]);
    };

    const removeDraft = (url: string) => {
        setDrafts(p => p.filter(d => d.imageUrl !== url));
        setSelectedImages(p => { const n = new Set(p); n.delete(url); return n; });
    };

    const updateDraft = (url: string, patch: Partial<PinDraft>) =>
        setDrafts(p => p.map(d => d.imageUrl === url ? { ...d, ...patch } : d));

    const generateText = async (draft: PinDraft) => {
        updateDraft(draft.imageUrl, { generating: true });
        try {
            const r = await fetch(`${API}/ai/generate-text`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "full-listing",
                    niche: draft.nicheName,
                    productType: "coloring-book",
                    language: "en",
                    extras: `image prompt used to create this image: "${draft.prompt}". Format: pinterest pin. Return a title (max 100 chars), description (max 500 chars) and 10 hashtags separated by spaces.`,
                }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            const text: string = typeof d.result === "string" ? d.result : JSON.stringify(d.result);
            const titleM = text.match(/title[^:]*:\s*["']?(.{10,120})["']?/i);
            const descM  = text.match(/description[^:]*:\s*["']?(.{20,600})["']?/i);
            const tagsM  = text.match(/(?:hashtags?|tags?)[^:]*:\s*(.{5,400})/i);
            updateDraft(draft.imageUrl, {
                title:       titleM?.[1]?.replace(/["'\n]/g, "").trim() ?? "",
                description: descM?.[1]?.replace(/["'\n]/g, "").trim() ?? "",
                hashtags:    tagsM?.[1]?.replace(/["\[\]{}\n]/g, "").trim() ?? "",
                generating: false,
            });
            toast.success("Texto generado");
        } catch (e: any) {
            toast.error(e.message);
            updateDraft(draft.imageUrl, { generating: false });
        }
    };

    const copyImageToClipboard = async (url: string) => {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            toast.success("Imagen copiada al portapapeles");
        } catch {
            // fallback: open in new tab so user can copy manually
            window.open(url, "_blank");
            toast.info("Abre la imagen y cópiala manualmente");
        }
    };

    const copyPin = (draft: PinDraft) => {
        navigator.clipboard.writeText([draft.title, "", draft.description, "", draft.hashtags].join("\n")).then(() => {
            updateDraft(draft.imageUrl, { copied: true });
            setTimeout(() => updateDraft(draft.imageUrl, { copied: false }), 2000);
        });
    };

    // Persist the draft to the queue (PinterestPin collection) — independent of
    // whether the Pinterest API is connected, so nothing is lost if the user
    // just wants to prepare pins and post them manually later.
    const saveDraft = async (draft: PinDraft): Promise<string | null> => {
        const hashtags = draft.hashtags.split(/[\s,]+/).map(t => t.startsWith("#") ? t : `#${t}`).filter(t => t.length > 1);
        const r = await fetch(`${API}/pinterest/queue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nicheName: draft.nicheName, imageUrl: draft.imageUrl, title: draft.title, description: draft.description, hashtags, amazonUrl: "", boardSuggestion: selectedBoard, pinType: "cover" }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d.pin?._id ? String(d.pin._id) : null;
    };

    const savePin = async (draft: PinDraft) => {
        setSaving(draft.imageUrl);
        try {
            await saveDraft(draft);
            toast.success("Pin guardado");
            removeDraft(draft.imageUrl);
            void fetchQueue();
        } catch (e: any) {
            toast.error(e.message);
        } finally { setSaving(null); }
    };

    const updatePinStatus = async (pin: QueuedPin, status: QueuedPin["status"]) => {
        if (status === pin.status) return;
        setUpdatingStatus(pin._id);
        try {
            const r = await fetch(`${API}/pinterest/pins/${pin._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setQueuedPins(prev => prev.map(p => p._id === pin._id ? { ...p, status } : p));
            toast.success(`Estado → ${STATUS_LABEL[status]}`);
        } catch (e: any) {
            toast.error(e.message);
        } finally { setUpdatingStatus(null); }
    };

    const renderStatusSelect = (pin: QueuedPin) => (
        <select
            value={pin.status}
            onChange={e => void updatePinStatus(pin, e.target.value as QueuedPin["status"])}
            disabled={updatingStatus === pin._id}
            onClick={e => e.stopPropagation()}
            title="Cambiar estado"
            className={`text-[10px] font-bold uppercase tracking-wide pl-2 pr-1 py-1 rounded-full border shrink-0 focus:outline-none cursor-pointer disabled:opacity-50 ${STATUS_CLASS[pin.status]}`}
        >
            {(Object.keys(STATUS_LABEL) as QueuedPin["status"][]).map(s => (
                <option key={s} value={s} className="bg-zinc-900 text-white normal-case">{STATUS_LABEL[s]}</option>
            ))}
        </select>
    );

    const deletePin = async (pin: QueuedPin) => {
        setDeletingPin(pin._id);
        try {
            const r = await fetch(`${API}/pinterest/pins/${pin._id}`, { method: "DELETE" });
            if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
            setQueuedPins(p => p.filter(x => x._id !== pin._id));
            toast.success("Pin eliminado");
        } catch (e: any) {
            toast.error(e.message);
        } finally { setDeletingPin(null); }
    };

    const publishQueuedPin = async (pin: QueuedPin) => {
        if (!connected) { toast.error("Conecta Pinterest API primero"); return; }
        if (!selectedBoard) { toast.error("Selecciona un board arriba primero"); return; }
        setPublishing(pin._id);
        try {
            const pr = await fetch(`${API}/pinterest/pins/${pin._id}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ boardId: selectedBoard }),
            });
            const pd = await pr.json();
            if (!pr.ok) throw new Error(pd.error);
            toast.success("Pin publicado en Pinterest");
            void fetchQueue();
        } catch (e: any) {
            toast.error(e.message);
        } finally { setPublishing(null); }
    };

    const publishPin = async (draft: PinDraft) => {
        if (!connected) { toast.error("Conecta Pinterest API primero"); return; }
        if (!selectedBoard) { toast.error("Selecciona un board"); return; }
        setPublishing(draft.imageUrl);
        try {
            const pinId = await saveDraft(draft);
            if (!pinId) throw new Error("No se pudo guardar el pin antes de publicar");
            const pr = await fetch(`${API}/pinterest/pins/${pinId}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ boardId: selectedBoard }),
            });
            const pd = await pr.json();
            if (!pr.ok) throw new Error(pd.error);
            toast.success("Pin publicado en Pinterest");
            removeDraft(draft.imageUrl);
            void fetchQueue();
        } catch (e: any) {
            toast.error(e.message);
        } finally { setPublishing(null); }
    };

    const openPinEditor = (pin: QueuedPin) => {
        setExpandedPinId(pin._id);
        setEditTitle(pin.title);
        setEditDescription(pin.description);
        setEditHashtags(pin.hashtags.join(" "));
    };
    const closePinEditor = () => setExpandedPinId(null);

    const generateEditText = async (pin: QueuedPin) => {
        setEditGenerating(true);
        try {
            const r = await fetch(`${API}/ai/generate-text`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "full-listing",
                    niche: pin.nicheName,
                    productType: "coloring-book",
                    language: "en",
                    extras: `Format: pinterest pin. Return a title (max 100 chars), description (max 500 chars) and 10 hashtags separated by spaces.`,
                }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            const text: string = typeof d.result === "string" ? d.result : JSON.stringify(d.result);
            const titleM = text.match(/title[^:]*:\s*["']?(.{10,120})["']?/i);
            const descM  = text.match(/description[^:]*:\s*["']?(.{20,600})["']?/i);
            const tagsM  = text.match(/(?:hashtags?|tags?)[^:]*:\s*(.{5,400})/i);
            setEditTitle(titleM?.[1]?.replace(/["'\n]/g, "").trim() ?? "");
            setEditDescription(descM?.[1]?.replace(/["'\n]/g, "").trim() ?? "");
            setEditHashtags(tagsM?.[1]?.replace(/["\[\]{}\n]/g, "").trim() ?? "");
            toast.success("Texto generado");
        } catch (e: any) {
            toast.error(e.message);
        } finally { setEditGenerating(false); }
    };

    const saveEditedPin = async (pin: QueuedPin) => {
        setEditSaving(true);
        try {
            const hashtags = editHashtags.split(/[\s,]+/).map(t => t.startsWith("#") ? t : `#${t}`).filter(t => t.length > 1);
            const r = await fetch(`${API}/pinterest/pins/${pin._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: editTitle, description: editDescription, hashtags }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setQueuedPins(prev => prev.map(p => p._id === pin._id ? { ...p, title: editTitle, description: editDescription, hashtags } : p));
            toast.success("Pin actualizado");
            setExpandedPinId(null);
        } catch (e: any) {
            toast.error(e.message);
        } finally { setEditSaving(false); }
    };

    const copyEditedAll = () => {
        navigator.clipboard.writeText([editTitle, "", editDescription, "", editHashtags].join("\n")).then(() => {
            setEditCopied(true);
            setTimeout(() => setEditCopied(false), 2000);
        });
    };

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (nicheRef.current && !nicheRef.current.contains(e.target as Node)) setNicheOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filteredNiches = niches.filter(n => {
        const q = nicheSearch.toLowerCase();
        return (n.nickname?.toLowerCase().includes(q) || n.name.toLowerCase().includes(q));
    });

    // Group saved/queued pins by niche so it scales past a handful of pins.
    const pinGroups = new Map<string, QueuedPin[]>();
    for (const pin of queuedPins) {
        const key = pin.nicheName || "Sin nicho";
        if (!pinGroups.has(key)) pinGroups.set(key, []);
        pinGroups.get(key)!.push(pin);
    }
    const sortedGroups = [...pinGroups.entries()].sort((a, b) => b[1].length - a[1].length);
    const toggleGroup = (name: string) => setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
    });

    if (loadingNiches) return <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">Cargando...</div>;

    return (
        <div className="space-y-5">

            {/* Step 1 — pick niche */}
            <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">1. Elige el nicho</p>
                <div ref={nicheRef} className="relative">
                    <button
                        onClick={() => setNicheOpen(v => !v)}
                        className="w-full flex items-center justify-between h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-base text-left transition hover:border-white/20 focus:outline-none"
                    >
                        <span className={selectedNiche ? "text-white" : "text-zinc-500"}>
                            {selectedNiche ? (selectedNiche.nickname?.trim() || selectedNiche.name) : "Selecciona un nicho..."}
                        </span>
                        <svg className={`w-4 h-4 text-zinc-500 transition-transform ${nicheOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                    </button>

                    {nicheOpen && (
                        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden">
                            <div className="p-2 border-b border-white/8">
                                <input
                                    autoFocus
                                    value={nicheSearch}
                                    onChange={e => setNicheSearch(e.target.value)}
                                    placeholder="Buscar nicho..."
                                    className="w-full h-10 px-3 bg-white/5 rounded-lg text-base text-white placeholder:text-zinc-500 focus:outline-none"
                                />
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {filteredNiches.length === 0 && <p className="text-base text-zinc-600 px-4 py-4">Sin resultados.</p>}
                                {filteredNiches.map(n => (
                                    <button key={n._id}
                                        onClick={() => { setSelectedNicheId(n._id); setSelectedImages(new Set()); setNicheOpen(false); setNicheSearch(""); }}
                                        className={`w-full text-left px-4 py-3 text-base transition hover:bg-white/5 ${selectedNicheId === n._id ? "text-rose-300 font-semibold" : "text-zinc-200"}`}>
                                        {n.nickname?.trim() || n.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                {niches.length === 0 && <p className="text-sm text-zinc-600">No hay nichos con imágenes generadas.</p>}
            </div>

            {/* Step 2 — pick images */}
            {selectedNicheId && (
                <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">2. Selecciona las imágenes</p>

                    {loadingCatalogs && <p className="text-sm text-zinc-500 py-4">Cargando imágenes...</p>}

                    {!loadingCatalogs && allImages.length === 0 && (
                        <p className="text-sm text-zinc-600 py-4">Este nicho no tiene imágenes generadas todavía.</p>
                    )}

                    {!loadingCatalogs && allImages.length > 0 && (
                        <>
                            <div className="flex flex-wrap gap-2">
                                {allImages.map(({ url }) => {
                                    const sel = selectedImages.has(url);
                                    const inUse = drafts.some(d => d.imageUrl === url);
                                    return (
                                        <button key={url} onClick={() => !inUse && toggleImage(url)} disabled={inUse}
                                            className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition ${sel ? "border-rose-500" : "border-transparent hover:border-white/30"} ${inUse ? "opacity-40 cursor-default" : ""}`}>
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                            {sel && !inUse && (
                                                <div className="absolute inset-0 bg-rose-500/30 flex items-center justify-center">
                                                    <Check size={20} className="text-white drop-shadow" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedImages.size > 0 && (
                                <button onClick={confirmSelection}
                                    className="h-9 px-4 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white text-sm font-semibold transition">
                                    Crear pins con {selectedImages.size} imagen{selectedImages.size > 1 ? "es" : ""}
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Step 3 — edit & publish */}
            {drafts.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">3. Título y publicar</p>
                        {connected && boards.length > 0 && (
                            <select value={selectedBoard} onChange={e => setSelectedBoard(e.target.value)}
                                className="h-7 px-2 bg-white/5 border border-white/10 rounded-lg text-xs text-zinc-300 outline-none">
                                <option value="">Board...</option>
                                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        )}
                    </div>

                    {drafts.map(draft => (
                        <div key={draft.imageUrl} className="rounded-xl border border-white/8 bg-white/[0.02] p-3 flex gap-3">
                            <img src={draft.imageUrl} alt="" className="w-20 h-20 object-cover rounded-lg flex-shrink-0 border border-white/10" />
                            <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex gap-2">
                                    <input value={draft.title} onChange={e => updateDraft(draft.imageUrl, { title: e.target.value })}
                                        placeholder="Título del pin..."
                                        className="flex-1 h-8 px-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/40" />
                                    <button onClick={() => void generateText(draft)} disabled={draft.generating} title="Generar con IA"
                                        className="h-8 w-8 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-600/30 transition disabled:opacity-40 flex items-center justify-center">
                                        <Sparkles size={13} className={draft.generating ? "animate-pulse" : ""} />
                                    </button>
                                    <button onClick={() => removeDraft(draft.imageUrl)}
                                        className="h-8 w-8 rounded-lg hover:bg-white/10 text-zinc-600 hover:text-zinc-400 transition flex items-center justify-center">
                                        <X size={13} />
                                    </button>
                                </div>
                                <textarea value={draft.description} onChange={e => updateDraft(draft.imageUrl, { description: e.target.value })}
                                    placeholder="Descripción (se genera con ✦)..." rows={2}
                                    className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none resize-none" />
                                <input value={draft.hashtags} onChange={e => updateDraft(draft.imageUrl, { hashtags: e.target.value })}
                                    placeholder="Hashtags (se generan con ✦)..."
                                    className="w-full h-7 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-zinc-400 placeholder:text-zinc-600 focus:outline-none" />
                                <div className="flex gap-2 flex-wrap">
                                    <button onClick={() => void copyImageToClipboard(draft.imageUrl)}
                                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs border border-white/10 transition">
                                        <Copy size={11} />
                                        Imagen
                                    </button>
                                    <a href={draft.imageUrl} download target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs border border-white/10 transition">
                                        <Download size={11} />
                                        Descargar
                                    </a>
                                    <button onClick={() => { navigator.clipboard.writeText(draft.title); toast.success("Título copiado"); }} disabled={!draft.title}
                                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs border border-white/10 transition disabled:opacity-30">
                                        <Copy size={11} />
                                        Título
                                    </button>
                                    <button onClick={() => copyPin(draft)} disabled={!draft.title}
                                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs border border-white/10 transition disabled:opacity-30">
                                        {draft.copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                        {draft.copied ? "Copiado" : "Todo"}
                                    </button>
                                    <button onClick={() => void savePin(draft)} disabled={!draft.title || saving === draft.imageUrl}
                                        title="Guarda el pin en la cola aunque no publiques ahora"
                                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 text-xs border border-emerald-600/30 transition disabled:opacity-30">
                                        <Check size={11} />
                                        {saving === draft.imageUrl ? "Guardando..." : "Guardar"}
                                    </button>
                                    {connected && (
                                        <button onClick={() => void publishPin(draft)} disabled={!draft.title || publishing === draft.imageUrl}
                                            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs border border-red-600/30 transition disabled:opacity-30">
                                            <Send size={11} />
                                            {publishing === draft.imageUrl ? "Publicando..." : "Publicar"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Step 4 — saved/queued pins, grouped by niche */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        4. Pins guardados {queuedPins.length > 0 && <span className="text-zinc-600">({queuedPins.length})</span>}
                    </p>
                    {loadingQueue && <Loader2 size={13} className="animate-spin text-zinc-600" />}
                </div>

                {!loadingQueue && queuedPins.length === 0 && (
                    <p className="text-sm text-zinc-600 py-2">Todavía no has guardado ningún pin.</p>
                )}

                {sortedGroups.length > 0 && (
                    <div className="space-y-2">
                        {sortedGroups.map(([nicheName, pins]) => {
                            const collapsed = collapsedGroups.has(nicheName);
                            return (
                                <div key={nicheName} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                                    <button onClick={() => toggleGroup(nicheName)}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition text-left">
                                        <ChevronDown size={13} className={`text-zinc-600 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                                        <span className="text-sm font-semibold text-white truncate flex-1">{nicheName}</span>
                                        <span className="text-xs text-zinc-500 shrink-0">{pins.length} pin{pins.length !== 1 ? "s" : ""}</span>
                                    </button>
                                    {!collapsed && (
                                        <div className="border-t border-white/8 divide-y divide-white/[0.05]">
                                            {pins.map(pin => {
                                                const isExpanded = expandedPinId === pin._id;
                                                if (!isExpanded) return (
                                                    <div key={pin._id} className="flex items-center gap-3 px-3 py-2.5">
                                                        <img src={pin.imageUrl} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0 border border-white/10" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm text-white truncate">{pin.title}</p>
                                                            <p className="text-xs text-zinc-600">{new Date(pin.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                                                        </div>
                                                        {renderStatusSelect(pin)}
                                                        <button onClick={() => openPinEditor(pin)}
                                                            title="Ver / editar todo"
                                                            className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition flex items-center justify-center shrink-0">
                                                            <Pencil size={11} />
                                                        </button>
                                                        {connected && pin.status !== "posted" && (
                                                            <button onClick={() => void publishQueuedPin(pin)} disabled={publishing === pin._id}
                                                                title="Publicar en Pinterest"
                                                                className="h-7 w-7 rounded-lg bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-600/25 transition disabled:opacity-30 flex items-center justify-center shrink-0">
                                                                {publishing === pin._id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                                                            </button>
                                                        )}
                                                        <button onClick={() => void deletePin(pin)} disabled={deletingPin === pin._id}
                                                            title="Eliminar"
                                                            className="h-7 w-7 rounded-lg hover:bg-white/10 text-zinc-600 hover:text-rose-400 transition disabled:opacity-30 flex items-center justify-center shrink-0">
                                                            {deletingPin === pin._id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                                        </button>
                                                    </div>
                                                );
                                                return (
                                                    <div key={pin._id} className="p-3 space-y-2.5 bg-white/[0.015]">
                                                        <div className="flex items-center justify-between">
                                                            {renderStatusSelect(pin)}
                                                            <button onClick={closePinEditor}
                                                                className="h-7 w-7 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition flex items-center justify-center">
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                        {pin.error && (
                                                            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5">{pin.error}</p>
                                                        )}
                                                        <img src={pin.imageUrl} alt="" className="w-full max-h-72 object-contain rounded-lg border border-white/10 bg-black/20" />
                                                        <div className="flex gap-2">
                                                            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                                                placeholder="Título del pin..."
                                                                className="flex-1 h-8 px-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/40" />
                                                            <button onClick={() => void generateEditText(pin)} disabled={editGenerating} title="Generar con IA"
                                                                className="h-8 w-8 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-600/30 transition disabled:opacity-40 flex items-center justify-center shrink-0">
                                                                <Sparkles size={13} className={editGenerating ? "animate-pulse" : ""} />
                                                            </button>
                                                        </div>
                                                        <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)}
                                                            placeholder="Descripción (se genera con ✦)..." rows={3}
                                                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none resize-none" />
                                                        <input value={editHashtags} onChange={e => setEditHashtags(e.target.value)}
                                                            placeholder="Hashtags (se generan con ✦)..."
                                                            className="w-full h-7 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-zinc-400 placeholder:text-zinc-600 focus:outline-none" />
                                                        <div className="flex gap-2 flex-wrap">
                                                            <button onClick={() => void copyImageToClipboard(pin.imageUrl)}
                                                                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs border border-white/10 transition">
                                                                <Copy size={11} /> Imagen
                                                            </button>
                                                            <a href={pin.imageUrl} download target="_blank" rel="noopener noreferrer"
                                                                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs border border-white/10 transition">
                                                                <Download size={11} /> Descargar
                                                            </a>
                                                            <button onClick={() => { navigator.clipboard.writeText(editTitle); toast.success("Título copiado"); }} disabled={!editTitle}
                                                                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs border border-white/10 transition disabled:opacity-30">
                                                                <Copy size={11} /> Título
                                                            </button>
                                                            <button onClick={copyEditedAll} disabled={!editTitle}
                                                                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs border border-white/10 transition disabled:opacity-30">
                                                                {editCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                                                {editCopied ? "Copiado" : "Todo"}
                                                            </button>
                                                            <button onClick={() => void saveEditedPin(pin)} disabled={!editTitle || editSaving}
                                                                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 text-xs border border-emerald-600/30 transition disabled:opacity-30">
                                                                {editSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                                                                {editSaving ? "Guardando..." : "Guardar cambios"}
                                                            </button>
                                                            {connected && pin.status !== "posted" && (
                                                                <button onClick={() => void publishQueuedPin(pin)} disabled={publishing === pin._id}
                                                                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs border border-red-600/30 transition disabled:opacity-30">
                                                                    {publishing === pin._id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                                                                    {publishing === pin._id ? "Publicando..." : "Publicar"}
                                                                </button>
                                                            )}
                                                            <button onClick={() => void deletePin(pin)} disabled={deletingPin === pin._id}
                                                                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/5 hover:bg-rose-500/15 text-zinc-500 hover:text-rose-400 text-xs border border-white/10 hover:border-rose-500/30 transition disabled:opacity-30 ml-auto">
                                                                {deletingPin === pin._id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                                                Eliminar
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pinterest API connection */}
            {!connected && (
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2">
                    <p className="text-sm text-zinc-400">Conecta Pinterest API para publicar directamente. Sin API, usa <strong className="text-white">Copiar</strong> y pégalo a mano.</p>
                    <button onClick={async () => {
                        try {
                            const r = await fetch(`${API}/pinterest/auth-url`);
                            const d = await r.json();
                            if (!r.ok) throw new Error(d.error);
                            window.location.href = d.url;
                        } catch (e: any) { toast.error(e.message); }
                    }} className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs border border-white/10 transition">
                        Conectar Pinterest API
                    </button>
                </div>
            )}
        </div>
    );
}
