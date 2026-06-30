"use client";

import React from "react";
import {
    Upload, Loader2, RefreshCw, Trash2, DollarSign, Target, TrendingUp,
    BookOpen, Link2, Unlink, Check,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import type { NicheFE, IACatalogFE, KdpSaleFE } from "./types";

interface VentasPanelProps {
    salesData: KdpSaleFE[];
    salesLoading: boolean;
    salesCsv: string;
    salesImportPeriod: string;
    salesPeriodFilter: string;
    salesPeriods: string[];
    linkSaleId: string | null;
    linkSaleNicheId: string;
    deletingSaleId: string | null;
    deletingPeriod: string | null;
    isImportingSales: boolean;
    niches: NicheFE[];
    iaCatalogs: IACatalogFE[];
    setSalesCsv: (v: string) => void;
    setSalesImportPeriod: (v: string) => void;
    setSalesPeriodFilter: (v: string) => void;
    setSalesData: React.Dispatch<React.SetStateAction<KdpSaleFE[]>>;
    setLinkSaleId: (id: string | null) => void;
    setLinkSaleNicheId: (id: string) => void;
    fetchSalesData: (period?: string) => Promise<void>;
    importSalesCsv: () => Promise<void>;
    deleteSale: (id: string) => Promise<void>;
    deleteSalePeriod: (period: string) => Promise<void>;
    nd: (n: Pick<NicheFE, "name" | "nickname">) => string;
    apiBaseUrl: string;
}

export function VentasPanel({
    salesData, salesLoading, salesCsv, salesImportPeriod, salesPeriodFilter,
    salesPeriods, linkSaleId, linkSaleNicheId, deletingSaleId, deletingPeriod,
    isImportingSales, niches, iaCatalogs,
    setSalesCsv, setSalesImportPeriod, setSalesPeriodFilter, setSalesData,
    setLinkSaleId, setLinkSaleNicheId,
    fetchSalesData, importSalesCsv, deleteSale, deleteSalePeriod,
    nd, apiBaseUrl,
}: VentasPanelProps) {
    const catsForNiche = (niche: NicheFE) => iaCatalogs.filter(c => c.nicheIds?.includes(niche._id));

    const totalUnits = salesData.reduce((s, r) => s + r.unitsSold, 0);
    const totalRoyalties = salesData.reduce((s, r) => s + r.royaltiesUsd, 0);
    const linkedCount = salesData.filter(r => r.nicheId).length;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-black text-white">Ventas KDP</h2>
                <p className="text-sm text-neutral-600">Importa informes CSV de Amazon KDP para ver royalties por nicho</p>
            </div>

            {/* Import CSV */}
            <Card variant="glass" className="p-5 border-white/5 bg-white/[0.01] space-y-4">
                <h3 className="text-sm font-black text-white flex items-center gap-2"><Upload size={12} /> Importar informe KDP</h3>
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <input type="month" value={salesImportPeriod} onChange={e => setSalesImportPeriod(e.target.value)}
                            className="h-8 px-2 rounded-lg border border-white/10 bg-white/[0.03] text-sm text-white" />
                        <button onClick={() => void fetchSalesData()} disabled={salesLoading}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/10 bg-white/[0.03] text-sm font-black text-neutral-500 hover:text-white transition-all disabled:opacity-40">
                            {salesLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Actualizar
                        </button>
                    </div>
                    <textarea value={salesCsv} onChange={e => setSalesCsv(e.target.value)}
                        placeholder="Pega aquí el CSV del informe de royalties de Amazon KDP…"
                        className="w-full h-28 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs text-neutral-300 font-mono resize-none focus:outline-none focus:border-sky-500/40 placeholder:text-neutral-700" />
                    <button onClick={() => void importSalesCsv()} disabled={!salesCsv.trim() || isImportingSales}
                        className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sm font-black text-sky-400 hover:bg-sky-500/25 transition-all disabled:opacity-40">
                        {isImportingSales ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />} Importar
                    </button>
                </div>
            </Card>

            {/* Period filter */}
            {salesPeriods.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Período:</span>
                    <button onClick={() => { setSalesPeriodFilter(""); void fetchSalesData(""); }}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-black transition-all ${!salesPeriodFilter ? "bg-white/10 border-white/20 text-white" : "border-white/10 text-neutral-600 hover:text-neutral-400"}`}>
                        Todos
                    </button>
                    {salesPeriods.map(p => (
                        <div key={p} className="flex items-center gap-0.5 group/period">
                            <button onClick={() => { setSalesPeriodFilter(p); void fetchSalesData(p); }}
                                className={`px-2 py-1 rounded-l-lg border-y border-l text-[10px] font-black transition-all ${salesPeriodFilter === p ? "bg-sky-500/20 border-sky-500/40 text-sky-400" : "border-white/10 text-neutral-600 hover:text-neutral-400"}`}>
                                {p}
                            </button>
                            <button
                                onClick={() => void deleteSalePeriod(p)}
                                disabled={deletingPeriod === p}
                                title={`Eliminar todas las ventas de ${p}`}
                                className="h-[26px] px-1.5 rounded-r-lg border-y border-r border-white/10 text-neutral-700 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all opacity-0 group-hover/period:opacity-100 disabled:opacity-40"
                            >
                                {deletingPeriod === p ? <Loader2 size={8} className="animate-spin" /> : <Trash2 size={8} />}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Summary cards */}
            {salesData.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: "Unidades", value: totalUnits, icon: <BookOpen size={12} />, color: "sky" },
                        { label: "Royalties", value: `$${totalRoyalties.toFixed(2)}`, icon: <DollarSign size={12} />, color: "emerald" },
                        { label: "Vinculados", value: `${linkedCount}/${salesData.length}`, icon: <Target size={12} />, color: "violet" },
                    ].map(({ label, value, icon, color }) => (
                        <Card key={label} variant="glass" className="p-3 border-white/5 bg-white/[0.01] text-center">
                            <div className={`text-lg font-black ${color === "sky" ? "text-sky-400" : color === "emerald" ? "text-emerald-400" : "text-violet-400"}`}>{value}</div>
                            <div className="text-[9px] font-black text-neutral-600 uppercase tracking-widest flex items-center justify-center gap-1 mt-0.5">{icon} {label}</div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Rentabilidad por nicho */}
            {(niches.length > 0 || salesData.length > 0) && (() => {
                const nicheRows = niches.map(n => {
                    const nSales = salesData.filter(s => s.nicheId === n._id);
                    const revenue = nSales.reduce((s, r) => s + r.royaltiesUsd, 0);
                    const units = nSales.reduce((s, r) => s + r.unitsSold, 0);
                    const cats = catsForNiche(n);
                    const images = cats.reduce((s, c) => s + c.images.length, 0);
                    const revenuePerImage = images > 0 ? revenue / images : 0;
                    return { n, revenue, units, cats: cats.length, images, revenuePerImage };
                }).sort((a, b) => b.revenue - a.revenue || b.images - a.images);

                const unlinkedSales = salesData.filter(s => !s.nicheId);
                const unlinkedRevenue = unlinkedSales.reduce((s, r) => s + r.royaltiesUsd, 0);
                const unlinkedUnits = unlinkedSales.reduce((s, r) => s + r.unitsSold, 0);
                const maxRevenue = Math.max(nicheRows[0]?.revenue ?? 0, unlinkedRevenue, 1);

                return (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                                <TrendingUp size={10} className="text-emerald-400" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-widest text-emerald-400/80">Rentabilidad por nicho</span>
                        </div>
                        <div className="space-y-1.5">
                            {nicheRows.map(({ n, revenue, units, cats, images, revenuePerImage }, idx) => {
                                const barW = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
                                const tier = revenue === 0 ? "none"
                                    : revenue < 5 ? "low"
                                    : revenue < 20 ? "mid"
                                    : "high";
                                const tierCls = tier === "high" ? "text-emerald-400"
                                    : tier === "mid" ? "text-sky-400"
                                    : tier === "low" ? "text-amber-400/70"
                                    : "text-neutral-700";
                                const barCls = tier === "high" ? "bg-emerald-500"
                                    : tier === "mid" ? "bg-sky-500"
                                    : tier === "low" ? "bg-amber-500/60"
                                    : "bg-neutral-800";
                                return (
                                    <div key={n._id} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.01] border border-white/[0.04] hover:border-white/10 hover:bg-white/[0.025] transition-all">
                                        <span className="text-[10px] font-black text-neutral-700 tabular-nums w-4 shrink-0">{idx + 1}</span>
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-white truncate">{nd(n)}</span>
                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${
                                                    n.status === "active" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/15" : "text-neutral-600 bg-white/5 border-white/8"
                                                }`}>{n.status}</span>
                                            </div>
                                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-700 ${barCls}`} style={{ width: `${barW}%` }} />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0 text-right">
                                            <div>
                                                <div className={`text-sm font-black tabular-nums ${tierCls}`}>${revenue.toFixed(2)}</div>
                                                <div className="text-[9px] text-neutral-700">{units} u.</div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-black tabular-nums text-neutral-400">{images}</div>
                                                <div className="text-[9px] text-neutral-700">{cats} cat.</div>
                                            </div>
                                            {images > 0 && (
                                                <div className="w-16">
                                                    <div className={`text-sm font-black tabular-nums ${revenuePerImage > 0 ? "text-violet-400" : "text-neutral-700"}`}>
                                                        ${revenuePerImage.toFixed(3)}
                                                    </div>
                                                    <div className="text-[9px] text-neutral-700">$/img</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {unlinkedRevenue > 0 && (
                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.01] border border-dashed border-white/[0.06]">
                                    <span className="text-[10px] font-black text-neutral-700 w-4 shrink-0">—</span>
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-neutral-600 italic truncate">Sin vincular</span>
                                            <span className="text-[9px] font-black text-neutral-700 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded-full">{unlinkedSales.length}</span>
                                        </div>
                                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-neutral-700/50 transition-all duration-700" style={{ width: `${(unlinkedRevenue / maxRevenue) * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0 text-right">
                                        <div>
                                            <div className="text-sm font-black tabular-nums text-neutral-500">${unlinkedRevenue.toFixed(2)}</div>
                                            <div className="text-[9px] text-neutral-700">{unlinkedUnits} u.</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Sales table */}
            {salesData.length === 0 && !salesLoading && (
                <div className="text-center py-12 text-neutral-700 text-sm">No hay datos de ventas. Importa un informe CSV.</div>
            )}
            {salesLoading && <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-neutral-700" /></div>}
            {salesData.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">{salesData.length} entradas</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-[9px] font-black text-neutral-600 uppercase tracking-widest border-b border-white/5">
                                    <th className="text-left py-2 pr-3">Período</th>
                                    <th className="text-left py-2 pr-3">Título / Nicho</th>
                                    <th className="text-left py-2 pr-3">ASIN</th>
                                    <th className="text-right py-2 pr-3">Unidades</th>
                                    <th className="text-right py-2 pr-3">Royalties</th>
                                    <th className="w-6" />
                                </tr>
                            </thead>
                            <tbody>
                                {salesData.map(r => {
                                    const niche = niches.find(n => n._id === r.nicheId);
                                    const isLinking = linkSaleId === r._id;
                                    const isDeleting = deletingSaleId === r._id;
                                    return (
                                        <React.Fragment key={r._id}>
                                            <tr className="group/row border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                <td className="py-2 pr-3 text-neutral-500 whitespace-nowrap">{r.period}</td>
                                                <td className="py-2 pr-3 max-w-[220px]">
                                                    <div className="truncate text-neutral-300">{r.title || "—"}</div>
                                                    {niche
                                                        ? <button
                                                            onClick={() => { setLinkSaleId(isLinking ? null : r._id); setLinkSaleNicheId(r.nicheId ?? ""); }}
                                                            className={`text-[9px] font-black flex items-center gap-1 transition-all ${isLinking ? "text-sky-400" : "text-sky-400/70 hover:text-sky-300"}`}
                                                          >
                                                            <Target size={7} /> {nd(niche)}
                                                          </button>
                                                        : <button
                                                            onClick={() => { setLinkSaleId(isLinking ? null : r._id); setLinkSaleNicheId(""); }}
                                                            className={`text-[9px] font-black flex items-center gap-1 transition-all ${isLinking ? "text-sky-400" : "text-neutral-700 hover:text-amber-400"}`}
                                                          >
                                                            <Link2 size={7} /> {isLinking ? "Cancelar" : "Sin nicho — vincular"}
                                                          </button>
                                                    }
                                                </td>
                                                <td className="py-2 pr-3 font-mono text-neutral-500">{r.asin}</td>
                                                <td className="py-2 pr-3 text-right font-black text-white">{r.unitsSold}</td>
                                                <td className="py-2 pr-3 text-right font-black text-emerald-400">${r.royaltiesUsd.toFixed(2)}</td>
                                                <td className="py-2">
                                                    <button
                                                        onClick={() => void deleteSale(r._id)}
                                                        disabled={isDeleting}
                                                        className="opacity-0 group-hover/row:opacity-100 text-neutral-700 hover:text-rose-400 transition-all disabled:opacity-40"
                                                    >
                                                        {isDeleting ? <Loader2 size={9} className="animate-spin" /> : <Trash2 size={9} />}
                                                    </button>
                                                </td>
                                            </tr>
                                            {isLinking && (
                                                <tr className="border-b border-white/[0.03] bg-sky-500/[0.03]">
                                                    <td colSpan={6} className="py-2 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={linkSaleNicheId}
                                                                onChange={e => setLinkSaleNicheId(e.target.value)}
                                                                className="flex-1 h-7 px-2 rounded-lg border border-white/10 bg-white/[0.04] text-[11px] text-white focus:outline-none focus:border-sky-500/40"
                                                            >
                                                                <option value="">— Selecciona un nicho —</option>
                                                                {niches.map(n => <option key={n._id} value={n._id}>{nd(n)}</option>)}
                                                            </select>
                                                            {r.nicheId && (
                                                                <button
                                                                    onClick={async () => {
                                                                        await fetch(`${apiBaseUrl}/kdp-sales/${r._id}`, {
                                                                            method: "PATCH",
                                                                            headers: { "Content-Type": "application/json" },
                                                                            body: JSON.stringify({ nicheId: null }),
                                                                        });
                                                                        setSalesData(prev => prev.map(s => s._id === r._id ? { ...s, nicheId: null } : s));
                                                                        setLinkSaleId(null);
                                                                        toast.success("Venta desvinculada");
                                                                    }}
                                                                    className="h-7 px-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] font-black text-rose-400 hover:bg-rose-500/20 transition-all"
                                                                >
                                                                    <Unlink size={9} />
                                                                </button>
                                                            )}
                                                            <button
                                                                disabled={!linkSaleNicheId}
                                                                onClick={async () => {
                                                                    await fetch(`${apiBaseUrl}/kdp-sales/${r._id}`, {
                                                                        method: "PATCH",
                                                                        headers: { "Content-Type": "application/json" },
                                                                        body: JSON.stringify({ nicheId: linkSaleNicheId }),
                                                                    });
                                                                    setSalesData(prev => prev.map(s => s._id === r._id ? { ...s, nicheId: linkSaleNicheId } : s));
                                                                    setLinkSaleId(null);
                                                                    toast.success("Venta vinculada al nicho");
                                                                }}
                                                                className="h-7 px-3 rounded-lg bg-sky-500/20 border border-sky-500/30 text-[10px] font-black text-sky-400 hover:bg-sky-500/30 transition-all disabled:opacity-40"
                                                            >
                                                                <Check size={9} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
