/**
 * Double-down — explota los nichos GANADORES.
 * Un nicho con ventas reales es la señal más valiosa del sistema: en vez de
 * buscar nichos nuevos a ciegas, propone spin-offs del que ya vende:
 *   Vol. 2 · versión niños/adultos · printable para Etsy · variante estacional.
 */
import { KdpSale } from "../models/kdp-sale.js";
import { Niche } from "../models/niche.js";
import { generateTextWithLLM } from "./ai.js";

export interface WinnerProposal {
    nicheId: string;
    nicheName: string;
    royaltiesUsd: number;
    unitsSold: number;
    proposals: Array<{ name: string; type: string; rationale: string }>;
}

/** Umbral mínimo para considerar "ganador": royalties en los últimos 2 periodos. */
const MIN_ROYALTIES_USD = 10;

export async function findWinners(): Promise<Array<{ nicheId: string; royaltiesUsd: number; unitsSold: number }>> {
    // Últimos 2 periodos mensuales (ej. 2026-05, 2026-06)
    const now = new Date();
    const periods = [0, 1].map(off => {
        const d = new Date(now.getFullYear(), now.getMonth() - off, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const agg = await KdpSale.aggregate([
        { $match: { period: { $in: periods }, nicheId: { $nin: [null, ""] } } },
        { $group: { _id: "$nicheId", royaltiesUsd: { $sum: "$royaltiesUsd" }, unitsSold: { $sum: "$unitsSold" } } },
        { $match: { royaltiesUsd: { $gte: MIN_ROYALTIES_USD } } },
        { $sort: { royaltiesUsd: -1 } },
        { $limit: 10 },
    ]);
    return agg.map((a: any) => ({ nicheId: String(a._id), royaltiesUsd: a.royaltiesUsd, unitsSold: a.unitsSold }));
}

/**
 * Para un nicho ganador, propone 4 spin-offs vía LLM.
 * No crea nada automáticamente — devuelve propuestas para aprobar.
 */
export async function proposeSpinoffs(nicheId: string, royaltiesUsd: number, unitsSold: number): Promise<WinnerProposal | null> {
    const niche = await Niche.findById(nicheId).lean() as any;
    if (!niche) return null;

    // Evitar proponer si ya existen spin-offs (nichos cuyo nombre referencia a este)
    const existingSpinoffs = await Niche.countDocuments({
        _id: { $ne: nicheId },
        $or: [
            { name: new RegExp(niche.name.split(" ").slice(0, 2).join(".*"), "i") },
            { notes: new RegExp(`spin-off de.*${niche.name.slice(0, 20)}`, "i") },
        ],
    });
    if (existingSpinoffs >= 3) return null; // ya explotado

    const system = `Eres un estratega de Amazon KDP. Un libro está VENDIENDO (dato real). Tu trabajo: exprimir ese ganador con spin-offs que capturen al mismo comprador.
Responde SOLO con JSON válido (sin markdown): { "proposals": [ { "name": string, "type": "vol2" | "audience-shift" | "printable" | "seasonal", "rationale": string } ] }
- Exactamente 4 propuestas, una de cada tipo:
  · vol2: segundo volumen del mismo tema (los compradores satisfechos recompran)
  · audience-shift: mismo tema, otra audiencia (niños↔adultos↔seniors)
  · printable: versión printable/wall-art para Etsy del mismo tema
  · seasonal: variante para la próxima festividad relevante (Navidad, Halloween, San Valentín...)
- "name": nombre corto y vendible. "rationale": 1 frase con el porqué.`;
    const context = [
        `Nicho ganador: ${niche.name}`,
        `Ventas últimos 2 meses: $${royaltiesUsd.toFixed(2)} (${unitsSold} unidades)`,
        niche.description ? `Descripción: ${niche.description}` : "",
        `Tipo: ${niche.productType ?? "coloring-book"} · Estilo: ${niche.styleCategory ?? "generic"}`,
    ].filter(Boolean).join("\n");

    try {
        const text = await generateTextWithLLM(system, context);
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        const parsed = JSON.parse(match[0]);
        return {
            nicheId,
            nicheName: niche.name,
            royaltiesUsd,
            unitsSold,
            proposals: Array.isArray(parsed.proposals) ? parsed.proposals.slice(0, 4) : [],
        };
    } catch {
        return null;
    }
}

/** Pipeline completo: ganadores → propuestas. Máx 3 ganadores por ejecución. */
export async function runDoubleDown(): Promise<WinnerProposal[]> {
    const winners = await findWinners();
    const out: WinnerProposal[] = [];
    for (const w of winners.slice(0, 3)) {
        const p = await proposeSpinoffs(w.nicheId, w.royaltiesUsd, w.unitsSold);
        if (p && p.proposals.length > 0) out.push(p);
    }
    return out;
}
