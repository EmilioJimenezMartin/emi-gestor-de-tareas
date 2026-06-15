import { PromptMetric } from "../models/prompt-metric.js";
import { Settings } from "../models/settings.js";

/**
 * Queries PromptMetric for the highest-scoring prompts of the given productType.
 * Returns a formatted string to be appended to the `extras` field of /ai/generate-text,
 * or an empty string when there's not enough data yet.
 *
 * Thresholds (conservative to avoid premature bias):
 *   - min 3 attempts (enough signal)
 *   - successRate >= 65% (clearly above random)
 *   - avgScore >= 60 (quality judge agrees)
 */
export async function getEvolutionSeed(productType: string): Promise<string> {
    try {
        const setting = await Settings.findOne({ key: "PROMPT_EVOLUTION_ENABLED" }).lean() as any;
        if (setting && (setting.value === "0" || setting.value === "false")) return "";

        const winners = await PromptMetric.find({
            productType,
            attempts: { $gte: 3 },
            successRate: { $gte: 65 },
            avgScore: { $gte: 60 },
        })
            .sort({ avgScore: -1, successRate: -1 })
            .limit(3)
            .select("promptPreview avgScore successRate")
            .lean() as any[];

        if (winners.length === 0) return "";

        const examples = winners
            .map((w, i) => `[${i + 1}] "${w.promptPreview}" (score ${w.avgScore}, ${w.successRate}% success)`)
            .join(" | ");

        console.log(`[evolution] 🧬 ${winners.length} winning prompt(s) injected for "${productType}" (avg scores: ${winners.map(w => w.avgScore).join(", ")})`);

        return `winning examples: ${examples}`;
    } catch {
        return "";
    }
}

/** Returns count of available winners — useful for status endpoints */
export async function getEvolutionStats(productType: string): Promise<{ count: number; avgScore: number }> {
    try {
        const winners = await PromptMetric.find({
            productType,
            attempts: { $gte: 3 },
            successRate: { $gte: 65 },
            avgScore: { $gte: 60 },
        })
            .select("avgScore")
            .lean() as any[];
        const avg = winners.length > 0
            ? Math.round(winners.reduce((s, w) => s + w.avgScore, 0) / winners.length)
            : 0;
        return { count: winners.length, avgScore: avg };
    } catch {
        return { count: 0, avgScore: 0 };
    }
}
