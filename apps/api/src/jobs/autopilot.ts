import type { Agenda, Job } from "agenda";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { TelegramAction } from "../models/telegram-action.js";
import { AutopilotRun } from "../models/autopilot-run.js";
import { sendTelegram, sendTelegramPhotoDiscovery, shouldNotify } from "../lib/telegram.js";

type RunStats = { discovered: number; pipelineProcessed: number; catalogsCreated: number };

function emitStage(io: any, stage: string, nicheId: string, nicheName: string) {
    io?.emit("autopilot:stage", { stage, nicheId, nicheName });
}

export const AUTOPILOT_JOB_NAME = "autopilot-run";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Map niche style to a Pollinations model (mirrors NICHE_STYLE_MODEL in the frontend)
function styleToAiModel(styleCategory: string) {
    const modelIds: Record<string, string> = {
        anime: "flux-anime",
        realistic: "flux-realism",
        "wall-art": "flux-realism",
        affirmation: "flux-realism",
        geometric: "flux-realism",
        celestial: "flux-realism",
    };
    const modelId = modelIds[styleCategory] ?? "flux";
    return { id: `pollinations-${modelId}`, name: "FLUX (Pollinations)", provider: "Pollinations", modelId };
}

type AutoPilotConfig = {
    catalogsPerNiche: number;
    imagesPerCatalog: number;
    maxNichesPerRun: number;
};

type AbortSignal = { aborted: boolean; reason: string };

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
    tag: string,
    abort: AbortSignal,
    stats: RunStats
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
        if (abort.aborted) break;
        await checkUserAbort(abort);
        if (abort.aborted) break;
        const niche = candidates[idx];
        if (await hasPendingAction(String(niche._id))) continue;

        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🔍 Nuevo nicho detectado: "${niche.name}"` });
        emitStage(io, "discovery", String(niche._id), niche.name);

        if (abort.aborted) break;

        // Generate prompt if missing
        let prompt = niche.generatedPrompt;
        if (!prompt) {
            emitStage(io, "prompt", String(niche._id), niche.name);
            try {
                const productType = niche.productType ?? "coloring-book";
                const style = niche.styleCategory ?? "generic";
                const aiType = productType === "printable-poster" ? "printable-particulars" : "niche-particulars";
                const res = await fetch(`${base}/ai/generate-text`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: aiType, niche: niche.name, productType, extras: style }),
                });
                if (res.status === 429) {
                    abort.aborted = true;
                    abort.reason = "Cuota de IA agotada (429) durante descubrimiento";
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⛔ Límite de cuota alcanzado. Deteniendo ciclo.` });
                    break;
                }
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
        emitStage(io, "sample", String(niche._id), niche.name);
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
        stats.discovered++;

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

function buildCoverPrompt(subject: string, style: string, productType: string): string {
    if (productType === "printable-poster") {
        return `Vibrant colorful wall art poster of ${subject}, decorative illustration, beautiful colors, portrait orientation, no text, no watermarks, clean design`;
    }
    const styleHints: Record<string, string> = {
        anime: `anime illustration style, vibrant colors, detailed character art`,
        children: `cute colorful children's book illustration, friendly characters, bright pastel colors`,
        realistic: `photorealistic digital painting, rich vibrant colors, highly detailed`,
        watercolor: `beautiful watercolor illustration, soft colors, artistic brushwork`,
        abstract: `abstract colorful geometric art, vibrant shapes and patterns`,
        "wall-art": `decorative wall art illustration, elegant vibrant colors`,
        botanical: `detailed botanical illustration, lush vibrant plants and flowers`,
        affirmation: `inspirational decorative illustration, warm vibrant colors, uplifting mood`,
        geometric: `colorful geometric mandala art, intricate symmetrical patterns`,
        celestial: `mystical celestial illustration, stars galaxies cosmic colors, magical atmosphere`,
        retro: `retro vintage illustration, warm earthy tones, nostalgic style`,
    };
    const hint = styleHints[style] ?? "colorful digital illustration, vibrant colors";
    return `Book cover art for ${subject} coloring book, ${hint}, no text, no words, no letters, no watermarks, portrait orientation, professional book cover quality, highly detailed`;
}

