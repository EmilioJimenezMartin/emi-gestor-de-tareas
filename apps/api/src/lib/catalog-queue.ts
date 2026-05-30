import type { Agenda } from "agenda";
import { Catalog } from "../models/catalog.js";
import { Settings } from "../models/settings.js";

const JOB_NAME = "generate-catalog-image";
const QUEUE_COOLDOWN = "in 2 minutes";
const DEFAULT_MAX_ACTIVE = 1; // global AI semaphore serializes calls; 1 active catalog avoids Agenda lock races

async function getMaxActiveCatalogs(): Promise<number> {
    try {
        const row = await Settings.findOne({ key: "MAX_ACTIVE_CATALOGS" }).lean();
        const val = parseInt((row as any)?.value ?? "");
        return isNaN(val) || val < 1 ? DEFAULT_MAX_ACTIVE : val;
    } catch {
        return DEFAULT_MAX_ACTIVE;
    }
}

/**
 * Atomically picks the oldest queued catalog, marks it "running", emits a
 * socket event so the frontend reacts immediately, then schedules its first
 * image job after QUEUE_COOLDOWN.
 *
 * Respects MAX_ACTIVE_CATALOGS setting — if the limit is reached, no new
 * catalog is activated until a running one completes or is cancelled.
 */
export async function activateNextQueued(agenda: Agenda, io: any): Promise<void> {
    const maxActive = await getMaxActiveCatalogs();
    const activeCount = await Catalog.countDocuments({ status: { $in: ["running", "pending"] } });
    if (activeCount >= maxActive) {
        console.log(`[catalog-queue] Active=${activeCount}/${maxActive} — holding queue`);
        return;
    }

    const next = await Catalog.findOneAndUpdate(
        { status: "queued" },
        { $set: { status: "running" } },
        { new: true, sort: { queueOrder: 1, createdAt: 1 } }
    );

    if (!next) {
        console.log("[catalog-queue] No queued catalogs waiting");
        return;
    }

    const catalogId = String(next._id);
    console.log(`[catalog-queue] Activating ${catalogId} "${next.name}" — first image ${QUEUE_COOLDOWN}`);

    io.emit("catalog:queue-activated", {
        catalogId,
        status: "running",
        name: next.name,
    });

    try {
        await agenda.schedule(QUEUE_COOLDOWN, JOB_NAME, { catalogId });
    } catch (e: any) {
        console.error(`[catalog-queue] Failed to schedule ${catalogId}: ${e?.message}`);
        await Catalog.findByIdAndUpdate(catalogId, {
            $set: { status: "failed", lastError: "Error al programar desde cola" },
        });
        io.emit("catalog:error", { catalogId, error: "Error al activar desde cola" });
    }
}
