import type { Agenda } from "agenda";
import { Settings } from "../models/settings.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";

export const CALENDAR_ALERTS_JOB_NAME = "calendar-event-alerts";

const STATUS_EMOJI: Record<string, string> = {
    idea: "💡", planned: "📋", inprogress: "🔄", published: "✅",
};

// Seasonal production windows — mirrors frontend SEASONAL_EVENTS + backend seasonal-check.ts
const SEASON_WINDOWS = [
    { name: "San Valentín",    emoji: "💕", month: 2,  day: 14, leadWeeks: 6 },
    { name: "San Patricio",    emoji: "🍀", month: 3,  day: 17, leadWeeks: 6 },
    { name: "Pascua",          emoji: "🐣", month: 4,  day: 1,  leadWeeks: 6 },
    { name: "Día de la Madre", emoji: "💐", month: 5,  day: 11, leadWeeks: 5 },
    { name: "Día del Padre",   emoji: "👔", month: 6,  day: 15, leadWeeks: 5 },
    { name: "Verano",          emoji: "☀️", month: 6,  day: 21, leadWeeks: 6 },
    { name: "Vuelta al Cole",  emoji: "🎒", month: 9,  day: 1,  leadWeeks: 8 },
    { name: "Halloween",       emoji: "🎃", month: 10, day: 31, leadWeeks: 10 },
    { name: "Día de Muertos",  emoji: "💀", month: 11, day: 2,  leadWeeks: 8 },
    { name: "Acción de Gracias", emoji: "🦃", month: 11, day: 27, leadWeeks: 8 },
    { name: "Hanukkah",        emoji: "🕎", month: 12, day: 10, leadWeeks: 8 },
    { name: "Navidad",         emoji: "🎄", month: 12, day: 25, leadWeeks: 12 },
    { name: "Año Nuevo",       emoji: "🎆", month: 1,  day: 1,  leadWeeks: 6 },
];

function getSeasonDate(month: number, day: number, now: Date): Date {
    const year = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() > day)
        ? now.getFullYear() + 1 : now.getFullYear();
    return new Date(year, month - 1, day);
}

function hasCalendarCoverage(events: any[], windowStart: string, windowEnd: string): boolean {
    return events.some((e: any) => typeof e.date === "string" && e.date >= windowStart && e.date <= windowEnd);
}

export function defineCalendarAlertsJob(agenda: Agenda): void {
    agenda.define(CALENDAR_ALERTS_JOB_NAME, async () => {
        if (!await shouldNotify("calendar.event")) return;

        const row = await Settings.findOne({ key: "KDP_PUB_CALENDAR" }).lean();
        let events: any[] = [];
        if (row?.value) {
            try {
                const raw = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) events = parsed;
            } catch { /* ignore */ }
        }

        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

        // ── 1. Today / tomorrow events (existing behaviour) ──────────────────
        const todayEvents    = events.filter((e: any) => e.date === today);
        const tomorrowEvents = events.filter((e: any) => e.date === tomorrow);

        if (todayEvents.length > 0 || tomorrowEvents.length > 0) {
            let msg = "📅 <b>Calendario KDP — Recordatorio</b>\n";
            if (todayEvents.length > 0) {
                msg += "\n🔔 <b>HOY</b>\n";
                for (const ev of todayEvents) msg += `${STATUS_EMOJI[ev.status] ?? "📌"} ${ev.title}\n`;
            }
            if (tomorrowEvents.length > 0) {
                msg += "\n⏰ <b>MAÑANA</b>\n";
                for (const ev of tomorrowEvents) msg += `${STATUS_EMOJI[ev.status] ?? "📌"} ${ev.title}\n`;
            }
            await sendTelegram(msg.trim());
        }

        // ── 2. Proactive production window alerts ─────────────────────────────
        // Fires the day a season's production window opens (leadWeeks before the event).
        // If the calendar has no coverage for that season → urgent Telegram with ideas.
        for (const season of SEASON_WINDOWS) {
            const eventDate = getSeasonDate(season.month, season.day, now);
            const windowOpen = new Date(eventDate.getTime() - season.leadWeeks * 7 * 24 * 3600 * 1000);
            const windowOpenStr = windowOpen.toISOString().slice(0, 10);

            // Only fire on the exact opening day
            if (windowOpenStr !== today) continue;

            const eventDateStr = eventDate.toISOString().slice(0, 10);
            const covered = hasCalendarCoverage(events, today, eventDateStr);

            const dateLabel = eventDate.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
            let msg = `${season.emoji} <b>VENTANA DE PRODUCCIÓN: ${season.name}</b>\n`;
            msg += `Fecha: ${dateLabel} — <b>${season.leadWeeks} semanas</b> para publicar\n\n`;

            if (!covered) {
                msg += `⚠️ <b>Sin libros en el calendario para esta temporada</b>\n`;
                msg += `Entra al Calendario KDP → pulsa <b>📅 Planificar</b> o <b>🗓 Año</b> para agendar ahora.`;
            } else {
                msg += `✅ Ya tienes producción planificada para esta temporada — ¡a trabajar!`;
            }

            await sendTelegram(msg).catch(() => {});
        }
    });
}

export async function scheduleCalendarAlerts(agenda: Agenda): Promise<void> {
    await agenda.cancel({ name: CALENDAR_ALERTS_JOB_NAME }).catch(() => {});
    await agenda.every("0 9 * * *", CALENDAR_ALERTS_JOB_NAME);
}
