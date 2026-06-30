"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
    CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Check, X, Loader2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/section-header";
import type { NicheFE, PublishEvent, PublishEventStatus, TimePrediction } from "./types";

function ModalPortal({ children }: { children: React.ReactNode }) {
    if (typeof window === "undefined") return null;
    return createPortal(children, document.body);
}

type CalAiSuggestion = { title: string; startDate: string; publishDate: string; event: string };

interface CalendarPanelProps {
    pubEvents: PublishEvent[];
    calMonth: string;
    calAutoScheduleLoading: boolean;
    calAiSuggestions: CalAiSuggestion[];
    calAiLoading: boolean;
    isLoadingTimeMachine: boolean;
    timeMachineData: TimePrediction[];
    pubEventFormOpen: boolean;
    editingEventId: string | null;
    eventTitle: string;
    eventDate: string;
    eventStatus: PublishEventStatus;
    eventNicheId: string;
    niches: NicheFE[];
    setCalAiLoading: (v: boolean) => void;
    setCalAiSuggestions: (v: CalAiSuggestion[]) => void;
    setCalAutoScheduleLoading: (v: boolean) => void;
    setCalMonth: (v: string) => void;
    setEditingEventId: (v: string | null) => void;
    setEventDate: (v: string) => void;
    setEventNicheId: (v: string) => void;
    setEventStatus: (v: PublishEventStatus) => void;
    setEventTitle: (v: string) => void;
    setIsLoadingTimeMachine: (v: boolean) => void;
    setPubEventFormOpen: (v: boolean) => void;
    setTimeMachineData: (v: TimePrediction[]) => void;
    savePubEvents: (events: PublishEvent[]) => void;
    openEventForm: (e?: PublishEvent, defaultDate?: string) => void;
    submitEvent: () => void;
    deleteEvent: (id: string) => void;
    addAllAiSuggestions: () => void;
    apiBaseUrl: string;
}

