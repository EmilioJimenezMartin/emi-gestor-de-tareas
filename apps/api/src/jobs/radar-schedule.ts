import type { Agenda } from "agenda";
import { Settings } from "../models/settings.js";
import { RadarJob } from "../models/radar-job.js";
import { RADAR_JOB_NAME } from "./radar.js";

export const RADAR_SCHEDULE_JOB_NAME = "run-radar-schedule";

type APRule = {
    id: string;
    days: number[];
    hour: number;
    platform: string;
    query: string;
    url?: string;
    mode: string;
    enabled: boolean;
};

const MODE_TO_STORAGE_KEY: Record<string, string> = {
    "etsy-niches":      "RADAR_ETSY_RESULT",
    "amazon-niches":    "RADAR_AMAZON_RESULT",
    "reddit-niches":    "RADAR_REDDIT_RESULT",
    "trends-niches":    "RADAR_TRENDS_RESULT",
    "opportunity":      "RADAR_OPPORTUNITY_RESULT",
    "amazon-movers":    "RADAR_MOVERS_RESULT",
    "cross-niche":      "RADAR_CROSS_RESULT",
    "gap-finder":       "RADAR_GAP_RESULT",
    "pinterest-niches": "RADAR_PINTEREST_RESULT",
    "general":          "RADAR_GENERAL_RESULT",
};

function storageKeyForMode(mode: string, platform: string): string {
    return MODE_TO_STORAGE_KEY[mode] ?? MODE_TO_STORAGE_KEY[`${platform}-niches`] ?? "RADAR_GENERAL_RESULT";
}

function resolveMode(rule: APRule): string {
    // Use explicit mode if it's a known radar mode; fall back to platform-based mapping
    const knownModes = new Set(Object.keys(MODE_TO_STORAGE_KEY));
    if (rule.mode && knownModes.has(rule.mode)) return rule.mode;
    if (rule.platform === "amazon") return "amazon-niches";
    if (rule.platform === "etsy") return "etsy-niches";
    if (rule.platform === "reddit") return "reddit-niches";
    if (rule.platform === "trends") return "trends-niches";
    if (rule.platform === "pinterest") return "pinterest-niches";
    return "general";
}

export function defineRadarScheduleJob(agenda: Agenda, io: any): void {
    agenda.define(RADAR_SCHEDULE_JOB_NAME, async () => {
        const now = new Date();
        const currentDay = now.getDay(); // 0=Sun, 1=Mon … 6=Sat
        const currentHour = now.getHours();

        let rules: APRule[] = [];
        try {
            const row = await Settings.findOne({ key: "AUTOPILOT_RULES" }).lean();
            if (row?.value) rules = JSON.parse(row.value as string);
        } catch {
            return;
        }

        const matching = rules.filter(r => {
            if (!r.enabled) return false;
            if (!r.days.includes(currentDay)) return false;
            if ((r.hour ?? 9) !== currentHour) return false;
            // gap-finder doesn't need a URL
            const mode = resolveMode(r);
            if (mode !== "gap-finder" && !r.url?.trim()) return false;
            return true;
        });

        if (!matching.length) return;

        console.log(`[radar-schedule] ${matching.length} rule(s) match day=${currentDay} hour=${currentHour}`);

        for (const rule of matching) {
            try {
                const jobId = `radar-${Date.now()}-${rule.id}`;
                const mode = resolveMode(rule);
                const storageKey = storageKeyForMode(mode, rule.platform);
                const jobUrl = mode === "gap-finder" ? "gap-finder" : rule.url!;

                await RadarJob.create({
                    jobId,
                    url: jobUrl,
                    mode: mode as any,
                    storageKey,
                    status: "running",
                    logs: [{ timestamp: new Date(), level: "info", message: `[INIT] Regla automática · ${mode} · ${rule.query}` }],
                });

                io?.emit("radar:log", {
                    timestamp: new Date(),
                    level: "info",
                    message: `[RADAR-SCHEDULE] Ejecutando regla automática: ${rule.query} (${mode})`,
                });

                await agenda.now(RADAR_JOB_NAME, { jobId });
                console.log(`[radar-schedule] Queued job ${jobId} for rule "${rule.query}"`);

                // Stagger multiple rules by 2 min to avoid parallel AI calls
                if (matching.length > 1) await new Promise(r => setTimeout(r, 2 * 60_000));
            } catch (e: any) {
                console.error(`[radar-schedule] Error queuing rule "${rule.query}": ${e.message}`);
            }
        }
    });
}
