/**
 * Score predictivo con histórico propio.
 * Cruza el verdict/score del Market Scan que tenía cada nicho al publicarse
 * con sus ventas reales (KdpSale), y calibra los scores futuros:
 * "gold" solo vale lo que TUS gold han vendido de verdad.
 *
 * Con pocos nichos publicados la confianza es baja y el ajuste se atenúa
 * (shrinkage hacia 1.0) — nunca decisiones bruscas con 2 datos.
 */
import { Niche } from "../models/niche.js";
import { KdpSale } from "../models/kdp-sale.js";

export type Verdict = "gold" | "good" | "saturated" | "dead";

export interface VerdictStats {
    verdict: Verdict;
    niches: number;            // nichos publicados con este verdict
    avgUnitsFirst60d: number;  // media de unidades en sus 2 primeros meses
    totalUnits: number;
    examples: Array<{ name: string; units: number; score: number }>;
}

export interface ScoreCalibration {
    buckets: VerdictStats[];
    /** multiplicador por verdict: >1 = tus nichos de ese verdict venden MÁS de lo esperado */
    factors: Partial<Record<Verdict, number>>;
    /** nº total de nichos con datos — define la confianza */
    sampleSize: number;
    confidence: "none" | "low" | "medium" | "high";
    computedAt: string;
}

// Ventas "esperadas" por verdict en los 2 primeros meses — baseline neutra que
// el histórico real va sustituyendo. Solo sirve de denominador inicial.
const BASELINE_UNITS: Record<Verdict, number> = { gold: 10, good: 5, saturated: 2, dead: 0.5 };

/** Unidades vendidas por un nicho en sus 2 primeros meses de vida */
async function unitsFirstMonths(nicheId: string, publishedAt: Date, months = 2): Promise<number> {
    const periods: string[] = [];
    for (let off = 0; off < months; off++) {
        const d = new Date(publishedAt.getFullYear(), publishedAt.getMonth() + off, 1);
        periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const agg = await KdpSale.aggregate([
        { $match: { nicheId, period: { $in: periods } } },
        { $group: { _id: null, units: { $sum: "$unitsSold" } } },
    ]);
    return agg[0]?.units ?? 0;
}

export async function computeScoreCalibration(): Promise<ScoreCalibration> {
    // Nichos publicados hace ≥30 días con market scan — los únicos con señal útil
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const niches = await Niche.find({
        lifecycleStage: { $in: ["published", "end-of-life"] },
        publishedAt: { $lte: cutoff },
        "marketScan.verdict": { $exists: true },
    }).select("name publishedAt marketScan").lean() as any[];

    const byVerdict = new Map<Verdict, Array<{ name: string; units: number; score: number }>>();

    for (const n of niches) {
        const verdict = n.marketScan?.verdict as Verdict | undefined;
        const score = Number(n.marketScan?.score ?? 0);
        if (!verdict || !n.publishedAt) continue;
        const units = await unitsFirstMonths(String(n._id), new Date(n.publishedAt));
        if (!byVerdict.has(verdict)) byVerdict.set(verdict, []);
        byVerdict.get(verdict)!.push({ name: n.name, units, score });
    }

    const buckets: VerdictStats[] = [];
    const factors: Partial<Record<Verdict, number>> = {};
    let sampleSize = 0;

    for (const verdict of ["gold", "good", "saturated", "dead"] as Verdict[]) {
        const entries = byVerdict.get(verdict) ?? [];
        if (entries.length === 0) continue;
        sampleSize += entries.length;
        const totalUnits = entries.reduce((a, e) => a + e.units, 0);
        const avg = totalUnits / entries.length;
        buckets.push({
            verdict,
            niches: entries.length,
            avgUnitsFirst60d: Math.round(avg * 10) / 10,
            totalUnits,
            examples: entries.sort((a, b) => b.units - a.units).slice(0, 5),
        });
        // Factor crudo vs baseline, con shrinkage según nº de datos:
        // n=1 → 25% del ajuste · n=4 → 50% · n=12 → 75% · n→∞ → 100%
        const rawFactor = avg / BASELINE_UNITS[verdict];
        const weight = entries.length / (entries.length + 3);
        factors[verdict] = Math.round((1 + (rawFactor - 1) * weight) * 100) / 100;
    }

    const confidence: ScoreCalibration["confidence"] =
        sampleSize === 0 ? "none" : sampleSize < 4 ? "low" : sampleSize < 10 ? "medium" : "high";

    return { buckets, factors, sampleSize, confidence, computedAt: new Date().toISOString() };
}

/**
 * Ajusta un score de Market Scan con el histórico propio.
 * Devuelve el score original si no hay datos suficientes.
 */
export function adjustScore(
    score: number,
    verdict: Verdict,
    calibration: ScoreCalibration,
): { adjustedScore: number; factor: number; applied: boolean } {
    const factor = calibration.factors[verdict];
    if (!factor || calibration.confidence === "none") {
        return { adjustedScore: score, factor: 1, applied: false };
    }
    const adjusted = Math.min(100, Math.max(0, Math.round(score * factor)));
    return { adjustedScore: adjusted, factor, applied: true };
}
