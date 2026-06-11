// Paneles de Market Scan y Launch Playbook de la card de nicho.
// Extraídos de kdp-factory-app.tsx sin cambios de lógica.
import { TrendingUp, Rocket } from "lucide-react";
import type { NicheFE } from "./types";

// ── Market Scan panel ─────────────────────────────────────────────────────────
// Datos reales de Amazon (.com/.es): balanza demanda / oferta / competencia.
const MARKET_VERDICT_STYLE: Record<string, { label: string; chip: string; glow: string }> = {
    gold:      { label: "🥇 GOLD",     chip: "bg-gradient-to-r from-yellow-500/25 to-amber-500/15 border-yellow-500/40 text-yellow-300", glow: "shadow-[0_0_18px_rgba(234,179,8,0.15)]" },
    good:      { label: "✓ BUENO",     chip: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400", glow: "" },
    saturated: { label: "⚠ SATURADO",  chip: "bg-amber-500/15 border-amber-500/30 text-amber-400", glow: "" },
    dead:      { label: "✕ SIN MERCADO", chip: "bg-rose-500/15 border-rose-500/30 text-rose-400", glow: "" },
};

function MarketScanBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = Math.max(4, Math.round((value / max) * 100));
    return (
        <div className="flex items-center gap-2">
            <span className="text-[9px] text-neutral-600 uppercase font-black w-16 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-black text-neutral-400 tabular-nums w-10 text-right">{value}/{max}</span>
        </div>
    );
}

function MarketScanMarketRow({ flag, data }: {
    flag: string;
    data?: { resultCount: number | null; medianReviews: number | null; bestsellerBadges: number; ok?: boolean; error?: string };
}) {
    const blocked = !data || data.ok === false || (data.resultCount === null && data.medianReviews === null);
    return (
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5">
            <span className="text-sm shrink-0">{flag}</span>
            {blocked ? (
                <span className="text-[10px] text-neutral-600 italic">sin datos — reescanear más tarde</span>
            ) : (
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <span className="text-[10px] text-neutral-400"><span className="font-black text-white tabular-nums">{data!.resultCount?.toLocaleString("es-ES") ?? "?"}</span> resultados</span>
                    <span className="text-[10px] text-neutral-400">mediana <span className="font-black text-white tabular-nums">{data!.medianReviews ?? "?"}</span> reviews</span>
                    {data!.bestsellerBadges > 0 && (
                        <span className="text-[10px] font-black text-orange-400">{data!.bestsellerBadges} bestsellers</span>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Launch Playbook ───────────────────────────────────────────────────────────
// Los primeros 30 días deciden el posicionamiento: Amazon da una "luna de miel"
// de visibilidad a los lanzamientos. Día 0 = cuando se aplicó el listing en KDP.
const LAUNCH_PLAYBOOK: Array<{ fromDay: number; toDay: number | null; title: string; action: string; why: string }> = [
    { fromDay: 0, toDay: 0, title: "Día 0 — Precio de lanzamiento", action: "Publica a precio bajo ($6.99)", why: "Velocidad de ventas inicial = el algoritmo te da \"luna de miel\" de ~30 días" },
    { fromDay: 0, toDay: 7, title: "Día 0-7 — Primeras reviews", action: "Pide reviews a conocidos QUE COMPREN (no regalado)", why: "Verified Purchase pesa mucho más para el algoritmo" },
    { fromDay: 14, toDay: 14, title: "Día 14 — Re-validar mercado", action: "Lanza otro Market Scan del nicho", why: "¿Entró competencia? ¿Tu libro aparece ya en autocomplete?" },
    { fromDay: 30, toDay: 30, title: "Día 30 — Rotar metadatos si no vende", action: "Cambia la keyword principal del título por la 2ª del intel (KDP permite editar sin perder histórico)", why: "A/B testing gratis" },
    { fromDay: 30, toDay: null, title: "Día 30+ — Subir precio", action: "Sube gradualmente ($8.99 → $10.99) si hay tracción", why: "Maximiza royalty una vez posicionado" },
];

export function LaunchPlaybookPanel({ appliedAt }: { appliedAt?: string }) {
    const day = appliedAt ? Math.floor((Date.now() - new Date(appliedAt).getTime()) / 86_400_000) : null;
    const stepState = (s: typeof LAUNCH_PLAYBOOK[number]): "done" | "current" | "upcoming" => {
        if (day === null) return "upcoming";
        const end = s.toDay ?? Infinity;
        if (day > end) return "done";
        if (day >= s.fromDay) return "current";
        return "upcoming";
    };
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.07] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Rocket size={11} className="text-sky-400/80 shrink-0" />
                    <span className="text-[9px] uppercase tracking-wider text-neutral-600 font-black">Launch Playbook · primeros 30 días</span>
                </div>
                {day !== null ? (
                    <span className="text-[10px] font-black text-sky-400 tabular-nums">Día {day}</span>
                ) : (
                    <span className="text-[9px] text-neutral-600 italic">marca un listing como aplicado para activar el reloj</span>
                )}
            </div>
            <div className="space-y-1">
                {LAUNCH_PLAYBOOK.map((s, i) => {
                    const st = stepState(s);
                    return (
                        <div key={i} title={s.why}
                            className={`flex items-start gap-2 rounded-lg px-2 py-1.5 border transition-all ${
                                st === "current" ? "bg-sky-500/[0.08] border-sky-500/25" :
                                st === "done" ? "bg-white/[0.015] border-white/[0.04] opacity-50" :
                                "bg-white/[0.015] border-white/[0.04]"
                            }`}>
                            <span className="text-[10px] mt-px shrink-0">{st === "done" ? "✅" : st === "current" ? "🔵" : "⚪"}</span>
                            <div className="min-w-0">
                                <p className={`text-[10px] font-black leading-tight ${st === "current" ? "text-sky-300" : "text-neutral-400"}`}>{s.title}</p>
                                <p className="text-[10px] text-neutral-500 leading-snug">{s.action}</p>
                                {st === "current" && <p className="text-[9px] text-neutral-600 italic mt-0.5">{s.why}</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function MarketScanPanel({ scan }: { scan: NonNullable<NicheFE["marketScan"]> }) {
    const v = MARKET_VERDICT_STYLE[scan.verdict] ?? MARKET_VERDICT_STYLE.dead;
    const bd = scan.scoreBreakdown;
    return (
        <div className={`rounded-xl bg-white/[0.02] border border-white/[0.07] p-3 space-y-2.5 ${v.glow}`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <TrendingUp size={11} className="text-yellow-400/80 shrink-0" />
                    <span className="text-[9px] uppercase tracking-wider text-neutral-600 font-black">Market Scan · Amazon real</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base font-black text-white tabular-nums leading-none">{scan.score}<span className="text-[9px] text-neutral-600">/100</span></span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${v.chip}`}>{v.label}</span>
                </div>
            </div>
            {bd && (
                <div className="space-y-1.5">
                    <MarketScanBar label="Demanda" value={bd.demand} max={40} color="from-emerald-500 to-teal-400" />
                    <MarketScanBar label="Hueco" value={bd.supply} max={30} color="from-sky-500 to-blue-400" />
                    <MarketScanBar label="Comp. débil" value={bd.competition} max={30} color="from-violet-500 to-purple-400" />
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <MarketScanMarketRow flag="🇺🇸" data={scan.us as any} />
                <MarketScanMarketRow flag="🇪🇸" data={scan.es as any} />
            </div>
            {scan.scannedAt && (
                <p className="text-[9px] text-neutral-700 text-right">escaneado {new Date(scan.scannedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            )}
        </div>
    );
}
