import type { Agenda, Job } from "agenda";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { TelegramAction } from "../models/telegram-action.js";
import { AutopilotRun } from "../models/autopilot-run.js";
import { sendTelegram, sendTelegramPhoto, sendTelegramPhotoDiscovery, sendTelegramImageWithButtons, shouldNotify } from "../lib/telegram.js";
import { withImageSlot, withLlmSlot } from "../lib/ai-semaphore.js";
import { buildCollage, buildHalfColored, pickCatalogImages, type CollageLayout } from "../lib/cover-collage.js";
import { generateCatalogPrompt } from "../lib/catalog-prompt.js";
import { getEvolutionSeed } from "../lib/prompt-evolution.js";
import { pollinationsFetch } from "../lib/pollinations-circuit.js";
import { generateImage, getAutopilotImageModel } from "../lib/image-gen.js";
import { buildColoringBookPrompt, buildPosterPrompt, buildSeamlessPatternPrompt } from "../routes/autopilot.js";
import { getAmazonKeywords } from "../lib/amazon-autocomplete.js";
import { createGumroadProduct } from "../lib/gumroad.js";

const _SERVER_API_KEY = process.env.SERVER_API_KEY || "";
function internalFetch(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, {
        ...init,
        headers: {
            ...(_SERVER_API_KEY ? { Authorization: `Bearer ${_SERVER_API_KEY}` } : {}),
            ...(init.headers as Record<string, string> ?? {}),
        },
    });
}

type RunStats = { discovered: number; pipelineProcessed: number; catalogsCreated: number };

function emitStage(io: any, stage: string, nicheId: string, nicheName: string) {
    io?.emit("autopilot:stage", { stage, nicheId, nicheName });
}

export const AUTOPILOT_JOB_NAME = "autopilot-run";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

type AutoPilotConfig = {
    catalogsPerNiche: number;
    imagesPerCatalog: number;
    maxNichesPerRun: number;
    maxActiveCatalogs: number;
};

type AbortSignal = { aborted: boolean; reason: string };

async function getConfig(): Promise<AutoPilotConfig> {
    try {
        const rows = await Settings.find({
            key: { $in: ["AUTOPILOT_CATALOGS_PER_NICHE", "AUTOPILOT_IMAGES_PER_CATALOG", "AUTOPILOT_MAX_NICHES", "MAX_ACTIVE_CATALOGS"] },
        }).lean();
        const map = new Map((rows as any[]).map((r) => [r.key, r.value]));
        return {
            catalogsPerNiche: parseInt((map.get("AUTOPILOT_CATALOGS_PER_NICHE") as string) ?? "8") || 8,
            imagesPerCatalog: parseInt((map.get("AUTOPILOT_IMAGES_PER_CATALOG") as string) ?? "5") || 5,
            maxNichesPerRun: parseInt((map.get("AUTOPILOT_MAX_NICHES") as string) ?? "3") || 3,
            maxActiveCatalogs: parseInt((map.get("MAX_ACTIVE_CATALOGS") as string) ?? "3") || 3,
        };
    } catch {
        return { catalogsPerNiche: 8, imagesPerCatalog: 5, maxNichesPerRun: 3, maxActiveCatalogs: 3 };
    }
}

async function getAutoApproveThreshold(): Promise<number> {
    try {
        const row = await Settings.findOne({ key: "AUTO_APPROVE_SCORE" }).lean();
        const val = parseInt((row as any)?.value ?? "");
        return isNaN(val) || val <= 0 ? 0 : val; // 0 = disabled
    } catch {
        return 0;
    }
}

async function hasPendingAction(nicheId: string): Promise<boolean> {
    const count = await TelegramAction.countDocuments({ nicheId, status: "pending" });
    return count > 0;
}

// Build a Pollinations URL for the sample image (public URL, no Cloudinary needed)
function buildSampleUrl(nicheName: string, style: string, productType: string, enhancedCore?: string): string {
    let prompt: string;
    let model = "flux";
    const core = enhancedCore ?? nicheName;

    if (productType === "printable-poster") {
        prompt = buildPosterPrompt(core, style);
        model = "flux-realism";
    } else if (productType === "seamless-pattern") {
        prompt = buildSeamlessPatternPrompt(core);
        model = "flux-realism";
    } else {
        // Style-aware coloring book formula
        prompt = buildColoringBookPrompt(core, style);
        if (style === "anime") model = "flux-anime";
        else if (style === "realistic") model = "flux-realism";
    }

    // No seed/width/height — those trigger Pollinations paid queue (max 1 concurrent free)
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${model}`;
}

async function buildAiEnhancedSampleCore(
    nicheName: string,
    productType: string,
    style: string,
    base: string
): Promise<string | null> {
    try {
        const aiType = productType === "printable-poster" ? "printable-particulars" : "niche-particulars";
        const res = await internalFetch(`${base}/ai/generate-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: aiType, niche: nicheName, productType, extras: style }),
            signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        // niche-particulars returns { particulars: "..." }; printable-particulars same schema
        const core = data.result?.particulars || data.result?.theme || data.result?.details;
        if (!core?.trim()) return null;
        return (core as string).trim().slice(0, 120);
    } catch {
        return null;
    }
}

