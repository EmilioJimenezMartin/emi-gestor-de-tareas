import type { Agenda, Job } from "agenda";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { TelegramAction } from "../models/telegram-action.js";
import { sendTelegram, sendTelegramPhotoApproval, sendTelegramApproval } from "../lib/telegram.js";

export const AUTOPILOT_JOB_NAME = "autopilot-run";

type AutoPilotConfig = {
    catalogsPerNiche: number;
    imagesPerCatalog: number;
    maxNichesPerRun: number;
};

async function getConfig(): Promise<AutoPilotConfig> {
    try {
        const rows = await Settings.find({ key: { $in: ["AUTOPILOT_CATALOGS_PER_NICHE", "AUTOPILOT_IMAGES_PER_CATALOG", "AUTOPILOT_MAX_NICHES"] } }).lean();
        const map = new Map((rows as any[]).map((r) => [r.key, r.value]));
        return {
            catalogsPerNiche: parseInt((map.get("AUTOPILOT_CATALOGS_PER_NICHE") as string) ?? "5") || 5,
            imagesPerCatalog: parseInt((map.get("AUTOPILOT_IMAGES_PER_CATALOG") as string) ?? "5") || 5,
            maxNichesPerRun: parseInt((map.get("AUTOPILOT_MAX_NICHES") as string) ?? "3") || 3,
        };
    } catch {
        return { catalogsPerNiche: 5, imagesPerCatalog: 5, maxNichesPerRun: 3 };
    }
}

// Check if a niche has an unresolved pending approval
async function hasPendingApproval(nicheId: string): Promise<boolean> {
    const count = await TelegramAction.countDocuments({ nicheId, status: "pending" });
    return count > 0;
}