// ── PHASE 2: Pipeline ─────────────────────────────────────────────────────────
// Process niches that were approved (autoPilotEnabled = true, phase = catalog/seo/cover)
async function runPipeline(
    cfg: AutoPilotConfig,
    base: string,
    io: any,
    tag: string,
    abort: AbortSignal,
    stats: RunStats,
    agenda: any
): Promise<number> {
    const candidates = await Niche.find({ autoPilotEnabled: true, status: "active" })
        .sort({ createdAt: 1 })
        .limit(cfg.maxNichesPerRun * 4)
        .lean();

    let processed = 0;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;

    for (const niche of candidates) {
        if (abort.aborted) break;
        await checkUserAbort(abort);
        if (abort.aborted) break;
        if (processed >= cfg.maxNichesPerRun) break;
        if (await hasPendingAction(String(niche._id))) {
            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⏳ "${niche.name}" esperando aprobación en Telegram` });
            continue;
        }

        const phase = niche.phase ?? "niche";

        // ── niche → launch catalogs ──────────────────────────────────────────
        if (phase === "niche") {
            emitStage(io, "catalog", String(niche._id), niche.name);
            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🖼️ Lanzando ${cfg.catalogsPerNiche} catálogos para "${niche.name}"…` });
            try {
                const aiModel = styleToAiModel(niche.styleCategory ?? "generic");
                for (let i = 0; i < cfg.catalogsPerNiche; i++) {
                    const res = await fetch(`${base}/catalogs`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: `${niche.name} — v${i + 1}`,
                            prompt: niche.generatedPrompt || niche.name,
                            totalImages: cfg.imagesPerCatalog,
                            aiModel,
                            nicheIds: [String(niche._id)],
                            productType: niche.productType ?? "coloring-book",
                        }),
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({})) as any;
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error creando catálogo ${i + 1}: ${err?.error ?? res.status}` });
                        consecutiveErrors++;
                        if (res.status === 429 || consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                            abort.aborted = true;
                            abort.reason = res.status === 429
                                ? "Cuota de IA agotada (429) durante generación de catálogos"
                                : `${MAX_CONSECUTIVE_ERRORS} errores consecutivos en catálogos`;
                            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⛔ ${abort.reason}. Deteniendo ciclo.` });
                            break;
                        }
                    } else {
                        consecutiveErrors = 0;
                    }
                    if (abort.aborted) break;
                    await new Promise(r => setTimeout(r, 400));
                }
                if (!abort.aborted) {
                    stats.catalogsCreated += cfg.catalogsPerNiche;
                    await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "catalog" } });
                    io?.emit("niches:updated");
                    io?.emit("catalogs:updated");
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ ${cfg.catalogsPerNiche} catálogos lanzados para "${niche.name}"` });
                    if (await shouldNotify("pipeline.complete")) {
                        await sendTelegram(`🏭 <b>${niche.name}</b>\n🖼️ ${cfg.catalogsPerNiche} catálogos en generación · ${cfg.catalogsPerNiche * cfg.imagesPerCatalog} imágenes totales`);
                    }
                }
            } catch (e: any) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error lanzando catálogos: ${e.message}` });
                consecutiveErrors++;
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    abort.aborted = true;
                    abort.reason = `${MAX_CONSECUTIVE_ERRORS} errores consecutivos críticos en pipeline`;
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⛔ ${abort.reason}. Deteniendo ciclo.` });
                }
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
            // Terminal = completed + cancelled + failed (no longer progressing)
            const terminal = linkedCats.filter((c: any) => ["completed", "cancelled", "failed"].includes(c.status)).length;
            const stillActive = total - terminal; // running/pending/queued

            if (total === 0 || stillActive > 0) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⏳ "${niche.name}": catálogos ${done}/${total} listos (${stillActive} activos)` });
                continue;
            }

            if (done === 0) {
                // All failed/cancelled — nothing to show, skip this niche
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ "${niche.name}": todos los catálogos fallaron o fueron cancelados` });
                await Niche.findByIdAndUpdate(niche._id, { $set: { autoPilotEnabled: false } });
                io?.emit("niches:updated");
                processed++;
                continue;
            }

            // All terminal and at least some completed — advance to seo
            const totalImages = linkedCats.reduce((s: number, c: any) => s + (c.images?.length ?? 0), 0);
            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✅ Catálogos completos: ${totalImages} imágenes → avanzando a SEO` });

            await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "seo" } });
            io?.emit("niches:updated");

            if (await shouldNotify("pipeline.complete")) {
                await sendTelegram(
                    `📦 <b>Catálogos listos</b>\n📚 <b>${niche.name}</b>\n🖼️ ${totalImages} imágenes en ${total} catálogos\n\n⚙️ Generando listing SEO automáticamente…`
                ).catch(() => {});
            }

            // Schedule a follow-up run to pick up the seo phase
            setTimeout(() => { agenda?.now("autopilot-run", {}).catch(() => {}); }, 8_000);
            processed++;
            continue;
        }

        // ── seo (or legacy pdf) → generate SEO listing ───────────────────────
        if ((phase === "seo" || (phase as string) === "pdf") && (!niche.listings || niche.listings.length === 0)) {
            emitStage(io, "listing", String(niche._id), niche.name);
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
                if (res.status === 429) {
                    abort.aborted = true;
                    abort.reason = "Cuota de IA agotada (429) durante generación de listing SEO";
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⛔ Límite de cuota alcanzado al generar listing. Deteniendo ciclo.` });
                } else if (res.ok) {
                    consecutiveErrors = 0;
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
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ Listing SEO listo para "${niche.name}" → generando portada…` });

                    // Advance to cover phase
                    await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "cover" } });
                    io?.emit("niches:updated");

                    const notifText = [
                        `📝 <b>Listing KDP listo</b>`,
                        ``,
                        `📚 <b>${niche.name}</b>`,
                        ``,
                        `<b>Título:</b> ${listing.title}`,
                        listing.keywords.length > 0 ? `<b>Keywords:</b> ${listing.keywords.slice(0, 4).join(", ")}…` : null,
                        ``,
                        `🎨 Generando portada automáticamente…`,
                    ].filter(Boolean).join("\n");

                    if (await shouldNotify("listing.generated")) {
                        await sendTelegram(notifText).catch(() => {});
                    }

                    // Schedule a follow-up run to pick up the cover phase
                    setTimeout(() => { agenda?.now("autopilot-run", {}).catch(() => {}); }, 8_000);
                }
            } catch (e: any) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error generando listing: ${e.message}` });
                consecutiveErrors++;
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    abort.aborted = true;
                    abort.reason = `${MAX_CONSECUTIVE_ERRORS} errores consecutivos en generación de listings`;
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⛔ ${abort.reason}. Deteniendo ciclo.` });
                }
            }
            if (!abort.aborted) { processed++; stats.pipelineProcessed++; }
            continue;
        }

        // ── cover → generate KDP cover image ─────────────────────────────────
        if (phase === "cover" && !niche.coverUrl) {
            emitStage(io, "cover", String(niche._id), niche.name);
            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🎨 Generando portada para "${niche.name}"…` });

            try {
                const style = niche.styleCategory ?? "generic";
                const listing = (niche.listings ?? [])[0];
                const coverSubject = listing?.title
                    ? listing.title.replace(/coloring book|coloring pages?/gi, "").trim()
                    : niche.name;

                const coverPrompt = buildCoverPrompt(coverSubject, style, niche.productType ?? "coloring-book");
                const model = style === "anime" ? "flux-anime"
                    : ["realistic", "wall-art", "affirmation", "geometric", "celestial"].includes(style) ? "flux-realism"
                    : "flux";

                const seed = Math.floor(Math.random() * 99999);
                const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?model=${model}&width=768&height=1024&nologo=true&seed=${seed}`;

                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🖼️ Descargando portada desde Pollinations…` });

                // Fetch the image buffer
                const imgRes = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(90_000) });
                if (!imgRes.ok) throw new Error(`Pollinations HTTP ${imgRes.status}`);
                const arrayBuf = await imgRes.arrayBuffer();
                const imageBuffer = Buffer.from(arrayBuf);

                // Upload to Cloudinary in covers/ folder
                const port = process.env.PORT || 3001;
                const base = `http://localhost:${port}`;
                const formData = new FormData();
                formData.append("buffer", new Blob([imageBuffer], { type: "image/png" }), "cover.png");
                formData.append("folder", "covers");
                formData.append("nicheId", String(niche._id));

                // Use the existing upload-buffer endpoint or fall back to storing the Pollinations URL directly
                let coverUrl = pollinationsUrl;
                try {
                    const cldRes = await fetch(`${base}/cloudinary/upload-url`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url: pollinationsUrl, nicheId: String(niche._id), folder: "covers" }),
                    });
                    if (cldRes.ok) {
                        const cldData = await (cldRes as any).json();
                        coverUrl = cldData.image?.url ?? pollinationsUrl;
                    }
                } catch { /* use Pollinations URL as fallback */ }

                await Niche.findByIdAndUpdate(niche._id, {
                    $set: { coverUrl, phase: "published" },
                });
                io?.emit("niches:updated");
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✅ Portada lista → "${niche.name}" PUBLICADO` });

                if (await shouldNotify("pipeline.complete")) {
                    await sendTelegram(
                        `🎨 <b>Portada generada</b>\n\n` +
                        `📚 <b>${niche.name}</b>\n\n` +
                        `✅ <b>Pipeline completo</b> — listo para subir a KDP`
                    ).catch(() => {});
                }

            } catch (e: any) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error generando portada: ${e.message}` });
                consecutiveErrors++;
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    abort.aborted = true;
                    abort.reason = `${MAX_CONSECUTIVE_ERRORS} errores consecutivos en generación de portada`;
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⛔ ${abort.reason}. Deteniendo ciclo.` });
                }
            }
            if (!abort.aborted) { processed++; stats.pipelineProcessed++; }
            continue;
        }
    }

    return processed;
}

async function checkUserAbort(abort: AbortSignal): Promise<void> {
    try {
        const row = await Settings.findOne({ key: "AUTOPILOT_ABORT" }).lean();
        if ((row as any)?.value === "1") {
            abort.aborted = true;
            abort.reason = "Detenido manualmente desde Telegram (/parar)";
            // Clear the flag so next run is not blocked
            await Settings.findOneAndUpdate({ key: "AUTOPILOT_ABORT" }, { value: "0" });
        }
    } catch { /* non-critical */ }
}

export function defineAutoPilotJob(agenda: Agenda, io: any) {
    // concurrency: 1 ensures only one autopilot run at a time — extra triggers queue automatically
    agenda.define(AUTOPILOT_JOB_NAME, { concurrency: 1, lockLifetime: 40 * 60 * 1000 }, async (_job: Job) => {
        const port = process.env.PORT || 3001;
        const base = `http://localhost:${port}`;
        const tag = "[autopilot]";

        console.log(`${tag} Run started at ${new Date().toISOString()}`);
        const cfg = await getConfig();
        const abort: AbortSignal = { aborted: false, reason: "" };
        const stats: RunStats = { discovered: 0, pipelineProcessed: 0, catalogsCreated: 0 };

        // Clear any stale abort flag from a previous /parar
        await Settings.findOneAndUpdate({ key: "AUTOPILOT_ABORT" }, { value: "0" }).catch(() => {});

        // Clear stale phase-approve actions — these were used before the pipeline became fully automatic.
        // Any that remain would permanently block hasPendingAction() for their niche.
        await TelegramAction.deleteMany({ type: "phase-approve", status: "pending" }).catch(() => {});

        const run = await AutopilotRun.create({ startedAt: new Date(), status: "running" });

        if (await shouldNotify("autopilot.run")) {
            await sendTelegram(`🤖 <b>Auto-Pilot</b> — Ciclo iniciado`).catch(() => {});
        }

        const discovered = await runDiscovery(cfg, base, io, tag, abort, stats);
        const processed = abort.aborted ? 0 : await runPipeline(cfg, base, io, tag, abort, stats, agenda);

        const total = discovered + processed;
        console.log(`${tag} Done — ${discovered} discovered, ${processed} pipeline steps, aborted=${abort.aborted}`);

        if (abort.aborted) {
            await AutopilotRun.findByIdAndUpdate(run._id, {
                finishedAt: new Date(), status: "aborted", abortReason: abort.reason,
                discovered: stats.discovered, pipelineProcessed: stats.pipelineProcessed, catalogsCreated: stats.catalogsCreated,
            });
            io?.emit("autopilot:error", { message: abort.reason });
            if (await shouldNotify("api.error.quota")) {
                await sendTelegram(
                    `⛔ <b>Auto-Pilot detenido</b>\n\n` +
                    `${abort.reason}\n\n` +
                    `Los ciclos programados se reanudarán automáticamente. Comprueba tu cuota de IA.`
                ).catch(() => {});
            }
            return;
        }

        await AutopilotRun.findByIdAndUpdate(run._id, {
            finishedAt: new Date(), status: "completed",
            discovered: stats.discovered, pipelineProcessed: stats.pipelineProcessed, catalogsCreated: stats.catalogsCreated,
        });

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
