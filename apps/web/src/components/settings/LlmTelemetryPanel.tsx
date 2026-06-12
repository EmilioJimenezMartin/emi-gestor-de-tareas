"use client";
// Telemetría de proveedores LLM: éxitos/fallos/latencia de los últimos 7 días.
// Si tu primario falla >30%, te conviene cambiar el orden de la cadena.
import { useState, useEffect } from "react";
import { Activity, RefreshCw } from "lucide-react";

interface ProviderStat {
    ok: number;
    fail: number;
    avgMs: number;
    successRate: number;
    lastError?: string;
    lastUsedAt?: string;
}

const PROVIDER_LABELS: Record<string, { name: string; color: string }> = {
    google:      { name: "Google Gemini", color: "text-blue-400" },
    groq:        { name: "Groq",          color: "text-orange-400" },
    openrouter:  { name: "OpenRouter",    color: "text-purple-400" },
    huggingface: { name: "HuggingFace",   color: "text-yellow-400" },
};

function rateColor(rate: number): string {
    if (rate >= 90) return "text-emerald-400";
    if (rate >= 70) return "text-amber-400";
    return "text-rose-400";
}

export function LlmTelemetryPanel({ apiUrl }: { apiUrl: string }) {
    const [data, setData] = useState<{ stats: Record<string, ProviderStat>; since: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/ai/llm-telemetry`);
            if (res.ok) setData(await res.json());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const entries = Object.entries(data?.stats ?? {}).sort((a, b) => (b[1].ok + b[1].fail) - (a[1].ok + a[1].fail));
    if (!loading && entries.length === 0) return null; // sin llamadas registradas aún

    return (
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity size={13} className="text-cyan-400/80" />
                    <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Salud de proveedores · 7 días</span>
                </div>
                <button onClick={() => void load()} disabled={loading}
                    className="flex items-center gap-1 text-[10px] text-neutral-600 hover:text-cyan-400 transition-colors disabled:opacity-40">
                    <RefreshCw size={9} className={loading ? "animate-spin" : ""} /> Actualizar
                </button>
            </div>

            <div className="space-y-1.5">
                {entries.map(([provider, s]) => {
                    const meta = PROVIDER_LABELS[provider] ?? { name: provider, color: "text-neutral-400" };
                    const total = s.ok + s.fail;
                    return (
                        <div key={provider} className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] px-3 py-2">
                            <span className={`text-xs font-black w-32 shrink-0 ${meta.color}`}>{meta.name}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden" title={`${s.ok} OK / ${s.fail} fallos`}>
                                <div className={`h-full rounded-full transition-all ${s.successRate >= 90 ? "bg-emerald-500/70" : s.successRate >= 70 ? "bg-amber-500/70" : "bg-rose-500/70"}`}
                                    style={{ width: `${Math.max(3, s.successRate)}%` }} />
                            </div>
                            <span className={`text-xs font-black tabular-nums w-12 text-right ${rateColor(s.successRate)}`}>{s.successRate}%</span>
                            <span className="text-[10px] text-neutral-600 tabular-nums w-20 text-right">{total} llamadas</span>
                            <span className="text-[10px] text-neutral-600 tabular-nums w-16 text-right">~{s.avgMs >= 1000 ? `${(s.avgMs / 1000).toFixed(1)}s` : `${s.avgMs}ms`}</span>
                        </div>
                    );
                })}
            </div>

            {entries.some(([, s]) => s.lastError && s.successRate < 90) && (
                <div className="space-y-0.5">
                    {entries.filter(([, s]) => s.lastError && s.successRate < 90).map(([p, s]) => (
                        <p key={p} className="text-[9px] text-neutral-700 truncate" title={s.lastError}>
                            <span className="font-black">{PROVIDER_LABELS[p]?.name ?? p}:</span> {s.lastError}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}
