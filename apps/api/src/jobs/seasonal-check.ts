import type { Agenda, Job } from "agenda";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";

export const SEASONAL_CHECK_JOB_NAME = "seasonal-niche-check";

interface SeasonalEvent {
    nameEs: string;
    keywords: string[];
    nicheIdeas: string[];
    getDate: (year: number) => Date;
    leadWeeks: number;
}

function nthWeekday(year: number, month: number, weekday: number, nth: number): Date {
    const first = new Date(year, month - 1, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month - 1, 1 + offset + (nth - 1) * 7);
}

function easterDate(year: number): Date {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mo = Math.floor((h + l - 7 * m + 114) / 31);
    const dy = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, mo - 1, dy);
}

// Approx Hanukkah start (25 Kislev) per year
const HANUKKAH_APPROX: Record<number, [number, number]> = {
    2024: [12, 26], 2025: [12, 15], 2026: [12, 4], 2027: [12, 24], 2028: [12, 12], 2029: [12, 1],
};

const EVENTS: SeasonalEvent[] = [
    {
        nameEs: "San Valentín (Feb 14)",
        keywords: ["valentine", "valentin", "amor", "love", "heart", "romantic"],
        nicheIdeas: ["Valentine Hearts Coloring Adults", "Romantic Flowers Coloring Book", "Love Mandalas Coloring"],
        getDate: y => new Date(y, 1, 14),
        leadWeeks: 8,
    },
    {
        nameEs: "San Patricio (Mar 17)",
        keywords: ["patrick", "patricio", "shamrock", "irish", "clover", "celtic"],
        nicheIdeas: ["St Patrick Shamrock Coloring", "Celtic Knots Mandala", "Irish Patterns Adults Coloring"],
        getDate: y => new Date(y, 2, 17),
        leadWeeks: 6,
    },
    {
        nameEs: "Semana Santa / Pascua",
        keywords: ["easter", "pascua", "bunny", "spring", "egg", "flowers"],
        nicheIdeas: ["Easter Bunny Coloring Book", "Spring Flowers Botanical", "Easter Egg Mandala Patterns"],
        getDate: y => easterDate(y),
        leadWeeks: 8,
    },
    {
        nameEs: "Día de la Madre",
        keywords: ["mother", "mama", "mom", "flores", "flower", "garden", "botanical"],
        nicheIdeas: ["Mother's Day Flowers Coloring", "Garden Botanical Adults", "Mom Appreciation Coloring Book"],
        getDate: y => nthWeekday(y, 5, 0, 2),
        leadWeeks: 8,
    },
    {
        nameEs: "Día del Padre",
        keywords: ["father", "papa", "dad", "fathers"],
        nicheIdeas: ["Father's Day Sports Coloring", "Cars & Mechanics Coloring", "Outdoor Adventure Adults"],
        getDate: y => nthWeekday(y, 6, 0, 3),
        leadWeeks: 8,
    },
    {
        nameEs: "4 de Julio (EE.UU.)",
        keywords: ["independence", "july", "patriotic", "american", "usa", "eagle"],
        nicheIdeas: ["Patriotic America Coloring Book", "Freedom Eagle Mandala", "American Flag Patterns"],
        getDate: y => new Date(y, 6, 4),
        leadWeeks: 6,
    },
    {
        nameEs: "Vuelta al Cole",
        keywords: ["school", "kids", "children", "educational", "abc", "learning", "alphabet"],
        nicheIdeas: ["Back to School Activity Book", "Kids Alphabet Animals Coloring", "Educational Coloring Children"],
        getDate: y => new Date(y, 7, 20),
        leadWeeks: 8,
    },
    {
        nameEs: "Halloween (Oct 31)",
        keywords: ["halloween", "pumpkin", "witch", "ghost", "spooky", "skull", "bat"],
        nicheIdeas: ["Halloween Pumpkins Adults Coloring", "Spooky Witch Coloring Book", "Halloween Mandala Patterns"],
        getDate: y => new Date(y, 9, 31),
        leadWeeks: 10,
    },
    {
        nameEs: "Día de Muertos (Nov 2)",
        keywords: ["muertos", "calavera", "dia de los muertos", "sugar skull"],
        nicheIdeas: ["Día de Muertos Calaveras Coloring", "Mexican Sugar Skull Mandala", "Catrina Coloring Adults"],
        getDate: y => new Date(y, 10, 2),
        leadWeeks: 8,
    },
    {
        nameEs: "Acción de Gracias",
        keywords: ["thanksgiving", "turkey", "harvest", "autumn", "fall leaves"],
        nicheIdeas: ["Thanksgiving Turkey Coloring Book", "Autumn Harvest Patterns", "Fall Leaves Mandala Adults"],
        getDate: y => nthWeekday(y, 11, 4, 4),
        leadWeeks: 8,
    },
    {
        nameEs: "Hanukkah",
        keywords: ["hanukkah", "menorah", "jewish", "dreidel"],
        nicheIdeas: ["Hanukkah Menorah Coloring Book", "Star of David Mandala", "Jewish Holiday Patterns"],
        getDate: y => { const [mo, dy] = HANUKKAH_APPROX[y] ?? [12, 15]; return new Date(y, mo - 1, dy); },
        leadWeeks: 8,
    },
    {
        nameEs: "Navidad (Dic 25)",
        keywords: ["christmas", "navidad", "santa", "holiday", "winter", "xmas", "noel"],
        nicheIdeas: ["Christmas Mandalas Adults Coloring", "Santa Holiday Coloring Book", "Winter Wonderland Patterns"],
        getDate: y => new Date(y, 11, 25),
        leadWeeks: 12,
    },
    {
        nameEs: "Año Nuevo (Ene 1)",
        keywords: ["new year", "año nuevo", "fireworks", "celebration", "resolution"],
        nicheIdeas: ["New Year Celebration Coloring", "Fireworks Mandala Patterns", "2027 Resolution Coloring Book"],
        getDate: y => new Date(y + 1, 0, 1),
        leadWeeks: 6,
    },
];

