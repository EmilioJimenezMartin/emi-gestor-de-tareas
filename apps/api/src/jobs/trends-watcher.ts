import type { Agenda, Job } from "agenda";
import { fetchTrendsReport } from "../lib/trends.js";
import { Settings } from "../models/settings.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";

export const TRENDS_WATCHER_JOB_NAME = "trends-watcher";
const TRENDS_KEY = "TRENDS_REPORT";

export function defineTrendsWatcherJob(agenda: Agenda, io?: any) {
    agenda.define(TRENDS_WATCHER_JOB_NAME, async (_job: Job) => {
        console.log("[trends] Recogiendo señales de tendencias...");
        const report = await fetchTrendsReport();

        // Persist to Settings so the frontend can read it
        await Settings.findOneAndUpdate(
            { key: TRENDS_KEY },
            { key: TRENDS_KEY, value: JSON.stringify(report) },
            { upsert: true }
        );

        io?.emit("trends:updated", { nicheMatches: report.nicheMatches.length, total: report.signals.length });

        // Telegram if there are KDP-relevant signals
        if (report.nicheMatches.length > 0 && await shouldNotify("trends.daily")) {
            const lines = [
                `📈 <b>Tendencias del día — ${report.nicheMatches.length} señales KDP</b>`,
                "",
                ...report.nicheMatches.slice(0, 8).map(m => `• ${m}`),
            ];
            if (report.nicheMatches.length > 8) lines.push(`…y ${report.nicheMatches.length - 8} más`);
            await sendTelegram(lines.join("\n"));
        }

        console.log(`[trends] ${report.signals.length} señales, ${report.nicheMatches.length} matches KDP`);
        return true;
    });
}

export async function scheduleTrendsWatcher(agenda: Agenda): Promise<void> {
    // Diario a las 7:30 — antes del lifecycle (9:15) para que los datos estén frescos
    await agenda.every("30 7 * * *", TRENDS_WATCHER_JOB_NAME);
}