// ── PHASE 1: Discovery ────────────────────────────────────────────────────────
// Find "found" niches that don't have a sample image yet → generate prompt → sample → ask Telegram
async function runDiscovery(
    cfg: AutoPilotConfig,
    base: string,
    io: any,
    tag: string,
    abort: AbortSignal,
    stats: RunStats,
    agenda: any
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
                const res = await withLlmSlot(`discovery-prompt:${String(niche._id)}`, () =>
                    fetch(`${base}/ai/generate-text`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: aiType, niche: niche.name, productType, extras: style }),
                        signal: AbortSignal.timeout(25_000),
                    })
                );
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

        // Auto-approve if score exceeds threshold — skip Telegram and launch pipeline directly
        const autoThreshold = await getAutoApproveThreshold();
        if (autoThreshold > 0 && (niche as any).score >= autoThreshold) {
            await Niche.findByIdAndUpdate(niche._id, {
                $set: { status: "active", phase: "niche", autoPilotEnabled: true },
            });
            io?.emit("niches:updated");
            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🤖 Auto-aprobado (score ${(niche as any).score} ≥ ${autoThreshold}) → pipeline lanzado` });
            if (await shouldNotify("autopilot.autoapprove")) {
                await sendTelegram(
                    `🤖 <b>Auto-aprobado</b> (score <b>${(niche as any).score}</b> ≥ ${autoThreshold})\n` +
                    `📚 <b>${niche.name}</b> → pipeline lanzado automáticamente`
                ).catch(() => {});
            }
            count++;
            stats.discovered++;
            await agenda.schedule("in 5 seconds", "autopilot-run", {}).catch(() => {});
            continue;
        }

        // Build sample image URL with AI-enhanced prompt for better quality
        emitStage(io, "sample", String(niche._id), niche.name);
        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🎨 Mejorando prompt de muestra con IA para "${niche.name}"…` });
        let sampleUrl: string;
        let discoveryImagePromptForAction = "";
        try {
            const aiCore = await buildAiEnhancedSampleCore(
                niche.name,
                niche.productType ?? "coloring-book",
                niche.styleCategory ?? "generic",
                base
            );
            if (aiCore) {
                sampleUrl = buildSampleUrl(niche.name, niche.styleCategory ?? "generic", niche.productType ?? "coloring-book", aiCore);
                discoveryImagePromptForAction = aiCore;
                await Niche.findByIdAndUpdate(niche._id, { $set: { discoveryImagePrompt: aiCore } });
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ Prompt mejorado por IA → pre-generando prompts de catálogo…` });
                // Pre-generate catalog prompts in background (ready when Telegram approves)
                const _nicheName = niche.name;
                const _nicheId = String(niche._id);
                const _productType = niche.productType ?? "coloring-book";
                const _style = niche.styleCategory ?? "generic";
                const _fallback = niche.generatedPrompt || niche.name;
                void (async () => {
                    try {
                        const evolutionSeed = await getEvolutionSeed(_productType).catch(() => "");
                        const prompts: string[] = [];
                        for (let i = 0; i < cfg.catalogsPerNiche; i++) {
                            const p = await withLlmSlot(`pre-catalog-prompt-${i}:${_nicheId}`, () =>
                                generateCatalogPrompt(base, _nicheName, _productType, _style, aiCore, i, evolutionSeed)
                            );
                            prompts.push((p as string | null) || _fallback);
                        }
                        await Niche.findByIdAndUpdate(_nicheId, { $set: { pendingCatalogPrompts: prompts } });
                        io?.emit("autopilot:log", { nicheId: _nicheId, message: `✓ ${prompts.length} prompts de catálogo pre-generados para "${_nicheName}"` });
                    } catch (e: any) {
                        io?.emit("autopilot:log", { nicheId: _nicheId, message: `⚠️ Error pre-generando prompts: ${e?.message}` });
                    }
                })();
            } else {
                sampleUrl = buildSampleUrl(niche.name, niche.styleCategory ?? "generic", niche.productType ?? "coloring-book");
            }
        } catch {
            sampleUrl = buildSampleUrl(niche.name, niche.styleCategory ?? "generic", niche.productType ?? "coloring-book");
        }
        await Niche.findByIdAndUpdate(niche._id, { $set: { sampleImageUrl: sampleUrl } });

        // Create TelegramAction IMMEDIATELY — hasPendingAction() blocks re-processing on the next run
        const action = await TelegramAction.create({
            type: "niche-discovery",
            nicheId: String(niche._id),
            nicheName: niche.name,
            imageUrl: sampleUrl,
            autoApproveAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        });

        count++;
        stats.discovered++;
        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `📬 "${niche.name}" registrado — imagen generándose en segundo plano…` });

        // Fire image generation + Telegram send in background (staggered so provider isn't flooded)
        // Each niche starts its image generation 20s after the previous, independent of the main loop.
        const _bgNiche = niche;
        const _bgBase = base;
        const _bgIo = io;
        const _bgAction = action;
        const _bgSampleUrl = sampleUrl;
        const _bgCfg = cfg;
        const _bgStagger = idx * 20_000;
        setTimeout(async () => {
            try {
                const bgPt = _bgNiche.productType ?? "coloring-book";
                const bgImageGenPrompt = bgPt === "printable-poster"
                    ? buildPosterPrompt(_bgNiche.name, _bgNiche.styleCategory ?? "generic")
                    : buildColoringBookPrompt(_bgNiche.name, _bgNiche.styleCategory ?? "generic");

                const bgDiscoveryAiModel = await getAutopilotImageModel();
                _bgIo?.emit("autopilot:log", { nicheId: String(_bgNiche._id), message: `🎨 Generando imagen con ${bgDiscoveryAiModel.name}…` });

                await Niche.findByIdAndUpdate(_bgNiche._id, { $set: { discoveryAiModel: bgDiscoveryAiModel } });

                let bgImageBytes: Buffer | null = null;
                let bgFinalImageUrl = _bgSampleUrl;

                try {
                    const aiRes = await internalFetch(`${_bgBase}/ai/generate-image`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            prompt: bgImageGenPrompt,
                            modelId: bgDiscoveryAiModel.modelId,
                            provider: bgDiscoveryAiModel.provider,
                            width: 1024,
                            height: 1024,
                        }),
                        signal: AbortSignal.timeout(90_000),
                    });
                    if (aiRes.ok && (aiRes.headers.get("content-type") ?? "").startsWith("image/")) {
                        bgImageBytes = Buffer.from(await aiRes.arrayBuffer());
                        _bgIo?.emit("autopilot:log", { nicheId: String(_bgNiche._id), message: `✓ Imagen generada con ${bgDiscoveryAiModel.name}` });
                    } else {
                        console.warn(`[discovery-bg] AI proxy ${aiRes.status} para ${bgDiscoveryAiModel.provider}`);
                    }
                } catch (aiErr: any) {
                    console.warn(`[discovery-bg] AI proxy error: ${aiErr?.message}`);
                }

                if (!bgImageBytes) {
                    _bgIo?.emit("autopilot:log", { nicheId: String(_bgNiche._id), message: `⚠️ ${bgDiscoveryAiModel.name} falló — usando fallback…` });
                    try { bgImageBytes = await generateImage(bgImageGenPrompt); } catch { /* non-critical */ }
                }

                // Upload to Cloudinary
                if (bgImageBytes) {
                    try {
                        const cldRes = await internalFetch(`${_bgBase}/cloudinary/upload-image`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ imageBase64: bgImageBytes.toString("base64"), nicheId: String(_bgNiche._id) }),
                        });
                        if (cldRes.ok) {
                            const cldData = await (cldRes as any).json();
                            const cloudUrl = cldData.image?.url;
                            if (cloudUrl) {
                                bgFinalImageUrl = cloudUrl;
                                await Niche.findByIdAndUpdate(_bgNiche._id, { $set: { sampleImageUrl: cloudUrl } });
                            }
                        }
                    } catch { /* non-critical */ }
                }

                const bgStyleLabel: Record<string, string> = {
                    generic: "Estilo genérico", anime: "Anime", illustration: "Ilustración",
                    children: "Infantil", realistic: "Realista", watercolor: "Acuarela",
                    abstract: "Abstracto", "wall-art": "Wall Art", botanical: "Botánico",
                    affirmation: "Afirmación", geometric: "Geométrico", celestial: "Celestial", retro: "Retro",
                };
                const bgTypeLabel = _bgNiche.productType === "printable-poster" ? "Póster imprimible" : "Libro de colorear";
                const bgCaption = [
                    `🔍 <b>Nuevo nicho encontrado</b>`,
                    ``,
                    `📚 <b>${_bgNiche.name}</b>`,
                    `🎨 ${bgStyleLabel[_bgNiche.styleCategory ?? "generic"] ?? _bgNiche.styleCategory} · ${bgTypeLabel}`,
                    _bgNiche.description ? `📝 ${_bgNiche.description}` : null,
                    ``,
                    `¿Qué hacemos con este nicho?`,
                    `<i>🚀 Continuar → lanza ${_bgCfg.catalogsPerNiche} catálogos × ${_bgCfg.imagesPerCatalog} imágenes</i>`,
                ].filter(Boolean).join("\n");

                const bgRows = [[
                    { text: "🚀 Continuar", callback_data: `continuar:${String(_bgAction._id)}` },
                    { text: "⏭️ Omitir",    callback_data: `omitir:${String(_bgAction._id)}` },
                    { text: "🗑️ Descartar", callback_data: `descartar:${String(_bgAction._id)}` },
                ]];

                const canDiscovery = await shouldNotify("autopilot.discovery");
                let bgMsgId: number | null = null;
                if (canDiscovery) {
                    if (bgImageBytes) {
                        bgMsgId = await sendTelegramImageWithButtons(bgImageBytes, bgCaption, bgRows);
                    }
                    if (!bgMsgId) {
                        bgMsgId = await sendTelegramPhotoDiscovery({ imageUrl: bgFinalImageUrl, caption: bgCaption, actionId: String(_bgAction._id) });
                    }
                }

                if (bgMsgId) { _bgAction.messageId = bgMsgId; await _bgAction.save(); }
                _bgIo?.emit("autopilot:log", { nicheId: String(_bgNiche._id), message: `📩 Esperando tu decisión en Telegram para "${_bgNiche.name}"` });
            } catch (e: any) {
                console.error(`[discovery-bg] Error para "${_bgNiche.name}":`, e.message);
            }
        }, _bgStagger);
    }

    return count;
}

function escapeXml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapText(text: string, maxChars: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
        if (line.length + word.length + 1 <= maxChars) {
            line = line ? line + " " + word : word;
        } else {
            if (line) lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    return lines.slice(0, 3); // max 3 lines
}

async function addCoverText(imageBuffer: Buffer, title: string, subtitle?: string): Promise<Buffer> {
    const sharpMod = await import("sharp");
    const meta = await sharpMod.default(imageBuffer).metadata();
    const W = meta.width ?? 768;
    const H = meta.height ?? 1024;

    const fontSize = Math.min(56, Math.max(22, Math.floor(W / 13)));
    const maxCharsPerLine = Math.floor(W / (fontSize * 0.58));
    const lines = wrapText(title, maxCharsPerLine);
    const lineHeight = fontSize * 1.35;
    const blockHeight = lines.length * lineHeight + (subtitle ? fontSize * 0.65 + 10 : 0);
    const textY = H - blockHeight - 32;
    const gradientTop = Math.max(textY - 40, H * 0.5);

    let textElements = "";
    for (let i = 0; i < lines.length; i++) {
        const y = textY + i * lineHeight + fontSize;
        textElements += `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="bold" fill="white">${escapeXml(lines[i])}</text>\n`;
    }
    if (subtitle) {
        const subFontSize = Math.floor(fontSize * 0.48);
        const subY = textY + lines.length * lineHeight + fontSize * 0.55;
        textElements += `<text x="${W / 2}" y="${subY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${subFontSize}" fill="rgba(255,255,255,0.82)">${escapeXml(subtitle)}</text>\n`;
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.78"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${gradientTop}" width="${W}" height="${H - gradientTop}" fill="url(#tg)"/>
  ${textElements}
</svg>`;

    return sharpMod.default(imageBuffer)
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .jpeg({ quality: 92 })
        .toBuffer();
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
                // Always use the exact prompt and model from the Telegram discovery image
                const discoveryPrompt = (niche as any).discoveryImagePrompt as string | undefined;
                const catalogPrompt = discoveryPrompt || niche.generatedPrompt || niche.name;
                const discoveryAiModelStored = (niche as any).discoveryAiModel as { id: string; name: string; provider: string; modelId: string } | undefined;
                const aiModel = discoveryAiModelStored ?? await getAutopilotImageModel();

                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🖼️ Usando prompt de descubrimiento · modelo: ${aiModel.name}` });

                for (let i = 0; i < cfg.catalogsPerNiche; i++) {
                    const res = await internalFetch(`${base}/catalogs`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: `${niche.name} — v${i + 1}`,
                            prompt: catalogPrompt,
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
                // Self-reschedule so we keep checking without relying solely on checkAutoPilotContinue
                await agenda.schedule("in 3 minutes", "autopilot-run", {}).catch(() => {});
                continue;
            }

            if (done === 0) {
                // All failed/cancelled — retry up to 2 times before giving up
                const MAX_RETRIES = 2;
                const { Catalog: CatalogModel } = await import("../models/catalog.js");
                const failedCats = linkedCats.filter((c: any) => c.status === "failed");
                const maxRetries = failedCats.length > 0 ? Math.max(...failedCats.map((c: any) => c.retries ?? 0)) : MAX_RETRIES;
                if (maxRetries < MAX_RETRIES && failedCats.length > 0) {
                    // Reset failed catalogs to queued and increment their retry counter
                    await CatalogModel.updateMany(
                        { nicheIds: String(niche._id), status: "failed" },
                        { $set: { status: "queued" }, $inc: { retries: 1 } }
                    );
                    io?.emit("catalogs:updated");
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🔄 "${niche.name}": reintentando ${failedCats.length} catálogos fallidos (intento ${maxRetries + 1}/${MAX_RETRIES})` });
                    processed++;
                    continue;
                }
                // Exhausted retries — disable autopilot for this niche
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ "${niche.name}": todos los catálogos fallaron tras ${MAX_RETRIES} reintentos` });
                await Niche.findByIdAndUpdate(niche._id, { $set: { autoPilotEnabled: false } });
                io?.emit("niches:updated");
                processed++;
                continue;
            }

            // All terminal and at least some completed — advance to libro (checkAutoPilotContinue handles this first; this is the fallback)
            const allImages: string[] = [];
            for (const cat of linkedCats) {
                for (const img of (cat as any).images ?? []) {
                    if (img.url) allImages.push(img.url as string);
                }
            }
            if (allImages.length > 0 && !((niche as any).catalogImageOrder?.length)) {
                // Shuffle only if not already set by checkAutoPilotContinue
                for (let i = allImages.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allImages[i], allImages[j]] = [allImages[j], allImages[i]];
                }
                await Niche.findByIdAndUpdate(niche._id, { $set: { catalogImageOrder: allImages } });
            }
            const totalImages = allImages.length;
            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✅ Catálogos completos: ${totalImages} imágenes → generando libro PDF` });

            await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "libro" } });
            io?.emit("niches:updated");

            if (await shouldNotify("pipeline.complete")) {
                await sendTelegram(
                    `📦 <b>Catálogos listos</b>\n📚 <b>${niche.name}</b>\n🖼️ ${totalImages} imágenes en ${total} catálogos\n\n📖 Generando libro PDF…`
                ).catch(() => {});
            }

            // Process libro in the same run — don't break the chain with a scheduled job
            // (scheduled fallback stays as safety net in case this run aborts early)
            await agenda.now("autopilot-run", {}).catch((e: any) => console.error("[autopilot] catalog follow-up schedule failed:", e));
            processed++;
            continue;
        }

        // ── libro → generate PDF book or skip-ahead if already created manually ─
        if ((phase as string) === "libro") {
            if ((niche as any).bookPdfUrl) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `📖 Libro ya existe → avanzando a SEO` });
                await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "seo" } });
                io?.emit("niches:updated");
                await agenda.schedule("in 3 seconds", "autopilot-run", {}).catch(() => {});
                processed++;
                stats.pipelineProcessed++;
                continue;
            }
            emitStage(io, "libro", String(niche._id), niche.name);

            // Catalog images (already shuffled by checkAutoPilotContinue or runPipeline catalog phase)
            const catalogUrls: string[] = (niche as any).catalogImageOrder ?? [];

            // Standalone cloudinary images: tagged to this niche but not part of any catalog
            let standaloneUrls: string[] = [];
            try {
                const cldRes = await internalFetch(`${base}/cloudinary/images?nicheId=${String(niche._id)}`);
                if (cldRes.ok) {
                    const cldData = await cldRes.json() as any;
                    const catalogSet = new Set(catalogUrls);
                    standaloneUrls = (cldData.images ?? [])
                        .map((img: any) => img.url as string)
                        .filter((u: string) => u && !catalogSet.has(u));
                }
            } catch { /* non-critical */ }

            // Combine: catalog images (shuffled) + standalone images, deduplicated
            const allUrls = [...new Set([...catalogUrls, ...standaloneUrls])];
            // Final shuffle so standalone images are distributed randomly
            for (let i = allUrls.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allUrls[i], allUrls[j]] = [allUrls[j], allUrls[i]];
            }

            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `📖 Generando libro PDF para "${niche.name}" (${allUrls.length} imágenes, ${standaloneUrls.length} standalone)…` });

            let advancedToSeo = false;
            try {
                if (allUrls.length === 0) {
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Sin imágenes para el libro — saltando a SEO` });
                    await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "seo" } });
                    io?.emit("niches:updated");
                    advancedToSeo = true;
                } else {
                    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
                    const sharp = await import("sharp");
                    const pdfDoc = await PDFDocument.create();

                    // KDP interior: 8.5" × 11" = 612 × 792 pts
                    const PAGE_WIDTH = 612;
                    const PAGE_HEIGHT = 792;

                    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

                    // ── 1. Copyright / Owner page ────────────────────────────────
                    {
                        const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
                        const year = new Date().getFullYear();
                        const copyrightLines = [
                            `Copyright © ${year}`,
                            `All rights reserved.`,
                            ``,
                            `No part of this publication may be reproduced,`,
                            `distributed, or transmitted in any form or by any means,`,
                            `including photocopying, recording, or other electronic`,
                            `or mechanical methods, without the prior written`,
                            `permission of the publisher.`,
                            ``,
                            `Printed in the United States of America`,
                        ];
                        let cy = PAGE_HEIGHT / 2 + 80;
                        for (const line of copyrightLines) {
                            if (line === "") { cy -= 12; continue; }
                            const w = font.widthOfTextAtSize(line, 10);
                            page.drawText(line, { x: (PAGE_WIDTH - w) / 2, y: cy, font, size: 10, color: rgb(0, 0, 0) });
                            cy -= 16;
                        }
                    }

                    // ── 2. Title page ────────────────────────────────────────────
                    {
                        const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
                        const productType = niche.productType ?? "coloring-book";
                        const subtitleText = productType === "seamless-pattern" ? "Seamless Pattern Collection"
                            : productType === "printable-poster" ? "Printable Art Collection"
                            : "Coloring Book";

                        // Fit title: try 28pt, fall back to 20pt if too wide
                        let titleSize = 28;
                        const titleText = niche.name;
                        if (fontBold.widthOfTextAtSize(titleText, titleSize) > PAGE_WIDTH - 80) titleSize = 20;
                        if (fontBold.widthOfTextAtSize(titleText, titleSize) > PAGE_WIDTH - 80) titleSize = 16;

                        page.drawText(titleText, {
                            x: 40,
                            y: PAGE_HEIGHT / 2 + 20,
                            font: fontBold,
                            size: titleSize,
                            color: rgb(0, 0, 0),
                            maxWidth: PAGE_WIDTH - 80,
                            lineHeight: titleSize * 1.3,
                        });
                        const subW = font.widthOfTextAtSize(subtitleText, 14);
                        page.drawText(subtitleText, {
                            x: (PAGE_WIDTH - subW) / 2,
                            y: PAGE_HEIGHT / 2 - 40,
                            font,
                            size: 14,
                            color: rgb(0.45, 0.45, 0.45),
                        });
                    }

                    // ── 3. Blank page after title ────────────────────────────────
                    pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

                    // ── 4. Image pages + blank after each ────────────────────────
                    let pagesAdded = 0;
                    let qualitySkipped = 0;
                    const isColoringBook = (niche.productType ?? "coloring-book") === "coloring-book";

                    // Load quality filter settings once before the loop
                    const [qualFilterRow, minWhiteRow] = await Promise.all([
                        Settings.findOne({ key: "IMAGE_QUALITY_FILTER_ENABLED" }).lean(),
                        Settings.findOne({ key: "IMAGE_QUALITY_MIN_WHITE_RATIO" }).lean(),
                    ]);
                    const qualityFilterEnabled = (qualFilterRow as any)?.value === "1";
                    const minWhiteRatio = parseFloat((minWhiteRow as any)?.value ?? "0.45") || 0.45;

                    for (let imgIdx = 0; imgIdx < allUrls.length; imgIdx++) {
                        if (imgIdx % 5 === 0) {
                            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `📖 Procesando imagen ${imgIdx + 1}/${allUrls.length}…` });
                        }
                        try {
                            const imgRes = await fetch(allUrls[imgIdx], { signal: AbortSignal.timeout(30_000) });
                            if (!imgRes.ok) continue;
                            const rawBuffer = Buffer.from(await imgRes.arrayBuffer());

                            // Quality filter: reject coloring pages that are too dark (not enough white pixels)
                            if (qualityFilterEnabled && isColoringBook) {
                                try {
                                    const { data: grayPx, info: grayInfo } = await sharp.default(rawBuffer).greyscale().raw().toBuffer({ resolveWithObject: true });
                                    const totalPx = grayInfo.width * grayInfo.height;
                                    let whitePx = 0;
                                    for (let p = 0; p < grayPx.length; p++) if (grayPx[p] > 200) whitePx++;
                                    const whiteRatio = whitePx / totalPx;
                                    if (whiteRatio < minWhiteRatio) {
                                        qualitySkipped++;
                                        continue;
                                    }
                                } catch { /* if check fails, include the image */ }
                            }

                            let cleanBuffer: Buffer = rawBuffer;
                            if (isColoringBook) {
                                try {
                                    const { data: px, info: pxi } = await sharp.default(rawBuffer)
                                        .flatten({ background: { r: 255, g: 255, b: 255 } })
                                        .removeAlpha()
                                        .greyscale()
                                        .raw()
                                        .toBuffer({ resolveWithObject: true });
                                    for (let p = 0; p < px.length; p++) {
                                        if (px[p] > 215) px[p] = 255;
                                    }
                                    cleanBuffer = await sharp.default(px, {
                                        raw: { width: pxi.width, height: pxi.height, channels: 1 },
                                    }).png().toBuffer();
                                } catch { /* keep original if processing fails */ }
                            }

                            const jpegBuffer = await sharp.default(cleanBuffer).jpeg({ quality: 85 }).toBuffer();
                            const img = await pdfDoc.embedJpg(jpegBuffer);
                            const imgPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
                            const scaled = img.scaleToFit(PAGE_WIDTH, PAGE_HEIGHT);
                            imgPage.drawImage(img, {
                                x: (PAGE_WIDTH - scaled.width) / 2,
                                y: (PAGE_HEIGHT - scaled.height) / 2,
                                width: scaled.width,
                                height: scaled.height,
                            });
                            pagesAdded++;
                            // Blank page after each image (KDP coloring book standard)
                            pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
                        } catch (imgErr: any) {
                            console.warn(`[autopilot] Skipping image ${imgIdx + 1} in libro: ${imgErr.message}`);
                        }
                    }

                    if (qualitySkipped > 0) {
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🔍 Filtro de calidad: ${qualitySkipped} imagen${qualitySkipped !== 1 ? "es" : ""} rechazada${qualitySkipped !== 1 ? "s" : ""} de ${allUrls.length} totales` });
                    }
                    if (pagesAdded === 0) throw new Error("No se pudieron insertar imágenes en el PDF");

                    const pdfBytes = await pdfDoc.save();
                    const base64 = Buffer.from(pdfBytes).toString("base64");
                    const safeName = niche.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    const fileName = `${safeName}-libro.pdf`;
                    const totalPdfPages = pdfDoc.getPageCount();

                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `📤 Subiendo libro a Cloudinary (${pagesAdded} imgs, ${totalPdfPages} páginas totales, ${Math.round(pdfBytes.byteLength / 1024)}KB)…` });

                    const uploadRes = await internalFetch(`${base}/cloudinary/upload-pdf`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ base64, fileName }),
                    });

                    if (!uploadRes.ok) {
                        const err = await uploadRes.json().catch(() => ({})) as any;
                        throw new Error(`Error subiendo PDF: ${err.error ?? uploadRes.status}`);
                    }

                    const uploadData = await uploadRes.json() as any;
                    const bookPdfUrl = uploadData.url;

                    await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "seo", bookPdfUrl, pipelineHasPdf: true } });
                    io?.emit("niches:updated");
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✅ Libro PDF listo (${pagesAdded} imágenes, ${totalPdfPages} páginas) → generando listing SEO…` });

                    // Persist a BookDraft record so it appears in the Book Factory UI
                    try {
                        const { BookDraft } = await import("../models/book-draft.js");
                        const safeDraftName = niche.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                        const draftPages = allUrls.map((url, i) => ({
                            id: `auto-${i}`,
                            type: "image",
                            image: { url, scale: 1, label: `${niche.name} #${i + 1}` },
                            text: { content: "", bold: false, italic: false, fontSize: 14, color: "#333333", align: "center", verticalAlign: "middle", fontFamily: "helvetica" },
                        }));
                        await BookDraft.findOneAndUpdate(
                            { nicheId: String(niche._id) },
                            {
                                $set: {
                                    fileName: safeDraftName,
                                    pdfUrl: bookPdfUrl,
                                    pageCount: totalPdfPages,
                                    pages: draftPages,
                                    savedAt: new Date(),
                                    nicheId: String(niche._id),
                                },
                            },
                            { upsert: true, returnDocument: 'after' }
                        );
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `📚 Borrador de libro guardado en base de datos` });
                    } catch (draftErr: any) {
                        console.warn(`[autopilot] BookDraft creation failed: ${draftErr.message}`);
                    }

                    if (await shouldNotify("pipeline.complete")) {
                        await sendTelegram(`📖 <b>Libro generado</b>\n📚 <b>${niche.name}</b>\n📄 ${pagesAdded} imágenes · ${totalPdfPages} páginas totales\n\n⚙️ Generando listing SEO…`).catch(() => {});
                    }
                    advancedToSeo = true;
                }
            } catch (e: any) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error generando libro: ${e.message} → saltando a SEO` });
                consecutiveErrors++;
                // Always advance to SEO even if libro fails — don't block the pipeline
                await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "seo" } });
                io?.emit("niches:updated");
                advancedToSeo = true;
            }

            if (advancedToSeo && !abort.aborted) {
                await agenda.schedule("in 10 seconds", "autopilot-run", {}).catch((e: any) => console.error("[autopilot] libro follow-up schedule failed:", e));
                processed++;
                stats.pipelineProcessed++;
            }
            continue;
        }

        // ── seo (or legacy pdf) → generate SEO listing ───────────────────────
        if (phase === "seo" || (phase as string) === "pdf") {
            if (niche.listings && niche.listings.length > 0) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `📝 SEO ya existe → avanzando a portada` });
                await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "cover" } });
                io?.emit("niches:updated");
                await agenda.schedule("in 3 seconds", "autopilot-run", {}).catch(() => {});
                processed++;
                stats.pipelineProcessed++;
                continue;
            }
            emitStage(io, "listing", String(niche._id), niche.name);
            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `📝 Generando listings KDP (EN + ES) para "${niche.name}"…` });
            let seoOk = false;
            try {
                // Get real Amazon search terms to anchor keywords in the listing
                const amazonKws = await getAmazonKeywords(niche.name, 8);
                const extrasCtx = amazonKws.length > 0
                    ? `Real Amazon search terms for this niche: ${amazonKws.join(", ")}`
                    : undefined;
                if (amazonKws.length > 0) {
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🔍 Keywords Amazon reales: ${amazonKws.slice(0, 4).join(", ")}…` });
                }

                const fetchListing = (lang: string) => withLlmSlot(`seo-${lang}:${String(niche._id)}`, () =>
                    fetch(`${base}/ai/generate-text`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "full-listing",
                            niche: niche.name,
                            productType: niche.productType ?? "coloring-book",
                            language: lang,
                            ...(extrasCtx ? { extras: extrasCtx } : {}),
                        }),
                        signal: AbortSignal.timeout(90_000),
                    })
                );
                const [resEn, resEs] = await Promise.all([fetchListing("en"), fetchListing("es")]);

                if (resEn.status === 429 || resEs.status === 429) {
                    abort.aborted = true;
                    abort.reason = "Cuota de IA agotada (429) durante generación de listing SEO";
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⛔ Límite de cuota alcanzado al generar listings. Deteniendo ciclo.` });
                } else {
                    const toSave: any[] = [];
                    let titleEn = "";
                    for (const [res, lang] of [[resEn, "en"], [resEs, "es"]] as [Response, string][]) {
                        if (res.ok) {
                            const data = await res.json() as any;
                            const listing = {
                                title: data.result?.title ?? "",
                                subtitle: data.result?.subtitle ?? "",
                                description: data.result?.description ?? "",
                                keywords: data.result?.keywords ?? [],
                                generatedAt: new Date(),
                                language: lang,
                            };
                            toSave.push(listing);
                            if (lang === "en") titleEn = listing.title;
                        } else {
                            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Listing ${lang.toUpperCase()} falló (${res.status}) — guardando los disponibles` });
                        }
                    }

                    if (toSave.length > 0) {
                        consecutiveErrors = 0;
                        for (const listing of toSave) {
                            await Niche.findByIdAndUpdate(niche._id, { $push: { listings: listing }, $set: { pipelineHasListings: true } });
                        }
                        io?.emit("niches:updated");
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✓ ${toSave.length} listing${toSave.length > 1 ? "s" : ""} (${toSave.map(l => l.language.toUpperCase()).join(" + ")}) listos → generando portada…` });

                        await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "cover" } });
                        io?.emit("niches:updated");

                        const mainListing = toSave.find(l => l.language === "en") ?? toSave[0];
                        const notifText = [
                            `📝 <b>Listings KDP listos</b>`,
                            ``,
                            `📚 <b>${niche.name}</b>`,
                            `🌐 ${toSave.map(l => l.language.toUpperCase()).join(" + ")}`,
                            ``,
                            `<b>Título (EN):</b> ${titleEn || mainListing.title}`,
                            mainListing.keywords.length > 0 ? `<b>Keywords:</b> ${mainListing.keywords.slice(0, 4).join(", ")}…` : null,
                            ``,
                            `🎨 Generando portada automáticamente…`,
                        ].filter(Boolean).join("\n");

                        if (await shouldNotify("listing.generated")) {
                            await sendTelegram(notifText).catch(() => {});
                        }
                        seoOk = true;
                    } else {
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Todos los listings fallaron — reintentando en 60s` });
                        consecutiveErrors++;
                    }
                }
            } catch (e: any) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error generando listings: ${e.message} — reintentando en 60s` });
                consecutiveErrors++;
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    abort.aborted = true;
                    abort.reason = `${MAX_CONSECUTIVE_ERRORS} errores consecutivos en generación de listings`;
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⛔ ${abort.reason}. Deteniendo ciclo.` });
                }
            }
            if (!abort.aborted) {
                processed++;
                stats.pipelineProcessed++;
                if (!seoOk) {
                    // Increment persistent cross-run error counter
                    const updated = await Niche.findByIdAndUpdate(
                        niche._id,
                        { $inc: { pipelineErrors: 1 } },
                        { returnDocument: 'after' }
                    );
                    const errCount = updated?.pipelineErrors ?? 1;
                    const MAX_PIPELINE_ERRORS = 5;
                    if (errCount >= MAX_PIPELINE_ERRORS) {
                        await Niche.findByIdAndUpdate(niche._id, { $set: { autoPilotEnabled: false } });
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⛔ "${niche.name}": SEO falló ${errCount} veces — autopilot desactivado` });
                        sendTelegram(`⛔ <b>Autopilot desactivado</b>\n"${niche.name}" — SEO falló ${errCount} veces seguidas. Intervención manual necesaria.`).catch(() => {});
                    } else {
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🔄 "${niche.name}": reintentando SEO en 60s (fallo ${errCount}/${MAX_PIPELINE_ERRORS})` });
                        await agenda.schedule("in 60 seconds", "autopilot-run", {}).catch((e: any) => console.error("[autopilot] seo follow-up schedule failed:", e));
                    }
                } else {
                    // SEO success — reset error counter and advance
                    await Niche.findByIdAndUpdate(niche._id, { $set: { pipelineErrors: 0 } });
                    await agenda.schedule("in 10 seconds", "autopilot-run", {}).catch((e: any) => console.error("[autopilot] seo follow-up schedule failed:", e));
                }
            }
            continue;
        }

        // ── cover → generate KDP cover image ─────────────────────────────────
        if (phase === "cover") {
            if (niche.coverUrl) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🎨 Portada ya existe → marcando como publicado` });
                await Niche.findByIdAndUpdate(niche._id, { $set: { phase: "published", pipelineHasCover: true } });
                io?.emit("niches:updated");
                if (await shouldNotify("pipeline.complete")) {
                    const listing0 = (niche.listings ?? [])[0];
                    await sendTelegram(
                        `✅ <b>Pipeline completo</b>\n📚 <b>${niche.name}</b>` +
                        (listing0?.title ? `\n📝 ${listing0.title}` : "") +
                        `\n\n✅ Listo para subir a KDP`
                    ).catch(() => {});
                }
                processed++;
                stats.pipelineProcessed++;
                continue;
            }
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

                const nicheScore = niche.score ?? 0;
                const nicheIdStr = String(niche._id);
                const candidateUrls: string[] = [];
                const port = process.env.PORT || 3001;
                const base = `http://localhost:${port}`;
                const isColoringBook = (niche.productType ?? "coloring-book") === "coloring-book";

                // Helper: add title text overlay then upload to Cloudinary
                const titleText = listing?.title || coverSubject;
                const uploadBuffer = async (rawBuf: Buffer, label: string): Promise<string | null> => {
                    try {
                        let buf = rawBuf;
                        try {
                            buf = await addCoverText(rawBuf, titleText);
                        } catch (textErr: any) {
                            console.warn(`[autopilot] cover text overlay failed for ${label}: ${textErr.message}`);
                        }
                        const dataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
                        const r = await internalFetch(`${base}/cloudinary/upload`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ dataUrl }),
                        });
                        if (!r.ok) return null;
                        const d = await (r as any).json();
                        return d.image?.url ?? null;
                    } catch {
                        console.warn(`[autopilot] cover uploadBuffer failed for ${label}`);
                        return null;
                    }
                };

                // ── Strategy 1: Collage from catalog images (coloring-books only) ──
                if (isColoringBook) {
                    io?.emit("autopilot:log", { nicheId: nicheIdStr, message: `🖼️ Generando collages con imágenes del catálogo…` });
                    try {
                        const catalogUrls = await pickCatalogImages(nicheIdStr, 8);
                        if (catalogUrls.length >= 2) {
                            const layouts: CollageLayout[] = catalogUrls.length >= 4
                                ? ["grid2x2", "triptych", "hero-sidebar"]
                                : ["triptych", "hero-sidebar"];

                            for (const layout of layouts) {
                                try {
                                    const buf = await buildCollage(catalogUrls, layout);
                                    const url = await uploadBuffer(buf, `collage-${layout}`);
                                    if (url) {
                                        candidateUrls.push(url);
                                        io?.emit("autopilot:log", { nicheId: nicheIdStr, message: `✅ Collage "${layout}" listo` });
                                    }
                                } catch (layoutErr: any) {
                                    console.warn(`[autopilot] collage ${layout} failed: ${layoutErr.message}`);
                                }
                            }

                            // Half-colored variant from the first catalog image
                            if (catalogUrls.length >= 1) {
                                try {
                                    const buf = await buildHalfColored(catalogUrls[0]);
                                    const url = await uploadBuffer(buf, "half-colored");
                                    if (url) {
                                        candidateUrls.push(url);
                                        io?.emit("autopilot:log", { nicheId: nicheIdStr, message: `✅ Portada "mitad coloreada" lista` });
                                    }
                                } catch (hcErr: any) {
                                    console.warn(`[autopilot] half-colored failed: ${hcErr.message}`);
                                }
                            }
                        }
                    } catch (collageErr: any) {
                        console.warn(`[autopilot] collage phase failed: ${collageErr.message}`);
                    }
                }

                // ── Strategy 2: AI-generated variants ──────────────────────────────
                const aiVariantsNeeded = isColoringBook ? 2 : 3;
                const coverAiModel = await getAutopilotImageModel();
                io?.emit("autopilot:log", { nicheId: nicheIdStr, message: `🤖 Generando ${aiVariantsNeeded} variante${aiVariantsNeeded > 1 ? "s" : ""} con ${coverAiModel.name}…` });

                for (let variant = 0; variant < aiVariantsNeeded; variant++) {
                    let imgBuf: Buffer | null = null;
                    try {
                        // 1st: selected model via AI proxy
                        const coverRes = await internalFetch(`${base}/ai/generate-image`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt: coverPrompt, provider: coverAiModel.provider, modelId: coverAiModel.modelId, width: 768, height: 1024 }),
                            signal: AbortSignal.timeout(90_000),
                        });
                        const coverCt = coverRes.headers.get("content-type") ?? "";
                        if (coverRes.ok && coverCt.startsWith("image/")) {
                            imgBuf = Buffer.from(await coverRes.arrayBuffer());
                        }
                    } catch (coverErr: any) {
                        console.warn(`[autopilot] cover variant ${variant + 1} AI proxy failed: ${coverErr.message}`);
                    }

                    // Fallback: Pollinations/Segmind/HF cascade
                    if (!imgBuf) {
                        try {
                            imgBuf = await withImageSlot(`cover-v${variant}:${nicheIdStr}`, () =>
                                generateImage(coverPrompt, { width: 768, height: 1024, model }),
                                nicheScore
                            );
                        } catch (fbErr: any) {
                            console.warn(`[autopilot] cover variant ${variant + 1} fallback failed: ${fbErr.message}`);
                        }
                    }

                    if (imgBuf) {
                        const candidateUrl = await uploadBuffer(imgBuf, `ai-cover-${variant}`) ?? "";
                        if (candidateUrl) {
                            candidateUrls.push(candidateUrl);
                            io?.emit("autopilot:log", { nicheId: nicheIdStr, message: `🖼️ Variante IA ${variant + 1}/${aiVariantsNeeded} lista` });
                        }
                    } else {
                        console.warn(`[autopilot] cover AI variant ${variant + 1} — sin imagen`);
                    }
                }

                if (!candidateUrls.length) throw new Error("No se generó ninguna variante de portada");

                // ── QA de portadas: contraste/saturación para el thumbnail de Amazon ──
                // Puntúa todas las candidatas y elige la mejor como auto-pick. Si todas
                // flojean, avisa pero no bloquea (la UI muestra todas para elegir a mano).
                let coverUrl = candidateUrls[0];
                try {
                    const { analyzeCoverQuality } = await import("../lib/cover-qa.js");
                    const scored: Array<{ url: string; ok: boolean; score: number; warnings: string[] }> = [];
                    for (const url of candidateUrls) {
                        try {
                            const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
                            if (!res.ok) continue;
                            const qa = await analyzeCoverQuality(Buffer.from(await res.arrayBuffer()));
                            scored.push({ url, ok: qa.ok, score: qa.contrast + qa.saturation * 100, warnings: qa.warnings });
                        } catch { /* candidata no evaluable — se queda con score 0 */ }
                    }
                    const best = scored.filter(s => s.ok).sort((a, b) => b.score - a.score)[0]
                        ?? scored.sort((a, b) => b.score - a.score)[0];
                    if (best) {
                        coverUrl = best.url;
                        if (!best.ok) {
                            const warn = best.warnings.join(" · ");
                            io?.emit("autopilot:log", { nicheId: nicheIdStr, message: `⚠️ Ninguna portada pasa el QA de thumbnail (${warn}) — revisa antes de publicar` });
                            if (await shouldNotify("autopilot.cover-qa")) {
                                await sendTelegram(`⚠️ <b>${niche.name}</b> — portadas con poca fuerza para el thumbnail de Amazon:\n${warn}\n\nElige a mano o regenera.`).catch(() => {});
                            }
                        } else {
                            console.log(`[autopilot] cover QA: elegida la candidata con score ${best.score.toFixed(0)}`);
                        }
                    }
                } catch (qaErr: any) {
                    console.warn(`[autopilot] cover QA skipped: ${qaErr.message}`);
                }

                await Niche.findByIdAndUpdate(niche._id, {
                    $set: { coverUrl, coverCandidates: candidateUrls, phase: "published", pipelineHasCover: true },
                });
                io?.emit("niches:updated");
                io?.emit("autopilot:log", {
                    nicheId: String(niche._id),
                    message: `✅ ${candidateUrls.length} portada${candidateUrls.length > 1 ? "s" : ""} generada${candidateUrls.length > 1 ? "s" : ""} → "${niche.name}" PUBLICADO`,
                });

                // ── Gumroad auto-publish (if enabled) ──────────────────────────
                try {
                    const [gmEnabledRow, gmTokenRow, gmPriceRow] = await Promise.all([
                        Settings.findOne({ key: "GUMROAD_ENABLED" }).lean(),
                        Settings.findOne({ key: "GUMROAD_ACCESS_TOKEN" }).lean(),
                        Settings.findOne({ key: "GUMROAD_DEFAULT_PRICE" }).lean(),
                    ]);
                    const gmEnabled = (gmEnabledRow as any)?.value === "1";
                    const gmToken = ((gmTokenRow as any)?.value ?? "").trim();
                    if (gmEnabled && gmToken) {
                        const mainListing = (niche.listings ?? [])[0];
                        const gmPriceCents = Math.round(parseFloat((gmPriceRow as any)?.value ?? "4.99") * 100) || 499;
                        const pdfUrl = (niche as any).bookPdfUrl as string | undefined;
                        if (pdfUrl) {
                            io?.emit("autopilot:log", { nicheId: String(niche._id), message: `💚 Publicando en Gumroad…` });
                            const product = await createGumroadProduct({
                                accessToken: gmToken,
                                name: mainListing?.title || niche.name,
                                description: mainListing?.description || niche.name,
                                priceInCents: gmPriceCents,
                                contentUrl: pdfUrl,
                                previewUrl: coverUrl,
                            });
                            if (product) {
                                await Niche.findByIdAndUpdate(niche._id, { $set: { gumroadUrl: product.shortUrl } });
                                io?.emit("niches:updated");
                                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `✅ Gumroad: ${product.shortUrl}` });
                            }
                        }
                    }
                } catch (gmErr: any) {
                    console.warn(`[autopilot] Gumroad publish failed: ${gmErr.message}`);
                }

                if (await shouldNotify("pipeline.complete")) {
                    const listing0 = (niche.listings ?? [])[0];
                    const caption = [
                        `🎉 <b>Pipeline completo</b>`,
                        ``,
                        `📚 <b>${niche.name}</b>`,
                        listing0?.title ? `📝 ${listing0.title}` : null,
                        listing0?.keywords?.length ? `🔑 ${listing0.keywords.slice(0, 4).join(", ")}` : null,
                        ``,
                        candidateUrls.length > 1 ? `🎨 ${candidateUrls.length} variantes disponibles — elige en el dashboard` : null,
                        `✅ Listo para subir a KDP`,
                    ].filter(Boolean).join("\n");
                    if (await shouldNotify("cover.generated")) {
                        await sendTelegramPhoto(coverUrl, caption).catch(() => {});
                    }
                }

            } catch (e: any) {
                io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⚠️ Error generando portada: ${e.message}` });
                consecutiveErrors++;
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    abort.aborted = true;
                    abort.reason = `${MAX_CONSECUTIVE_ERRORS} errores consecutivos en generación de portada`;
                    io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⛔ ${abort.reason}. Deteniendo ciclo.` });
                } else {
                    // Increment persistent cross-run counter before retrying
                    const updated = await Niche.findByIdAndUpdate(
                        niche._id,
                        { $inc: { pipelineErrors: 1 } },
                        { returnDocument: 'after' }
                    );
                    const errCount = updated?.pipelineErrors ?? 1;
                    const MAX_PIPELINE_ERRORS = 5;
                    if (errCount >= MAX_PIPELINE_ERRORS) {
                        await Niche.findByIdAndUpdate(niche._id, { $set: { autoPilotEnabled: false } });
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `⛔ "${niche.name}": portada falló ${errCount} veces — autopilot desactivado` });
                        sendTelegram(`⛔ <b>Autopilot desactivado</b>\n"${niche.name}" — portada falló ${errCount} veces. Intervención manual necesaria.`).catch(() => {});
                    } else {
                        io?.emit("autopilot:log", { nicheId: String(niche._id), message: `🔄 "${niche.name}": reintentando portada en 60s (fallo ${errCount}/${MAX_PIPELINE_ERRORS})` });
                        await agenda.schedule("in 60 seconds", "autopilot-run", {}).catch((e2: any) => console.error("[autopilot] cover retry schedule failed:", e2));
                    }
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
    agenda.define(AUTOPILOT_JOB_NAME, async (_job: Job) => {
        const port = process.env.PORT || 3001;
        const base = `http://localhost:${port}`;
        const tag = "[autopilot]";

        console.log(`${tag} Run started at ${new Date().toISOString()}`);
        const cfg = await getConfig();
        const abort: AbortSignal = { aborted: false, reason: "" };
        const stats: RunStats = { discovered: 0, pipelineProcessed: 0, catalogsCreated: 0 };

        // Check if emergency stop / abort is active — if so, exit immediately without clearing the flag
        // The flag is only cleared by an explicit /autopilot/run or /emergency-stop reset
        const abortCheck = await Settings.findOne({ key: "AUTOPILOT_ABORT" }).lean().catch(() => null);
        if ((abortCheck as any)?.value === "1") {
            console.log(`[autopilot] Abort flag set — skipping run`);
            return;
        }

        // Clear stale phase-approve actions — these were used before the pipeline became fully automatic.
        // Any that remain would permanently block hasPendingAction() for their niche.
        await TelegramAction.deleteMany({ type: "phase-approve", status: "pending" }).catch(() => {});

        const run = await AutopilotRun.create({ startedAt: new Date(), status: "running" });

        if (await shouldNotify("autopilot.run")) {
            await sendTelegram(`🤖 <b>Auto-Pilot</b> — Ciclo iniciado`).catch(() => {});
        }

        // Pipeline runs FIRST so active niches always advance regardless of discovery timing
        const processed = await runPipeline(cfg, base, io, tag, abort, stats, agenda);
        // Discovery runs after — image gen fires in background, doesn't block pipeline
        const discovered = abort.aborted ? 0 : await runDiscovery(cfg, base, io, tag, abort, stats, agenda);

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
    }, { concurrency: 1, lockLifetime: 45 * 60 * 1000 });
}
