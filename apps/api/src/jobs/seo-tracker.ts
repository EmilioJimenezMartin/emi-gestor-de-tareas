import type { Agenda, Job } from "agenda";
import { trackAllPublishedNiches } from "../lib/seo-tracker.js";

export const SEO_TRACKER_JOB_NAME = "seo-tracker";

export function defineSeoTrackerJob(agenda: Agenda, io?: any) {
    agenda.define(SEO_TRACKER_JOB_NAME, async (_job: Job) => {
        console.log("[seo-tracker] Trackeando posiciones en Amazon de nichos publicados…");
        const results = await trackAllPublishedNiches(io);
        console.log(`[seo-tracker] ${results.length} nichos trackeados, ${results.flatMap(r => r.drops).length} caídas detectadas`);
        io?.emit("seo:track-complete", { tracked: results.length });
        return true;
    });
}

export async function scheduleSeoTracker(agenda: Agenda): Promise<void> {
    // Lunes a las 8:00 — antes del autopilot de las 9:00
    await agenda.every("0 8 * * 1", SEO_TRACKER_JOB_NAME);
}