function upcomingResult(event: SeasonalEvent, now: Date, maxWeeks: number): { date: Date; weeksUntil: number } | null {
    for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
        const d = event.getDate(year);
        const weeks = (d.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000);
        if (weeks >= 0 && weeks <= maxWeeks) return { date: d, weeksUntil: Math.ceil(weeks) };
    }
    return null;
}

function hasCoverage(niches: any[], keywords: string[]): { yes: boolean; names: string[] } {
    const names: string[] = [];
    for (const n of niches) {
        const haystack = `${n.name ?? ""} ${(n.tags ?? []).join(" ")}`.toLowerCase();
        if (keywords.some(kw => haystack.includes(kw))) names.push(n.name);
    }
    return { yes: names.length > 0, names };
}

async function getWeeksAhead(): Promise<number> {
    try {
        const row = await Settings.findOne({ key: "SEASONAL_WEEKS_AHEAD" }).lean();
        return parseInt((row as any)?.value ?? "12") || 12;
    } catch { return 12; }
}

export function defineSeasonalCheckJob(agenda: Agenda, _io: any) {
    agenda.define(SEASONAL_CHECK_JOB_NAME, async (_job: Job) => {
        try {
            const enabledRow = await Settings.findOne({ key: "SEASONAL_CHECK_ENABLED" }).lean().catch(() => null);
            if ((enabledRow as any)?.value === "0") return;

            const now = new Date();
            const weeksAhead = await getWeeksAhead();
            const niches = await Niche.find({ status: { $ne: "archived" } }).select("name tags").lean();

            const urgent: string[] = [];
            const soon: string[] = [];
            const onRadar: string[] = [];

            for (const ev of EVENTS) {
                const res = upcomingResult(ev, now, weeksAhead);
                if (!res) continue;

                const { date, weeksUntil } = res;
                const { yes, names } = hasCoverage(niches, ev.keywords);
                const dateStr = date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
                const coverLine = yes
                    ? `  ✅ ${names.slice(0, 2).join(", ")}`
                    : `  ⚠️ Sin nicho · Ideas: <i>${ev.nicheIdeas[0]}</i> · <i>${ev.nicheIdeas[1]}</i>`;
                const line = `<b>${ev.nameEs}</b> (${dateStr}, ${weeksUntil}sem)\n${coverLine}`;

                if (weeksUntil <= 4) urgent.push(line);
                else if (weeksUntil <= 8) soon.push(line);
                else onRadar.push(line);
            }

            if (!urgent.length && !soon.length && !onRadar.length) return;

            const parts: string[] = [
                `🗓️ <b>RADAR ESTACIONAL</b> — ${now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}`,
                ``,
            ];
            if (urgent.length) parts.push(`🚨 <b>URGENTE</b> — menos de 4 semanas`, ...urgent.map(l => `\n${l}`), ``);
            if (soon.length) parts.push(`⚠️ <b>PRÓXIMAMENTE</b> — 4 a 8 semanas`, ...soon.map(l => `\n${l}`), ``);
            if (onRadar.length) parts.push(`📡 <b>EN RADAR</b> — hasta ${weeksAhead} semanas`, ...onRadar.map(l => `\n${l}`));

            if (await shouldNotify("seasonal.check")) {
                await sendTelegram(parts.join("\n")).catch(() => {});
            }
            console.log(`[seasonal] Digest: ${urgent.length} urgentes · ${soon.length} próximos · ${onRadar.length} radar`);
        } catch (e: any) {
            console.error("[seasonal] Error:", e?.message);
        }
    });
}

export async function scheduleSeasonalCheck(agenda: Agenda): Promise<void> {
    await agenda.cancel({ name: SEASONAL_CHECK_JOB_NAME }).catch(() => {});
    // Every Monday at 9:00 AM
    await agenda.every("0 9 * * 1", SEASONAL_CHECK_JOB_NAME);
}
