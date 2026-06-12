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

            let listingData: { title: string; subtitle: string; description: string; keywords: string[]; etsyTags?: string[]; categories?: string[]; seoNotes?: string; platform?: "kdp" | "etsy" | "both" };

            if (body.generate || (!body.title && !body.description)) {
                // Auto-generate using AI from niche context
                const niche = await Niche.findById(id).lean();
                if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

                const { generateTextWithLLM } = await import("../lib/ai.js");
                const { gatherKeywordIntel, gatherEtsyIntel, validateKdpKeywords, validateEtsyTags, checkTitleReadability, checkDescriptionKeywordCoverage } = await import("../lib/seo-engine.js");

                const pt = (niche as any).productType ?? "coloring-book";

                // ── Etsy-first products only need Etsy intel; KDP products need both ──
                const isEtsyFirst = pt === "printable-poster" || pt === "seamless-pattern";
                const marketScan = (niche as any).marketScan as any;
                const scanSuggestions: string[] = [
                    ...(marketScan?.demand?.usSuggestions ?? []),
                    ...(marketScan?.demand?.esSuggestions ?? []),
                ];

                const [kdpIntel, etsyIntel] = await Promise.all([
                    isEtsyFirst ? Promise.resolve(null) : gatherKeywordIntel((niche as any).name, pt),
                    gatherEtsyIntel((niche as any).name, pt),
                ]);

                const kdpTerms = kdpIntel
                    ? [...new Set([...kdpIntel.terms, ...scanSuggestions.map(s => s.toLowerCase())])].slice(0, 20)
                    : [];
                const etsyTerms = [...new Set([
                    ...etsyIntel.occasionTerms.slice(0, 8),
                    ...etsyIntel.moodTerms.slice(0, 6),
                    ...etsyIntel.lifestyleTerms.slice(0, 4),
                ])];

                // Fetch latest radar insight summary for market context
                let radarMarketContext = "";
                try {
                    const { RadarInsight } = await import("../models/radar-insight.js");
                    const latestInsight = await RadarInsight.findOne({}).sort({ createdAt: -1 }).lean();
                    if (latestInsight?.analysis?.summary) {
                        radarMarketContext = `Contexto de mercado reciente: ${latestInsight.analysis.summary}`;
                    }
                } catch { /* non-blocking */ }

                const sharedContext = [
                    `Nicho: ${(niche as any).name}`,
                    `Tipo de producto: ${pt}`,
                    ((niche as any).tags as string[]).length > 0 ? `Tags: ${((niche as any).tags as string[]).join(", ")}` : "",
                    (niche as any).styleCategory && (niche as any).styleCategory !== "generic" ? `Estilo visual: ${(niche as any).styleCategory}` : "",
                    (niche as any).description ? `Descripción del nicho: ${(niche as any).description}` : "",
                    marketScan?.us?.resultCount ? `Mercado US: ${marketScan.us.resultCount} resultados, mediana ${marketScan.us.medianReviews ?? "?"} reviews` : "",
                    radarMarketContext,
                ].filter(Boolean).join("\n");

                // ── KDP Prompt (A9/A10 algorithm — keyword-first, backend slots) ─────────
                const KDP_SYSTEM = `Eres especialista en SEO para Amazon KDP. Tu trabajo: metadatos que ranqueen en Amazon (algoritmo A9/A10).
PRINCIPIOS KDP:
- El título es el campo de mayor peso de indexación. Keyword principal (mayor volumen de búsqueda real) va PRIMERA.
- Las 7 casillas de keywords backend son para long-tail que NO aparece en título/subtítulo. Repetir desperdicia el slot.
- Amazon penaliza keyword stuffing visible en título (baja conversión → baja rank). El título debe leerse natural.
- El comprador en Amazon busca CONTENIDO: "adult coloring book stress relief", "mandala coloring pages 50 designs".

REGLAS DURAS:
- title: 50-80 chars. Formato "[Keyword volumen alto] Coloring Book: [Beneficio] for [Audiencia]"
- subtitle: 60-90 chars. Nº páginas únicas, nivel detalle, audiencia específica. Sin repetir palabras del título.
- description: HTML para KDP. (1) <p> hook con <strong> en 2-3 keywords, (2) <ul><li> 4-5 beneficios concretos, (3) <p> CTA. 450-650 chars.
- keywords: EXACTAMENTE 7 frases long-tail, máx 50 chars c/u. PROHIBIDO: best/new/free/top/premium/book/amazon/kindle + cualquier palabra del título/subtítulo.
- categories: 3 rutas completas y ESPECÍFICAS (ej: "Crafts, Hobbies & Home > Coloring Books for Adults").
Responde SOLO con JSON: { "title": string, "subtitle": string, "description": string, "keywords": string[7], "categories": string[3] }`;

                // ── Etsy Prompt (emotion-first, occasion/mood, lifestyle) ────────────────
                const ETSY_SYSTEM = `Eres especialista en SEO para Etsy. Tu trabajo: metadatos que conviertan en Etsy donde el comprador busca EXPERIENCIAS y REGALOS.
PRINCIPIOS ETSY:
- El título debe despertar EMOCIÓN primero. El comprador busca "gift for mom who loves coloring", no "mandala coloring book".
- Las 13 etiquetas (tags) son por FRASE (2-3 palabras). El matching de Etsy es por frase completa, no por palabra suelta.
- Cubre siempre: ocasión de regalo (birthday, mothers day, christmas), estado de ánimo (mindfulness, stress relief, self care), audiencia, formato del producto.
- La descripción cuenta una HISTORIA: quién lo usa, en qué momento del día, cómo se siente. El comprador debe verse en la imagen.
- El comprador en Etsy busca: "gifts for her", "self care gift ideas", "mindfulness activity for adults", "unique birthday gift".

REGLAS DURAS:
- title: 100-140 chars. Empieza por la emoción/ocasión más fuerte. Incluye el tipo de producto y 2-3 atributos clave (para quién, qué hace).
- description: HTML para Etsy. (1) <p> historia visual: quién es el comprador ideal y cómo usará el producto, (2) <ul><li> 4-5 puntos: qué incluye, para quién es perfecto, cuándo regalarlo, formato/specs, (3) <p> "Perfect for:" con 3-4 personas o momentos específicos. 500-700 chars.
- tags: EXACTAMENTE 13 tags, máx 20 chars c/u, frases de 2-3 palabras. Distribuye: 4 de ocasión/regalo, 4 de estado de ánimo/lifestyle, 3 de audiencia/para quién, 2 de tipo de producto.
- categories: 3 rutas Etsy ESPECÍFICAS (ej: "Books, Films & Music > Books > Activity Books").
Responde SOLO con JSON: { "title": string, "description": string, "tags": string[13], "categories": string[3] }`;

                const kdpContext = [
                    sharedContext,
                    kdpTerms.length > 0 ? `TÉRMINOS REALES AMAZON (úsalos como base para keywords):\n${kdpTerms.map(t => `- ${t}`).join("\n")}` : "",
                ].filter(Boolean).join("\n\n");

                const etsyContext = [
                    sharedContext,
                    etsyTerms.length > 0 ? `TÉRMINOS REALES ETSY (ocasión/mood — úsalos en title y tags):\n${etsyTerms.map(t => `- ${t}`).join("\n")}` : "",
                    etsyIntel.occasionTerms.length > 0 ? `Señales de ocasión detectadas: ${etsyIntel.occasionTerms.slice(0, 6).join(", ")}` : "",
                    etsyIntel.moodTerms.length > 0 ? `Señales de estado de ánimo: ${etsyIntel.moodTerms.slice(0, 5).join(", ")}` : "",
                ].filter(Boolean).join("\n\n");

                // Generate both listings in parallel
                const [kdpText, etsyText] = await Promise.all([
                    isEtsyFirst ? Promise.resolve("{}") : generateTextWithLLM(KDP_SYSTEM, kdpContext),
                    generateTextWithLLM(ETSY_SYSTEM, etsyContext),
                ]);

                // Parse KDP listing
                const kdpMatch = kdpText.match(/\{[\s\S]*\}/);
                const kdpParsed = kdpMatch ? JSON.parse(kdpMatch[0]) : {};

                // Parse Etsy listing
                const etsyMatch = etsyText.match(/\{[\s\S]*\}/);
                const etsyParsed = etsyMatch ? JSON.parse(etsyMatch[0]) : {};

                // Validate KDP keywords with hard rules
                const kdpTitle = kdpParsed.title ?? (niche as any).name;
                const kdpSubtitle = kdpParsed.subtitle ?? "";
                const kwResult = !isEtsyFirst && kdpIntel
                    ? validateKdpKeywords(Array.isArray(kdpParsed.keywords) ? kdpParsed.keywords : [], kdpTitle, kdpSubtitle, kdpIntel)
                    : { keywords: [], fixed: [] };

                // Validate Etsy tags with semantic enforcement (occasion/mood)
                const rawEtsyTags = Array.isArray(etsyParsed.tags) ? etsyParsed.tags : [];
                const etsyTags = validateEtsyTags(rawEtsyTags, etsyIntel);

                // For Etsy-first products the "main" listing is Etsy; for KDP-first it's KDP
                const primaryTitle = isEtsyFirst ? (etsyParsed.title ?? (niche as any).name) : kdpTitle;
                const primarySubtitle = isEtsyFirst ? "" : kdpSubtitle;
                const primaryDescription = isEtsyFirst ? (etsyParsed.description ?? "") : (kdpParsed.description ?? "");
                const primaryKeywords = kwResult.keywords;
                const primaryCategories = isEtsyFirst
                    ? (Array.isArray(etsyParsed.categories) ? etsyParsed.categories.slice(0, 3) : [])
                    : (Array.isArray(kdpParsed.categories) ? kdpParsed.categories.slice(0, 3) : []);

                // Calidad editorial: ¿el título suena humano? ¿la descripción cubre las keywords?
                const readabilityWarnings = checkTitleReadability(primaryTitle);
                const densityWarnings = checkDescriptionKeywordCoverage(primaryDescription, primaryTitle, primaryKeywords);

                listingData = {
                    title: primaryTitle,
                    subtitle: primarySubtitle,
                    description: primaryDescription,
                    keywords: primaryKeywords,
                    etsyTags,
                    categories: primaryCategories.map((c: string) => c.trim()).filter(Boolean),
                    seoNotes: [
                        `KDP: ${kdpTerms.length} términos Amazon · Etsy: ${etsyTerms.length} señales ocasión/mood`,
                        kwResult.fixed.length > 0 ? `Validador KDP: ${kwResult.fixed.join(" · ")}` : "",
                        readabilityWarnings.length > 0 ? `⚠ Legibilidad: ${readabilityWarnings.join(" · ")}` : "",
                        densityWarnings.length > 0 ? `⚠ Densidad: ${densityWarnings.join(" · ")}` : "",
                        !isEtsyFirst && etsyParsed.title ? `Título Etsy sugerido: "${etsyParsed.title.slice(0, 80)}…"` : "",
                    ].filter(Boolean).join(" | "),
                    platform: isEtsyFirst ? "etsy" : "both",
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

    // Calibración con histórico propio — cacheada 10 min (agrega ventas de todos los nichos)
    let _calibCache: { data: any; expiresAt: number } | null = null;
    const getCalibration = async () => {
        if (_calibCache && _calibCache.expiresAt > Date.now()) return _calibCache.data;
        const { computeScoreCalibration } = await import("../lib/score-calibration.js");
        const data = await computeScoreCalibration();
        _calibCache = { data, expiresAt: Date.now() + 10 * 60 * 1000 };
        return data;
    };

    // Adjunta el score ajustado por tu histórico real al resultado del scan (fail-safe)
    const withAdjustedScore = async (scan: any) => {
        try {
            const calibration = await getCalibration();
            const { adjustScore } = await import("../lib/score-calibration.js");
            const adj = adjustScore(scan.score, scan.verdict, calibration);
            return {
                ...scan,
                ...(adj.applied ? {
                    adjustedScore: adj.adjustedScore,
                    adjustmentFactor: adj.factor,
                    calibrationConfidence: calibration.confidence,
                    calibrationSample: calibration.sampleSize,
                } : {}),
            };
        } catch {
            return scan; // sin calibración no se bloquea nada
        }
    };

    // GET /niches/score-calibration — cómo predicen TUS scans vs tus ventas reales
    app.get("/niches/score-calibration", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            return reply.send(await getCalibration());
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
            return reply.send(await withAdjustedScore(scan));
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
            const scan = await withAdjustedScore(await scanNicheMarket(keyword, keywordEs?.trim() || undefined));
            niche.marketScan = scan as unknown as Record<string, unknown>;
            niche.markModified("marketScan");
            await niche.save();
            return reply.send({ niche: { id: String(niche._id), name: niche.name }, scan });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error en market-scan" });
        }
    });

    // GET /niches/cohorts — curva de ventas de cada nicho publicado vs la media
    // de tus nichos anteriores en el mismo mes de vida ("¿va mejor o peor de lo normal?")
    app.get("/niches/cohorts", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { KdpSale } = await import("../models/kdp-sale.js");
            const published = await Niche.find({
                lifecycleStage: { $in: ["published", "end-of-life"] },
                publishedAt: { $ne: null },
            }).select("name publishedAt lifecycleStage marketScan.verdict").lean() as any[];

            if (published.length === 0) return reply.send({ cohorts: [], average: [], sampleSize: 0 });

            // Unidades por mes-de-vida para cada nicho (mes 0 = mes de publicación)
            const MAX_MONTHS = 6;
            const cohorts: Array<{
                nicheId: string; name: string; lifecycleStage: string; verdict?: string;
                monthsLive: number; curve: number[]; totalUnits: number;
            }> = [];

            for (const n of published) {
                const pub = new Date(n.publishedAt);
                const monthsLive = Math.min(
                    MAX_MONTHS,
                    (new Date().getFullYear() - pub.getFullYear()) * 12 + (new Date().getMonth() - pub.getMonth()) + 1,
                );
                const periods: string[] = [];
                for (let m = 0; m < monthsLive; m++) {
                    const d = new Date(pub.getFullYear(), pub.getMonth() + m, 1);
                    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                }
                const sales = await KdpSale.aggregate([
                    { $match: { nicheId: String(n._id), period: { $in: periods } } },
                    { $group: { _id: "$period", units: { $sum: "$unitsSold" } } },
                ]);
                const byPeriod = new Map(sales.map((s: any) => [s._id, s.units]));
                const curve = periods.map(p => byPeriod.get(p) ?? 0);
                cohorts.push({
                    nicheId: String(n._id),
                    name: n.name,
                    lifecycleStage: n.lifecycleStage,
                    verdict: n.marketScan?.verdict,
                    monthsLive,
                    curve,
                    totalUnits: curve.reduce((a, b) => a + b, 0),
                });
            }

            // Curva media por mes de vida (solo con los nichos que llegaron a ese mes)
            const average: Array<{ month: number; avgUnits: number; niches: number }> = [];
            for (let m = 0; m < MAX_MONTHS; m++) {
                const present = cohorts.filter(c => c.curve.length > m);
                if (present.length === 0) break;
                const avg = present.reduce((a, c) => a + c.curve[m], 0) / present.length;
                average.push({ month: m, avgUnits: Math.round(avg * 10) / 10, niches: present.length });
            }

            // Comparativa: cada nicho vs la media en su último mes completo
            const enriched = cohorts.map(c => {
                const lastMonth = c.monthsLive - 1;
                const avgAtMonth = average[lastMonth]?.avgUnits ?? 0;
                const own = c.curve[lastMonth] ?? 0;
                const vsAverage = avgAtMonth > 0 ? Math.round((own / avgAtMonth) * 100) / 100 : null;
                return { ...c, currentMonth: lastMonth, unitsThisMonth: own, avgAtSameMonth: avgAtMonth, vsAverage };
            }).sort((a, b) => (b.vsAverage ?? 0) - (a.vsAverage ?? 0));

            return reply.send({ cohorts: enriched, average, sampleSize: cohorts.length });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
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
