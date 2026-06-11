import type { Agenda, Job } from "agenda";
import { checkLifecycleAlerts } from "../lib/lifecycle.js";

export const LIFECYCLE_ALERTS_JOB_NAME = "lifecycle-alerts";

export function defineLifecycleAlertsJob(agenda: Agenda, io?: any) {
    agenda.define(LIFECYCLE_ALERTS_JOB_NAME, async (_job: Job) => {
        const { alerted } = await checkLifecycleAlerts(io);
        if (alerted > 0) console.log(`[lifecycle] ${alerted} hitos/avisos enviados`);
        return true;
    });
}

export async function scheduleLifecycleAlerts(agenda: Agenda): Promise<void> {
    // Diario a las 9:15 — después del SEO tracker de los lunes
    await agenda.every("15 9 * * *", LIFECYCLE_ALERTS_JOB_NAME);
}
