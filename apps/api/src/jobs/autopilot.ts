import type { Agenda, Job } from "agenda";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { TelegramAction } from "../models/telegram-action.js";
import { sendTelegram, sendTelegramPhotoDiscovery, sendTelegramApproval, shouldNotify } from "../lib/telegram.js";

export const AUTOPILOT_JOB_NAME = "autopilot-run";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

type AutoPilotConfig = {
    catalogsPerNiche: number;
    imagesPerCatalog: number;
    maxNichesPerRun: number;
};

async function getConfig(): Promise<AutoPilotConfig> {
    try {
        const rows = await Settings.find({
            key: { $in: ["AUTOPILOT_CATALOGS_PER_NICHE", "AUTOPILOT_IMAGES_PER_CATALOG", "AUTOPILOT_MAX_NICHES"] },
        }).lean();
        const map = new Map((rows as any[]).map((r) => [r.key, r.value]));
        return {
            catalogsPerNiche: parseInt((map.get("AUTOPILOT_CATALOGS_PER_NICHE") as string) ?? "8") || 8,
            imagesPerCatalog: parseInt((map.get("AUTOPILOT_IMAGES_PER_CATALOG") as string) ?? "5") || 5,
            maxNichesPerRun: parseInt((map.get("AUTOPILOT_MAX_NICHES") as string) ?? "3") || 3,
        };
    } catch {
        return { catalogsPerNiche: 8, imagesPerCatalog: 5, maxNichesPerRun: 3 };
    }
}

async function hasPendingAction(nicheId: string): Promise<boolean> {
    const count = await TelegramAction.countDocuments({ nicheId, status: "pending" });
    return count > 0;
}

