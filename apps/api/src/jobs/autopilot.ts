import type { Agenda, Job } from "agenda";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { sendTelegram } from "../lib/telegram.js";

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

export function defineAutoPilotJob(agenda: Agenda, io: any) {
    agenda.define(AUTOPILOT_JOB_NAME, async (_job: Job) => {
        const port = process.env.PORT || 3001;
        const base = `http://localhost:${port}`;
        const tag = "[autopilot]";

        console.log(`${tag} Run started at ${new Date().toISOString()}`);
        const cfg = await getConfig();

        // 1. Find niches with autoPilotEnabled = true that haven't progressed
        const candidates = await Niche.find({ autoPilotEnabled: true })
            .sort({ createdAt: 1 })
            .limit(cfg.maxNichesPerRun * 4)
            .lean();

        let processed = 0;

        for (const niche of candidates) {
            if (processed >= cfg.maxNichesPerRun) break;

            const phase = niche.phase ?? "niche";

            // ── Phase: niche → generate content ──────────────────────────
            if (phase === "niche" && !niche.generatedPrompt) {
                console.log(`${tag} [${niche.name}] Generating content…`);
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
                            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ Contenido generado para "${niche.name}"` });
                            console.log(`${tag} [${niche.name}] Content OK`);
                        }
                    }
                } catch (e: any) {
                    console.error(`${tag} [${niche.name}] content error:`, e.message);
                }
                processed++;
                continue;
            }

            // ── Phase: niche (has prompt) → launch catalogs ───────────────
            if (phase === "niche" && niche.generatedPrompt) {
                console.log(`${tag} [${niche.name}] Launching ${cfg.catalogsPerNiche} catalogs…`);
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
                    await sendTelegram(`🏭 <b>Auto-Pilot</b>\n✅ ${cfg.catalogsPerNiche} catálogos lanzados para <b>${niche.name}</b>`);
                    console.log(`${tag} [${niche.name}] Catalogs launched`);
                } catch (e: any) {
                    console.error(`${tag} [${niche.name}] catalog error:`, e.message);
                }
                processed++;
                continue;
            }

            // ── Phase: catalog → check completion → advance to pdf ────────
            if (phase === "catalog") {
                const linkedCats = await (await import("../models/catalog.js")).Catalog
                    .find({ nicheIds: String(niche._id) }).lean();
                const allDone = linkedCats.length > 0 && linkedCats.every((c: any) => c.status === "completed");
                if (allDone) {
                    await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "pdf" } });
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ Catálogos completos → avanzando a PDF para "${niche.name}"` });
                    await sendTelegram(`📚 <b>Auto-Pilot</b>\n✅ Catálogos listos para <b>${niche.name}</b> — listo para PDF`);
                    console.log(`${tag} [${niche.name}] → pdf`);
                    processed++;
                }
                continue;
            }

            // ── Phase: pdf → generate SEO listing ─────────────────────────
            if (phase === "pdf" && (!niche.listings || niche.listings.length === 0)) {
                console.log(`${tag} [${niche.name}] Generating KDP listing…`);
                try {
                    const res = await fetch(`${base}/ai/generate-text`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "full-listing", niche: niche.name, productType: niche.productType ?? "coloring-book", language: "en" }),
                    });
                    if (res.ok) {
                        const data = await res.json() as any;
                        const listing = { title: data.result?.title ?? "", subtitle: data.result?.subtitle ?? "", description: data.result?.description ?? "", keywords: data.result?.keywords ?? [], generatedAt: new Date() };
                        await Niche.findByIdAndUpdate(niche._id, { $push: { listings: listing } });
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ Listing SEO generado para "${niche.name}"` });
                        await sendTelegram(`📝 <b>Auto-Pilot</b>\n✅ Listing KDP generado para <b>${niche.name}</b> — listo para publicar`);
                        console.log(`${tag} [${niche.name}] Listing OK`);
                    }
                } catch (e: any) {
                    console.error(`${tag} [${niche.name}] listing error:`, e.message);
                }
                processed++;
                continue;
            }
        }

        console.log(`${tag} Run complete — processed ${processed} niches`);
        io?.emit("autopilot:done", { processed, timestamp: new Date().toISOString() });
    });
}
