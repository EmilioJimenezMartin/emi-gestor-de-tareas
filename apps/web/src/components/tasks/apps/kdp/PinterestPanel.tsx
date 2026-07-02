"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface PinterestPin {
    _id: string;
    nicheId: string;
    nicheName: string;
    imageUrl: string;
    title: string;
    description: string;
    hashtags: string[];
    amazonUrl: string;
    boardId?: string;
    boardSuggestion: string;
    pinType: "cover" | "sample";
    status: "pending" | "posted" | "skipped" | "scheduled" | "failed";
    postedAt?: string;
    pinterestPinId?: string;
    error?: string;
    createdAt: string;
}

interface Board {
    id: string;
    name: string;
    pin_count?: number;
}

const STATUS_COLORS: Record<string, string> = {
    pending:   "text-amber-400 bg-amber-400/10 border-amber-400/20",
    posted:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    skipped:   "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
    scheduled: "text-sky-400 bg-sky-400/10 border-sky-400/20",
    failed:    "text-red-400 bg-red-400/10 border-red-400/20",
};

const STATUS_LABELS: Record<string, string> = {
    pending: "Pendiente", posted: "Publicado", skipped: "Omitido",
    scheduled: "Programado", failed: "Error",
};

export function PinterestPanel() {
    const [pins, setPins] = useState<PinterestPin[]>([]);
    const [boards, setBoards] = useState<Board[]>([]);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [selectedBoard, setSelectedBoard] = useState("");
    const [filterStatus, setFilterStatus] = useState("pending");
    const [pendingTotal, setPendingTotal] = useState(0);
    const [expandedPin, setExpandedPin] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"queue" | "connect">("queue");
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
    const [publishing, setPublishing] = useState<string | null>(null);
    const [batchPublishing, setBatchPublishing] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const r = await fetch(`${API}/pinterest/status`);
            const d = await r.json();
            setConnected(d.connected);
            if (d.connected) {
                const rb = await fetch(`${API}/pinterest/boards`);
                if (rb.ok) {
                    const db = await rb.json();
                    setBoards(db.boards ?? []);
                }
            }
        } catch { /* ignore */ }
    }, []);

    const fetchQueue = useCallback(async () => {
        try {
            const r = await fetch(`${API}/pinterest/queue?status=${filterStatus}&limit=50`);
            if (!r.ok) return;
            const d = await r.json();
            setPins(d.pins ?? []);
            setPendingTotal(d.pendingTotal ?? 0);
        } catch { /* ignore */ }
    }, [filterStatus]);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchStatus(), fetchQueue()]).finally(() => setLoading(false));
    }, [fetchStatus, fetchQueue]);

    // Check for OAuth callback query param
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("pinterest") === "connected") {
            fetchStatus();
            const url = new URL(window.location.href);
            url.searchParams.delete("pinterest");
            window.history.replaceState({}, "", url.toString());
        }
    }, [fetchStatus]);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const r = await fetch(`${API}/pinterest/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            await fetchQueue();
            alert(`✓ ${d.created} pins generados para ${d.nichesProcessed} nichos.`);
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const handlePatch = async (id: string, body: object) => {
        const r = await fetch(`${API}/pinterest/pins/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) { const d = await r.json(); alert(d.error); return; }
        await fetchQueue();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este pin de la cola?")) return;
        await fetch(`${API}/pinterest/pins/${id}`, { method: "DELETE" });
        await fetchQueue();
    };

    const handlePublishOne = async (pin: PinterestPin) => {
        const board = pin.boardId || selectedBoard;
        if (!board) { alert("Selecciona un board primero."); return; }
        setPublishing(pin._id);
        try {
            const r = await fetch(`${API}/pinterest/pins/${pin._id}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ boardId: board }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            await fetchQueue();
        } catch (e: any) {
            alert(`Error al publicar: ${e.message}`);
        } finally {
            setPublishing(null);
        }
    };

    const handleBatchPublish = async () => {
        if (!selectedBoard) { alert("Selecciona un board primero."); return; }
        if (!confirm(`¿Publicar los primeros 5 pins pendientes en "${boards.find(b => b.id === selectedBoard)?.name}"?`)) return;
        setBatchPublishing(true);
        try {
            const r = await fetch(`${API}/pinterest/publish-batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ boardId: selectedBoard, limit: 5 }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            await fetchQueue();
            alert(`✓ Publicados: ${d.published}. Errores: ${d.errors?.length ?? 0}`);
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setBatchPublishing(false);
        }
    };

    const handleCopyCaption = (pin: PinterestPin) => {
        const text = `${pin.title}\n\n${pin.description}\n\n${pin.hashtags.join(" ")}`;
        navigator.clipboard.writeText(text).then(() => {
            setCopyFeedback(pin._id);
            setTimeout(() => setCopyFeedback(null), 2000);
        });
    };

    const handleConnectPinterest = async () => {
        try {
            const r = await fetch(`${API}/pinterest/auth-url`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error ?? "Error");
            window.location.href = d.url;
        } catch (e: any) {
            alert(e.message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
                Cargando Pinterest...
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                    </svg>
                    <h3 className="text-sm font-semibold text-white">Pinterest Queue</h3>
                    {pendingTotal > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/20">
                            {pendingTotal} pendientes
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="text-xs px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-600/30 transition disabled:opacity-50"
                    >
                        {generating ? "Generando..." : "+ Generar pins"}
                    </button>
                    <button
                        onClick={() => setActiveTab(activeTab === "queue" ? "connect" : "queue")}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/10 transition"
                    >
                        {activeTab === "queue" ? "⚙ Conectar API" : "← Volver"}
                    </button>
                </div>
            </div>

            {activeTab === "connect" ? (
                <ConnectTab
                    connected={connected}
                    onConnect={handleConnectPinterest}
                />
            ) : (
                <>
                    {/* Board selector + batch publish */}
                    {connected && boards.length > 0 && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                            <select
                                value={selectedBoard}
                                onChange={e => setSelectedBoard(e.target.value)}
                                className="flex-1 text-xs bg-transparent text-white border-none outline-none"
                            >
                                <option value="">Seleccionar board...</option>
                                {boards.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleBatchPublish}
                                disabled={!selectedBoard || batchPublishing}
                                className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 transition disabled:opacity-40"
                            >
                                {batchPublishing ? "Publicando..." : "Publicar 5"}
                            </button>
                        </div>
                    )}

                    {/* Status filter */}
                    <div className="flex gap-1.5">
                        {["pending", "posted", "skipped", "failed"].map(s => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`text-xs px-3 py-1 rounded-full border transition ${
                                    filterStatus === s
                                        ? STATUS_COLORS[s]
                                        : "text-zinc-500 border-zinc-700 hover:border-zinc-500"
                                }`}
                            >
                                {STATUS_LABELS[s]}
                            </button>
                        ))}
                    </div>

                    {/* Pin list */}
                    {pins.length === 0 ? (
                        <div className="text-center py-12 text-zinc-600 text-sm">
                            No hay pins {STATUS_LABELS[filterStatus]?.toLowerCase()}s.
                            {filterStatus === "pending" && (
                                <p className="mt-1 text-xs">Pulsa "+ Generar pins" para crear la cola.</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {pins.map(pin => (
                                <PinRow
                                    key={pin._id}
                                    pin={pin}
                                    boards={boards}
                                    connected={connected}
                                    expanded={expandedPin === pin._id}
                                    publishing={publishing === pin._id}
                                    copyFeedback={copyFeedback === pin._id}
                                    selectedBoard={selectedBoard}
                                    onToggleExpand={() => setExpandedPin(expandedPin === pin._id ? null : pin._id)}
                                    onCopy={() => handleCopyCaption(pin)}
                                    onSkip={() => handlePatch(pin._id, { status: "skipped" })}
                                    onRestore={() => handlePatch(pin._id, { status: "pending" })}
                                    onDelete={() => handleDelete(pin._id)}
                                    onPublish={() => handlePublishOne(pin)}
                                    onBoardChange={(boardId: string) => handlePatch(pin._id, { boardId })}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function PinRow({
    pin, boards, connected, expanded, publishing, copyFeedback, selectedBoard,
    onToggleExpand, onCopy, onSkip, onRestore, onDelete, onPublish, onBoardChange,
}: {
    pin: PinterestPin;
    boards: Board[];
    connected: boolean;
    expanded: boolean;
    publishing: boolean;
    copyFeedback: boolean;
    selectedBoard: string;
    onToggleExpand: () => void;
    onCopy: () => void;
    onSkip: () => void;
    onRestore: () => void;
    onDelete: () => void;
    onPublish: () => void;
    onBoardChange: (id: string) => void;
}) {
    return (
        <div className={`rounded-xl border transition-all ${expanded ? "border-white/15 bg-white/5" : "border-white/8 bg-white/3 hover:bg-white/5"}`}>
            <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={onToggleExpand}
            >
                {/* Thumbnail */}
                <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                    <img src={pin.imageUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as any).style.display = "none"; }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[pin.status]}`}>
                            {STATUS_LABELS[pin.status]}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                            {pin.pinType === "cover" ? "Portada" : "Interior"}
                        </span>
                    </div>
                    <p className="text-xs font-medium text-white truncate">{pin.title}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{pin.nicheName}</p>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={onCopy}
                        title="Copiar caption"
                        className={`text-xs px-2 py-1 rounded-lg border transition ${
                            copyFeedback
                                ? "text-emerald-400 bg-emerald-400/15 border-emerald-400/20"
                                : "text-zinc-400 bg-white/5 border-white/10 hover:text-white"
                        }`}
                    >
                        {copyFeedback ? "✓" : "Copiar"}
                    </button>

                    {pin.status === "pending" && connected && (
                        <button
                            onClick={onPublish}
                            disabled={publishing}
                            title="Publicar via API"
                            className="text-xs px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 transition disabled:opacity-50"
                        >
                            {publishing ? "..." : "Publicar"}
                        </button>
                    )}

                    {pin.status === "pending" && (
                        <button
                            onClick={onSkip}
                            title="Omitir pin"
                            className="text-xs px-2 py-1 rounded-lg text-zinc-500 bg-white/5 border border-white/10 hover:text-zinc-300 transition"
                        >
                            Skip
                        </button>
                    )}
                    {pin.status !== "pending" && (
                        <button
                            onClick={onRestore}
                            title="Restaurar a pendiente"
                            className="text-xs px-2 py-1 rounded-lg text-zinc-500 bg-white/5 border border-white/10 hover:text-zinc-300 transition"
                        >
                            ↩
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded content */}
            {expanded && (
                <div className="px-3 pb-3 space-y-2.5 border-t border-white/8 pt-2.5">
                    {/* Full caption preview */}
                    <div className="rounded-lg bg-black/30 p-2.5 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        <span className="font-semibold text-white">{pin.title}</span>
                        {"\n\n"}
                        {pin.description}
                        {"\n\n"}
                        <span className="text-rose-400/80">{pin.hashtags.join(" ")}</span>
                    </div>

                    {/* Board selector (Option A — only if connected) */}
                    {connected && boards.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-zinc-500 flex-shrink-0">Board:</span>
                            <select
                                value={pin.boardId ?? ""}
                                onChange={e => onBoardChange(e.target.value)}
                                className="flex-1 text-xs bg-black/30 text-white border border-white/10 rounded-lg px-2 py-1 outline-none"
                            >
                                <option value="">Sugerido: {pin.boardSuggestion}</option>
                                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Amazon link */}
                    <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-zinc-500">Amazon:</span>
                        <a
                            href={pin.amazonUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-400 hover:underline truncate"
                        >
                            {pin.amazonUrl}
                        </a>
                    </div>

                    {/* Error display */}
                    {pin.error && (
                        <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-2.5 py-1.5 border border-red-400/20">
                            {pin.error}
                        </p>
                    )}

                    {/* Delete */}
                    <button
                        onClick={onDelete}
                        className="text-[11px] text-red-500/60 hover:text-red-400 transition"
                    >
                        Eliminar de la cola
                    </button>
                </div>
            )}
        </div>
    );
}

function ConnectTab({ connected, onConnect }: { connected: boolean; onConnect: () => void }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/3 p-6 space-y-4">
            <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-600"}`} />
                <p className="text-sm font-medium text-white">
                    {connected ? "Cuenta Pinterest conectada" : "Pinterest no conectado"}
                </p>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
                Conecta tu cuenta Pinterest para publicar pins automáticamente via la API oficial.
                Si prefieres publicarlos manualmente, usa el botón <strong className="text-zinc-300">"Copiar"</strong> en cada pin
                y pégalo directamente en Pinterest.
            </p>

            <div className="space-y-2 text-xs text-zinc-500">
                <p className="font-medium text-zinc-400">Para conectar la API:</p>
                <ol className="list-decimal list-inside space-y-1">
                    <li>Ve a <strong className="text-zinc-300">developers.pinterest.com</strong> y crea una app</li>
                    <li>En <strong className="text-zinc-300">Ajustes → API Keys</strong> añade <code className="text-sky-400">PINTEREST_APP_ID</code> y <code className="text-sky-400">PINTEREST_APP_SECRET</code></li>
                    <li>Pulsa "Conectar cuenta" abajo</li>
                </ol>
            </div>

            {!connected && (
                <button
                    onClick={onConnect}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 text-sm transition"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                    </svg>
                    Conectar cuenta Pinterest
                </button>
            )}

            {connected && (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <span>✓ Conectado.</span>
                    <span className="text-zinc-500">Los pins se pueden publicar directamente desde la cola.</span>
                </div>
            )}
        </div>
    );
}
