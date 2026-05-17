import type { Agenda } from "agenda";
import { Catalog } from "../models/catalog.js";

const JOB_NAME = "generate-catalog-image";
const QUEUE_COOLDOWN = "in 2 minutes";

/**
 * Atomically picks the oldest queued catalog, marks it "running", emits a
 * socket event so the frontend reacts immediately, then schedules its first
 * image job after QUEUE_COOLDOWN.
 *
 * Using findOneAndUpdate with the { status: "queued" } filter is the race-
 * condition guard: even if two concurrent callers race (cancel + complete at
 * the same moment), only one will find and claim the document.
 */
export async function activateNextQueued(agenda: Agenda, io: any): Promise<void> {
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
