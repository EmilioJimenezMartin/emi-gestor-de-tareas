import { FastifyInstance } from "fastify";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { TelegramAction } from "../models/telegram-action.js";
import { AutopilotRun } from "../models/autopilot-run.js";
import { getMongoStatus } from "../lib/mongo.js";
import { sendTelegram, sendTelegramPhotoDiscovery, sendTelegramImageWithButtons, sendTelegramApproval, sendTelegramButtons, shouldNotify } from "../lib/telegram.js";
import { generateImage, getAutopilotImageModel } from "../lib/image-gen.js";
import { generateCatalogPrompt } from "../lib/catalog-prompt.js";
import { generateTextWithLLM } from "../lib/ai.js";
import { getEvolutionSeed } from "../lib/prompt-evolution.js";
import { withLlmSlot } from "../lib/ai-semaphore.js";

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

// ── Style-aware coloring-book prompt formula ─────────────────────────────────
// Token order matters in FLUX: early tokens get highest attention weight.
// Structure: [MODE OPENER] → [STYLE MODIFIER] → [SUBJECT/PARTICULARS] → [EXCLUSIONS]

// Short opener — immediately tells FLUX the output format (highest weight tokens)
// Calidad de línea sí; "densely layered/breathtaking composition" NO: esos tokens
// hacían que FLUX inventara fondos (flores, casas…) que el usuario no pidió.
const CB_OPENER = "masterful coloring book page, crisp black ink line art on pure white, bold ultra-thick confident outlines, outline-only drawing, every shape hollow and empty white inside";

// Sujeto fiel: va justo después del estilo, y se refuerza que NO se añada contenido extra
const CB_FIDELITY = "depicting exactly and only the following subject, faithful to the description, intricate detail concentrated on the subject itself";

// Style modifiers — describen CÓMO dibujar, nunca QUÉ añadir (no inventan escenas)
const CB_STYLE_MODIFIERS: Record<string, string> = {
    funko:        "funko pop vinyl figure style, oversized spherical head twice the body size, large circular blank eyes, no nose, tiny stubby body and limbs, chibi collectible toy proportions, bold rounded simplified silhouette, clean toy product design",
    anime:        "expressive manga linework, confident dynamic strokes, exaggerated expressive emotion, strong character presence",
    botanical:    "specimen-quality botanical etching, fine precise linework, elegant natural detail within the subject",
    celestial:    "sacred geometry mandala precision, perfectly symmetrical radial composition, intricate concentric patterning",
    geometric:    "precise interlocking geometric tessellation, flawless symmetry, mesmerizing ornamental precision",
    children:     "large friendly bold shapes, thick playful cartoon outlines, charming easy-to-color simplicity",
    watercolor:   "flowing graceful organic shapes, delicate elegant curves, natural fluid linework",
    "wall-art":   "art nouveau ornamental linework, sinuous elegant flowing curves, decorative sophistication",
    retro:        "bold vintage mid-century graphic style, strong confident shapes, classic print-era linework",
    abstract:     "fluid biomorphic abstract forms, balanced rhythmic composition, hypnotic interlocking curves",
    illustration: "expressive confident character linework, dramatic line-weight contrast, skilled draftsmanship",
    realistic:    "naturalistic specimen-level precision, anatomically accurate rendering, texture implied through line density",
};

const CB_EXCLUSIONS = "no color, no shading, no grey fills, no gray tones, no gradients, no stippling, no background texture, no solid black areas, no filled-in shapes, no black silhouettes, no dark fills on foliage rooftops hair or clothing, all surfaces drawn as empty white outlines ready to color, no extra background elements, no invented scenery, no added objects beyond the described subject, no watermark, no text, no words, no letters, no page numbers, no signature, pure white background, extra bold ultra thick clean outlines, heavy line weight, high contrast, if human or animal figures are present draw hands and paws as simple rounded mitten shapes or hide them behind the body, no extra fingers, no four fingers, no three fingers, no fused fingers, no deformed hands, no malformed limbs, simplified anatomy, correct number of fingers if visible";

// Si el prompt del usuario pide explícitamente algo que NO es página de colorear
// (color, foto, póster, patrón…), la fórmula CB no debe aplicarse aunque el
// productType por defecto sea coloring-book.
const NON_COLORING_INTENT = /full[ -]?color|colorful|vibrant colors?|in color|a todo color|con colores|watercolor painting|oil painting|acrylic|photograph|photo[- ]?realistic|realistic photo|poster|seamless pattern|sticker design|t-?shirt design|logo design|wall art|book cover|portada/i;

