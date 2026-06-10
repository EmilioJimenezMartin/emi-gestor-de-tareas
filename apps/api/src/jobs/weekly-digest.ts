import type { Agenda, Job } from "agenda";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";
import { Catalog } from "../models/catalog.js";

export const WEEKLY_DIGEST_JOB_NAME = "telegram-weekly-digest";

async function isDigestEnabled(): Promise<boolean> {
    try {
        const row = await Settings.findOne({ key: "TELEGRAM_WEEKLY_DIGEST" }).lean();
        return (row as any)?.value !== "false";
    } catch { return true; }
}

export function defineWeeklyDigestJob(agenda: Agenda, _io: any) {
    agenda.define(WEEKLY_DIGEST_JOB_NAME, async (_job: Job) => {
        if (!(await isDigestEnabled())) return;

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [niches, catalogs] = await Promise.all([
            Niche.find().lean(),
            Catalog.find({ createdAt: { $gte: weekAgo } }).lean(),
        ]);

        // Phase breakdown
        const phases: Record<string, number> = {};
        for (const n of niches) {
            const p = (n as any).phase ?? "niche";
            phases[p] = (phases[p] ?? 0) + 1;
        }

        const publishedThisWeek = niches.filter(n =>
            (n as any).publishedAt && new Date((n as any).publishedAt) >= weekAgo
        ).length;

        const totalPublished = niches.filter(n => (n as any).phase === "published").length;

        // Royalties this week (niches with entries in current month)
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        let royaltiesMonth = 0;
        for (const n of niches) {
            for (const r of (n as any).royalties ?? []) {
                if (r.month === monthKey) royaltiesMonth += r.revenue ?? 0;
            }
        }

        // Stuck catalogs (running + not updated in 2h)
        const stuckCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const stuckCatalogs = await Catalog.countDocuments({
            status: "running",
            updatedAt: { $lt: stuckCutoff },
        });

        // Active pipeline (autopilot on, not published)
        const activePipeline = niches.filter(n =>
            (n as any).autoPilotEnabled && (n as any).phase !== "published"
        ).length;

        const PHASE_LABEL: Record<string, string> = {
            niche: "Pendiente aprobación",
            catalog: "Generando catálogos",
            libro: "Generando PDF",
            seo: "Generando SEO",
            cover: "Generando portada",
            published: "Publicado",
        };

        const phaseLines = Object.entries(phases)
            .filter(([, count]) => count > 0)
            .sort((a, b) => {
                const order = ["niche", "catalog", "libro", "seo", "cover", "published"];
                return order.indexOf(a[0]) - order.indexOf(b[0]);
            })
            .map(([phase, count]) => `  · ${PHASE_LABEL[phase] ?? phase}: <b>${count}</b>`);

        const weekLabel = now.toLocaleDateString("es-ES", { day: "numeric", month: "long" });

        const lines = [
            `📊 <b>Resumen semanal KDP Factory</b>`,
            `<i>Semana hasta el ${weekLabel}</i>`,
            ``,
            `📚 <b>Nichos en pipeline</b>`,
            ...phaseLines,
            ``,
            `🚀 <b>Esta semana</b>`,
            publishedThisWeek > 0 ? `  · ${publishedThisWeek} nicho${publishedThisWeek !== 1 ? "s" : ""} publicado${publishedThisWeek !== 1 ? "s" : ""} 🎉` : `  · Sin nuevas publicaciones`,
            `  · ${catalogs.length} catálogo${catalogs.length !== 1 ? "s" : ""} creado${catalogs.length !== 1 ? "s" : ""}`,
            ``,
            `⚙️ <b>Pipeline activo:</b> ${activePipeline} nicho${activePipeline !== 1 ? "s" : ""} en autopilot`,
            stuckCatalogs > 0 ? `⚠️ <b>Catálogos atascados:</b> ${stuckCatalogs}` : null,
            royaltiesMonth > 0 ? `\n💰 <b>Royalties ${monthKey}:</b> $${royaltiesMonth.toFixed(2)}` : null,
            ``,
            `📈 Total publicados: <b>${totalPublished}</b>`,
        ].filter(line => line !== null).join("\n");

        if (await shouldNotify("weekly.digest")) {
            await sendTelegram(lines as string);
        }
        console.log(`[weekly-digest] Digest sent — ${niches.length} niches, ${catalogs.length} catalogs this week`);

        // ── Double-down: si hay nichos GANADORES (ventas reales), proponer spin-offs ──
        try {
            const { runDoubleDown } = await import("../lib/double-down.js");
            const winners = await runDoubleDown();
            if (winners.length > 0 && await shouldNotify("winners.double-down")) {
                const blocks = winners.map(w => {
                    const props = w.proposals.map(p => `   · <i>${p.name}</i> — ${p.rationale}`).join("\n");
                    return `🏆 <b>${w.nicheName}</b> — $${w.royaltiesUsd.toFixed(2)} (${w.unitsSold}u) últimos 2 meses\n${props}`;
                });
                await sendTelegram(`💎 <b>Nichos ganadores — hora de doblar la apuesta</b>\n\n${blocks.join("\n\n")}\n\nCrea los spin-offs desde KDP Factory → botón "Double-down".`);
                console.log(`[weekly-digest] Double-down: ${winners.length} ganadores propuestos`);
            }
        } catch (e: any) {
            console.warn(`[weekly-digest] double-down failed: ${e?.message}`);
        }
    });
}

export async function scheduleWeeklyDigest(agenda: Agenda): Promise<void> {
    await agenda.cancel({ name: WEEKLY_DIGEST_JOB_NAME }).catch(() => {});
    // Every Monday at 9:00 AM
    await agenda.every("0 9 * * 1", WEEKLY_DIGEST_JOB_NAME);
}
