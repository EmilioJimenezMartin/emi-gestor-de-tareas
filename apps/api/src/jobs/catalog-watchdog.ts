import type { Agenda, Job } from "agenda";
import { Catalog } from "../models/catalog.js";
import { activateNextQueued } from "../lib/catalog-queue.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";

const JOB_NAME = "catalog-watchdog";
const STUCK_THRESHOLD_MS = 10 * 60 * 1000;   // 10 min without progress = stuck
const FAILED_RESTART_WINDOW_MS = 60 * 60 * 1000; // restart failed catalogs within last 1 hour
const MAX_AUTO_RESTARTS = 3;

export function defineCatalogWatchdog(agenda: Agenda, io: any) {
    agenda.define(JOB_NAME, async (_job: Job) => {
        const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

        // ── 1. Stuck running catalogs: force-skip current slot ──────────────────
        const stuck = await Catalog.find({
            status: "running",
            updatedAt: { $lt: cutoff },
        }).lean();

        if (stuck.length > 0) {
            console.log(`[watchdog] Found ${stuck.length} stuck catalog(s), force-skipping current slot`);
        }

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
                console.error(`[watchdog] Error processing stuck ${catalogId}: ${e?.message}`);
            }
        }

        // ── 2. Failed catalogs with pending images: auto-restart ────────────────
        const failedCutoff = new Date(Date.now() - FAILED_RESTART_WINDOW_MS);
        const failed = await Catalog.find({
            status: "failed",
            updatedAt: { $gt: failedCutoff },
        }).lean();

        for (const catalog of failed) {
            const catalogId = String(catalog._id);
            const attempted = (catalog as any).images?.length + ((catalog as any).skippedImages ?? 0);
            if (attempted >= (catalog as any).totalImages) continue; // already done

            const restartCount = (catalog as any).retries ?? 0;
            if (restartCount >= MAX_AUTO_RESTARTS) {
                console.log(`[watchdog] Catalog ${catalogId} hit max restarts (${MAX_AUTO_RESTARTS}) — skipping`);
                continue;
            }

            // Check if a job is already scheduled
            try {
                const pending = await (agenda as any).jobs({
                    name: "generate-catalog-image",
                    "data.catalogId": catalogId,
                    nextRunAt: { $ne: null },
                });
                if (pending.length > 0) continue;
            } catch { /* if query fails, attempt restart anyway */ }

            console.log(`[watchdog] Auto-restarting failed catalog ${catalogId} "${(catalog as any).name}" (restart ${restartCount + 1}/${MAX_AUTO_RESTARTS})`);
            await Catalog.findByIdAndUpdate(catalogId, {
                status: "running",
                lastError: `Auto-restart ${restartCount + 1}/${MAX_AUTO_RESTARTS} por watchdog`,
                retries: restartCount + 1,
            });
            io?.emit("catalog:progress", {
                catalogId,
                status: "running",
                current: (catalog as any).images?.length ?? 0,
                total: (catalog as any).totalImages,
                skipped: (catalog as any).skippedImages ?? 0,
                lastError: null,
            });
            await agenda.schedule("in 10 seconds", "generate-catalog-image", { catalogId });

            await shouldNotify("watchdog.restart").then(ok => {
                if (ok) sendTelegram(`🔄 <b>Catálogo reiniciado</b>\n"${(catalog as any).name}" — intento ${restartCount + 1}/${MAX_AUTO_RESTARTS}`).catch(() => {});
            });
        }
    });
}

export async function scheduleWatchdog(agenda: Agenda): Promise<void> {
    await agenda.cancel({ name: JOB_NAME }).catch(() => {});
    await agenda.every("10 minutes", JOB_NAME);
}