export function isNonColoringIntent(prompt: string): boolean {
    return NON_COLORING_INTENT.test(prompt);
}

export function buildColoringBookPrompt(particulars: string, style = "generic"): string {
    // Si el usuario menciona "funko" en su prompt, ese estilo manda sobre el seleccionado
    const effectiveStyle = /funko/i.test(particulars) ? "funko" : style;
    const modifier = CB_STYLE_MODIFIERS[effectiveStyle];
    return modifier
        ? `${CB_OPENER}, ${modifier}, ${CB_FIDELITY}: ${particulars}, ${CB_EXCLUSIONS}`
        : `${CB_OPENER}, ${CB_FIDELITY}: ${particulars}, ${CB_EXCLUSIONS}`;
}

// ── Poster prompts ────────────────────────────────────────────────────────────
// Misma estructura FLUX: [OPENER] → [STYLE] → [SUBJECT] → [QUALITY/EXCLUSIONS]
const POSTER_OPENER = "printable wall art poster, premium digital illustration";

const POSTER_STYLE_MODIFIERS: Record<string, string> = {
    realistic:    "ultra sharp photorealistic rendering, cinematic lighting, professional photography look",
    watercolor:   "soft watercolor wash, organic pigment blooms, artistic paper texture",
    abstract:     "bold abstract shapes, modern minimalist composition, generous negative space",
    botanical:    "elegant botanical illustration, fine detail, muted earthy palette",
    "wall-art":   "art nouveau decorative style, flowing ornamental linework",
    retro:        "vintage mid-century poster design, bold flat shapes, classic print palette",
    geometric:    "clean geometric composition, balanced symmetry, modern design",
    celestial:    "dreamy celestial scene, deep night palette, glowing accents",
    children:     "cheerful flat illustration, friendly rounded shapes, bright happy palette",
    anime:        "anime illustration style, vibrant cel shading, expressive composition",
    illustration: "detailed editorial illustration, confident shapes, rich texture",
};

const POSTER_QUALITY = "vibrant cohesive color palette, high contrast focal point, balanced centered composition, gallery print quality, sharp details, no text, no words, no watermark, no frame, no border";

export function buildPosterPrompt(particulars: string, style = "generic"): string {
    const modifier = POSTER_STYLE_MODIFIERS[style];
    return modifier
        ? `${POSTER_OPENER}, ${modifier}, ${particulars}, ${POSTER_QUALITY}`
        : `${POSTER_OPENER}, ${particulars}, ${POSTER_QUALITY}`;
}

// ── Seamless pattern prompts ─────────────────────────────────────────────────
const PATTERN_QUALITY = "perfectly seamless tileable repeat pattern, edge-to-edge uniform layout, flat design, consistent flat lighting, no borders, no vignette, no focal center, no text, no watermark, POD ready";