export function CalendarPanel({
    pubEvents, calMonth, calAutoScheduleLoading, calAiSuggestions, calAiLoading,
    isLoadingTimeMachine, timeMachineData, pubEventFormOpen, editingEventId,
    eventTitle, eventDate, eventStatus, eventNicheId, niches,
    setCalAiLoading, setCalAiSuggestions, setCalAutoScheduleLoading, setCalMonth,
    setEditingEventId, setEventDate, setEventNicheId, setEventStatus, setEventTitle,
    setIsLoadingTimeMachine, setPubEventFormOpen, setTimeMachineData,
    savePubEvents, openEventForm, submitEvent, deleteEvent, addAllAiSuggestions,
    apiBaseUrl,
}: CalendarPanelProps) {
    const SEASONAL_EVENTS: { name: string; month: number; day: number; weeksNeeded: number; emoji: string; color: string; tip: string }[] = [
        { name: "Halloween",     month: 10, day: 31, weeksNeeded: 8, emoji: "🎃", color: "text-orange-400", tip: "Libros de colorear de terror, mandalas oscuros, motivos de calabazas y fantasmas" },
        { name: "Navidad",       month: 12, day: 25, weeksNeeded: 10, emoji: "🎄", color: "text-emerald-400", tip: "Libros festivos, renos, Papá Noel, escenas navideñas para colorear" },
        { name: "San Valentín",  month: 2,  day: 14, weeksNeeded: 6, emoji: "💕", color: "text-pink-400", tip: "Mandalas románticos, corazones, flores, parejas" },
        { name: "Pascua",        month: 4,  day: 1,  weeksNeeded: 6, emoji: "🐣", color: "text-yellow-400", tip: "Huevos decorados, conejos, flores de primavera" },
        { name: "Día de Madres", month: 5,  day: 11, weeksNeeded: 5, emoji: "💐", color: "text-rose-400", tip: "Flores, jardines, mariposas, diseños elegantes" },
        { name: "Verano",        month: 6,  day: 21, weeksNeeded: 6, emoji: "☀️", color: "text-amber-400", tip: "Mandalas de playa, conchas, paisajes tropicales, animales marinos" },
        { name: "Back to School",month: 9,  day: 1,  weeksNeeded: 6, emoji: "🎒", color: "text-sky-400", tip: "Útiles escolares, animales listos, personajes educativos" },
        { name: "Año Nuevo",     month: 1,  day: 1,  weeksNeeded: 6, emoji: "🎆", color: "text-violet-400", tip: "Fuegos artificiales, mandalas de abundancia, motivos de año nuevo" },
    ];

    const today = new Date();
    const getSeasonalAlerts = () => {
        return SEASONAL_EVENTS.map(ev => {
            const year = today.getMonth() + 1 > ev.month || (today.getMonth() + 1 === ev.month && today.getDate() > ev.day)
                ? today.getFullYear() + 1 : today.getFullYear();
            const target = new Date(year, ev.month - 1, ev.day);
            const msLeft = target.getTime() - today.getTime();
            const weeksLeft = Math.ceil(msLeft / (7 * 24 * 3600 * 1000));
            const daysLeft = Math.ceil(msLeft / (24 * 3600 * 1000));
            return { ...ev, weeksLeft, daysLeft, target };
        }).sort((a, b) => a.daysLeft - b.daysLeft);
    };

    const alerts = getSeasonalAlerts();
    const urgent = alerts.filter(a => a.weeksLeft <= a.weeksNeeded + 2 && a.daysLeft > 0);
    const upcoming = alerts.filter(a => a.weeksLeft > a.weeksNeeded + 2).slice(0, 4);

    const seasonalCoverage = SEASONAL_EVENTS.map(ev => {
        const year = today.getMonth() + 1 > ev.month || (today.getMonth() + 1 === ev.month && today.getDate() > ev.day)
            ? today.getFullYear() + 1 : today.getFullYear();
        const target = new Date(year, ev.month - 1, ev.day);
        const windowStart = new Date(target.getTime() - (ev.weeksNeeded + 2) * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const targetStr = target.toISOString().slice(0, 10);
        const covered = pubEvents.some(e => e.date >= windowStart && e.date <= targetStr);
        return { ...ev, covered, target };
    }).sort((a, b) => a.target.getTime() - b.target.getTime());

    const scheduleSeasonNow = (a: typeof alerts[0]) => {
        const evColors = { planned: "#6366f1", inprogress: "#f59e0b", published: "#10b981", idea: "#8b5cf6" };
        const startDate = new Date(a.target.getTime() - a.weeksNeeded * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const pubDate = new Date(a.target.getTime() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const newEvs: PublishEvent[] = [
            { id: `ss-${a.name}-${Date.now()}`, title: `${a.emoji} Empezar: Libro ${a.name}`, date: startDate, status: "idea", color: evColors.idea },
            { id: `sp-${a.name}-${Date.now()}`, title: `${a.emoji} Publicar: Libro ${a.name}`, date: pubDate, status: "planned", color: evColors.planned },
        ];
        savePubEvents([...pubEvents, ...newEvs]);
        toast.success(`${a.emoji} ${a.name} planificado · Inicio ${startDate} · Publicar ${pubDate}`);
    };

    const autoScheduleYear = () => {
        const evColors = { planned: "#6366f1", inprogress: "#f59e0b", published: "#10b981", idea: "#8b5cf6" };
        const newEvs: PublishEvent[] = [];
        setCalAutoScheduleLoading(true);
        for (const s of seasonalCoverage) {
            if (s.covered) continue;
            const startDate = new Date(s.target.getTime() - s.weeksNeeded * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
            const pubDate = new Date(s.target.getTime() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
            if (new Date(startDate) < today) continue;
            newEvs.push({ id: `ys-${s.name}-${Date.now()}`, title: `${s.emoji} Empezar: Libro ${s.name}`, date: startDate, status: "idea", color: evColors.idea });
            newEvs.push({ id: `yp-${s.name}-${Date.now()}`, title: `${s.emoji} Publicar: Libro ${s.name}`, date: pubDate, status: "planned", color: evColors.planned });
        }
        if (newEvs.length > 0) { savePubEvents([...pubEvents, ...newEvs]); toast.success(`🗓 ${newEvs.length} eventos añadidos — año planificado`); }
        else toast.success("✅ Todas las temporadas ya tienen cobertura");
        setCalAutoScheduleLoading(false);
    };

    const [calYear, calMonthNum] = calMonth.split("-").map(Number);
    const firstDay = new Date(calYear, calMonthNum - 1, 1);
    const lastDay = new Date(calYear, calMonthNum, 0);
    const daysInMonth = lastDay.getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const eventsThisMonth = pubEvents.filter(e => e.date.startsWith(calMonth));

    const prevMonth = () => {
        const d = new Date(calYear, calMonthNum - 2, 1);
        setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    };
    const nextMonth = () => {
        const d = new Date(calYear, calMonthNum, 1);
        setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    };

    const monthName = firstDay.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    const statusColors: Record<string, string> = { planned: "bg-indigo-500", inprogress: "bg-amber-500", published: "bg-emerald-500", idea: "bg-purple-500" };
    const statusLabels: Record<string, string> = { planned: "Planificado", inprogress: "En progreso", published: "Publicado", idea: "Idea" };

    const fetchCalAiSuggestions = async () => {
        setCalAiLoading(true);
        setCalAiSuggestions([]);
        try {
            const nicheNames = niches.slice(0, 5).map(n => n.name).join(", ");
            const alertNames = urgent.slice(0, 3).map(a => `${a.name} — ${a.target.toISOString().slice(0, 10)} (en ${a.weeksLeft} semanas)`).join("; ");
            const todayStr = new Date().toISOString().slice(0, 10);
            const promptText = `Eres un consultor KDP experto. Hoy es ${todayStr}. Nichos del usuario: ${nicheNames || "libros para colorear para adultos"}. Próximas fechas estacionales: ${alertNames || "Halloween 2026-10-31"}. Genera 6 sugerencias de libros KDP para estas fechas. Para cada una calcula: (1) startDate = fecha en que debe EMPEZAR a crear el libro (diseño+contenido), mínimo 6-8 semanas antes de la festividad; (2) publishDate = fecha en que debe SUBIR el libro a Amazon KDP, 2-3 semanas antes de la festividad. Devuelve SOLO este JSON (sin texto extra, sin comillas dobles dentro de los valores): {"suggestions":[{"title":"título del libro","startDate":"YYYY-MM-DD","publishDate":"YYYY-MM-DD","event":"nombre de la festividad"}]}`;
            const res = await fetch(`${apiBaseUrl}/ai/generate-text`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "free", niche: promptText }),
            });
            if (res.ok) {
                const d = await res.json() as any;
                const raw = d.result ?? d.text ?? "";
                const text = (typeof raw === "string" ? raw : JSON.stringify(raw))
                    .replace(/\}\}/g, "}").replace(/,\s*\]/g, "]").replace(/,\s*\}/g, "}");
                try {
                    const jsonStart = text.indexOf("{"); const jsonEnd = text.lastIndexOf("}");
                    if (jsonStart !== -1 && jsonEnd > jsonStart) {
                        const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
                        if (Array.isArray(parsed?.suggestions) && parsed.suggestions.length > 0) {
                            setCalAiSuggestions(parsed.suggestions.map((s: any) => ({
                                title: s.title ?? "", startDate: s.startDate ?? "", publishDate: s.publishDate ?? s.date ?? "", event: s.event ?? "",
                            })));
                            return;
                        }
                    }
                } catch { /* fall through */ }
                const objRegex = /"title"\s*:\s*"([^"]+)"[^}]*?"startDate"\s*:\s*"([^"]+)"[^}]*?"publishDate"\s*:\s*"([^"]+)"[^}]*?"event"\s*:\s*"([^"]+)"/g;
                const suggestions: CalAiSuggestion[] = [];
                let m: RegExpExecArray | null;
                while ((m = objRegex.exec(text)) !== null) {
                    suggestions.push({ title: m[1], startDate: m[2], publishDate: m[3], event: m[4] });
                }
                if (suggestions.length > 0) { setCalAiSuggestions(suggestions); return; }
                setCalAiSuggestions([{ title: "Error al procesar respuesta. Inténtalo de nuevo.", startDate: "", publishDate: "", event: "" }]);
            }
        } catch { /* ignore */ } finally { setCalAiLoading(false); }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">

            {/* ── Seasonal Alerts ── */}
            {urgent.length > 0 && (
                <div className="rounded-3xl border border-orange-500/20 bg-orange-500/5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
                    <div className="h-px w-full bg-gradient-to-r from-orange-500/80 via-amber-400/40 to-transparent" />
                    <div className="p-5 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">⚡</span>
                            <span className="text-sm font-bold text-orange-300">Alertas estacionales</span>
                            <span className="text-[10px] text-neutral-500 ml-auto">Fechas clave que se aproximan</span>
                        </div>
                        <div className="space-y-2">
                            {urgent.map(a => {
                                const isUrgent = a.weeksLeft <= a.weeksNeeded;
                                const isCritical = a.weeksLeft <= 2;
                                return (
                                    <div key={a.name} className={`flex items-start gap-3 px-4 py-3 rounded-2xl border transition-all ${isCritical ? "border-red-500/30 bg-red-500/10" : isUrgent ? "border-orange-500/25 bg-orange-500/8" : "border-white/8 bg-white/[0.03]"}`}>
                                        <span className="text-xl shrink-0 mt-0.5">{a.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-sm font-bold ${a.color}`}>{a.name}</span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isCritical ? "bg-red-500/20 text-red-300" : isUrgent ? "bg-orange-500/20 text-orange-300" : "bg-white/5 text-neutral-400"}`}>
                                                    {a.weeksLeft <= 0 ? "¡Hoy!" : `${a.weeksLeft} sem · ${a.daysLeft} días`}
                                                </span>
                                                {isUrgent && <span className="text-[10px] text-red-400 font-semibold">⚠ ¡Ponte en marcha ya!</span>}
                                            </div>
                                            <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">{a.tip}</p>
                                        </div>
                                        <button onClick={() => scheduleSeasonNow(a)}
                                            className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-[10px] text-indigo-300 font-semibold transition-all border border-indigo-500/30">
                                            📅 Planificar
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main Content: Calendar + Sidebar ── */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">

                {/* Calendar */}
                <div className="rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
                    <div className="h-px w-full bg-gradient-to-r from-indigo-500/80 via-violet-400/40 to-transparent" />
                    <div className="p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                                    <CalendarDays size={16} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white capitalize">{monthName}</h3>
                                    <p className="text-xs text-neutral-500">{eventsThisMonth.length} evento{eventsThisMonth.length !== 1 ? "s" : ""} este mes</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={prevMonth} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/8">
                                    <ChevronLeft size={14} className="text-neutral-400" />
                                </button>
                                <button onClick={nextMonth} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/8">
                                    <ChevronRight size={14} className="text-neutral-400" />
                                </button>
                                <button onClick={autoScheduleYear} disabled={calAutoScheduleLoading}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs font-semibold transition-all border border-violet-500/30 disabled:opacity-50"
                                    title="Planifica todas las temporadas sin cobertura de una vez">
                                    {calAutoScheduleLoading ? <Loader2 size={12} className="animate-spin" /> : "🗓"} Año
                                </button>
                                <button onClick={() => openEventForm()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold transition-all border border-indigo-500/30">
                                    <Plus size={12} /> Evento
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
                                <div key={d} className="text-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest py-1">{d}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: startOffset }).map((_, i) => <div key={`pad-${i}`} />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const dateStr = `${calMonth}-${String(day).padStart(2, "0")}`;
                                const dayEvents = pubEvents.filter(e => e.date === dateStr);
                                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                                const isToday = dateStr === todayStr;
                                const seasonalOnDay = alerts.filter(a => {
                                    const d = a.target;
                                    return d.getFullYear() === calYear && d.getMonth() + 1 === calMonthNum && d.getDate() === day;
                                });
                                const aiStartOnDay = calAiSuggestions.filter(s => s.startDate === dateStr);
                                const aiPublishOnDay = calAiSuggestions.filter(s => s.publishDate === dateStr);
                                const hasAnything = dayEvents.length > 0 || seasonalOnDay.length > 0 || aiStartOnDay.length > 0 || aiPublishOnDay.length > 0;
                                return (
                                    <div key={day} onClick={() => openEventForm(undefined, dateStr)}
                                        className={`min-h-[60px] rounded-xl p-1.5 cursor-pointer transition-all border group ${isToday ? "border-indigo-500/50 bg-indigo-500/10" : hasAnything ? "border-white/10" : "border-white/5 hover:border-white/15 hover:bg-white/[0.04]"}`}>
                                        <div className={`text-[11px] font-bold mb-1 w-5 h-5 rounded-full flex items-center justify-center ${isToday ? "bg-indigo-500 text-white" : "text-neutral-500 group-hover:text-neutral-300"}`}>{day}</div>
                                        <div className="space-y-0.5">
                                            {seasonalOnDay.map(a => (
                                                <div key={a.name} title={a.name}
                                                    className="w-full px-1 py-0.5 rounded text-[9px] font-bold leading-tight truncate bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                                    {a.emoji} {a.name}
                                                </div>
                                            ))}
                                            {aiStartOnDay.map((s, idx) => (
                                                <div key={`start-${idx}`} title={`🛠 Empezar: ${s.title}`}
                                                    className="w-full px-1 py-0.5 rounded text-[9px] font-semibold leading-tight truncate bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                    🛠 {s.title}
                                                </div>
                                            ))}
                                            {aiPublishOnDay.map((s, idx) => (
                                                <div key={`pub-${idx}`} title={`🚀 Publicar: ${s.title}`}
                                                    className="w-full px-1 py-0.5 rounded text-[9px] font-semibold leading-tight truncate bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                                                    🚀 {s.title}
                                                </div>
                                            ))}
                                            {dayEvents.map(ev => (
                                                <div key={ev.id} onClick={e => { e.stopPropagation(); openEventForm(ev); }}
                                                    className={`w-full px-1 py-0.5 rounded text-[9px] font-semibold leading-tight truncate text-white ${statusColors[ev.status]}`}>
                                                    {ev.title}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-4 pt-2 border-t border-white/5 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-orange-500/60" />
                                <span className="text-[10px] text-neutral-500">Fecha estacional</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                                <span className="text-[10px] text-neutral-500">🛠 Inicio</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-fuchsia-500/60" />
                                <span className="text-[10px] text-neutral-500">🚀 Publicar</span>
                            </div>
                            {Object.entries(statusLabels).map(([s, l]) => (
                                <div key={s} className="flex items-center gap-1.5">
                                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[s]}`} />
                                    <span className="text-[10px] text-neutral-500">{l}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                        <div className="h-px w-full bg-gradient-to-r from-violet-500/60 to-transparent" />
                        <div className="p-4 space-y-3">
                            <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest">Próximas fechas clave</p>
                            {upcoming.map(a => (
                                <div key={a.name} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                                    <span className="text-base">{a.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-semibold ${a.color}`}>{a.name}</p>
                                        <p className="text-[10px] text-neutral-600">{a.weeksLeft} semanas</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                        <div className="h-px w-full bg-gradient-to-r from-emerald-500/60 to-transparent" />
                        <div className="p-4 space-y-2">
                            <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest mb-1">Cobertura estacional</p>
                            {seasonalCoverage.slice(0, 6).map(s => (
                                <div key={s.name} className="flex items-center gap-2">
                                    <span className="text-sm shrink-0">{s.emoji}</span>
                                    <span className={`text-[11px] flex-1 truncate ${s.covered ? "text-neutral-400" : "text-neutral-300 font-semibold"}`}>{s.name}</span>
                                    {s.covered
                                        ? <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">✓</span>
                                        : <span className="text-[9px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded-full border border-rose-500/20">Sin plan</span>
                                    }
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                        <div className="h-px w-full bg-gradient-to-r from-fuchsia-500/60 to-transparent" />
                        <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest">Sugerencias IA</p>
                                <div className="flex items-center gap-1.5">
                                    {calAiSuggestions.length > 0 && (
                                        <button onClick={addAllAiSuggestions}
                                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[10px] font-bold transition-all border border-emerald-500/30">
                                            📥 Añadir todos
                                        </button>
                                    )}
                                    <button onClick={() => void fetchCalAiSuggestions()} disabled={calAiLoading}
                                        className="px-3 py-1 rounded-lg bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-300 text-[10px] font-bold transition-all border border-fuchsia-500/30 disabled:opacity-50">
                                        {calAiLoading ? "..." : "✨ Generar"}
                                    </button>
                                </div>
                            </div>
                            {calAiSuggestions.length === 0 && !calAiLoading && (
                                <p className="text-[11px] text-neutral-600 italic">Pulsa "Generar" para obtener ideas de lanzamiento basadas en tus nichos y las fechas estacionales.</p>
                            )}
                            {calAiLoading && (
                                <div className="space-y-2">
                                    {[1,2,3].map(i => <div key={i} className="h-3 rounded-full bg-white/5 animate-pulse" style={{ width: `${60 + i * 12}%` }} />)}
                                </div>
                            )}
                            {calAiSuggestions.map((s, i) => (
                                <div key={i} className="py-2.5 border-b border-white/5 last:border-0 space-y-2">
                                    <p className="text-[11px] text-neutral-200 font-semibold leading-snug">{s.title}</p>
                                    {s.event && <p className="text-[10px] text-orange-400 font-bold">Para: {s.event}</p>}
                                    <div className="flex flex-col gap-1">
                                        {s.startDate && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                    🛠 Inicio: {s.startDate}
                                                </span>
                                                <button onClick={() => { setEventTitle(`[Inicio] ${s.title}`); setEventDate(s.startDate); setEventStatus("idea"); setEventNicheId(""); setPubEventFormOpen(true); setEditingEventId(null); }}
                                                    className="text-[10px] text-neutral-500 hover:text-neutral-300 font-semibold transition-colors">
                                                    + Agendar
                                                </button>
                                            </div>
                                        )}
                                        {s.publishDate && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-fuchsia-400 font-bold bg-fuchsia-500/10 border border-fuchsia-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                    🚀 Publicar: {s.publishDate}
                                                </span>
                                                <button onClick={() => { setEventTitle(s.title); setEventDate(s.publishDate); setEventStatus("planned"); setEventNicheId(""); setPubEventFormOpen(true); setEditingEventId(null); }}
                                                    className="text-[10px] text-neutral-500 hover:text-neutral-300 font-semibold transition-colors">
                                                    + Agendar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden">
                        <div className="h-px w-full bg-gradient-to-r from-indigo-500/60 to-transparent" />
                        <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest">Este mes</p>
                                <button onClick={() => openEventForm()} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">+ Añadir</button>
                            </div>
                            {eventsThisMonth.length === 0
                                ? <p className="text-[11px] text-neutral-600 italic">Sin eventos. Haz clic en un día del calendario.</p>
                                : eventsThisMonth.sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
                                    <div key={ev.id} className="flex items-center gap-2.5 py-2 border-b border-white/5 last:border-0 group">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${statusColors[ev.status]}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-white font-medium truncate">{ev.title}</p>
                                            <p className="text-[10px] text-neutral-600">{ev.date.split("-")[2]} · {statusLabels[ev.status]}</p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEventForm(ev)} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                                                <Pencil size={9} className="text-neutral-400" />
                                            </button>
                                            <button onClick={() => deleteEvent(ev.id)} className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-all">
                                                <Trash2 size={9} className="text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Event Form Modal ── */}
            {pubEventFormOpen && <ModalPortal><div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-950 shadow-2xl overflow-hidden">
                    <div className="h-px w-full bg-gradient-to-r from-indigo-500 via-violet-400 to-transparent" />
                    <div className="p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">{editingEventId ? "Editar evento" : "Nuevo evento"}</h3>
                            <button onClick={() => setPubEventFormOpen(false)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                                <X size={14} className="text-neutral-400" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-1.5 block">Título *</label>
                                <input value={eventTitle} onChange={e => setEventTitle(e.target.value)}
                                    placeholder="Ej: Lanzar libro de Halloween"
                                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500/50" />
                            </div>
                            <div>
                                <label className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-1.5 block">Fecha *</label>
                                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                            </div>
                            <div>
                                <label className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-1.5 block">Estado</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["idea", "planned", "inprogress", "published"] as const).map(s => (
                                        <button key={s} onClick={() => setEventStatus(s)}
                                            className={`py-2 rounded-xl text-xs font-semibold transition-all border ${eventStatus === s ? `${statusColors[s]} border-transparent text-white` : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10"}`}>
                                            {statusLabels[s]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-1.5 block">Nicho vinculado</label>
                                <select value={eventNicheId} onChange={e => setEventNicheId(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                                    <option value="">Sin nicho</option>
                                    {niches.map(n => <option key={n._id} value={n._id}>{n.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            {editingEventId && <button onClick={() => { deleteEvent(editingEventId); setPubEventFormOpen(false); }}
                                className="px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-all">
                                Eliminar
                            </button>}
                            <button onClick={() => setPubEventFormOpen(false)} className="flex-1 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-sm text-neutral-400 hover:bg-white/10 transition-all font-semibold">Cancelar</button>
                            <button onClick={submitEvent} disabled={!eventTitle.trim() || !eventDate}
                                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold disabled:opacity-40 hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-900/40">
                                {editingEventId ? "Guardar" : "Crear"}
                            </button>
                        </div>
                    </div>
                </div>
            </div></ModalPortal>}

            {/* ══ TIME MACHINE ══ */}
            {(() => {
                const runTimeMachine = async () => {
                    setIsLoadingTimeMachine(true);
                    setTimeMachineData([]);
                    try {
                        const nicheNames = niches.map(n => n.name).slice(0, 20);
                        const res = await fetch(`${apiBaseUrl}/trends/timemachine`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ nicheNames }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error ?? "Error");
                        setTimeMachineData(data.predictions ?? []);
                    } catch (e: any) {
                        toast.error(e.message ?? "Error en Time Machine");
                    } finally {
                        setIsLoadingTimeMachine(false);
                    }
                };

                const urgencyStyle: Record<string, { bar: string; badge: string; label: string }> = {
                    critical:  { bar: "bg-rose-500",    badge: "bg-rose-500/15 border-rose-500/30 text-rose-400",       label: "URGENTE"  },
                    soon:      { bar: "bg-amber-500",   badge: "bg-amber-500/15 border-amber-500/30 text-amber-400",    label: "PRONTO"   },
                    ok:        { bar: "bg-sky-500",     badge: "bg-sky-500/15 border-sky-500/30 text-sky-400",          label: "EN PLAZO" },
                    evergreen: { bar: "bg-emerald-500", badge: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400", label: "EVERGREEN" },
                };

                return (
                    <div className="mt-6 rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
                        <div className="h-px w-full bg-gradient-to-r from-violet-500/80 via-purple-400/40 to-transparent" />
                        <div className="p-6 space-y-5">
                            <div className="flex items-start justify-between gap-4">
                                <SectionHeader
                                    icon={<Clock size={18} />}
                                    title={<><span className="text-white">Time </span><span className="bg-gradient-to-r from-violet-300 to-purple-400 bg-clip-text text-transparent">Machine</span></>}
                                    subtitle="Calcula la semana exacta en que publicar cada nicho para coger el pico de búsqueda"
                                    color="violet"
                                    size="sm"
                                />
                                <button
                                    onClick={() => void runTimeMachine()}
                                    disabled={isLoadingTimeMachine}
                                    className="shrink-0 h-9 px-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-2"
                                >
                                    {isLoadingTimeMachine ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />}
                                    {isLoadingTimeMachine ? "Calculando..." : `Analizar ${niches.length} nichos`}
                                </button>
                            </div>

                            {!isLoadingTimeMachine && timeMachineData.length === 0 && (
                                <div className="flex items-center justify-center py-8 rounded-2xl border border-dashed border-white/[0.06] text-neutral-700 text-[10px]">
                                    Pulsa el botón para calcular cuándo publicar cada nicho
                                </div>
                            )}

                            {timeMachineData.length > 0 && (
                                <div className="space-y-2">
                                    {timeMachineData.map((pred, idx) => {
                                        const s = urgencyStyle[pred.urgency] ?? urgencyStyle.ok;
                                        const isPast = pred.weeksUntilPublish < 0;
                                        const weeksAbs = Math.abs(pred.weeksUntilPublish);
                                        const tmId = `tm-${pred.nicheName}-${pred.optimalPublishDate}`;
                                        const inCalendar = pubEvents.some(e => e.id === tmId);
                                        const linkedNiche = niches.find(n => n.name.toLowerCase() === pred.nicheName.toLowerCase());
                                        const urgencyColor: Record<string, string> = { critical: "#ef4444", soon: "#f59e0b", ok: "#0ea5e9", evergreen: "#10b981" };

                                        const addToCalendar = () => {
                                            const ev: PublishEvent = {
                                                id: tmId,
                                                title: pred.nicheName,
                                                date: pred.optimalPublishDate,
                                                nicheId: linkedNiche?._id,
                                                status: "planned",
                                                color: urgencyColor[pred.urgency] ?? "#6366f1",
                                            };
                                            savePubEvents([...pubEvents, ev]);
                                            toast.success(`"${pred.nicheName}" añadido al calendario`);
                                        };

                                        const removeFromCalendar = () => {
                                            savePubEvents(pubEvents.filter(e => e.id !== tmId));
                                            toast("Eliminado del calendario", { icon: "🗑️" });
                                        };

                                        return (
                                            <div key={idx} className={`rounded-2xl border overflow-hidden transition-all ${inCalendar ? "border-indigo-500/25 bg-indigo-500/[0.03]" : "border-white/8 bg-white/[0.02]"}`}>
                                                <div className={`h-0.5 ${s.bar}`} />
                                                <div className="px-4 py-3 flex items-center gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-[11px] font-black text-white">{pred.nicheName}</p>
                                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${s.badge}`}>{s.label}</span>
                                                            <span className="text-[8px] text-neutral-600">{pred.season}</span>
                                                        </div>
                                                        <p className="text-[9px] text-neutral-500 italic mt-0.5">{pred.tip}</p>
                                                    </div>
                                                    <div className="shrink-0 text-right space-y-1.5">
                                                        <p className={`text-[11px] font-black ${isPast ? "text-rose-400" : "text-white"}`}>
                                                            {isPast ? `Ventana pasada (hace ${weeksAbs}s)` : `Publicar en ${weeksAbs}s`}
                                                        </p>
                                                        <p className="text-[9px] text-neutral-600">{pred.optimalPublishDate} · pico {pred.peakWeek}</p>
                                                        {inCalendar ? (
                                                            <div className="flex items-center gap-1 justify-end">
                                                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 flex items-center gap-1">
                                                                    <Check size={7} /> En calendario
                                                                </span>
                                                                <button
                                                                    onClick={removeFromCalendar}
                                                                    title="Quitar del calendario"
                                                                    className="p-0.5 rounded-md text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                                                >
                                                                    <X size={9} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={addToCalendar}
                                                                disabled={isPast}
                                                                className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-[8px] font-black hover:bg-indigo-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed ml-auto"
                                                            >
                                                                <CalendarDays size={7} /> + Calendario
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <p className="text-[9px] text-neutral-700 text-center pt-1">Amazon necesita 6-8 semanas para indexar y rankear un libro nuevo</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