// Build a Pollinations URL for the sample image (public URL, no Cloudinary needed)
function buildSampleUrl(nicheName: string, style: string, productType: string): string {
    let prompt: string;
    let model = "flux";

    if (productType === "printable-poster") {
        prompt = `${nicheName} printable wall art poster, colorful illustration, clean design, no text`;
        model = "flux-realism";
    } else {
        // coloring book
        switch (style) {
            case "anime":
                prompt = `Anime coloring page ${nicheName}, ultra thick clean black outlines, white background, zero shading, no grey`;
                model = "flux-anime";
                break;
            case "children":
                prompt = `Cute children coloring page ${nicheName}, thick clean black outlines, white background, simple shapes, no shading`;
                break;
            case "realistic":
                prompt = `Realistic coloring page ${nicheName}, detailed thick black outlines, white background, zero shading`;
                model = "flux-realism";
                break;
            default:
                prompt = `Coloring page ${nicheName}, ultra thick clean black outlines, white background, high contrast, zero shading, zero gradients`;
        }
    }

    const seed = Math.floor(Math.random() * 99999);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${model}&width=1024&height=1024&nologo=true&seed=${seed}`;
}

// ── PHASE 1: Discovery ────────────────────────────────────────────────────────
// Find "found" niches that don't have a sample image yet → generate prompt → sample → ask Telegram
async function runDiscovery(
    cfg: AutoPilotConfig,
    base: string,
    io: any,
    tag: string
): Promise<number> {
    // Count total pending (all found, no sample yet)
    const totalPending = await Niche.countDocuments({
        status: "found",
        sampleImageUrl: { $exists: false },
        autoPilotEnabled: { $ne: true },
    });

    const candidates = await Niche.find({
        status: "found",
        sampleImageUrl: { $exists: false },
        autoPilotEnabled: { $ne: true },
    })
        .sort({ createdAt: -1 })
        .limit(cfg.maxNichesPerRun)
        .lean();

    if (candidates.length === 0) return 0;

    // Send summary before starting
    try {
        if (await shouldNotify("autopilot.run")) {
            await sendTelegram(
                `🔍 <b>Auto-Pilot — Descubrimiento</b>\n\n` +
                `📋 <b>${totalPending}</b> nicho${totalPending !== 1 ? "s" : ""} pendiente${totalPending !== 1 ? "s" : ""} en cola\n` +
                `⚡ Procesando <b>${candidates.length}</b> en este ciclo, uno por uno…`
            );
        }
    } catch { /* non-critical */ }

    let count = 0;

    for (let idx = 0; idx < candidates.length; idx++) {
        const niche = candidates[idx];
        if (await hasPendingAction(String(niche._id))) continue;

        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🔍 Nuevo nicho detectado: "${niche.name}"` });

        // Generate prompt if missing
        let prompt = niche.generatedPrompt;
        if (!prompt) {
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
                    prompt = [data.result?.theme, data.result?.specs, data.result?.details, data.result?.particulars]
                        .filter(Boolean).join("\n\n");
                    if (prompt) {
                        await Niche.findByIdAndUpdate(niche._id, { $set: { generatedPrompt: prompt } });
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ Prompt generado para "${niche.name}"` });
                    }
                }
            } catch (e: any) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error generando prompt: ${e.message}` });
            }
        }

        // Build sample image URL (Pollinations — public URL)
        const sampleUrl = buildSampleUrl(niche.name, niche.styleCategory ?? "generic", niche.productType ?? "coloring-book");
        await Niche.findByIdAndUpdate(niche._id, { $set: { sampleImageUrl: sampleUrl } });
        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🖼️ Imagen de muestra generada para "${niche.name}"` });

        // Create pending action
        const action = await TelegramAction.create({
            type: "niche-discovery",
            nicheId: String(niche._id),
            nicheName: niche.name,
            imageUrl: sampleUrl,
            autoApproveAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h auto-discard
        });

        const styleLabel: Record<string, string> = {
            generic: "Estilo genérico", anime: "Anime", illustration: "Ilustración",
            children: "Infantil", realistic: "Realista", watercolor: "Acuarela",
            abstract: "Abstracto", "wall-art": "Wall Art", botanical: "Botánico",
            affirmation: "Afirmación", geometric: "Geométrico", celestial: "Celestial", retro: "Retro",
        };
        const typeLabel = niche.productType === "printable-poster" ? "Póster imprimible" : "Libro de colorear";

        const caption = [
            `🔍 <b>Nuevo nicho encontrado</b>`,
            ``,
            `📚 <b>${niche.name}</b>`,
            `🎨 ${styleLabel[niche.styleCategory ?? "generic"] ?? niche.styleCategory} · ${typeLabel}`,
            niche.description ? `📝 ${niche.description}` : null,
            ``,
            `¿Qué hacemos con este nicho?`,
            `<i>🚀 Continuar → lanza ${cfg.catalogsPerNiche} catálogos × ${cfg.imagesPerCatalog} imágenes</i>`,
        ].filter(Boolean).join("\n");

        const msgId = await sendTelegramPhotoDiscovery({
            imageUrl: sampleUrl,
            caption,
            actionId: String(action._id),
        });

        if (msgId) { action.messageId = msgId; await action.save(); }
        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `📩 Esperando tu decisión en Telegram para "${niche.name}"` });
        count++;

        // Upload to Cloudinary after 12s (gives Pollinations time to render)
        const nicheId = String(niche._id);
        setTimeout(async () => {
            try {
                const cldRes = await fetch(`${base}/cloudinary/upload-url`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: sampleUrl, nicheId }),
                });
                if (cldRes.ok) {
                    const cldData = await (cldRes as any).json();
                    const cloudUrl = cldData.image?.url;
                    if (cloudUrl) {
                        await Niche.findByIdAndUpdate(nicheId, { $set: { sampleImageUrl: cloudUrl } });
                    }
                }
            } catch { /* non-critical */ }
        }, 12_000);

        // Wait between niches so Pollinations doesn't receive parallel render requests
        if (idx < candidates.length - 1) await delay(6_000);
    }

    return count;
}

// ── PHASE 2: Pipeline ─────────────────────────────────────────────────────────
// Process niches that were approved (autoPilotEnabled = true, phase = catalog/pdf)
async function runPipeline(
    cfg: AutoPilotConfig,
    base: string,
    io: any,
    tag: string
): Promise<number> {
    const candidates = await Niche.find({ autoPilotEnabled: true, status: "active" })
        .sort({ createdAt: 1 })
        .limit(cfg.maxNichesPerRun * 4)
        .lean();

    let processed = 0;

    for (const niche of candidates) {
        if (processed >= cfg.maxNichesPerRun) break;
        if (await hasPendingAction(String(niche._id))) {
            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⏳ "${niche.name}" esperando aprobación en Telegram` });
            continue;
        }

        const phase = niche.phase ?? "niche";

        // ── niche → launch catalogs ──────────────────────────────────────────
        if (phase === "niche") {
            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🖼️ Lanzando ${cfg.catalogsPerNiche} catálogos para "${niche.name}"…` });
            try {
                for (let i = 0; i < cfg.catalogsPerNiche; i++) {
                    await fetch(`${base}/catalogs`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: `${niche.name} — v${i + 1}`,
                            prompt: niche.generatedPrompt || niche.name,
                            imageCount: cfg.imagesPerCatalog,
                            style: niche.styleCategory ?? "generic",
                            nicheIds: [String(niche._id)],
                            productType: niche.productType ?? "coloring-book",
                        }),
                    });
                    await new Promise(r => setTimeout(r, 400));
                }
                await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "catalog" } });
                io?.emit("niches:updated");
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ ${cfg.catalogsPerNiche} catálogos lanzados para "${niche.name}"` });
                if (await shouldNotify("pipeline.complete")) {
                    await sendTelegram(`🏭 <b>${niche.name}</b>\n🖼️ ${cfg.catalogsPerNiche} catálogos en generación · ${cfg.catalogsPerNiche * cfg.imagesPerCatalog} imágenes totales`);
                }
            } catch (e: any) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error lanzando catálogos: ${e.message}` });
            }
            processed++;
            continue;
        }

        // ── catalog → check completion ────────────────────────────────────────
        if (phase === "catalog") {
            const { Catalog } = await import("../models/catalog.js");
            const linkedCats = await Catalog.find({ nicheIds: String(niche._id) }).lean();
            const total = linkedCats.length;
            const done = linkedCats.filter((c: any) => c.status === "completed").length;

            if (total === 0 || done < total) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⏳ "${niche.name}": catálogos ${done}/${total} listos` });
                continue;
            }

            // All done — ask approval before PDF
            const totalImages = linkedCats.reduce((s: number, c: any) => s + (c.images?.length ?? 0), 0);
            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✅ Catálogos completos: ${totalImages} imágenes generadas para "${niche.name}"` });

            // Pick a sample image from the catalogs
            const sampleImg = linkedCats.flatMap((c: any) => c.images ?? []).find((img: any) => img?.url);

            const action = await TelegramAction.create({
                type: "phase-approve",
                nicheId: String(niche._id),
                nicheName: niche.name,
                targetPhase: "pdf",
                imageUrl: sampleImg?.url,
                autoApproveAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            });

            const text = [
                `📦 <b>Catálogos completados</b>`,
                ``,
                `📚 <b>${niche.name}</b>`,
                `🖼️ ${totalImages} imágenes en ${total} catálogos`,
                ``,
                `¿Generar listing SEO y avanzar a PDF?`,
                `<i>Auto-aprobación en 24h</i>`,
            ].join("\n");

            if (await shouldNotify("pipeline.complete")) {
                const msgId = await sendTelegramApproval({ text, actionId: String(action._id) });
                if (msgId) { action.messageId = msgId; await action.save(); }
            }
            processed++;
            continue;
        }

        // ── pdf → generate SEO listing ────────────────────────────────────────
        if (phase === "pdf" && (!niche.listings || niche.listings.length === 0)) {
            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `📝 Generando listing KDP para "${niche.name}"…` });
            try {
                const res = await fetch(`${base}/ai/generate-text`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "full-listing",
                        niche: niche.name,
                        productType: niche.productType ?? "coloring-book",
                        language: "en",
                    }),
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
                    io?.emit("niches:updated");
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ Listing SEO listo para "${niche.name}"` });

                    const action = await TelegramAction.create({
                        type: "phase-approve",
                        nicheId: String(niche._id),
                        nicheName: niche.name,
                        targetPhase: "published",
                        autoApproveAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    });

                    const text = [
                        `📝 <b>Listing KDP listo</b>`,
                        ``,
                        `📚 <b>${niche.name}</b>`,
                        ``,
                        `<b>Título:</b> ${listing.title}`,
                        listing.keywords.length > 0 ? `<b>Keywords:</b> ${listing.keywords.slice(0, 4).join(", ")}…` : null,
                        ``,
                        `¿Marcar como <b>publicado</b>?`,
                        `<i>Auto-aprobación en 24h</i>`,
                    ].filter(Boolean).join("\n");

                    if (await shouldNotify("listing.generated")) {
                        const msgId = await sendTelegramApproval({ text, actionId: String(action._id) });
                        if (msgId) { action.messageId = msgId; await action.save(); }
                    }
                }
            } catch (e: any) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error generando listing: ${e.message}` });
            }
            processed++;
            continue;
        }
    }

    return processed;
}

export function defineAutoPilotJob(agenda: Agenda, io: any) {
    agenda.define(AUTOPILOT_JOB_NAME, async (_job: Job) => {
        const port = process.env.PORT || 3001;
        const base = `http://localhost:${port}`;
        const tag = "[autopilot]";

        console.log(`${tag} Run started at ${new Date().toISOString()}`);
        const cfg = await getConfig();

        if (await shouldNotify("autopilot.run")) {
            await sendTelegram(`🤖 <b>Auto-Pilot</b> — Ciclo iniciado`).catch(() => {});
        }

        const discovered = await runDiscovery(cfg, base, io, tag);
        const processed = await runPipeline(cfg, base, io, tag);

        const total = discovered + processed;
        console.log(`${tag} Done — ${discovered} discovered, ${processed} pipeline steps`);
        io?.emit("autopilot:done", { processed: total, timestamp: new Date().toISOString() });

        if (await shouldNotify("autopilot.run")) {
            await sendTelegram(
                `✅ <b>Auto-Pilot completado</b>\n` +
                (discovered > 0 ? `🔍 ${discovered} nicho${discovered !== 1 ? "s" : ""} nuevo${discovered !== 1 ? "s" : ""}\n` : "") +
                (processed > 0 ? `⚙️ ${processed} paso${processed !== 1 ? "s" : ""} de pipeline procesado${processed !== 1 ? "s" : ""}` : `ℹ️ Sin cambios en este ciclo`)
            ).catch(() => {});
        }
    });
}
