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

function storageKeyForPlatform(platform: string): string {
    if (platform === "amazon") return "RADAR_AMAZON_RESULT";
    if (platform === "etsy") return "RADAR_ETSY_RESULT";
    if (platform === "reddit") return "RADAR_REDDIT_RESULT";
    if (platform === "trends") return "RADAR_TRENDS_RESULT";
    return "RADAR_GENERAL_RESULT";
}

function modeForPlatform(platform: string): "etsy-niches" | "amazon-niches" | "reddit-niches" | "trends-niches" | "general" {
    if (platform === "amazon") return "amazon-niches";
    if (platform === "etsy") return "etsy-niches";
    if (platform === "reddit") return "reddit-niches";
    if (platform === "trends") return "trends-niches";
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

        const matching = rules.filter(r =>
            r.enabled &&
            r.url?.trim() &&
            r.days.includes(currentDay) &&
            (r.hour ?? 9) === currentHour
        );

        if (!matching.length) return;

        console.log(`[radar-schedule] ${matching.length} rule(s) match day=${currentDay} hour=${currentHour}`);

        for (const rule of matching) {
            try {
                const jobId = `radar-${Date.now()}-${rule.id}`;
                const storageKey = storageKeyForPlatform(rule.platform);
                const mode = modeForPlatform(rule.platform);

                await RadarJob.create({
                    jobId,
                    url: rule.url!,
                    mode,
                    storageKey,
                    status: "running",
                    logs: [{ timestamp: new Date(), level: "info", message: `[INIT] Regla automática · ${rule.platform} · ${rule.query}` }],
                });

                io?.emit("radar:log", {
                    timestamp: new Date(),
                    level: "info",
                    message: `[RADAR-SCHEDULE] Ejecutando regla automática: ${rule.query} (${rule.platform})`,
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
