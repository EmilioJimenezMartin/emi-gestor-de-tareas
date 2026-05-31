import type { Agenda, Job } from "agenda";
import { Niche } from "../models/niche.js";
import { Catalog } from "../models/catalog.js";
import { sendTelegram } from "../lib/telegram.js";
import { Settings } from "../models/settings.js";

export const ALERTS_JOB_NAME = "pipeline-alerts";

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h

interface AlertSettings {
    stuckPipelineEnabled: boolean;
    stuckPipelineHours: number;
    stuckCatalogEnabled: boolean;
    stuckCatalogHours: number;
}

async function getAlertSettings(): Promise<AlertSettings> {
    try {
        const rows = await Settings.find({
            key: { $in: [
                "ALERT_STUCK_PIPELINE_ENABLED",
                "ALERT_STUCK_PIPELINE_HOURS",
                "ALERT_STUCK_CATALOG_ENABLED",
                "ALERT_STUCK_CATALOG_HOURS",
            ] }
        }).lean();
        const map = new Map((rows as any[]).map(r => [r.key, String(r.value)]));
        return {
            stuckPipelineEnabled: (map.get("ALERT_STUCK_PIPELINE_ENABLED") ?? "true") !== "false",
            stuckPipelineHours: parseFloat(map.get("ALERT_STUCK_PIPELINE_HOURS") ?? "4") || 4,
            stuckCatalogEnabled: (map.get("ALERT_STUCK_CATALOG_ENABLED") ?? "true") !== "false",
            stuckCatalogHours: parseFloat(map.get("ALERT_STUCK_CATALOG_HOURS") ?? "2") || 2,
        };
    } catch {
        return { stuckPipelineEnabled: true, stuckPipelineHours: 4, stuckCatalogEnabled: true, stuckCatalogHours: 2 };
    }
}

// Returns a map of id → last-sent ms (0 if never sent)
async function getLastSent(key: string): Promise<Record<string, number>> {
    try {
        const row = await Settings.findOne({ key }).lean();
        if (!row?.value) return {};
        return JSON.parse(row.value as string) as Record<string, number>;
    } catch { return {}; }
}

async function saveLastSent(key: string, map: Record<string, number>): Promise<void> {
    await Settings.findOneAndUpdate(
        { key },
        { key, value: JSON.stringify(map) },
        { upsert: true }
    );
}

function fmtHours(ms: number): string {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ""}` : `${m}min`;
}

export function defineAlertsJob(agenda: Agenda, _io: any) {
    agenda.define(ALERTS_JOB_NAME, async (_job: Job) => {
        const cfg = await getAlertSettings();
        const now = Date.now();

        // ── Niches stuck in pipeline phases ─────────────────────────────────────
        if (cfg.stuckPipelineEnabled) {
            const cutoff = new Date(now - cfg.stuckPipelineHours * 3_600_000);
            const stuckNiches = await Niche.find({
                status: "active",
                autoPilotEnabled: true,
                phase: { $in: ["catalog", "libro", "seo", "cover"] },
                updatedAt: { $lt: cutoff },
            }).lean();

            if (stuckNiches.length > 0) {
                const lastSent = await getLastSent("ALERT_STUCK_PIPELINE_LAST_SENT");
                // Only include niches whose alert hasn't been sent in the last 24h
                const toNotify = stuckNiches.filter(n => {
                    const id = String((n as any)._id);
                    return !lastSent[id] || now - lastSent[id] > COOLDOWN_MS;
                });

                if (toNotify.length > 0) {
                    const lines = toNotify.map(n => {
                        const elapsed = fmtHours(now - new Date((n as any).updatedAt).getTime());
                        return `• <b>${(n as any).name}</b> — fase ${(n as any).phase} (${elapsed} sin actividad)`;
                    }).join("\n");
                    await sendTelegram(
                        `⚠️ <b>Autopilot atascado (${toNotify.length} nicho${toNotify.length > 1 ? "s" : ""})</b>\n\n${lines}\n\n` +
                        `Comprueba con /estado o revisa el dashboard.`
                    ).catch(() => {});

                    // Record sent time for each notified niche
                    for (const n of toNotify) lastSent[String((n as any)._id)] = now;
                    await saveLastSent("ALERT_STUCK_PIPELINE_LAST_SENT", lastSent);
                }
            }
        }

        // ── Running catalogs with no image progress ──────────────────────────────
        if (cfg.stuckCatalogEnabled) {
            const cutoff = new Date(now - cfg.stuckCatalogHours * 3_600_000);
            const stuckCatalogs = await Catalog.find({
                status: "running",
                updatedAt: { $lt: cutoff },
            }).lean();

            if (stuckCatalogs.length > 0) {
                const lastSent = await getLastSent("ALERT_STUCK_CATALOG_LAST_SENT");
                const toNotify = stuckCatalogs.filter(c => {
                    const id = String((c as any)._id);
                    return !lastSent[id] || now - lastSent[id] > COOLDOWN_MS;
                });

                if (toNotify.length > 0) {
                    const lines = toNotify.map(c => {
                        const elapsed = fmtHours(now - new Date((c as any).updatedAt).getTime());
                        return `• "${(c as any).name}" — ${(c as any).images?.length ?? 0}/${(c as any).totalImages} imgs (${elapsed})`;
                    }).join("\n");
                    await sendTelegram(
                        `🔴 <b>Catálogos atascados (${toNotify.length})</b>\n\n${lines}\n\n` +
                        `El watchdog intentará recuperarlos automáticamente.`
                    ).catch(() => {});

                    for (const c of toNotify) lastSent[String((c as any)._id)] = now;
                    await saveLastSent("ALERT_STUCK_CATALOG_LAST_SENT", lastSent);
                }
            }
        }
    });
}

export async function scheduleAlerts(agenda: Agenda): Promise<void> {
    // Cancel duplicates created by previous restarts before re-registering
    await agenda.cancel({ name: ALERTS_JOB_NAME }).catch(() => {});
    await agenda.every("30 minutes", ALERTS_JOB_NAME);
}
