import type { Agenda, Job } from "agenda";
import { Catalog } from "../models/catalog.js";
import { activateNextQueued } from "../lib/catalog-queue.js";

const JOB_NAME = "catalog-watchdog";
const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes without progress = stuck

export function defineCatalogWatchdog(agenda: Agenda, io: any) {
    agenda.define(JOB_NAME, async (_job: Job) => {
        const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

        // Find running catalogs that haven't been updated in >15 min
        const stuck = await Catalog.find({
            status: "running",
            updatedAt: { $lt: cutoff },
        }).lean();

        if (stuck.length === 0) return;

        console.log(`[watchdog] Found ${stuck.length} stuck catalog(s), force-skipping current slot`);

        for (const catalog of stuck) {
            const catalogId = String(catalog._id);
            try {
                const fresh = await Catalog.findById(catalogId);
                if (!fresh || fresh.status !== "running") continue;

                fresh.skippedImages = (fresh.skippedImages ?? 0) + 1;
                const attempted = fresh.images.length + fresh.skippedImages;
                const isComplete = attempted >= fresh.totalImages;
                fresh.status = isComplete ? "completed" : "running";
                fresh.lastError = `Watchdog: slot omitido automáticamente (sin actividad en ${STUCK_THRESHOLD_MS / 60000} min)`;
                await fresh.save();

                console.log(`[watchdog] Catalog ${catalogId} "${fresh.name}" — skipped slot, complete=${isComplete}`);

                io?.emit("catalog:progress", {
                    catalogId,
                    status: fresh.status,
                    current: fresh.images.length,
                    total: fresh.totalImages,
                    skipped: fresh.skippedImages,
                    lastError: fresh.lastError,
                });

                if (isComplete) {
                    io?.emit("catalog:completed", { catalogId });
                    await activateNextQueued(agenda, io);
                } else {
                    await agenda.schedule("in 5 seconds", "generate-catalog-image", { catalogId });
                }
            } catch (e: any) {
                console.error(`[watchdog] Error processing ${catalogId}: ${e?.message}`);
            }
        }
    });
}

export async function scheduleWatchdog(agenda: Agenda): Promise<void> {
    await agenda.every("10 minutes", JOB_NAME);
}