export function buildSeamlessPatternPrompt(particulars: string): string {
    return `seamless repeating surface pattern, ${particulars}, ${PATTERN_QUALITY}`;
}

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerAutoPilotRoutes(app: FastifyInstance, deps: { agenda?: any; io?: any }) {
    // ── Stop running autopilot ───────────────────────────────────────────────
    app.post("/autopilot/stop", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            await Settings.findOneAndUpdate(
                { key: "AUTOPILOT_ABORT" },
                { key: "AUTOPILOT_ABORT", value: "1" },
                { upsert: true }
            );
            deps.io?.emit("autopilot:log", { message: "⛔ Pipeline detenido manualmente desde la app" });
            return reply.send({ ok: true, message: "Señal de parada enviada" });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── EMERGENCY STOP — kills everything immediately ────────────────────────
    app.post("/autopilot/emergency-stop", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const results: Record<string, number | string> = {};

            // 1. Set abort flag (persistent so new runs don't start)
            await Settings.findOneAndUpdate(
                { key: "AUTOPILOT_ABORT" },
                { key: "AUTOPILOT_ABORT", value: "1" },
                { upsert: true }
            );

            // 2. Cancel ALL pending agenda jobs
            if (deps.agenda) {
                const cancelled = await deps.agenda.cancel({});
                results.agendaJobsCancelled = cancelled;
            }

            // 3. Cancel all running/queued catalogs
            const { Catalog } = await import("../models/catalog.js");
            const { modifiedCount } = await (Catalog as any).updateMany(
                { status: { $in: ["running", "queued"] } },
                { $set: { status: "cancelled", lastError: "Freno de emergencia activado" } }
            );
            results.catalogsCancelled = modifiedCount;

            // 4. Mark any running autopilot runs as aborted
            const { AutopilotRun: AR } = await import("../models/autopilot-run.js");
            await (AR as any).updateMany(
                { status: "running" },
                { $set: { status: "aborted", finishedAt: new Date(), abortReason: "Freno de emergencia activado" } }
            );

            deps.io?.emit("autopilot:log", { message: "🚨 FRENO DE EMERGENCIA — todos los procesos detenidos" });
            deps.io?.emit("autopilot:done", { processed: 0, timestamp: new Date().toISOString() });
            deps.io?.emit("catalogs:updated");
            deps.io?.emit("niches:updated");

            console.log(`[emergency-stop] Jobs cancelados=${results.agendaJobsCancelled} Catálogos cancelados=${results.catalogsCancelled}`);

            return reply.send({ ok: true, ...results });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Force-advance a niche to the next pipeline phase ────────────────────
    app.post("/autopilot/niche/:id/advance", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const { phase } = (request.body ?? {}) as { phase?: string };
            const PHASE_ORDER = ["niche", "catalog", "libro", "seo", "cover", "published"] as const;
            const niche = await Niche.findById(id).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            let targetPhase: string;
            if (phase) {
                targetPhase = phase;
            } else {
                const currentIdx = PHASE_ORDER.indexOf((niche as any).phase as any);
                if (currentIdx === -1 || currentIdx >= PHASE_ORDER.length - 1) {
                    return reply.status(400).send({ error: `No hay siguiente fase para "${(niche as any).phase}"` });
                }
                targetPhase = PHASE_ORDER[currentIdx + 1];
            }

            await Niche.findByIdAndUpdate(id, { $set: { phase: targetPhase } });
            deps.io?.emit("niches:updated");
            deps.io?.emit("autopilot:log", { nicheId: id, message: `⏩ "${(niche as any).name}" forzado a fase "${targetPhase}"` });

            // Trigger autopilot to pick up the new phase
            if (deps.agenda) {
                await deps.agenda.schedule("in 3 seconds", "autopilot-run", {}).catch(() => {});
            }

            return reply.send({ ok: true, nicheId: id, phase: targetPhase });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Retry a stuck niche (reset failed catalogs + re-trigger autopilot) ───
    app.post("/autopilot/niche/:id/retry", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const niche = await Niche.findById(id).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            const { Catalog } = await import("../models/catalog.js");
            const { modifiedCount } = await (Catalog as any).updateMany(
                { nicheIds: id, status: { $in: ["failed", "error"] } },
                { $set: { status: "queued" }, $unset: { lastError: "" } }
            );

            deps.io?.emit("catalogs:updated");
            deps.io?.emit("niches:updated");
            deps.io?.emit("autopilot:log", { nicheId: id, message: `🔄 "${(niche as any).name}" reintentando (${modifiedCount} catálogos reactivados)` });

            if (deps.agenda) {
                await deps.agenda.schedule("in 2 seconds", "autopilot-run", {}).catch(() => {});
            }

            return reply.send({ ok: true, nicheId: id, reactivated: modifiedCount });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Run autopilot now ────────────────────────────────────────────────────
    app.post("/autopilot/run", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            if (!deps.agenda) return reply.status(503).send({ error: "Agenda no disponible" });
            // Clear abort flag so the run actually executes
            await Settings.findOneAndUpdate(
                { key: "AUTOPILOT_ABORT" },
                { key: "AUTOPILOT_ABORT", value: "0" },
                { upsert: true }
            );
            await deps.agenda.now("autopilot-run", {});
            await sendTelegram("🚀 <b>Auto-Pilot</b>\nEjecución manual iniciada");
            return reply.send({ ok: true, message: "Auto-Pilot lanzado" });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Schedule autopilot cron ──────────────────────────────────────────────
    app.post("/autopilot/schedule", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { cron } = request.body as { cron: string };
            if (!cron?.trim()) return reply.status(400).send({ error: "cron required" });
            if (!deps.agenda) return reply.status(503).send({ error: "Agenda no disponible" });
            // Cancel existing and reschedule
            await deps.agenda.cancel({ name: "autopilot-run" });
            await deps.agenda.every(cron, "autopilot-run");
            await Settings.findOneAndUpdate({ key: "AUTOPILOT_CRON" }, { key: "AUTOPILOT_CRON", value: cron }, { upsert: true });
            return reply.send({ ok: true, cron });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Cancel scheduled autopilot ───────────────────────────────────────────
    app.delete("/autopilot/schedule", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            if (!deps.agenda) return reply.status(503).send({ error: "Agenda no disponible" });
            await deps.agenda.cancel({ name: "autopilot-run" });
            await Settings.findOneAndUpdate({ key: "AUTOPILOT_CRON" }, { key: "AUTOPILOT_CRON", value: "" }, { upsert: true });
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Toggle autoPilot on a niche ──────────────────────────────────────────
    app.patch("/autopilot/niche/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const { enabled } = request.body as { enabled: boolean };
            const niche = await Niche.findByIdAndUpdate(id, { $set: { autoPilotEnabled: enabled } }, { returnDocument: 'after' }).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            // When enabling autopilot on a niche already in a pipeline phase, kick off autopilot-run immediately
            if (enabled && deps.agenda) {
                const phase = (niche as any).phase ?? "niche";
                if (["catalog", "libro", "seo", "cover"].includes(phase)) {
                    await deps.agenda.schedule("in 5 seconds", "autopilot-run", {}).catch(() => {});
                }
            }
            return reply.send({ ok: true, autoPilotEnabled: enabled });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Trigger discovery for a specific niche ───────────────────────────────
    // force=true: skips shouldNotify gate (used by manual trigger from UI)
    // GET /autopilot/pending-actions — decisiones esperándote en Telegram (para el inbox de la UI)
    app.get("/autopilot/pending-actions", async (_request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const actions = await TelegramAction.find({ status: "pending" })
                .sort({ createdAt: -1 }).limit(20)
                .select("nicheName type createdAt autoApproveAt").lean();
            return reply.send({ count: actions.length, actions });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /autopilot/quick-catalog/:nicheId — prompt perfecto → catálogo directo, SIN pasar por Telegram.
    // Mismo pipeline que discover (particulars IA + fórmula probada) pero el destino es un catálogo en cola.
    app.post("/autopilot/quick-catalog/:nicheId", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { nicheId } = request.params as { nicheId: string };
            const niche = await Niche.findById(nicheId).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            const productType = (niche as any).productType ?? "coloring-book";
            const style = (niche as any).styleCategory ?? "generic";
            const nicheName = (niche as any).name as string;
            const port = process.env.PORT || 3001;
            const base = `http://localhost:${port}`;

            // Priority 1: discoveryImagePrompt (the exact prompt that generated the approved Telegram image)
            // Priority 2: generatedPrompt (may be set from earlier runs)
            // Priority 3: generate a fresh one (only if niche has never had a discovery image)
            const savedDiscoveryPrompt = ((niche as any).discoveryImagePrompt as string | undefined)?.trim();
            let prompt: string;

            if (savedDiscoveryPrompt) {
                // Use the proven discovery prompt verbatim — this is what the user approved
                prompt = savedDiscoveryPrompt;
            } else {
                // No discovery prompt exists yet — generate one and save it
                let particulars = (niche as any).generatedPrompt as string | undefined;
                const alreadyWrapped = !!particulars && /coloring book page|printable wall art poster|seamless repeating/i.test(particulars);
                if (!particulars) {
                    try {
                        const aiType = productType === "printable-poster" ? "printable-particulars" : "niche-particulars";
                        const evolutionSeed = await getEvolutionSeed(productType).catch(() => "");
                        const targetAudience = (niche as any).targetAudience as string | undefined;
                        const audiencePart = targetAudience && targetAudience !== "all" ? `audience: ${targetAudience}` : "";
                        const quickExtras = [style, audiencePart, evolutionSeed].filter(Boolean).join("; ");
                        const aiRes = await internalFetch(`${base}/ai/generate-text`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ type: aiType, niche: nicheName, productType, extras: quickExtras }),
                            signal: AbortSignal.timeout(25_000),
                        });
                        if (aiRes.ok) {
                            const aiData = await aiRes.json() as any;
                            particulars = aiData.result?.particulars as string | undefined;
                        }
                    } catch { /* fallback al nombre */ }
                }
                const sceneDesc = particulars || nicheName;
                prompt = alreadyWrapped
                    ? sceneDesc
                    : productType === "printable-poster"
                        ? buildPosterPrompt(sceneDesc, style)
                        : buildColoringBookPrompt(sceneDesc, style);
            }

            // Crear catálogo con el modelo y tamaño configurados del autopilot
            const model = await getAutopilotImageModel();
            const imgRow = await Settings.findOne({ key: "AUTOPILOT_IMAGES_PER_CATALOG" }).lean();
            const totalImages = parseInt(String((imgRow as any)?.value ?? "5")) || 5;

            const catRes = await internalFetch(`${base}/catalogs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: `${nicheName} — Quick`,
                    prompt,
                    aiModel: model,
                    width: 1024,
                    height: 1024,
                    totalImages,
                    productType,
                    nicheIds: [nicheId],
                }),
            });
            const catData = await catRes.json() as any;
            if (!catRes.ok) return reply.status(502).send({ error: catData.error ?? "Error creando catálogo" });

            // Only update generatedPrompt — NEVER overwrite discoveryImagePrompt (it's the approved baseline)
            await Niche.findByIdAndUpdate(nicheId, {
                $set: { generatedPrompt: prompt, pipelineHasCatalogs: true, phase: "catalog" },
            });
            deps.io?.emit("niches:updated");
            deps.io?.emit("autopilot:log", { nicheId, message: `📦 Catálogo directo creado para "${nicheName}" (${totalImages} imágenes, ${model.name})` });

            return reply.status(201).send({ catalog: catData.catalog, prompt, model: model.name });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message ?? "Error en quick-catalog" });
        }
    });

    app.post("/autopilot/discover/:nicheId", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { nicheId } = request.params as { nicheId: string };
            // force=true bypasses shouldNotify — used when triggered manually from UI
            const force = (request.body as any)?.force === true;
            const niche = await Niche.findById(nicheId).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            // Cancel any previous pending action for this niche
            await TelegramAction.updateMany(
                { nicheId, status: "pending" },
                { $set: { status: "omitir", resolvedAt: new Date() } }
            );

            // Read config for labels
            const cfgRows = await Settings.find({ key: { $in: ["AUTOPILOT_CATALOGS_PER_NICHE", "AUTOPILOT_IMAGES_PER_CATALOG"] } }).lean();
            const cfgMap = new Map((cfgRows as any[]).map(r => [r.key, r.value]));
            const catalogsPerNiche = parseInt((cfgMap.get("AUTOPILOT_CATALOGS_PER_NICHE") as string) ?? "8") || 8;
            const imagesPerCatalog = parseInt((cfgMap.get("AUTOPILOT_IMAGES_PER_CATALOG") as string) ?? "5") || 5;

            const productType = (niche as any).productType ?? "coloring-book";
            const style = (niche as any).styleCategory ?? "generic";
            const sourceTitulo = ((niche as any).sourceTitulo as string | undefined)?.trim() || "";
            const nicheName = (niche as any).name as string;

            // Strip marketing subtitles from the niche name before feeding to the AI
            // e.g. "Elegant Patterns: Coloring Book for Adults with..." → "Elegant Patterns"
            const visualCoreName = nicheName
                .split(":")[0]
                .replace(/\s+(coloring\s*book|activity\s*book|printable|for\s+adults?|for\s+kids?|for\s+seniors?|with\s+\d+|vol\s*\.|volume\s*\d)/i, "")
                .trim() || nicheName.split(":")[0].trim();

            // Step 1: ALWAYS generate fresh visual particulars — never use cached generatedPrompt.
            // Reason: generatedPrompt may be stale OR already-wrapped (causes double-wrapping with buildColoringBookPrompt).
            let particulars: string | undefined;
            {
                const port2 = process.env.PORT || 3001;
                const base2 = `http://localhost:${port2}`;
                const aiType = productType === "printable-poster" ? "printable-particulars" : "niche-particulars";
                const nicheForAI = sourceTitulo && sourceTitulo !== nicheName
                    ? `${visualCoreName} (market reference: "${sourceTitulo}")`
                    : visualCoreName;
                const evolutionSeed = await getEvolutionSeed(productType).catch(() => "");
                const targetAudience = (niche as any).targetAudience as string | undefined;
                const audiencePart = targetAudience && targetAudience !== "all" ? `audience: ${targetAudience}` : "";
                const discoverExtras = [style, audiencePart, evolutionSeed].filter(Boolean).join("; ");
                try {
                    const aiRes = await internalFetch(`${base2}/ai/generate-text`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: aiType, niche: nicheForAI, productType, extras: discoverExtras }),
                        signal: AbortSignal.timeout(25_000),
                    });
                    if (aiRes.ok) {
                        const aiData = await aiRes.json() as any;
                        particulars = aiData.result?.particulars as string | undefined;
                    }
                } catch { /* fallback to visual core name */ }
            }

            // Step 2: wrap the RAW scene description in the proven formula.
            // Use visualCoreName as fallback — never the full subtitle-heavy nicheName.
            const sceneDesc = particulars || visualCoreName;
            let samplePrompt: string;
            if (productType === "printable-poster") {
                samplePrompt = buildPosterPrompt(sceneDesc, style);
            } else {
                samplePrompt = buildColoringBookPrompt(sceneDesc, style);
            }

            const sampleUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(samplePrompt)}?model=flux`;

            // Resolve model BEFORE saving to niche so discoveryAiModel is always set
            const discoveryModel = await getAutopilotImageModel();

            // Save: discoveryImagePrompt = full wrapped prompt (used as style anchor in explode-catalogs)
            //       generatedPrompt = RAW scene desc only (prevents double-wrapping on future runs)
            await Niche.findByIdAndUpdate(nicheId, { $set: { sampleImageUrl: sampleUrl, discoveryImagePrompt: samplePrompt, generatedPrompt: sceneDesc, discoveryAiModel: discoveryModel } });

            // Add to prompt memory — user approved this image via Telegram, so the prompt is validated
            const nicheForMemory = await Niche.findById(nicheId).lean() as any;
            if (nicheForMemory && samplePrompt) {
                const existing: any[] = nicheForMemory.confirmedPrompts ?? [];
                if (!existing.some((p: any) => p.prompt === samplePrompt)) {
                    const updated = [...existing, { prompt: samplePrompt, source: "discovery", addedAt: new Date() }].slice(-10);
                    await Niche.findByIdAndUpdate(nicheId, { $set: { confirmedPrompts: updated } });
                }
            }

            deps.io?.emit("niches:updated");

            const port = process.env.PORT || 3001;
            const base = `http://localhost:${port}`;

            let imageBytes: Buffer | null = null;
            let telegramImageUrl = sampleUrl;
            deps.io?.emit("autopilot:log", { message: `🎨 Generando imagen con ${discoveryModel.name}…` });
            try {
                const isSlowModel = (discoveryModel.modelId ?? "").includes("dev") || (discoveryModel.modelId ?? "").includes("pro");
                const aiRes = await internalFetch(`${base}/ai/generate-image`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: samplePrompt,
                        modelId: discoveryModel.modelId,
                        provider: discoveryModel.provider,
                        width: 1024, height: 1024,
                    }),
                    signal: AbortSignal.timeout(isSlowModel ? 180_000 : 90_000),
                });
                const ct = aiRes.headers.get("content-type") ?? "";
                if (aiRes.ok && ct.startsWith("image/")) {
                    imageBytes = Buffer.from(await aiRes.arrayBuffer());
                } else {
                    console.warn(`[discover] AI proxy ${aiRes.status}`);
                }
            } catch (e: any) {
                console.warn(`[discover] AI proxy error: ${e?.message}`);
            }

            // Fallback 1: Pollinations → Segmind → HuggingFace
            if (!imageBytes) {
                imageBytes = await generateImage(samplePrompt);
            }

            // Fallback 2: Google Gemini image generation
            if (!imageBytes) {
                try {
                    const gemImgRes = await internalFetch(`${base}/ai/generate-image`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            prompt: samplePrompt,
                            provider: "Google",
                            modelId: "gemini-2.0-flash-preview-image-generation",
                            width: 1024, height: 1024,
                        }),
                        signal: AbortSignal.timeout(60_000),
                    });
                    const gemCt = gemImgRes.headers.get("content-type") ?? "";
                    if (gemImgRes.ok && gemCt.startsWith("image/")) {
                        imageBytes = Buffer.from(await gemImgRes.arrayBuffer());
                        deps.io?.emit("autopilot:log", { message: "🎨 Imagen generada con Google Gemini (fallback)" });
                    } else {
                        console.warn(`[discover] Google image fallback ${gemImgRes.status}`);
                    }
                } catch (e: any) {
                    console.warn(`[discover] Google image fallback error: ${e?.message}`);
                }
            }

            // Upload to Cloudinary via bytes (avoids fetching blocked Pollinations URL)
            if (imageBytes) {
                try {
                    const cldRes = await internalFetch(`${base}/cloudinary/upload-image`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ imageBase64: imageBytes.toString("base64"), nicheId }),
                        signal: AbortSignal.timeout(30_000),
                    });
                    if (cldRes.ok) {
                        const cldData = await cldRes.json() as any;
                        const cloudUrl = cldData.image?.url;
                        if (cloudUrl) {
                            telegramImageUrl = cloudUrl;
                            await Niche.findByIdAndUpdate(nicheId, { $set: { sampleImageUrl: cloudUrl } });
                            deps.io?.emit("niches:updated");
                        }
                    }
                } catch { /* non-critical */ }
            }

            // Create pending action and send Telegram
            const styleLabel: Record<string, string> = {
                generic: "Genérico", anime: "Anime", illustration: "Ilustración",
                children: "Infantil", realistic: "Realista", watercolor: "Acuarela",
                abstract: "Abstracto", "wall-art": "Wall Art", botanical: "Botánico",
                affirmation: "Afirmación", geometric: "Geométrico", celestial: "Celestial", retro: "Retro",
            };
            const typeLabel = productType === "printable-poster" ? "Póster imprimible" : "Libro de colorear";

            const action = await TelegramAction.create({
                type: "niche-discovery",
                nicheId,
                nicheName: (niche as any).name,
                imageUrl: telegramImageUrl,
                imagePrompt: samplePrompt,
                aiModel: discoveryModel,
                autoApproveAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            });

            const caption = [
                `🔍 <b>Nuevo nicho encontrado</b>`,
                ``,
                `📚 <b>${(niche as any).name}</b>`,
                `🎨 ${styleLabel[style] ?? style} · ${typeLabel}`,
                (niche as any).description ? `📝 ${(niche as any).description}` : null,
                ``,
                `¿Qué hacemos?`,
                `<i>🚀 Continuar → ${catalogsPerNiche} catálogos × ${imagesPerCatalog} imgs + SEO</i>`,
            ].filter(Boolean).join("\n");

            const buttons = [[
                { text: "🚀 Continuar", callback_data: `continuar:${String(action._id)}` },
                { text: "⏭️ Omitir", callback_data: `omitir:${String(action._id)}` },
                { text: "🗑️ Descartar", callback_data: `descartar:${String(action._id)}` },
            ]];

            let msgId: number | null = null;
            // force=true (manual trigger) always sends; otherwise respect shouldNotify toggle
            if (force || await shouldNotify("autopilot.discovery")) {
                if (imageBytes) {
                    msgId = await sendTelegramImageWithButtons(imageBytes, caption, buttons);
                }
                // If image bytes failed, try URL-based photo send
                if (!msgId && telegramImageUrl && !telegramImageUrl.includes("pollinations.ai")) {
                    msgId = await sendTelegramPhotoDiscovery({ imageUrl: telegramImageUrl, caption, actionId: String(action._id) });
                }
                // Last resort: text-only with buttons so user can still act
                if (!msgId) {
                    msgId = await sendTelegramButtons(
                        caption + "\n\n⚠️ <i>Sin imagen de muestra (configura un proveedor de imagen en Ajustes)</i>",
                        buttons
                    );
                }
            }

            if (msgId) { action.messageId = msgId; await action.save(); }

            return reply.send({ ok: true, nicheId, sampleImageUrl: sampleUrl, actionId: String(action._id) });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Reset a stuck TelegramAction so user can retry from Telegram ──
    app.post("/autopilot/niche/:nicheId/reset-action", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { nicheId } = request.params as { nicheId: string };
            const action = await TelegramAction.findOneAndUpdate(
                { nicheId, type: "niche-discovery" },
                { $set: { status: "pending" }, $unset: { resolvedAt: "" } },
                { sort: { createdAt: -1 }, new: true }
            );
            if (!action) return reply.status(404).send({ error: "No hay acción para este nicho" });
            const buttons = [[
                { text: "🚀 Continuar", callback_data: `continuar:${String(action._id)}` },
                { text: "⏭️ Omitir",    callback_data: `omitir:${String(action._id)}` },
                { text: "🗑️ Descartar", callback_data: `descartar:${String(action._id)}` },
            ]];
            if (action.imageUrl) {
                // Use pollinationsFetch for Pollinations URLs (converts old image.pollinations.ai → new gen.pollinations.ai gateway)
                const { pollinationsFetch } = await import("../lib/pollinations-circuit.js");
                const fetchFn = action.imageUrl.includes("pollinations.ai")
                    ? (url: string) => pollinationsFetch(url, { signal: AbortSignal.timeout(60_000) })
                    : (url: string) => fetch(url, { signal: AbortSignal.timeout(30_000) });
                const imgRes = await fetchFn(action.imageUrl).catch(() => null);
                const buf = imgRes?.ok ? Buffer.from(await imgRes.arrayBuffer()) : null;
                if (buf) {
                    await sendTelegramImageWithButtons(buf, `🔄 <b>Reintentar: ${action.nicheName}</b>\n¿Qué hacemos?`, buttons);
                } else {
                    await sendTelegramButtons(`🔄 <b>Reintentar: ${action.nicheName}</b>\n¿Qué hacemos?`, buttons);
                }
            } else {
                await sendTelegramButtons(`🔄 <b>Reintentar: ${action.nicheName}</b>\n¿Qué hacemos?`, buttons);
            }
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Is autopilot currently running? (used by frontend to sync halo on reconnect) ──
    app.get("/autopilot/status", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            // A run is "live" only if it started less than 50 minutes ago (Agenda lockLifetime = 45 min)
            const cutoff = new Date(Date.now() - 50 * 60 * 1000);
            const runningJob = await AutopilotRun.findOne({
                status: "running",
                startedAt: { $gte: cutoff },
            }).lean();
            // Mark stale runs as aborted so the halo doesn't stay on after a server restart
            await AutopilotRun.updateMany(
                { status: "running", startedAt: { $lt: cutoff } },
                { $set: { status: "aborted", finishedAt: new Date(), abortReason: "Proceso reiniciado (stale lock)" } }
            );
            return reply.send({ running: !!runningJob });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Run history ──────────────────────────────────────────────────────────
    app.get("/autopilot/runs", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const runs = await AutopilotRun.find().sort({ startedAt: -1 }).limit(30).lean();
            return reply.send({ runs });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Clear run history ────────────────────────────────────────────────────
    app.delete("/autopilot/runs", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { deletedCount } = await AutopilotRun.deleteMany({});
            return reply.send({ ok: true, deleted: deletedCount });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Test Telegram ─────────────────────────────────────────────────────────
    app.post("/autopilot/test-telegram", async (_req, reply) => {
        try {
            await sendTelegram("✅ <b>Emi Gestor</b>\nConexión con Telegram funcionando correctamente 🚀");
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Insights timeseries ───────────────────────────────────────────────────
    app.get("/insights/timeseries", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const days = Math.min(parseInt(request.query?.days ?? "30") || 30, 90);
            const since = new Date(Date.now() - days * 86400000);

            const { Catalog } = await import("../models/catalog.js");

            // Daily niches created
            const nichesSeries = await Niche.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]);

            // Daily catalogs created
            const catalogsSeries = await Catalog.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]);

            // Daily images generated — unwind catalog images, parse createdAt string to date
            const imagesSeries = await Catalog.aggregate([
                { $unwind: "$images" },
                { $addFields: { imgDate: { $toDate: "$images.createdAt" } } },
                { $match: { imgDate: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$imgDate" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]);

            // Autopilot runs per day
            const runsSeries = await AutopilotRun.aggregate([
                { $match: { startedAt: { $gte: since }, status: { $in: ["completed", "aborted"] } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]);

            // Build a full date index
            const dateMap = (series: { _id: string; count: number }[]) => {
                const m: Record<string, number> = {};
                for (const s of series) m[s._id] = s.count;
                return m;
            };
            const nichesMap = dateMap(nichesSeries);
            const catalogsMap = dateMap(catalogsSeries);
            const imagesMap = dateMap(imagesSeries);
            const runsMap = dateMap(runsSeries);

            const dates: string[] = [];
            for (let i = 0; i < days; i++) {
                const d = new Date(since.getTime() + i * 86400000);
                dates.push(d.toISOString().slice(0, 10));
            }

            return reply.send({
                dates,
                niches: dates.map(d => nichesMap[d] ?? 0),
                catalogs: dates.map(d => catalogsMap[d] ?? 0),
                images: dates.map(d => imagesMap[d] ?? 0),
                runs: dates.map(d => runsMap[d] ?? 0),
            });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Trigger KDP publish job ───────────────────────────────────────────────
    app.post("/niches/:id/publish-kdp", async (req: any, reply) => {
        if (!ensureMongo(reply)) return;
        const { id } = req.params as { id: string };
        try {
            const niche = await Niche.findById(id).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            const n = niche as any;
            if (!n.bookPdfUrl) return reply.status(400).send({ error: "El nicho no tiene PDF generado. Genera el PDF del libro primero." });
            if (!n.listings?.[0]?.title) return reply.status(400).send({ error: "El nicho no tiene listing SEO. Genera el listing primero." });
            if (!deps.agenda) return reply.status(503).send({ error: "Agenda no disponible" });

            await deps.agenda.now("kdp-publish", { nicheId: String(n._id) });
            deps.io?.emit("kdp:status", { nicheId: id, status: "queued" });

            return reply.send({ queued: true, message: `Job KDP encolado para "${n.name}"` });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
