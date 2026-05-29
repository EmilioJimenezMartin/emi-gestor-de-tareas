import type { Agenda, Job } from "agenda";
import { defineCatalogJob } from "./catalog.js";
import { defineRadarJob } from "./radar.js";
import { definePatternGenJob } from "./pattern-generation.js";
import { defineAutoPilotJob, AUTOPILOT_JOB_NAME } from "./autopilot.js";
import { defineCatalogWatchdog, scheduleWatchdog } from "./catalog-watchdog.js";
import { defineRadarScheduleJob, RADAR_SCHEDULE_JOB_NAME } from "./radar-schedule.js";
export { AUTOPILOT_JOB_NAME };

export function defineJobs(agenda: Agenda, io?: any) {
    agenda.define("dummy-task", async (job: Job) => {
        const data = (job.attrs.data ?? {}) as { name?: string };
        const name = data.name ?? "anónimo";

        console.log(`\n========================================`);
        console.log(`⚙️ [JOB EXECUTION] Ejecutando 'dummy-task'`);
        console.log(`⏰ [TIMESTAMP] ${new Date().toISOString()}`);
        console.log(`👤 [DATA] Hola ${name}, tu tarea programada ha funcionado correctamente.`);
        console.log(`========================================\n`);

        await new Promise((resolve) => setTimeout(resolve, 2000));
        return true;
    });

    if (io) {
        defineCatalogJob(agenda, io);
        defineRadarJob(agenda, io);
        definePatternGenJob(agenda, io);
        defineAutoPilotJob(agenda, io);
        defineCatalogWatchdog(agenda, io);
        defineRadarScheduleJob(agenda, io);
    }
}

export async function scheduleRadarRules(agenda: Agenda): Promise<void> {
    // Fires at minute 0 of every hour — the job itself checks which rules match
    await agenda.every("0 * * * *", RADAR_SCHEDULE_JOB_NAME);
}

export { scheduleWatchdog };
