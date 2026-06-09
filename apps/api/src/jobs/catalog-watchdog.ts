import type { Agenda, Job } from "agenda";
import { Catalog } from "../models/catalog.js";

const _SERVER_API_KEY = process.env.SERVER_API_KEY || "";
function internalFetch(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...init, headers: { ...(_SERVER_API_KEY ? { Authorization: `Bearer ${_SERVER_API_KEY}` } : {}), ...(init.headers as Record<string, string> ?? {}) } });
}
import { activateNextQueued } from "../lib/catalog-queue.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";

async function triggerAutoPilotContinue(agenda: Agenda, catalogId: string, nicheIds: string[], io: any): Promise<void> {
    if (!nicheIds.length) return;
    try {
        const { Niche } = await import("../models/niche.js");
        for (const nicheId of nicheIds) {
            const niche = await Niche.findById(nicheId).lean();
            if (!(niche as any)?.autoPilotEnabled || (niche as any).phase !== "catalog") continue;
            const allCats = await Catalog.find({ nicheIds: nicheId }).lean();
            if (!allCats.length) continue;
            const allDone = allCats.every(
                (c: any) => c.status === "completed" || c.status === "cancelled" || c.status === "failed"
            );
            if (!allDone) continue;

            const allImages: string[] = [];
            for (const cat of allCats) {
                for (const img of (cat as any).images ?? []) {
                    if (img.url) allImages.push(img.url as string);
                }
            }
            for (let i = allImages.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allImages[i], allImages[j]] = [allImages[j], allImages[i]];
            }
            await Niche.findByIdAndUpdate(nicheId, { $set: { phase: "libro", catalogImageOrder: allImages } });
            io?.emit("niches:updated");
            io?.emit("autopilot:log", { nicheId, message: `✅ [Watchdog] ${allImages.length} imágenes listas → generando libro PDF` });
            console.log(`[watchdog] checkAutoPilotContinue: niche ${nicheId} advanced to libro, ${allImages.length} images`);

            let scheduled = false;
            try { await agenda.schedule("in 5 seconds", "autopilot-run", {}); scheduled = true; } catch { /* fallback below */ }
            if (!scheduled) {
                const port = process.env.PORT || 3001;
                void internalFetch(`http://localhost:${port}/autopilot/run`, { method: "POST" }).catch(() => {});
            }
            break;
        }
    } catch (e: any) {
        console.error(`[watchdog] triggerAutoPilotContinue failed for catalog ${catalogId}:`, e?.message);
    }
}

const JOB_NAME = "catalog-watchdog";
const STUCK_THRESHOLD_MS = 10 * 60 * 1000;    // 10 min without progress = stuck (force-skip slot)
const SMART_STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2h stuck = smart retry with simplified prompt
const MAX_AUTO_RESTARTS = 2; // max retries for stuck-running catalogs before cancellation

// FALLBACK_MODELS: try in order when a catalog keeps failing (Pollinations is IP-blocked)
const FALLBACK_MODELS = [
    { id: "hf-flux-schnell", modelId: "black-forest-labs/FLUX.1-schnell", provider: "Hugging Face", name: "FLUX.1-schnell (HF)" },
    { id: "hf-flux-dev", modelId: "black-forest-labs/FLUX.1-dev", provider: "Hugging Face", name: "FLUX.1-dev (HF)" },
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
        const fallback = FALLBACK_MODELS[0];
        return {
            overridePrompt: simplifyPrompt(originalPrompt),
            overrideModel: { id: fallback.id, modelId: fallback.modelId, name: fallback.name, provider: fallback.provider },
        };
    }
    if (restartCount >= 3) {
        const fallback = FALLBACK_MODELS[1] ?? FALLBACK_MODELS[0];
        const ultraSimple = simplifyPrompt(originalPrompt).split(" ").slice(0, 10).join(" ");
        return {
            overridePrompt: ultraSimple,
            overrideModel: { id: fallback.id, modelId: fallback.modelId, name: fallback.name, provider: fallback.provider },
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
                    void triggerAutoPilotContinue(agenda, catalogId, fresh.nicheIds ?? [], io);
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
                    void triggerAutoPilotContinue(agenda, catalogId, fresh.nicheIds ?? [], io);
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

        const MAX_QUEUE_REACTIVATIONS = 3;
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

                const reactivations = (catalog as any).retries ?? 0;
                if (reactivations >= MAX_QUEUE_REACTIVATIONS) {
                    await Catalog.findByIdAndUpdate(catalogId, {
                        status: "cancelled",
                        lastError: `Watchdog: cancelado tras ${MAX_QUEUE_REACTIVATIONS} reactivaciones sin éxito en estado queued`,
                    });
                    io?.emit("catalog:progress", { catalogId, status: "cancelled", current: 0, total: (catalog as any).totalImages, skipped: 0, lastError: "Watchdog: cancelado" });
                    io?.emit("catalog:completed", { catalogId });
                    console.warn(`[watchdog] Catalog ${catalogId} "${(catalog as any).name}" cancelled — ${MAX_QUEUE_REACTIVATIONS} queue reactivations exhausted`);
                    sendTelegram(`⛔ <b>Catálogo cancelado</b>\n"${(catalog as any).name}" — ${MAX_QUEUE_REACTIVATIONS} intentos de activación fallidos`).catch(() => {});
                    continue;
                }

                console.log(`[watchdog] Activating stuck queued catalog ${catalogId} "${(catalog as any).name}" (reactivation ${reactivations + 1}/${MAX_QUEUE_REACTIVATIONS})`);
                await Catalog.findByIdAndUpdate(catalogId, { status: "running", $inc: { retries: 1 } });
                io?.emit("catalog:progress", { catalogId, status: "running", current: (catalog as any).images?.length ?? 0, total: (catalog as any).totalImages, skipped: (catalog as any).skippedImages ?? 0, lastError: null });
                await agenda.schedule("in 10 seconds", "generate-catalog-image", { catalogId });
            } catch (e: any) {
                console.error(`[watchdog] Error activating queued ${catalogId}: ${e?.message}`);
            }
        }

        // ── 3. Niches stuck in "catalog" phase with all catalogs terminal ────────
        // Safety net: if checkAutoPilotContinue or autopilot-run polling missed the transition,
        // force-advance here so the pipeline never stalls indefinitely.
        try {
            const { Niche } = await import("../models/niche.js");
            const catalogPhaseNiches = await Niche.find({
                autoPilotEnabled: true,
                status: "active",
                phase: "catalog",
            }).lean();

            for (const niche of catalogPhaseNiches) {
                const nicheId = String(niche._id);
                const allCats = await Catalog.find({ nicheIds: nicheId }).lean();
                if (!allCats.length) continue;
                const allDone = allCats.every(
                    (c: any) => c.status === "completed" || c.status === "cancelled" || c.status === "failed"
                );
                if (!allDone) continue;

                console.log(`[watchdog] Niche ${nicheId} "${(niche as any).name}" stuck in catalog phase — all ${allCats.length} catalogs terminal, forcing libro transition`);
                void triggerAutoPilotContinue(agenda, "", [nicheId], io);
            }
        } catch (e: any) {
            console.error(`[watchdog] Error in catalog-phase safety net: ${e?.message}`);
        }
    });
}

export async function scheduleWatchdog(agenda: Agenda): Promise<void> {
    await agenda.cancel({ name: JOB_NAME }).catch(() => {});
    await agenda.every("10 minutes", JOB_NAME);
}
