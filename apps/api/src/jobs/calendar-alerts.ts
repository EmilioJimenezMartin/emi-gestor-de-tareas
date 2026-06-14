import type { Agenda } from "agenda";
import { Settings } from "../models/settings.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";

export const CALENDAR_ALERTS_JOB_NAME = "calendar-event-alerts";

const STATUS_EMOJI: Record<string, string> = {
    idea: "💡", planned: "📋", inprogress: "🔄", published: "✅",
};

export function defineCalendarAlertsJob(agenda: Agenda): void {
    agenda.define(CALENDAR_ALERTS_JOB_NAME, async () => {
        if (!await shouldNotify("calendar.event")) return;

        const row = await Settings.findOne({ key: "KDP_PUB_CALENDAR" }).lean();
        if (!row?.value) return;

        let events: any[];
        try {
            const raw = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
            events = JSON.parse(raw);
            if (!Array.isArray(events)) return;
        } catch { return; }

        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

        const todayEvents   = events.filter((e: any) => e.date === today);
        const tomorrowEvents = events.filter((e: any) => e.date === tomorrow);

        if (todayEvents.length === 0 && tomorrowEvents.length === 0) return;

        let msg = "📅 <b>Calendario KDP — Recordatorio</b>\n";

        if (todayEvents.length > 0) {
            msg += "\n🔔 <b>HOY</b>\n";
            for (const ev of todayEvents) {
                msg += `${STATUS_EMOJI[ev.status] ?? "📌"} ${ev.title}\n`;
            }
        }

        if (tomorrowEvents.length > 0) {
            msg += "\n⏰ <b>MAÑANA</b>\n";
            for (const ev of tomorrowEvents) {
                msg += `${STATUS_EMOJI[ev.status] ?? "📌"} ${ev.title}\n`;
            }
        }

        await sendTelegram(msg.trim());
    });
}

export async function scheduleCalendarAlerts(agenda: Agenda): Promise<void> {
    await agenda.cancel({ name: CALENDAR_ALERTS_JOB_NAME }).catch(() => {});
    await agenda.every("0 9 * * *", CALENDAR_ALERTS_JOB_NAME);
}
