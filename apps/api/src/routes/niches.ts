import { FastifyInstance } from "fastify";
import { Niche } from "../models/niche.js";

const _SERVER_API_KEY = process.env.SERVER_API_KEY || "";
function internalFetch(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...init, headers: { ...(_SERVER_API_KEY ? { Authorization: `Bearer ${_SERVER_API_KEY}` } : {}), ...(init.headers as Record<string, string> ?? {}) } });
}
import { Catalog } from "../models/catalog.js";
import { BookDraft } from "../models/book-draft.js";
import { Settings } from "../models/settings.js";
import { getMongoStatus } from "../lib/mongo.js";
import { getAgenda } from "../lib/agenda.js";
import { scanNicheMarket } from "../lib/market-scan.js";
import { fetchTrendsReport } from "../lib/trends.js";

const RADAR_KEYS = [
    "RADAR_ETSY_RESULT", "RADAR_AMAZON_RESULT", "RADAR_REDDIT_RESULT",
    "RADAR_TRENDS_RESULT", "RADAR_GENERAL_RESULT", "RADAR_OPPORTUNITY_RESULT",
    "RADAR_MOVERS_RESULT", "RADAR_CROSS_RESULT", "RADAR_GAP_RESULT",
];

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerNicheRoutes(app: FastifyInstance) {
    app.get("/niches", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const niches = await Niche.find({ status: { $ne: "discarded" } }).sort({ createdAt: -1 }).lean();
            return reply.send({ niches });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.post("/niches", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { name, description, tags, status, competition, demand, productType, styleCategory, styleCategories, notes, etsyUrl, _sourceTitulo, radarInsight } = request.body as any;
            if (!name?.trim()) return reply.status(400).send({ error: "name required" });

            // Deduplication — return existing niche instead of creating a duplicate
            const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const existing = await Niche.findOne({ name: { $regex: new RegExp(`^${escaped}$`, "i") } }).lean();
            if (existing) return reply.status(200).send({ niche: existing, duplicate: true });
            const resolvedStyles: string[] = Array.isArray(styleCategories) && styleCategories.length > 0
                ? styleCategories
                : styleCategory ? [styleCategory] : ["generic"];
            const niche = await Niche.create({
                name: name.trim(),
                description: description?.trim() ?? "",
                tags: Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
                status: status ?? "found",
                competition: competition ?? "unknown",
                demand: demand ?? "unknown",
                productType: productType ?? "coloring-book",
                styleCategory: resolvedStyles[0] as any,
                styleCategories: resolvedStyles as any,
                notes: notes?.trim() ?? "",
                etsyUrl: etsyUrl?.trim() ?? "",
                sourceTitulo: _sourceTitulo?.trim() ?? "",
                ...(radarInsight && typeof radarInsight === "object" ? { radarInsight } : {}),
            });
            // If created from radar table, stamp _nichoCreado on the saved etsy result
            if (_sourceTitulo) {
                try {
                    const { Settings } = await import("../models/settings.js");
                    const row = await Settings.findOne({ key: "RADAR_ETSY_RESULT" }).lean();
                    if (row?.value) {
                        const saved = JSON.parse(row.value as string);
                        if (saved?.nichos_detectados) {
                            saved.nichos_detectados = saved.nichos_detectados.map((r: any) =>
                                r.titulo_producto === _sourceTitulo ? { ...r, _nichoCreado: true } : r
                            );
                            await Settings.findOneAndUpdate(
                                { key: "RADAR_ETSY_RESULT" },
                                { $set: { value: JSON.stringify(saved) } },
                                { upsert: true }
                            );
                        }
                    }
                } catch { /* silently ignore radar update failure */ }
            }
            // Auto-trigger discovery if new niche is interesting (status "found")
            if (niche.status === "found") {
                const nicheId = String(niche._id);
                setImmediate(async () => {
                    try {
                        const port = process.env.PORT || 3001;
                        await internalFetch(`http://localhost:${port}/autopilot/discover/${nicheId}`, { method: "POST" });
                    } catch { /* non-critical — discovery is best-effort */ }
                });
            }

            return reply.status(201).send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.patch("/niches/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const { name, nickname, description, tags, status, competition, demand, productType, styleCategory, styleCategories, notes, generatedPrompt, catalogIds } = request.body as any;
            const update: Record<string, any> = {};
            if (name?.trim()) update.name = name.trim();
            if (nickname !== undefined) update.nickname = nickname.trim();
            if (description !== undefined) update.description = description.trim();
            if (Array.isArray(tags)) update.tags = tags.map((t: string) => t.trim()).filter(Boolean);
            if (status) update.status = status;
            if (competition) update.competition = competition;
            if (demand) update.demand = demand;
            if (productType) update.productType = productType;
            if (Array.isArray(styleCategories) && styleCategories.length > 0) {
                update.styleCategories = styleCategories;
                update.styleCategory = styleCategories[0];
            } else if (styleCategory) {
                update.styleCategory = styleCategory;
                update.styleCategories = [styleCategory];
            }
            if (notes !== undefined) update.notes = notes.trim();
            if (generatedPrompt !== undefined) update.generatedPrompt = generatedPrompt;
            if (Array.isArray(catalogIds)) update.catalogIds = catalogIds;
            if (request.body.phase) update.phase = request.body.phase;
            if (request.body.autoPilotEnabled !== undefined) update.autoPilotEnabled = Boolean(request.body.autoPilotEnabled);
            if (request.body.publishedAt !== undefined) {
                update.publishedAt = request.body.publishedAt ? new Date(request.body.publishedAt) : null;
                update.lifecycleAlertsSent = []; // nueva fecha = reiniciar los hitos avisados
            }
            if (request.body.lifecycleStage !== undefined) {
                update.lifecycleStage = request.body.lifecycleStage || null;
            }
            if (request.body.asin !== undefined) update.asin = request.body.asin;
            if (request.body.etsyUrl !== undefined) update.etsyUrl = request.body.etsyUrl;
            if (request.body.gumroadUrl !== undefined) update.gumroadUrl = request.body.gumroadUrl;
            // Sync pipeline flags when artifact URLs are explicitly set or cleared
            if (request.body.bookPdfUrl !== undefined) {
                update.bookPdfUrl = request.body.bookPdfUrl;
                update.pipelineHasPdf = !!request.body.bookPdfUrl;
            }
            if (request.body.coverUrl !== undefined) {
                update.coverUrl = request.body.coverUrl;
                update.pipelineHasCover = !!request.body.coverUrl;
            }
            // Allow direct flag overrides (e.g. when a book draft is linked without a final PDF URL)
            if (request.body.pipelineHasPdf !== undefined && request.body.bookPdfUrl === undefined) update.pipelineHasPdf = Boolean(request.body.pipelineHasPdf);
            if (request.body.pipelineHasCover !== undefined && request.body.coverUrl === undefined) update.pipelineHasCover = Boolean(request.body.pipelineHasCover);
            if (request.body.pipelineHasCatalogs !== undefined) update.pipelineHasCatalogs = Boolean(request.body.pipelineHasCatalogs);
            if (request.body.pipelineHasListings !== undefined) update.pipelineHasListings = Boolean(request.body.pipelineHasListings);
            if (Array.isArray(request.body.coverCandidates)) update.coverCandidates = request.body.coverCandidates;
            if (request.body.backCoverUrl !== undefined) update.backCoverUrl = request.body.backCoverUrl;
            const niche = await Niche.findByIdAndUpdate(id, { $set: update }, { returnDocument: 'after' }).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            // When autopilot is enabled on a niche that's already past the catalog phase, kick off autopilot-run
            if (update.autoPilotEnabled === true) {
                const phase = (niche as any).phase ?? "niche";
                if (["catalog", "libro", "seo", "cover"].includes(phase)) {
                    getAgenda()?.schedule("in 5 seconds", "autopilot-run", {}).catch(() => {});
                }
            }
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.post("/niches/:id/royalties", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const { month, sales, revenue } = request.body as any;
            if (!month?.trim()) return reply.status(400).send({ error: "month required" });
            const niche = await Niche.findByIdAndUpdate(
                id,
                { $push: { royalties: { month: month.trim(), sales: Number(sales) || 0, revenue: Number(revenue) || 0 } } },
                { returnDocument: 'after' }
            ).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.delete("/niches/:id/royalties/:month", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id, month } = request.params as { id: string; month: string };
            const niche = await Niche.findByIdAndUpdate(
                id,
                { $pull: { royalties: { month: decodeURIComponent(month) } } },
                { returnDocument: 'after' }
            ).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.delete("/niches/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const niche = await Niche.findById(id).lean() as any;

            // Soft-delete so radar can't re-discover the same niche
            await Niche.findByIdAndUpdate(id, { $set: { status: "discarded" } });

            // Clean radar result arrays so the entry doesn't reappear in the radar table
            if (niche?.sourceTitulo) {
                for (const key of RADAR_KEYS) {
                    try {
                        const row = await Settings.findOne({ key }).lean() as any;
                        if (!row?.value) continue;
                        const saved = JSON.parse(row.value as string);
                        if (!Array.isArray(saved?.nichos_detectados)) continue;
                        const before = saved.nichos_detectados.length;
                        saved.nichos_detectados = saved.nichos_detectados.filter(
                            (r: any) => r.titulo_producto !== niche.sourceTitulo
                        );
                        if (saved.nichos_detectados.length !== before) {
                            await Settings.findOneAndUpdate({ key }, { $set: { value: JSON.stringify(saved) } });
                        }
                    } catch { /* non-critical */ }
                }
            }

            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /niches/:id/listings — generate (optionally via AI) + save a KDP listing to the niche
    app.post("/niches/:id/listings", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const body = request.body as {
                title?: string; subtitle?: string; description?: string; keywords?: string[];
                generate?: boolean;
            };

            let listingData: { title: string; subtitle: string; description: string; keywords: string[]; etsyTags?: string[]; categories?: string[]; seoNotes?: string };

            if (body.generate || (!body.title && !body.description)) {
                // Auto-generate using AI from niche context
                const niche = await Niche.findById(id).lean();
                if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

                const { generateTextWithLLM } = await import("../lib/ai.js");
                const { gatherKeywordIntel, validateKdpKeywords, validateEtsyTags } = await import("../lib/seo-engine.js");

                const pt = (niche as any).productType ?? "coloring-book";

                // ── Intel real: lo que la gente teclea en Amazon/Google AHORA ──
                const intel = await gatherKeywordIntel((niche as any).name, pt);
                const marketScan = (niche as any).marketScan as any;
                const scanSuggestions: string[] = [
                    ...(marketScan?.demand?.usSuggestions ?? []),
                    ...(marketScan?.demand?.esSuggestions ?? []),
                ];
                const realTerms = [...new Set([...intel.terms, ...scanSuggestions.map(s => s.toLowerCase())])].slice(0, 25);
                const KDP_SYSTEM = pt === "coloring-book"
                    ? `Eres un especialista en SEO y copywriting para Amazon KDP. Genera metadatos de alta conversión para un LIBRO DE COLOREAR (coloring book).
Responde SOLO con JSON válido (sin markdown): { "title": string, "subtitle": string, "description": string, "keywords": string[] }
- title: 50-80 chars. Formato: "[Keyword principal] Coloring Book: [Beneficio emocional] for [Audiencia]". Empieza por la keyword de mayor volumen de búsqueda en Amazon, NO hagas una simple lista de palabras.
- subtitle: 60-90 chars. Menciona nº de páginas únicas (ej. "50 Unique Designs"), nivel de detalle (intricate / simple), y audiencia específica. No repitas palabras del título.
- description: HTML para Amazon KDP. Estructura: (1) <p> hook emocional con <strong> en 2-3 keywords clave, (2) <ul><li> 4-5 beneficios concretos (alivio de estrés, mindfulness, regalo perfecto, horas de entretenimiento, páginas de una sola cara), (3) <p> llamada a la acción + para quién es ideal (adultos, niños, aficionados al arte, etc.). 450-650 chars visibles.
- keywords: exactamente 7 frases de cola larga (2-5 palabras c/u) que NO repitan palabras del título. Combina: temática específica + audiencia + ocasión de regalo + "coloring pages" / "stress relief" / "adult coloring" / "activity book" según corresponda.`
                    : pt === "printable-poster"
                    ? `Eres un especialista en SEO y copywriting para productos digitales imprimibles en Etsy y Gumroad. Genera metadatos de alta conversión para un IMPRIMIBLE DIGITAL (printable).
Responde SOLO con JSON válido (sin markdown): { "title": string, "subtitle": string, "description": string, "keywords": string[] }
- title: 50-80 chars. Formato: "[Keyword principal] Printable Wall Art — Instant Download". Empieza por la keyword de mayor volumen, destaca que es descarga instantánea, NO hagas lista de keywords.
- subtitle: 60-90 chars. Menciona los formatos incluidos (ej. "A4, US Letter & 8×10" PDF + PNG"), el uso decorativo (home decor, nursery, office) y que no se necesita suscripción. No repitas palabras del título.
- description: HTML para Etsy/Gumroad. Estructura: (1) <p> hook con <strong> en 2-3 keywords de decoración/regalo, (2) <ul><li> 4-5 puntos: descarga instantánea, formatos incluidos, resolución de impresión (300 DPI), uso permitido (personal/comercial), ideas de regalo; (3) <p> llamada a la acción + instrucciones de uso (descarga, imprime en casa o en imprenta). 450-650 chars visibles.
- keywords: exactamente 7 frases de cola larga (2-5 palabras c/u) que NO repitan palabras del título. Combina: "printable wall art" + "instant download" + temática + habitación destino (nursery, bedroom, kitchen) + ocasión (birthday gift, housewarming) + "digital print" / "digital download".`
                    : pt === "seamless-pattern"
                    ? `Eres un especialista en SEO y copywriting para patrones digitales sin costura (seamless patterns) para Etsy, Creative Market y Spoonflower. Genera metadatos de alta conversión.
Responde SOLO con JSON válido (sin markdown): { "title": string, "subtitle": string, "description": string, "keywords": string[] }
- title: 50-80 chars. Formato: "[Keyword] Seamless Pattern — Digital Download". Empieza por la keyword con mayor volumen, incluye "seamless pattern", NO hagas lista de keywords.
- subtitle: 60-90 chars. Menciona archivos incluidos (ej. "PNG Tile 12×12" at 300 DPI + SVG"), usos (fabric, wallpaper, scrapbooking, POD). No repitas palabras del título.
- description: HTML. Estructura: (1) <p> hook con <strong> en el estilo/temática + uso principal, (2) <ul><li> 4-5 puntos: tile size, DPI, formatos, licencia de uso (POD permitido / no comercial), instrucciones de repeat; (3) <p> llamada a la acción + plataformas compatibles (Spoonflower, Printful, Redbubble). 450-650 chars visibles.
- keywords: exactamente 7 frases de cola larga (2-5 palabras c/u) que NO repitan palabras del título. Combina: "seamless pattern" + temática + estilo (watercolor, boho, minimalist) + material destino (fabric, wallpaper, gift wrap) + "digital paper" / "scrapbooking" / "surface design".`
                    : `Eres un especialista en SEO y copywriting para Amazon KDP y productos digitales. Genera metadatos de alta conversión.
Responde SOLO con JSON válido (sin markdown): { "title": string, "subtitle": string, "description": string, "keywords": string[] }
- title: 50-80 chars, empieza por la keyword de mayor volumen. Atractivo y orientado a la conversión. Formato: "[Keyword]: [Beneficio emocional] for [Audiencia]"
- subtitle: 60-90 chars, keywords secundarias no repetidas del título, menciona cantidad de páginas/diseños y audiencia
- description: HTML. Estructura: (1) <p> hook emocional con <strong> en 2-3 keywords, (2) <ul><li> 4-5 beneficios concretos, (3) <p> llamada a la acción. 450-650 chars visibles.
- keywords: exactamente 7 frases de cola larga (2-5 palabras c/u), sin repetir palabras del título.`;

                // Reglas duras comunes (algoritmo A9/A10) — se añaden a cualquier prompt de producto
                const SEO_RULES = `

REGLAS DURAS ADICIONALES (obligatorias):
- IDIOMA: TODO el output (title, subtitle, description, keywords, etsyTags, categories) en INGLÉS — el mercado objetivo es amazon.com/etsy.com (US). Solo usa otro idioma si el contexto lo pide explícitamente.
- "title": la keyword de mayor volumen REAL va al principio, pero debe leerse natural para un humano (Amazon penaliza keyword stuffing en título vía conversión).
- "keywords": exactamente 7 frases long-tail, cada una de MÁXIMO 50 caracteres. PROHIBIDO: best, new, free, top, premium, book, amazon, kindle, y cualquier palabra que ya aparezca en title o subtitle (Amazon ya indexa título/subtítulo — repetir desperdicia el slot).
- Construye las keywords COMBINANDO los TÉRMINOS REALES DE BÚSQUEDA del contexto (es lo que la gente teclea de verdad en Amazon). No inventes términos si hay reales disponibles.
- "etsyTags": exactamente 13 tags de máximo 20 caracteres cada uno, frases de 2-3 palabras (el matching de Etsy es por frase, no por palabra suelta). Cubre: temática, estilo, audiencia, ocasión de regalo, uso.
- "categories": 3 categorías lo más ESPECÍFICAS posible con su ruta completa (ej. "Crafts, Hobbies & Home > Crafts & Hobbies > Coloring Books for Adults"). Mejor top de categoría nicho que página 50 de una general.
Responde SOLO con JSON válido (sin markdown): { "title": string, "subtitle": string, "description": string, "keywords": string[], "etsyTags": string[], "categories": string[] }`;

                // Fetch latest radar insight summary for market context
                let radarMarketContext = "";
                try {
                    const { RadarInsight } = await import("../models/radar-insight.js");
                    const latestInsight = await RadarInsight.findOne({}).sort({ createdAt: -1 }).lean();
                    if (latestInsight?.analysis?.summary) {
                        radarMarketContext = `En cuanto a productos similares detectados recientemente, hemos obtenido la siguiente información de mercado: ${latestInsight.analysis.summary}`;
                    }
                } catch { /* non-blocking */ }

                const context = [
                    `Nicho: ${(niche as any).name}`,
                    `Tipo de producto: ${pt}`,
                    ((niche as any).tags as string[]).length > 0 ? `Tags: ${((niche as any).tags as string[]).join(", ")}` : "",
                    (niche as any).styleCategory && (niche as any).styleCategory !== "generic" ? `Estilo visual: ${(niche as any).styleCategory}` : "",
                    (niche as any).description ? `Descripción del nicho: ${(niche as any).description}` : "",
                    realTerms.length > 0 ? `TÉRMINOS REALES DE BÚSQUEDA (autocomplete de Amazon/Google hoy — úsalos como base):\n${realTerms.map(t => `- ${t}`).join("\n")}` : "",
                    marketScan?.us?.resultCount ? `Mercado US: ${marketScan.us.resultCount} resultados, mediana ${marketScan.us.medianReviews ?? "?"} reviews → ${marketScan.verdict}` : "",
                    radarMarketContext,
                ].filter(Boolean).join("\n");

                const text = await generateTextWithLLM(KDP_SYSTEM + SEO_RULES, context);
                const match = text.match(/\{[\s\S]*\}/);
                if (!match) throw new Error("La IA no devolvió JSON válido");
                const parsed = JSON.parse(match[0]);

                // Validación dura por código — el LLM propone, las reglas disponen
                const title = parsed.title ?? niche.name;
                const subtitle = parsed.subtitle ?? "";
                const kwResult = validateKdpKeywords(
                    Array.isArray(parsed.keywords) ? parsed.keywords : [], title, subtitle, intel
                );
                const etsyTags = validateEtsyTags(Array.isArray(parsed.etsyTags) ? parsed.etsyTags : [], intel);

                listingData = {
                    title,
                    subtitle,
                    description: parsed.description ?? "",
                    keywords: kwResult.keywords,
                    etsyTags,
                    categories: Array.isArray(parsed.categories) ? parsed.categories.map((c: string) => c.trim()).filter(Boolean).slice(0, 3) : [],
                    seoNotes: [
                        realTerms.length > 0 ? `Basado en ${realTerms.length} términos reales de autocomplete.` : "",
                        kwResult.fixed.length > 0 ? `Validador: ${kwResult.fixed.join(" · ")}` : "",
                    ].filter(Boolean).join(" "),
                };
            } else {
                listingData = {
                    title: body.title?.trim() ?? "",
                    subtitle: body.subtitle?.trim() ?? "",
                    description: body.description?.trim() ?? "",
                    keywords: Array.isArray(body.keywords) ? body.keywords.map((k: string) => k.trim()).filter(Boolean) : [],
                };
            }

            const niche = await Niche.findByIdAndUpdate(
                id,
                { $push: { listings: { ...listingData, generatedAt: new Date() } }, $set: { pipelineHasListings: true } },
                { returnDocument: 'after' }
            ).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // PATCH /niches/:id/listings/:listingId — edit a saved KDP listing
    app.patch("/niches/:id/listings/:listingId", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id, listingId } = request.params as { id: string; listingId: string };
            const body = request.body as { title?: string; subtitle?: string; description?: string; keywords?: string[] };
            const update: Record<string, any> = {};
            if (body.title       !== undefined) update["listings.$.title"]       = body.title.trim();
            if (body.subtitle    !== undefined) update["listings.$.subtitle"]    = body.subtitle.trim();
            if (body.description !== undefined) update["listings.$.description"] = body.description.trim();
            if (body.keywords    !== undefined) update["listings.$.keywords"]    = body.keywords.map((k: string) => k.trim()).filter(Boolean);
            const niche = await Niche.findOneAndUpdate(
                { _id: id, "listings._id": listingId },
                { $set: update },
                { returnDocument: 'after' }
            ).lean();
            if (!niche) return reply.status(404).send({ error: "Listing no encontrado" });
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // DELETE /niches/:id/listings/:listingId — remove a saved KDP listing
    app.delete("/niches/:id/listings/:listingId", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id, listingId } = request.params as { id: string; listingId: string };
            const niche = await Niche.findByIdAndUpdate(
                id,
                { $pull: { listings: { _id: listingId } } },
                { returnDocument: 'after' }
            ).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            // Clear flag if no listings remain
            const remaining = (niche as any).listings?.length ?? 0;
            if (remaining === 0) {
                await Niche.findByIdAndUpdate(id, { $set: { pipelineHasListings: false } });
            }
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /niches/suggest-description — AI-suggested description, tags and notes
    // POST /niches/double-down — detecta nichos GANADORES (ventas reales) y propone spin-offs
    app.post("/niches/double-down", async (_request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { runDoubleDown } = await import("../lib/double-down.js");
            const winners = await runDoubleDown();
            return reply.send({ winners });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message ?? "Error en double-down" });
        }
    });

    // POST /niches/:id/seo-track — trackea AHORA las posiciones en Amazon de este nicho (necesita ASIN)
    app.post("/niches/:id/seo-track", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { trackNicheSeo } = await import("../lib/seo-tracker.js");
            const result = await trackNicheSeo(request.params.id);
            if (!result) return reply.status(400).send({ error: "El nicho no tiene ASIN — añádelo para trackear posiciones" });
            return reply.send(result);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message ?? "Error trackeando SEO" });
        }
    });

    // GET /niches/:id/seo-history — histórico de snapshots de posiciones
    app.get("/niches/:id/seo-history", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { SeoSnapshot } = await import("../models/seo-snapshot.js");
            const snapshots = await SeoSnapshot.find({ nicheId: request.params.id })
                .sort({ createdAt: -1 }).limit(26).lean();
            return reply.send({ snapshots });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // PATCH /niches/:id/listings/:listingId/apply — marca una versión como aplicada en KDP (día 0 del playbook)
    app.patch("/niches/:id/listings/:listingId/apply", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const niche = await Niche.findOneAndUpdate(
                { _id: request.params.id, "listings._id": request.params.listingId },
                { $set: { "listings.$.appliedAt": new Date() } },
                { returnDocument: "after" }
            ).lean();
            if (!niche) return reply.status(404).send({ error: "Listing no encontrado" });
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /niches/market-scan — balanza demanda/oferta/competencia en Amazon .com + .es
    // Un keyword por llamada (~15-25s): la UI itera la lista que quiera escanear.
    app.post("/niches/market-scan", async (request: any, reply) => {
        const { keyword, keywordEs } = request.body ?? {};
        if (!keyword?.trim()) return reply.status(400).send({ error: "keyword requerido" });
        try {
            const scan = await scanNicheMarket(String(keyword).trim(), keywordEs?.trim() || undefined);
            return reply.send(scan);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error en market-scan" });
        }
    });

    // POST /niches/:id/market-scan — escanea el nicho por nombre y guarda el resultado
    app.post("/niches/:id/market-scan", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        const { id } = request.params;
        const { keywordEs } = request.body ?? {};
        try {
            const niche = await Niche.findById(id);
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            const productSuffix = niche.productType === "printable-poster" ? "wall art print" : "coloring book";
            const keyword = `${niche.name} ${productSuffix}`;
            const scan = await scanNicheMarket(keyword, keywordEs?.trim() || undefined);
            niche.marketScan = scan as unknown as Record<string, unknown>;
            niche.markModified("marketScan");
            await niche.save();
            return reply.send({ niche: { id: String(niche._id), name: niche.name }, scan });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error en market-scan" });
        }
    });

    app.post("/niches/suggest-description", async (request: any, reply) => {
        const { nicheName, productType, style, etsyUrl } = request.body ?? {};
        if (!nicheName?.trim()) return reply.status(400).send({ error: "nicheName requerido" });

        const context = [
            `Niche: ${nicheName}`,
            productType ? `Product type: ${productType}` : "",
            style && style !== "generic" ? `Art style: ${style}` : "",
            etsyUrl ? `Reference Etsy URL: ${etsyUrl}` : "",
        ].filter(Boolean).join("\n");

        const systemPrompt = `You are a KDP publishing expert. Given a niche name, generate concise, useful metadata for tracking and publishing a self-published book (coloring book, journal, activity book).
Respond ONLY with valid JSON (no markdown):
{
  "description": "2-3 sentence niche overview — target audience, market angle, why it sells (max 200 chars)",
  "tags": ["tag1", "tag2", ...up to 8 relevant lowercase tags],
  "notes": "1-2 sentences with actionable publishing tip or market insight for this niche (max 160 chars)"
}`;

        try {
            const { generateTextWithLLM } = await import("../lib/ai.js");
            const text = await generateTextWithLLM(systemPrompt, context);
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) throw new Error("AI no devolvió JSON válido");
            const json = JSON.parse(match[0]);
            return reply.send({
                description: json.description ?? "",
                tags: Array.isArray(json.tags) ? json.tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [],
                notes: json.notes ?? "",
            });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error generando sugerencia" });
        }
    });

    // POST /niches/suggest-prompt — AI-suggested catalog prompt from niche context
    app.post("/niches/suggest-prompt", async (request: any, reply) => {
        const { nicheName, tags, description, productType, style, sourceTitulo } = request.body ?? {};
        if (!nicheName?.trim()) return reply.status(400).send({ error: "nicheName requerido" });

        const context = [
            `Niche: ${nicheName}`,
            sourceTitulo ? `Original Etsy product: "${sourceTitulo}"` : "",
            description ? `Description: ${description}` : "",
            Array.isArray(tags) && tags.length ? `Tags: ${tags.join(", ")}` : "",
            productType === "coloring-book" ? "Product type: coloring book (black and white line art)" : "",
            style ? `Art style: ${style}` : "",
        ].filter(Boolean).join("\n");

        const systemPrompt = `You are an expert at writing image generation prompts for Amazon KDP coloring books and printable products.
Generate an optimized prompt that will produce beautiful, unique images for this niche.
Respond ONLY with valid JSON (no markdown): { "theme": "string", "particulars": "string" }
- theme: specific main subject in English, evocative and detailed (60-120 chars)
- particulars: creative variation details to differentiate images in this niche, English (50-140 chars)`;

        try {
            const { generateTextWithLLM } = await import("../lib/ai.js");
            const text = await generateTextWithLLM(systemPrompt, context);
            const match = text.match(/\{[\s\S]*?\}/);
            if (!match) throw new Error("AI no devolvió JSON válido");
            const json = JSON.parse(match[0]);
            return reply.send({ theme: json.theme ?? nicheName, particulars: json.particulars ?? "" });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error generando sugerencia" });
        }
    });

    // POST /niches/repair-pipeline — scan all niches and correct pipeline flags + phase
    app.post("/niches/repair-pipeline", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const niches = await Niche.find({}).lean();
            const nicheIdsWithCatalogs = new Set<string>(
                (await Catalog.distinct("nicheIds", { status: "completed" })).map(String)
            );
            // A niche has a PDF if it has a bookPdfUrl OR any linked book draft
            const nicheIdsWithDrafts = new Set<string>(
                (await BookDraft.distinct("nicheId", { nicheId: { $exists: true, $ne: null } })).map(String)
            );

            let updated = 0;
            const phaseCounts: Record<string, number> = {};

            for (const niche of niches) {
                const id = String(niche._id);
                const hasCatalogs = nicheIdsWithCatalogs.has(id);
                const hasPdf = !!(niche as any).bookPdfUrl || nicheIdsWithDrafts.has(id);
                const hasListings = Array.isArray((niche as any).listings) && (niche as any).listings.length > 0;
                const hasCover = !!(niche as any).coverUrl;
                const isPublished = (niche as any).phase === "published";

                const phase = isPublished ? "published"
                    : hasCover ? "cover"
                    : hasListings ? "seo"
                    : hasPdf ? "libro"
                    : hasCatalogs ? "catalog"
                    : "niche";

                const current = niche as any;
                const needsUpdate =
                    current.pipelineHasCatalogs !== hasCatalogs ||
                    current.pipelineHasPdf !== hasPdf ||
                    current.pipelineHasListings !== hasListings ||
                    current.pipelineHasCover !== hasCover ||
                    (current.phase !== "published" && current.phase !== phase);

                if (needsUpdate) {
                    await Niche.findByIdAndUpdate(id, {
                        $set: {
                            pipelineHasCatalogs: hasCatalogs,
                            pipelineHasPdf: hasPdf,
                            pipelineHasListings: hasListings,
                            pipelineHasCover: hasCover,
                            ...(isPublished ? {} : { phase }),
                        },
                    });
                    updated++;
                }
                phaseCounts[phase] = (phaseCounts[phase] ?? 0) + 1;
            }

            return reply.send({ ok: true, total: niches.length, updated, phases: phaseCounts });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Trends: GET cached report or fetch fresh ─────────────────────────────
    app.get("/trends/signals", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const row = await Settings.findOne({ key: "TRENDS_REPORT" }).lean();
            if (row?.value) {
                return reply.send(JSON.parse(row.value as string));
            }
            // No cache yet — fetch on demand
            const report = await fetchTrendsReport();
            await Settings.findOneAndUpdate(
                { key: "TRENDS_REPORT" },
                { key: "TRENDS_REPORT", value: JSON.stringify(report) },
                { upsert: true }
            );
            return reply.send(report);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // Refresh trends manually
    app.post("/trends/refresh", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const report = await fetchTrendsReport();
            await Settings.findOneAndUpdate(
                { key: "TRENDS_REPORT" },
                { key: "TRENDS_REPORT", value: JSON.stringify(report) },
                { upsert: true }
            );
            return reply.send({ ok: true, signals: report.signals.length, nicheMatches: report.nicheMatches.length });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Autopilot: toggle enable/disable per niche ───────────────────────────
    app.patch("/niches/:id/autopilot", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { enabled, currentPrice } = request.body as { enabled?: boolean; currentPrice?: number };
            const update: Record<string, any> = {};
            if (typeof enabled === "boolean") update.autoPilotEnabled = enabled;
            if (typeof currentPrice === "number") update.currentPrice = currentPrice;
            const niche = await Niche.findByIdAndUpdate(request.params.id, { $set: update }, { new: true }).lean();
            if (!niche) return reply.status(404).send({ error: "Not found" });
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
