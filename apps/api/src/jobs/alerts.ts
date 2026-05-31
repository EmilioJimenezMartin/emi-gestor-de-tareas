import type { Agenda, Job } from "agenda";
import { Niche } from "../models/niche.js";
import { Catalog } from "../models/catalog.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";
import { Settings } from "../models/settings.js";

export const ALERTS_JOB_NAME = "pipeline-alerts";

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // max once per 24 h per item

async function getHours(key: string, defaultHours: number): Promise<number> {
    try {
        const row = await Settings.findOne({ key }).lean();
        const v = parseFloat((row as any)?.value ?? "");
        return isFinite(v) && v > 0 ? v : defaultHours;
    } catch { return defaultHours; }
}

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
    const d = Math.floor(ms / 86_400_000);
    if (d > 0) return `${d}d ${h % 24}h`;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ""}` : `${m}min`;
}

export function defineAlertsJob(agenda: Agenda, _io: any) {
    agenda.define(ALERTS_JOB_NAME, async (_job: Job) => {
        const now = Date.now();

        // ── Niches stuck in pipeline phases ─────────────────────────────────────
        if (await shouldNotify("alert.stuck_pipeline")) {
            const hours = await getHours("ALERT_STUCK_PIPELINE_HOURS", 168); // default 1 week
            const cutoff = new Date(now - hours * 3_600_000);
            const stuckNiches = await Niche.find({
                status: "active",
                autoPilotEnabled: true,
                phase: { $in: ["catalog", "libro", "seo", "cover"] },
                updatedAt: { $lt: cutoff },
            }).lean();

            if (stuckNiches.length > 0) {
                const lastSent = await getLastSent("ALERT_STUCK_PIPELINE_LAST_SENT");
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

                    for (const n of toNotify) lastSent[String((n as any)._id)] = now;
                    await saveLastSent("ALERT_STUCK_PIPELINE_LAST_SENT", lastSent);
                }
            }
        }

        // ── Running catalogs with no image progress ──────────────────────────────
        if (await shouldNotify("alert.stuck_catalog")) {
            const hours = await getHours("ALERT_STUCK_CATALOG_HOURS", 168); // default 1 week
            const cutoff = new Date(now - hours * 3_600_000);
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
    await agenda.cancel({ name: ALERTS_JOB_NAME }).catch(() => {});
    await agenda.every("30 minutes", ALERTS_JOB_NAME);
}
