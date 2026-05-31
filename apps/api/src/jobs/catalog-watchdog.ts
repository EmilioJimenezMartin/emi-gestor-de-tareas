import type { Agenda, Job } from "agenda";
import { Catalog } from "../models/catalog.js";
import { activateNextQueued } from "../lib/catalog-queue.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";

const JOB_NAME = "catalog-watchdog";
const STUCK_THRESHOLD_MS = 10 * 60 * 1000;    // 10 min without progress = stuck (force-skip slot)
const SMART_STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2h stuck = smart retry with simplified prompt
const FAILED_RESTART_WINDOW_MS = 60 * 60 * 1000; // restart failed catalogs within last 1 hour
const MAX_AUTO_RESTARTS = 5; // increased from 3 — allow more retries with escalating strategies

// FALLBACK_MODELS: try in order when a catalog keeps failing
const FALLBACK_MODELS = [
    { id: "pollinations-flux", modelId: "flux" },
    { id: "pollinations-flux-realism", modelId: "flux-realism" },
];

function simplifyPrompt(prompt: string): string {
    return prompt
        .replace(/[^a-zA-Z0-9\s,.\-éáíóúüñÉÁÍÓÚÜÑ]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(/\s+/)
        .slice(0, 20)
        .join(" ");
}

function getRetryStrategy(restartCount: number, originalPrompt: string, originalModel: any): {
    overridePrompt?: string;
    overrideModel?: { id: string; modelId: string; name: string; provider: string };
} {
    if (restartCount === 0) return {}; // first retry: same prompt, same model
    if (restartCount === 1) return { overridePrompt: simplifyPrompt(originalPrompt) }; // simplify prompt
    if (restartCount === 2) {
        // simplified prompt + fallback model 1
        const fallback = FALLBACK_MODELS[0];
        return {
            overridePrompt: simplifyPrompt(originalPrompt),
            overrideModel: { ...fallback, name: "FLUX (Pollinations)", provider: "Pollinations" },
        };
    }
    if (restartCount >= 3) {
        // ultra-simplified prompt + fallback model 2
        const fallback = FALLBACK_MODELS[1] ?? FALLBACK_MODELS[0];
        const ultraSimple = simplifyPrompt(originalPrompt).split(" ").slice(0, 10).join(" ");
        return {
            overridePrompt: ultraSimple,
            overrideModel: { ...fallback, name: "FLUX Realism (Pollinations)", provider: "Pollinations" },
        };
    }
    return {};
}

export function defineCatalogWatchdog(agenda: Agenda, io: any) {
    agenda.define(JOB_NAME, async (_job: Job) => {
        const now = new Date();
        const stuckCutoff = new Date(now.getTime() - STUCK_THRESHOLD_MS);
        const smartStuckCutoff = new Date(now.getTime() - SMART_STUCK_THRESHOLD_MS);

        // ── 1. Stuck running catalogs: force-skip current slot ──────────────────
        const stuck = await Catalog.find({
            status: "running",
            updatedAt: { $lt: stuckCutoff },
        }).lean();

        if (stuck.length > 0) {
            console.log(`[watchdog] Found ${stuck.length} stuck catalog(s), force-skipping current slot`);
        }

        for (const catalog of stuck) {
            const catalogId = String(catalog._id);
            try {
                const fresh = await Catalog.findById(catalogId);
                if (!fresh || fresh.status !== "running") continue;

                // If stuck for very long (2h+), use smart retry instead of just skipping
                const isLongStuck = (catalog as any).updatedAt < smartStuckCutoff;
                if (isLongStuck) {
                    const restartCount = (fresh.retries ?? 0);
                    if (restartCount < MAX_AUTO_RESTARTS) {
                        const strategy = getRetryStrategy(restartCount, (catalog as any).overridePrompt || (catalog as any).prompt || "", (catalog as any).aiModel);
                        const strategyDesc = restartCount === 0 ? "mismo prompt" : restartCount === 1 ? "prompt simplificado" : restartCount <= 2 ? "prompt simplificado + modelo alternativo" : "prompt mínimo + modelo alternativo";

                        await Catalog.findByIdAndUpdate(catalogId, {
                            status: "running",
                            retries: restartCount + 1,
                            lastError: `Watchdog smart-retry ${restartCount + 1}/${MAX_AUTO_RESTARTS}: ${strategyDesc}`,
                        });
                        io?.emit("catalog:progress", {
                            catalogId,
                            status: "running",
                            current: fresh.images.length,
                            total: fresh.totalImages,
                            skipped: fresh.skippedImages ?? 0,
                            lastError: null,
                        });

                        const jobData: any = { catalogId, retryCount: restartCount + 1 };
                        if (strategy.overridePrompt) jobData.overridePrompt = strategy.overridePrompt;
                        if (strategy.overrideModel) jobData.overrideModel = strategy.overrideModel;
                        await agenda.schedule("in 15 seconds", "generate-catalog-image", jobData);

                        console.log(`[watchdog] Smart-retry catalog ${catalogId} (restart ${restartCount + 1}/${MAX_AUTO_RESTARTS}) — ${strategyDesc}`);
                        await shouldNotify("watchdog.restart").then(ok => {
                            if (ok) sendTelegram(`🔄 <b>Watchdog smart-retry</b>\n"${fresh.name}" (${strategyDesc}) — intento ${restartCount + 1}/${MAX_AUTO_RESTARTS}`).catch(() => {});
                        });
                        continue;
                    }
                    // Max retries hit — cancel and alert
                    fresh.status = "cancelled";
                    fresh.lastError = `Watchdog: cancelado tras ${MAX_AUTO_RESTARTS} reintentos sin éxito`;
                    await fresh.save();
                    io?.emit("catalog:progress", { catalogId, status: "cancelled", current: fresh.images.length, total: fresh.totalImages, skipped: fresh.skippedImages ?? 0, lastError: fresh.lastError });
                    io?.emit("catalog:completed", { catalogId });
                    void activateNextQueued(agenda, io);
                    await shouldNotify("watchdog.restart").then(ok => {
                        if (ok) sendTelegram(`⛔ <b>Catálogo cancelado</b>\n"${fresh.name}" — ${MAX_AUTO_RESTARTS} reintentos fallidos. Libera el slot.`).catch(() => {});
                    });
                    console.log(`[watchdog] Catalog ${catalogId} cancelled after ${MAX_AUTO_RESTARTS} restarts`);
                    continue;
                }

                // Short stuck: just skip the current slot
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

        // ── 2. Queued catalogs stuck (never started) — activate them ───────────
        const queuedStuckCutoff = new Date(now.getTime() - 30 * 60 * 1000); // queued for 30min+
        const stuckQueued = await Catalog.find({
            status: "queued",
            updatedAt: { $lt: queuedStuckCutoff },
        }).lean();

        for (const catalog of stuckQueued) {
            const catalogId = String(catalog._id);
            try {
                // Check no job is already scheduled
                const pending = await (agenda as any).jobs({
                    name: "generate-catalog-image",
                    "data.catalogId": catalogId,
                    nextRunAt: { $ne: null },
                });
                if (pending.length > 0) continue;

                console.log(`[watchdog] Activating stuck queued catalog ${catalogId} "${(catalog as any).name}"`);
                await Catalog.findByIdAndUpdate(catalogId, { status: "running" });
                io?.emit("catalog:progress", { catalogId, status: "running", current: (catalog as any).images?.length ?? 0, total: (catalog as any).totalImages, skipped: (catalog as any).skippedImages ?? 0, lastError: null });
                await agenda.schedule("in 10 seconds", "generate-catalog-image", { catalogId });
            } catch (e: any) {
                console.error(`[watchdog] Error activating queued ${catalogId}: ${e?.message}`);
            }
        }

        // ── 3. Failed catalogs with pending images: smart restart ───────────────
        const failedCutoff = new Date(now.getTime() - FAILED_RESTART_WINDOW_MS);
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

            const strategy = getRetryStrategy(restartCount, (catalog as any).overridePrompt || (catalog as any).prompt || "", (catalog as any).aiModel);
            const strategyDesc = restartCount === 0 ? "mismo prompt" : restartCount === 1 ? "prompt simplificado" : restartCount <= 2 ? "prompt simplificado + modelo alternativo" : "prompt mínimo + modelo alternativo";

            console.log(`[watchdog] Smart-restarting failed catalog ${catalogId} "${(catalog as any).name}" (restart ${restartCount + 1}/${MAX_AUTO_RESTARTS}) — ${strategyDesc}`);

            await Catalog.findByIdAndUpdate(catalogId, {
                status: "running",
                lastError: `Smart-restart ${restartCount + 1}/${MAX_AUTO_RESTARTS}: ${strategyDesc}`,
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

            const jobData: any = { catalogId, retryCount: restartCount + 1 };
            if (strategy.overridePrompt) jobData.overridePrompt = strategy.overridePrompt;
            if (strategy.overrideModel) jobData.overrideModel = strategy.overrideModel;
            await agenda.schedule("in 10 seconds", "generate-catalog-image", jobData);

            await shouldNotify("watchdog.restart").then(ok => {
                if (ok) sendTelegram(`🔄 <b>Catálogo reiniciado</b>\n"${(catalog as any).name}" — ${strategyDesc} (intento ${restartCount + 1}/${MAX_AUTO_RESTARTS})`).catch(() => {});
            });
        }
    });
}

export async function scheduleWatchdog(agenda: Agenda): Promise<void> {
    await agenda.cancel({ name: JOB_NAME }).catch(() => {});
    await agenda.every("10 minutes", JOB_NAME);
}
