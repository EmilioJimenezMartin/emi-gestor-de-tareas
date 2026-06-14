import type { Agenda, Job } from "agenda";
import { defineCatalogJob } from "./catalog.js";
import { defineRadarJob } from "./radar.js";
import { definePatternGenJob } from "./pattern-generation.js";
import { defineAutoPilotJob, AUTOPILOT_JOB_NAME } from "./autopilot.js";
import { defineCatalogWatchdog, scheduleWatchdog } from "./catalog-watchdog.js";
import { defineRadarScheduleJob, RADAR_SCHEDULE_JOB_NAME } from "./radar-schedule.js";
import { defineKdpPublisherJob, KDP_PUBLISHER_JOB_NAME } from "./kdp-publisher.js";
import { defineAlertsJob, scheduleAlerts, ALERTS_JOB_NAME } from "./alerts.js";
import { defineWeeklyDigestJob, scheduleWeeklyDigest, WEEKLY_DIGEST_JOB_NAME } from "./weekly-digest.js";
import { defineSeasonalCheckJob, scheduleSeasonalCheck, SEASONAL_CHECK_JOB_NAME } from "./seasonal-check.js";
import { defineSeoTrackerJob, scheduleSeoTracker, SEO_TRACKER_JOB_NAME } from "./seo-tracker.js";
import { defineLifecycleAlertsJob, scheduleLifecycleAlerts, LIFECYCLE_ALERTS_JOB_NAME } from "./lifecycle-alerts.js";
import { defineTrendsWatcherJob, scheduleTrendsWatcher, TRENDS_WATCHER_JOB_NAME } from "./trends-watcher.js";
import { defineStorageCleanupJob, scheduleStorageCleanup, STORAGE_CLEANUP_JOB_NAME } from "./storage-cleanup.js";
import { defineCalendarAlertsJob, scheduleCalendarAlerts, CALENDAR_ALERTS_JOB_NAME } from "./calendar-alerts.js";
export { AUTOPILOT_JOB_NAME, KDP_PUBLISHER_JOB_NAME, ALERTS_JOB_NAME, WEEKLY_DIGEST_JOB_NAME, SEASONAL_CHECK_JOB_NAME, SEO_TRACKER_JOB_NAME, LIFECYCLE_ALERTS_JOB_NAME, TRENDS_WATCHER_JOB_NAME, STORAGE_CLEANUP_JOB_NAME, CALENDAR_ALERTS_JOB_NAME };

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
        defineKdpPublisherJob(agenda, io);
        defineAlertsJob(agenda, io);
        defineWeeklyDigestJob(agenda, io);
        defineSeasonalCheckJob(agenda, io);
        defineSeoTrackerJob(agenda, io);
        defineLifecycleAlertsJob(agenda, io);
        defineTrendsWatcherJob(agenda, io);
        defineStorageCleanupJob(agenda, io);
        defineCalendarAlertsJob(agenda);
    }
}

export async function scheduleRadarRules(agenda: Agenda): Promise<void> {
    // Fires at minute 0 of every hour — the job itself checks which rules match
    await agenda.cancel({ name: RADAR_SCHEDULE_JOB_NAME }).catch(() => {});
    await agenda.every("0 * * * *", RADAR_SCHEDULE_JOB_NAME);
}

export { scheduleWatchdog, scheduleAlerts, scheduleWeeklyDigest, scheduleSeasonalCheck, scheduleSeoTracker, scheduleLifecycleAlerts, scheduleTrendsWatcher, scheduleStorageCleanup, scheduleCalendarAlerts };
