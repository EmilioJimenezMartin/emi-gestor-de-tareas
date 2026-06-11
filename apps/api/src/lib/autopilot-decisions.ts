/**
 * Autopilot de decisiones post-lanzamiento.
 * Cuando autoPilotEnabled=true en un nicho, este módulo se activa en los hitos
 * del lifecycle (día 30/60) y ejecuta las decisiones automáticamente:
 *   - Con ventas: actualiza suggestedPrice y avisa por Telegram
 *   - Sin ventas: rota keywords en el listing más reciente y genera nueva versión
 */
import { Niche } from "../models/niche.js";
import { sendTelegram, shouldNotify } from "./telegram.js";

export type AutopilotActionType = "price-increase" | "metadata-rotation" | "end-of-life-suggestion";

export interface AutopilotAction {
    type: AutopilotActionType;
    details: string;
    suggestedPrice?: number;
    executedAt: Date;
}

const PRICE_LADDER: Record<number, number> = { 30: 8.99, 60: 10.99 };

export async function executeAutopilotDecision(
    nicheId: string,
    day: number,
    hasSales: boolean,
    io?: any
): Promise<AutopilotAction | null> {
    const niche = await Niche.findById(nicheId);
    if (!niche?.autoPilotEnabled) return null;

    // Find which price-ladder tier we're on (30 or 60)
    const tier = day >= 60 ? 60 : day >= 30 ? 30 : null;
    if (!tier) return null;

    const nextPrice = PRICE_LADDER[tier];
    let action: AutopilotAction;

    if (hasSales) {
        action = {
            type: "price-increase",
            details: `Día ${tier} con ventas — autopilot sugiere subir precio a $${nextPrice}. Cámbialo en KDP Dashboard.`,
            suggestedPrice: nextPrice,
            executedAt: new Date(),
        };
        await Niche.findByIdAndUpdate(nicheId, {
            $set: { suggestedPrice: nextPrice },
            $push: { autopilotLog: action },
        });
    } else {
        action = await _rotateMetadata(niche, tier);
    }

    if (await shouldNotify("autopilot.decision")) {
        const emoji = action.type === "price-increase" ? "💰" : "🔄";
        const lines = [`${emoji} <b>AUTOPILOT — ${niche.name}</b>`, "", action.details];
        if (action.suggestedPrice) {
            lines.push("", `👉 Nuevo precio: <b>$${action.suggestedPrice}</b>`);
            lines.push("Aplícalo en KDP → Pricing → List Price");
        }
        await sendTelegram(lines.join("\n"));
    }

    io?.emit("niches:updated");
    return action;
}

async function _rotateMetadata(niche: any, tier: number): Promise<AutopilotAction> {
    const listings = niche.listings ?? [];
    const current = listings[listings.length - 1];
    const keywords: string[] = current?.keywords ?? [];

    // Pick best rotation keyword: 2nd in list, or from radarInsight
    let rotateTarget = keywords[1] ?? keywords[0] ?? "";
    const insight = niche.radarInsight as any;
    const seoPool: string[] = insight?.keyword_opportunities ?? insight?.keywords ?? [];
    if (seoPool.length > 1) {
        const primary = (keywords[0] ?? "").toLowerCase().split(" ")[0];
        const candidate = seoPool.find((k: string) => !k.toLowerCase().startsWith(primary));
        if (candidate) rotateTarget = candidate;
    }

    // Swap positions 0 ↔ 1 in the keywords array
    const rotated = keywords.length > 1
        ? [keywords[1], keywords[0], ...keywords.slice(2)]
        : keywords;

    const newListing = {
        title: current?.title ?? "",
        subtitle: current?.subtitle ?? "",
        description: current?.description ?? "",
        keywords: rotated,
        etsyTags: current?.etsyTags ?? [],
        categories: current?.categories ?? [],
        seoNotes: `[AUTOPILOT día ${tier}] Sin ventas — keyword rotada a "${rotateTarget}"`,
        generatedAt: new Date(),
        language: current?.language ?? "en",
    };

    const action: AutopilotAction = {
        type: "metadata-rotation",
        details: `Día ${tier} sin ventas — keyword principal rotada a "${rotateTarget}". Nueva versión de listing lista para aplicar en KDP.`,
        executedAt: new Date(),
    };

    await Niche.findByIdAndUpdate(niche._id, {
        $push: { listings: newListing, autopilotLog: action },
    });

    return action;
}