export function defineAutoPilotJob(agenda: Agenda, io: any) {
    agenda.define(AUTOPILOT_JOB_NAME, async (_job: Job) => {
        const port = process.env.PORT || 3001;
        const base = `http://localhost:${port}`;
        const tag = "[autopilot]";

        console.log(`${tag} Run started at ${new Date().toISOString()}`);
        const cfg = await getConfig();

        const candidates = await Niche.find({ autoPilotEnabled: true })
            .sort({ createdAt: 1 })
            .limit(cfg.maxNichesPerRun * 4)
            .lean();

        let processed = 0;

        for (const niche of candidates) {
            if (processed >= cfg.maxNichesPerRun) break;

            const phase = niche.phase ?? "niche";

            // Skip niches waiting for Telegram approval
            if (await hasPendingApproval(String(niche._id))) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⏳ "${niche.name}" esperando aprobación en Telegram` });
                continue;
            }

            // ── Phase: niche → generate prompt ──────────────────────────────
            if (phase === "niche" && !niche.generatedPrompt) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🧠 Generando contenido para "${niche.name}"…` });
                try {
                    const productType = niche.productType ?? "coloring-book";
                    const style = niche.styleCategory ?? "generic";
                    const aiType = productType === "printable-poster" ? "printable-particulars" : "niche-particulars";

                    const res = await fetch(`${base}/ai/generate-text`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: aiType, niche: niche.name, productType, extras: style }),
                    });
                    if (res.ok) {
                        const data = await res.json() as any;
                        const prompt = [data.result?.theme, data.result?.specs, data.result?.details, data.result?.particulars].filter(Boolean).join("\n\n");
                        if (prompt) {
                            await Niche.findByIdAndUpdate(niche._id, { $set: { generatedPrompt: prompt } });
                            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ Prompt generado para "${niche.name}"` });
                        }
                    }
                } catch (e: any) {
                    console.error(`${tag} [${niche.name}] content error:`, e.message);
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error generando prompt: ${e.message}` });
                }
                processed++;
                continue;
            }

            // ── Phase: niche (has prompt) → launch catalogs ──────────────────
            if (phase === "niche" && niche.generatedPrompt) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🖼️ Lanzando ${cfg.catalogsPerNiche} catálogos para "${niche.name}"…` });
                try {
                    const style = niche.styleCategory ?? "generic";
                    for (let i = 0; i < cfg.catalogsPerNiche; i++) {
                        await fetch(`${base}/catalogs`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                name: `${niche.name} — v${i + 1}`,
                                prompt: niche.generatedPrompt,
                                imageCount: cfg.imagesPerCatalog,
                                style,
                                nicheIds: [String(niche._id)],
                                productType: niche.productType ?? "coloring-book",
                            }),
                        });
                        await new Promise(r => setTimeout(r, 500));
                    }
                    await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "catalog" } });
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ ${cfg.catalogsPerNiche} catálogos lanzados para "${niche.name}"` });
                    await sendTelegram(`🏭 <b>Auto-Pilot</b>\n🖼️ ${cfg.catalogsPerNiche} catálogos lanzados para <b>${niche.name}</b>\nGenerando imágenes…`);
                } catch (e: any) {
                    console.error(`${tag} [${niche.name}] catalog error:`, e.message);
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error lanzando catálogos: ${e.message}` });
                }
                processed++;
                continue;
            }

            // ── Phase: catalog → check completion → ask approval ─────────────
            if (phase === "catalog") {
                const { Catalog } = await import("../models/catalog.js");
                const linkedCats = await Catalog.find({ nicheIds: String(niche._id) }).lean();
                const allDone = linkedCats.length > 0 && linkedCats.every((c: any) => c.status === "completed");

                if (!allDone) {
                    const done = linkedCats.filter((c: any) => c.status === "completed").length;
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⏳ Catálogos de "${niche.name}": ${done}/${linkedCats.length} listos` });
                    continue;
                }

                // All catalogs done — find a sample image and ask for approval
                const sampleImage = linkedCats
                    .flatMap((c: any) => c.images ?? [])
                    .find((img: any) => img?.url);

                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✅ Catálogos completos para "${niche.name}" — solicitando aprobación…` });

                const action = await TelegramAction.create({
                    type: "phase-approve",
                    nicheId: String(niche._id),
                    nicheName: niche.name,
                    targetPhase: "pdf",
                    imageUrl: sampleImage?.url,
                    autoApproveAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                });

                const caption = [
                    `🏭 <b>Auto-Pilot · Aprobación requerida</b>`,
                    ``,
                    `📚 <b>${niche.name}</b>`,
                    `📦 ${linkedCats.length} catálogos · ${linkedCats.reduce((s: number, c: any) => s + (c.images?.length ?? 0), 0)} imágenes`,
                    ``,
                    `¿Avanzar a fase <b>PDF</b>?`,
                    `<i>Auto-aprobación en 24h si no respondes</i>`,
                ].join("\n");

                let msgId: number | null = null;
                if (sampleImage?.url) {
                    msgId = await sendTelegramPhotoApproval({
                        imageUrl: sampleImage.url,
                        caption,
                        actionId: String(action._id),
                        nicheId: String(niche._id),
                    });
                } else {
                    msgId = await sendTelegramApproval({
                        text: caption,
                        actionId: String(action._id),
                    });
                }

                if (msgId) {
                    action.messageId = msgId;
                    await action.save();
                }

                processed++;
                continue;
            }

            // ── Phase: pdf → generate SEO listing ────────────────────────────
            if (phase === "pdf" && (!niche.listings || niche.listings.length === 0)) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `📝 Generando listing KDP para "${niche.name}"…` });
                try {
                    const res = await fetch(`${base}/ai/generate-text`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "full-listing", niche: niche.name, productType: niche.productType ?? "coloring-book", language: "en" }),
                    });
                    if (res.ok) {
                        const data = await res.json() as any;
                        const listing = {
                            title: data.result?.title ?? "",
                            subtitle: data.result?.subtitle ?? "",
                            description: data.result?.description ?? "",
                            keywords: data.result?.keywords ?? [],
                            generatedAt: new Date(),
                        };
                        await Niche.findByIdAndUpdate(niche._id, { $push: { listings: listing } });
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ Listing SEO generado para "${niche.name}"` });

                        // Ask approval before marking as published
                        const action = await TelegramAction.create({
                            type: "phase-approve",
                            nicheId: String(niche._id),
                            nicheName: niche.name,
                            targetPhase: "published",
                            autoApproveAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        });

                        const text = [
                            `📝 <b>Listing KDP generado</b>`,
                            ``,
                            `📚 <b>${niche.name}</b>`,
                            ``,
                            `<b>Título:</b> ${listing.title}`,
                            `<b>Keywords:</b> ${listing.keywords.slice(0, 3).join(", ")}…`,
                            ``,
                            `¿Marcar como <b>publicado</b>?`,
                            `<i>Auto-aprobación en 24h si no respondes</i>`,
                        ].join("\n");

                        const msgId = await sendTelegramApproval({ text, actionId: String(action._id) });
                        if (msgId) { action.messageId = msgId; await action.save(); }
                    }
                } catch (e: any) {
                    console.error(`${tag} [${niche.name}] listing error:`, e.message);
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error generando listing: ${e.message}` });
                }
                processed++;
                continue;
            }
        }

        console.log(`${tag} Run complete — processed ${processed} niches`);
        io?.emit("autopilot:done", { processed, timestamp: new Date().toISOString() });
        if (processed > 0) {
            await sendTelegram(`✅ <b>Auto-Pilot completado</b>\n${processed} nicho${processed !== 1 ? "s" : ""} procesado${processed !== 1 ? "s" : ""}`);
        }
    });
}
