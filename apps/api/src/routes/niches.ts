import { FastifyInstance } from "fastify";
import { Niche } from "../models/niche.js";
import { sendTelegramImageWithButtons, sendTelegram } from "../lib/telegram.js";
import { TelegramAction } from "../models/telegram-action.js";
import { getAutopilotImageModel } from "../lib/image-gen.js";
import { buildColoringBookPrompt } from "./autopilot.js";

const _SERVER_API_KEY = process.env.SERVER_API_KEY || "";
function internalFetch(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...init, headers: { ...(_SERVER_API_KEY ? { Authorization: `Bearer ${_SERVER_API_KEY}` } : {}), ...(init.headers as Record<string, string> ?? {}) } });
}

const LEVEL_MAP: Record<string, "low" | "medium" | "high"> = {
    baja: "low", low: "low", bajo: "low",
    media: "medium", medium: "medium", medio: "medium", moderate: "medium",
    alta: "high", high: "high", alto: "high",
};
function normalizeLevel(v: unknown): "unknown" | "low" | "medium" | "high" {
    if (!v || typeof v !== "string") return "unknown";
    return LEVEL_MAP[v.trim().toLowerCase()] ?? "unknown";
}
import { Catalog } from "../models/catalog.js";
import { BookDraft } from "../models/book-draft.js";
import { Settings } from "../models/settings.js";
import { getCloudinaryConfig, initCloudinary } from "./cloudinary.js";
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
                competition: normalizeLevel(competition),
                demand: normalizeLevel(demand),
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
            if (competition) update.competition = normalizeLevel(competition);
            if (demand) update.demand = normalizeLevel(demand);
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
            if (request.body.sampleImageUrl !== undefined) update.sampleImageUrl = request.body.sampleImageUrl;
            if (request.body.discoveryImagePrompt !== undefined) update.discoveryImagePrompt = request.body.discoveryImagePrompt;
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

    // POST /niches/:id/confirm-prompt — record an approved prompt into the niche's prompt memory (max 10)
    app.post("/niches/:id/confirm-prompt", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const { prompt, source = "comparator" } = request.body ?? {};
            if (!prompt?.trim()) return reply.status(400).send({ error: "prompt requerido" });

            const niche = await Niche.findById(id).lean() as any;
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            const existing: any[] = niche.confirmedPrompts ?? [];
            // Skip if same prompt already stored
            if (existing.some((p: any) => p.prompt === prompt.trim())) {
                return reply.send({ ok: true, skipped: true });
            }
            // Keep max 10, remove oldest if needed
            const updated = [...existing, { prompt: prompt.trim(), source, addedAt: new Date() }]
                .slice(-10);

            await Niche.findByIdAndUpdate(id, { $set: { confirmedPrompts: updated } });
            return reply.send({ ok: true, total: updated.length });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── POST /niches/merge ────────────────────────────────────────────────────
    app.post("/niches/merge", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { sourceIds, targetName } = (request.body ?? {}) as { sourceIds?: string[]; targetName?: string };
            if (!Array.isArray(sourceIds) || sourceIds.length < 2) return reply.status(400).send({ error: "Se necesitan al menos 2 nichos para fusionar" });
            if (!targetName?.trim()) return reply.status(400).send({ error: "Proporciona un nombre para el nicho fusionado" });

            const sources = await Niche.find({ _id: { $in: sourceIds } }).lean() as any[];
            if (sources.length < 2) return reply.status(404).send({ error: "No se encontraron suficientes nichos" });

            const sourceIdStrs = sources.map((s: any) => String(s._id));

            // ── 1. FIND ALL CATALOGS using BOTH directions ──────────────────────────
            // Direction A: from niche.catalogIds arrays (may be stale)
            const fromNicheArrays = sources.flatMap((s: any) => (s.catalogIds ?? []) as string[])
                .map(String).filter(id => id && id !== "undefined" && id !== "null");

            // Direction B: query Catalog collection — try both string AND ObjectId forms
            const fromCatalogQuery = await Catalog.find({
                nicheIds: { $in: sourceIdStrs }
            }).select("_id nicheIds").lean() as any[];
            const fromCatalogQueryIds = fromCatalogQuery.map((c: any) => String(c._id));

            // Union of both — filter garbage values
            const allCatalogIdStrs = [...new Set([...fromNicheArrays, ...fromCatalogQueryIds])]
                .filter(id => id && id !== "undefined" && id !== "null");

            console.log("[merge] sourceIdStrs:", sourceIdStrs);
            console.log("[merge] fromNicheArrays (len):", fromNicheArrays.length, fromNicheArrays);
            console.log("[merge] fromCatalogQuery (len):", fromCatalogQuery.length, fromCatalogQueryIds);
            console.log("[merge] allCatalogIdStrs (len):", allCatalogIdStrs.length);

            // ── 2. PICK BEST METADATA from sources ──────────────────────────────────
            const mergedBookPdfUrl = sources.map((s: any) => s.bookPdfUrl).find(Boolean);
            const mergedCoverUrl   = sources.map((s: any) => s.coverUrl).find(Boolean);
            const mergedAsin       = sources.map((s: any) => s.asin).find(Boolean);
            const mergedListings   = sources.flatMap((s: any) => s.listings ?? []);
            // Derive phase from what data actually exists — never assume phase from source niches
            const effectivePhase = (() => {
                if (mergedAsin) return "published";
                if (mergedCoverUrl) return "cover";
                if (mergedListings.length > 0) return "seo";
                if (mergedBookPdfUrl) return "libro";
                if (allCatalogIdStrs.length > 0) return "catalog";
                return "niche";
            })();

            const first = sources.find((s: any) => s.sampleImageUrl) ?? sources[0];
            const merged = await Niche.create({
                name: targetName.trim(),
                status: "active",
                phase: effectivePhase,
                description: sources.map((s: any) => s.description || s.name).filter(Boolean).join(" · "),
                tags: [...new Set(sources.flatMap((s: any) => s.tags ?? []))],
                notes: `Fusión de: ${sources.map((s: any) => s.name).join(", ")}`,
                score: Math.max(...sources.map((s: any) => s.score ?? 0)),
                competition: first.competition ?? "unknown",
                styleCategory: first.styleCategory ?? "generic",
                styleCategories: [...new Set(sources.flatMap((s: any) => s.styleCategories ?? [s.styleCategory ?? "generic"]))],
                productType: first.productType ?? "coloring-book",
                // Pick first non-empty value for single-value fields
                sampleImageUrl: sources.map((s: any) => s.sampleImageUrl).find(Boolean) ?? undefined,
                coverUrl: sources.map((s: any) => s.coverUrl).find(Boolean) ?? undefined,
                backCoverUrl: sources.map((s: any) => s.backCoverUrl).find(Boolean) ?? undefined,
                bookPdfUrl: sources.map((s: any) => s.bookPdfUrl).find(Boolean) ?? undefined,
                discoveryImagePrompt: sources.map((s: any) => s.discoveryImagePrompt).find(Boolean) ?? undefined,
                generatedPrompt: sources.map((s: any) => s.generatedPrompt).find(Boolean) ?? undefined,
                asin: sources.map((s: any) => s.asin).find(Boolean) ?? undefined,
                etsyUrl: sources.map((s: any) => s.etsyUrl).find(Boolean) ?? undefined,
                gumroadUrl: sources.map((s: any) => s.gumroadUrl).find(Boolean) ?? undefined,
                // Merge arrays
                listings: sources.flatMap((s: any) => s.listings ?? []),
                confirmedPrompts: sources.flatMap((s: any) => s.confirmedPrompts ?? []),
                coverCandidates: [...new Set(sources.flatMap((s: any) => s.coverCandidates ?? []))],
                pendingCatalogPrompts: [...new Set(sources.flatMap((s: any) => s.pendingCatalogPrompts ?? []))],
                catalogImageOrder: sources.flatMap((s: any) => s.catalogImageOrder ?? []),
                royalties: sources.flatMap((s: any) => s.royalties ?? []),
                autoPilotEnabled: sources.some((s: any) => s.autoPilotEnabled),
                pipelineHasCatalogs: allCatalogIdStrs.length > 0,
                pipelineHasPdf: sources.some((s: any) => s.pipelineHasPdf),
                pipelineHasListings: sources.some((s: any) => s.pipelineHasListings),
                pipelineHasCover: sources.some((s: any) => s.pipelineHasCover),
            });

            const mergedId = String((merged as any)._id);

            // ── 3. REASSIGN ALL CATALOGS ─────────────────────────────────────────────
            for (const catId of allCatalogIdStrs) {
                const cat = await Catalog.findById(catId).lean() as any;
                if (!cat) continue;
                const existing: string[] = (cat.nicheIds ?? []).map(String);
                const filtered = existing.filter(id => !sourceIdStrs.includes(id));
                const newIds = [...new Set([...filtered, mergedId])];
                await Catalog.findByIdAndUpdate(catId, { $set: { nicheIds: newIds } });
            }
            await Niche.findByIdAndUpdate(mergedId, { $set: { catalogIds: allCatalogIdStrs } });

            // ── 4. REASSIGN SeoSnapshots + BookDrafts (do NOT delete) ────────────────
            const { SeoSnapshot } = await import("../models/seo-snapshot.js");
            for (const srcId of sourceIdStrs) {
                await SeoSnapshot.updateMany({ nicheId: srcId }, { $set: { nicheId: mergedId } }).catch(() => {});
                await BookDraft.updateMany({ nicheId: srcId }, { $set: { nicheId: mergedId } }).catch(() => {});
                await TelegramAction.updateMany({ nicheId: srcId }, { $set: { nicheId: mergedId } }).catch(() => {});
            }

            // ── 5. REASSIGN Cloudinary loose images (context.nicheId + tag) ─────────
            try {
                const cldConfig = await getCloudinaryConfig();
                if (cldConfig) {
                    const cld = await initCloudinary(cldConfig);
                    for (const srcId of sourceIdStrs) {
                        const seen = new Set<string>();

                        // A: by tag (images uploaded with nicheId get this tag)
                        try {
                            const tagged = await cld.api.resources_by_tag(`nicho:${srcId}`, { max_results: 500, context: true });
                            for (const r of (tagged.resources ?? [])) seen.add(r.public_id as string);
                        } catch { /* tag search not available on this plan */ }

                        // B: by context scan (images linked via PATCH only have context, no tag)
                        try {
                            const all = await cld.api.resources({ type: "upload", prefix: "emi-kdp-assets/", max_results: 500, context: true });
                            for (const r of (all.resources ?? [])) {
                                if (r.context?.custom?.nicheId === srcId) seen.add(r.public_id as string);
                            }
                        } catch { /* non-critical */ }

                        const publicIds = [...seen];
                        if (publicIds.length > 0) {
                            await cld.uploader.add_context(`nicheId=${mergedId}`, publicIds).catch(() => {});
                            await cld.uploader.add_tag(`nicho:${mergedId}`, publicIds).catch(() => {});
                            await cld.uploader.remove_tag(`nicho:${srcId}`, publicIds).catch(() => {});
                        }
                    }
                }
            } catch { /* non-critical — don't fail the whole merge */ }

            // ── 6. HARD-DELETE source niches (everything else already reassigned) ────
            await Niche.deleteMany({ _id: { $in: sourceIdStrs } });

            const result = await Niche.findById(mergedId).lean();
            return reply.status(201).send({
                niche: result,
                catalogCount: allCatalogIdStrs.length,
                mergedFrom: sourceIdStrs,
                debug: { fromNicheArrays, fromCatalogQueryIds, allCatalogIdStrs }
            });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── POST /niches/absorb ───────────────────────────────────────────────────
    // hostId keeps its name and data; sourceIds get absorbed into it and deleted.
    app.post("/niches/absorb", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { hostId, sourceIds } = (request.body ?? {}) as { hostId?: string; sourceIds?: string[] };
            if (!hostId) return reply.status(400).send({ error: "hostId requerido" });
            if (!Array.isArray(sourceIds) || sourceIds.length < 1) return reply.status(400).send({ error: "sourceIds requerido (mínimo 1)" });

            const host = await Niche.findById(hostId).lean() as any;
            if (!host) return reply.status(404).send({ error: "Nicho anfitrión no encontrado" });

            const sources = await Niche.find({ _id: { $in: sourceIds } }).lean() as any[];
            if (sources.length === 0) return reply.status(404).send({ error: "No se encontraron nichos a absorber" });

            const hostIdStr = String(host._id);
            const sourceIdStrs = sources.map((s: any) => String(s._id));

            // ── 1. FIND ALL CATALOGS from sources ───────────────────────────────────
            const fromNicheArrays = sources.flatMap((s: any) => (s.catalogIds ?? []) as string[])
                .map(String).filter(id => id && id !== "undefined" && id !== "null");
            const fromCatalogQuery = await Catalog.find({ nicheIds: { $in: sourceIdStrs } }).select("_id nicheIds").lean() as any[];
            const sourceCatalogIds = [...new Set([...fromNicheArrays, ...fromCatalogQuery.map((c: any) => String(c._id))])]
                .filter(id => id && id !== "undefined" && id !== "null");

            // ── 2. REASSIGN CATALOGS to host ────────────────────────────────────────
            for (const catId of sourceCatalogIds) {
                const cat = await Catalog.findById(catId).lean() as any;
                if (!cat) continue;
                const existing: string[] = (cat.nicheIds ?? []).map(String);
                const filtered = existing.filter(id => !sourceIdStrs.includes(id));
                const newIds = [...new Set([...filtered, hostIdStr])];
                await Catalog.findByIdAndUpdate(catId, { $set: { nicheIds: newIds } });
            }
            // Merge catalogIds into host
            const hostCurrentCatalogIds = ((host.catalogIds ?? []) as string[]).map(String);
            const mergedCatalogIds = [...new Set([...hostCurrentCatalogIds, ...sourceCatalogIds])];
            await Niche.findByIdAndUpdate(hostIdStr, {
                $set: { catalogIds: mergedCatalogIds, pipelineHasCatalogs: mergedCatalogIds.length > 0 },
            });

            // ── 3. REASSIGN SeoSnapshots, BookDrafts, TelegramActions ────────────────
            const { SeoSnapshot } = await import("../models/seo-snapshot.js");
            for (const srcId of sourceIdStrs) {
                await SeoSnapshot.updateMany({ nicheId: srcId }, { $set: { nicheId: hostIdStr } }).catch(() => {});
                await BookDraft.updateMany({ nicheId: srcId }, { $set: { nicheId: hostIdStr } }).catch(() => {});
                await TelegramAction.updateMany({ nicheId: srcId }, { $set: { nicheId: hostIdStr } }).catch(() => {});
            }

            // ── 4. REASSIGN Cloudinary loose images ──────────────────────────────────
            try {
                const cldConfig = await getCloudinaryConfig();
                if (cldConfig) {
                    const cld = await initCloudinary(cldConfig);
                    for (const srcId of sourceIdStrs) {
                        const seen = new Set<string>();
                        try {
                            const tagged = await cld.api.resources_by_tag(`nicho:${srcId}`, { max_results: 500, context: true });
                            for (const r of (tagged.resources ?? [])) seen.add(r.public_id as string);
                        } catch { }
                        try {
                            const all = await cld.api.resources({ type: "upload", prefix: "emi-kdp-assets/", max_results: 500, context: true });
                            for (const r of (all.resources ?? [])) {
                                if (r.context?.custom?.nicheId === srcId) seen.add(r.public_id as string);
                            }
                        } catch { }
                        const publicIds = [...seen];
                        if (publicIds.length > 0) {
                            await cld.uploader.add_context(`nicheId=${hostIdStr}`, publicIds).catch(() => {});
                            await cld.uploader.add_tag(`nicho:${hostIdStr}`, publicIds).catch(() => {});
                            await cld.uploader.remove_tag(`nicho:${srcId}`, publicIds).catch(() => {});
                        }
                    }
                }
            } catch { }

            // ── 5. DELETE source niches (now empty) ──────────────────────────────────
            await Niche.deleteMany({ _id: { $in: sourceIdStrs } });

            const result = await Niche.findById(hostIdStr).lean();
            return reply.status(200).send({ niche: result, absorbed: sourceIdStrs.length, catalogCount: sourceCatalogIds.length });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.delete("/niches/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const niche = await Niche.findById(id).lean() as any;
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            // 1. Delete all associated catalogs + their Cloudinary images
            const catalogs = await Catalog.find({ nicheIds: id }).lean();
            if (catalogs.length > 0) {
                try {
                    const { getCloudinaryConfig, initCloudinary } = await import("./cloudinary.js");
                    const config = await getCloudinaryConfig();
                    if (config) {
                        const cld = await initCloudinary(config);
                        const publicIds = catalogs.flatMap((c: any) => (c.images ?? []).map((img: any) => img.publicId)).filter(Boolean);
                        if (publicIds.length > 0) {
                            await cld.api.delete_resources(publicIds, { type: "upload" }).catch(() => {});
                        }
                    }
                } catch { /* non-critical — delete DB records regardless */ }
                await Catalog.deleteMany({ nicheIds: id });
            }

            // 2. Delete niche's own Cloudinary sample/cover images
            if (niche.sampleImageUrl || niche.coverUrl) {
                try {
                    const { getCloudinaryConfig, initCloudinary } = await import("./cloudinary.js");
                    const config = await getCloudinaryConfig();
                    if (config) {
                        const cld = await initCloudinary(config);
                        // Extract publicId from URL (last path segment without extension)
                        const extractId = (url: string) => {
                            const parts = url.split("/upload/");
                            if (parts.length < 2) return null;
                            return parts[1].replace(/\.[^.]+$/, "").replace(/^v\d+\//, "");
                        };
                        const ids = [niche.sampleImageUrl, niche.coverUrl].filter(Boolean).map(extractId).filter(Boolean) as string[];
                        if (ids.length > 0) await cld.api.delete_resources(ids, { type: "upload" }).catch(() => {});
                    }
                } catch { /* non-critical */ }
            }

            // 3. Delete associated TelegramActions
            await TelegramAction.deleteMany({ nicheId: id }).catch(() => {});

            // 3b. Delete SeoSnapshots + BookDrafts
            try {
                const { SeoSnapshot } = await import("../models/seo-snapshot.js");
                await SeoSnapshot.deleteMany({ nicheId: id });
            } catch { /* non-critical */ }
            await BookDraft.deleteMany({ nicheId: id }).catch(() => {});

            // 4. Hard-delete the niche
            await Niche.findByIdAndDelete(id);

            // 5. Clean radar result arrays
            if (niche.sourceTitulo) {
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
                generate?: boolean; language?: "en" | "es"; seoAnnotation?: string;
            };
            const listingLang = body.language ?? "es";

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

                const targetAudienceLabel: Record<string, string> = {
                    children: "Niños (4-10 años)",
                    teens:    "Adolescentes (11-17 años)",
                    adults:   "Adultos",
                    all:      "Público general",
                };
                // generatedPrompt = raw visual scene description (best source for what the book actually looks like)
                const visualContext = (niche as any).generatedPrompt?.trim() ?? "";

                const sharedContext = [
                    body.seoAnnotation?.trim() ? `⚠ INSTRUCCIÓN MANUAL DEL AUTOR (PRIORIDAD MÁXIMA — aplica esto en todos los campos generados): ${body.seoAnnotation.trim()}` : "",
                    `Nicho: ${(niche as any).name}`,
                    `Tipo de producto: ${pt}`,
                    ((niche as any).tags as string[])?.length > 0 ? `Tags: ${((niche as any).tags as string[]).join(", ")}` : "",
                    (niche as any).styleCategory && (niche as any).styleCategory !== "generic" ? `Estilo visual: ${(niche as any).styleCategory}` : "",
                    (niche as any).targetAudience ? `Público objetivo: ${targetAudienceLabel[(niche as any).targetAudience] ?? (niche as any).targetAudience}` : "",
                    (niche as any).description ? `Descripción del nicho: ${(niche as any).description}` : "",
                    visualContext ? `Descripción visual del contenido: ${visualContext}` : "",
                    (niche as any).notes?.trim() ? `Notas del autor: ${(niche as any).notes.trim()}` : "",
                    marketScan?.us?.resultCount ? `Mercado US: ${marketScan.us.resultCount} resultados, mediana ${marketScan.us.medianReviews ?? "?"} reviews` : "",
                    radarMarketContext,
                ].filter(Boolean).join("\n");

                const listingLangRule = listingLang === "en"
                    ? "LANGUAGE: Write ALL fields (title, subtitle, description, keywords, tags) in ENGLISH. No exceptions."
                    : "IDIOMA: Escribe TODOS los campos (título, subtítulo, descripción, keywords, tags) en ESPAÑOL. Sin excepciones.";
                const trademarkRule = listingLang === "en"
                    ? "TRADEMARK SAFETY: If the niche involves a registered brand (Disney, Marvel, KAWS, Funko, Pokemon, Nintendo, CrossFit, etc.), you MUST still mention the brand in title/subtitle — fans search for it exactly. But ALWAYS add a legal qualifier: '[Brand]-Inspired', '[Brand]-Style', '[Brand] Inspiration'. NEVER use the brand name alone without a qualifier."
                    : "MARCAS REGISTRADAS: Si el nicho incluye una marca registrada (Disney, Marvel, KAWS, Funko, Pokemon, Nintendo, CrossFit, etc.), DEBES mencionarla en el título o subtítulo — esos fans la buscan así. Usa SIEMPRE un calificador legal: '[Marca]-Inspired', 'Estilo [Marca]', 'Inspiración [Marca]', 'Arte [Marca]'. NUNCA la marca sola sin calificador.";

                // ── KDP Prompt (A9/A10 algorithm — keyword-first, backend slots) ─────────
                const KDP_SYSTEM = `Eres experto en copywriting y SEO para Amazon KDP. Genera metadatos que VENDAN: títulos que la gente quiera clickar, subtítulos con keywords reales, descripciones que conviertan.
${listingLangRule}
${trademarkRule}

TÍTULO (35-60 chars): Debe sonar como un bestseller de Amazon — concreto, potente, directo. Fórmula: [Keyword alta demanda] + [Tipo de producto] + [Para quién / Beneficio]. Si hay marca registrada, usa el GÉNERO/ESTILO en su lugar (ej: "Arte Urbano Moderno" en lugar de "KAWS").
✅ Buenos: "Mandalas Antiestres: Libro de Colorear para Adultos" / "Arte Urbano: Colorear Street Art para Adultos"
❌ Malos: "inspirado en arte urbano para colorear" / "colorear y relajarse con diseños únicos"

SUBTÍTULO (80-120 chars): Cadena de keywords secundarias — NO es una descripción en prosa. Fórmula: [Keywords secundarias] · [Audiencia] · [Beneficio emocional].
✅ Buenos: "Diseños de Graffiti y Arte de Calle · Para Fans del Arte Moderno · Creatividad y Relajación"
❌ Malos: "Inspirado en el estilo KAWS, con diseños únicos y emocionales para fans del arte urbano" (es descripción, no subtítulo)

DESCRIPCIÓN: HTML para KDP. (1) <p> hook emocional con <strong> en 2-3 keywords, (2) <p> qué hace único este libro, (3) <ul><li> 5-6 beneficios concretos, (4) <p> para quién + ocasiones regalo, (5) <p> CTA. 800-1200 chars visibles.
KEYWORDS: EXACTAMENTE 7 frases long-tail, máx 49 chars c/u. PROHIBIDO: best/new/free/top/premium/book/amazon/kindle + palabras del título/subtítulo. REGLA CRÍTICA: ninguna palabra individual puede repetirse entre las 7 frases — cada frase debe aportar vocabulario único. Revisa todas las frases al final y elimina duplicados.
CATEGORIES: 3 rutas completas y específicas (ej: "Crafts, Hobbies & Home > Coloring Books for Adults").
Responde SOLO con JSON: { "title": string, "subtitle": string, "description": string, "keywords": string[7], "categories": string[3] }`;

                // ── Etsy Prompt (emotion-first, occasion/mood, lifestyle) ────────────────
                const ETSY_SYSTEM = `Eres especialista en SEO para Etsy. Tu trabajo: metadatos que conviertan en Etsy donde el comprador busca EXPERIENCIAS y REGALOS.
${listingLangRule}
${trademarkRule}

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

    // POST /niches/:id/explode-catalogs — la IA detecta N situaciones visuales
    // distintas del nicho y lanza un catálogo por cada una (encolados en serie).
    app.post("/niches/:id/explode-catalogs", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { count = 5, imagesPerCatalog = 5, model, hints = [], imagination = 50, variation = 50 } = request.body ?? {};
            const n = Math.min(Math.max(2, Number(count)), 20);
            const imgsPer = Math.min(Math.max(1, Number(imagesPerCatalog)), 20);
            const hintList: string[] = Array.isArray(hints) ? hints.map((h: any) => String(h).trim()).filter(Boolean).slice(0, n) : [];

            const niche = await Niche.findById(request.params.id).lean() as any;
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            // 1. Load existing catalog prompts — completed ones anchor on-topic style, all avoid repetition
            const existingCatalogs = await Catalog.find({ nicheIds: String(niche._id) })
                .select("name prompt status")
                .lean() as any[];
            const completedCatalogs = existingCatalogs.filter((c: any) => c.status === "completed" || c.status === "published");
            const usedPrompts = existingCatalogs
                .map((c: any) => c.prompt?.trim())
                .filter(Boolean)
                .slice(0, 40); // cap to keep prompt size sane
            const usedSituations = existingCatalogs
                .map((c: any) => {
                    // Extract the situation label from catalog name: "Niche — Situación" → "Situación"
                    const sep = c.name?.lastIndexOf(" — ");
                    return sep > -1 ? c.name.slice(sep + 3).trim() : null;
                })
                .filter(Boolean);

            // 1. La IA detecta N situaciones/sub-temáticas visuales distintas
            const { generateTextWithLLM } = await import("../lib/ai.js");
            const style = niche.styleCategory ?? "generic";
            const system = `You are a creative director for coloring book and printable art production. Reply ONLY with a valid JSON array, no markdown fences, no explanations.`;

            // Strip marketing subtitles for a clean subject name
            const visualCoreName = niche.name
                .split(":")[0]
                .replace(/\s+(coloring\s*book|activity\s*book|printable|for\s+adults?|for\s+kids?|for\s+seniors?|with\s+\d+|vol\s*\.|volume\s*\d)\b.*/i, "")
                .trim() || niche.name.split(":")[0].trim();

            // confirmedPrompts (user hand-picked) take priority over completed catalog prompts
            const confirmedPrompts: string[] = (niche.confirmedPrompts ?? []).map((p: any) => p.prompt).filter(Boolean);
            const referencePrompts = confirmedPrompts.length > 0
                ? confirmedPrompts
                : completedCatalogs.map((c: any) => c.prompt).filter(Boolean);

            const onTopicAnchorBlock = referencePrompts.length > 0
                ? `\n\n${confirmedPrompts.length > 0 ? "USER-APPROVED PROMPTS (hand-picked by the owner as working well for this niche)" : "ON-TOPIC REFERENCE (prompts from completed catalogs)"}:\n${referencePrompts.slice(0, 5).map((p, i) => `  ${i + 1}. "${p}"`).join("\n")}\nStudy these carefully — they define exactly what subject matter belongs in this niche. Your new situations must match this specificity and keep "${visualCoreName}" as the undeniable core.`
                : "";

            const alreadyUsedBlock = usedPrompts.length > 0
                ? `\n\nALREADY USED — do NOT repeat or closely resemble any of these (${usedPrompts.length} existing catalogs):\n${usedPrompts.map((p, i) => `${i + 1}. ${p}`).join("\n")}${usedSituations.length ? `\nUsed situation labels: ${usedSituations.join(", ")}` : ""}`
                : "";

            const audienceHint: Record<string, string> = {
                children: "TARGET AUDIENCE: Children (ages 4-10). Simple, bold, friendly subjects — animals, toys, fairy-tale scenes. Avoid anything scary or complex.",
                teens:    "TARGET AUDIENCE: Teens (ages 11-17). Trendy, expressive subjects — pop culture, fantasy, anime-adjacent, nature, empowerment themes.",
                adults:   "TARGET AUDIENCE: Adults. Intricate, detailed, meditative subjects — fine patterns, architecture, botanicals, elaborate fantasy, stress-relief themes.",
            };
            const audience = niche.targetAudience && niche.targetAudience !== "all"
                ? audienceHint[niche.targetAudience] ?? ""
                : "";

            // The discovery prompt is the approved visual reference — all variations must match its style
            const discoveryPrompt = (niche.discoveryImagePrompt || niche.generatedPrompt || "").trim();
            const discoveryAnchorBlock = discoveryPrompt
                ? `\n\nAPPROVED VISUAL STYLE (this is the EXACT prompt that generated the accepted sample image — every situation you create MUST produce images that look like this same visual style, same technique, same line art quality):\n"${discoveryPrompt}"\nIMPORTANT: Do NOT reinvent the visual style. Keep the same drawing technique, level of detail, and aesthetic. Only change the SUBJECT or SCENE composition.`
                : "";

            const hintsBlock = hintList.length > 0
                ? `\n\nMANDATORY FOCAL POINTS — the user has specified ${hintList.length} specific sub-topic(s) that MUST each appear as the central focus of one prompt. Treat each hint as a deep expert cue: you are a specialist who knows EXACTLY how "${hintList.join('" and "')}" relate to "${visualCoreName}". For each hinted slot, build a rich, specific prompt that puts that sub-topic at the absolute center:\n${hintList.map((h, i) => `  Slot ${i + 1}: "${h}" — write a prompt where this is the undeniable focal subject within the world of ${visualCoreName}`).join("\n")}\n\nThe remaining ${n - hintList.length} prompt(s) must be freely generated but must NOT overlap with the focal points above.`
                : "";

            const user = `You are an expert in "${visualCoreName}" as a visual art niche for coloring books. You know every sub-genre, iconic character type, signature scene, and distinctive motif that defines this niche.

Niche: "${visualCoreName}"
Full title: "${niche.name}"
Description: ${niche.description || "(none)"}
Style: ${style}${audience ? `\n${audience}` : ""}${discoveryAnchorBlock}${onTopicAnchorBlock}${alreadyUsedBlock}${hintsBlock}

YOUR TASK: Generate exactly ${n} image prompts. Each prompt must describe something that lives 100% INSIDE the world of "${visualCoreName}" — not something generic that uses "${visualCoreName}" as a tag or backdrop.

MENTAL STEP (do this first, don't output it): Think of the 6-8 most iconic, specific visual sub-categories, character archetypes, signature scenes, or motifs that are NATIVE to "${visualCoreName}". Use those as your source material.

THE TEST — before finalising each prompt, ask: "If someone who has never heard of ${visualCoreName} saw this image, would they immediately think of ${visualCoreName}?" If NO → the prompt is wrong, rewrite it.

WRONG (niche as tag/modifier):
- Niche "Anime" → "a sports competition scene" ✗ (sports exist without anime)
- Niche "Anime" → "a space battle with rockets" ✗ (space battles exist without anime)
- Niche "Mandalas" → "a zen garden with raked gravel" ✗ (zen gardens exist without mandalas)

RIGHT (niche is the actual subject):
- Niche "Anime" → "a shōnen hero mid-battle, explosive ki aura radiating outward, dynamic action lines and dramatic expression" ✓
- Niche "Anime" → "a magical girl mid-transformation, flowing ribbons and sparkling particles forming around her silhouette" ✓
- Niche "Mandalas" → "an intricate lotus mandala with nested geometric petals and sacred geometry in concentric rings" ✓

VARIATION: The ${n} situations must be visually distinct. Vary the specific sub-type, iconic character/motif, or signature scenario WITHIN "${visualCoreName}". Do NOT vary by external settings or unrelated genres.${usedPrompts.length > 0 ? "\n\nALREADY USED — produce entirely different sub-themes, do not repeat:\n" + usedPrompts.slice(0, 20).map((p, i) => `${i + 1}. ${p}`).join("\n") : ""}${discoveryPrompt ? "\n\nSTYLE RULE: Each prompt MUST preserve the visual technique from the approved style anchor above. Change the subject, not the drawing style." : ""}

${Number(imagination) <= 25
    ? `CREATIVITY LEVEL: CONVENTIONAL (${imagination}/100). Choose the most iconic, recognisable, bestselling subjects of this niche — the scenes that immediately define what the niche IS. Safe, proven, high-demand images.`
    : Number(imagination) <= 50
    ? `CREATIVITY LEVEL: BALANCED (${imagination}/100). Mix recognisable bestselling subjects with some fresh angles. Mostly proven concepts, one or two less-obvious variations.`
    : Number(imagination) <= 75
    ? `CREATIVITY LEVEL: CREATIVE (${imagination}/100). Explore unexpected sub-genres, unusual character archetypes, or non-standard compositions that still belong 100% within the niche. Surprise without losing niche identity.`
    : `CREATIVITY LEVEL: EXPERIMENTAL (${imagination}/100). Be bold and unconventional — unusual moods, unexpected style fusions within the niche, avant-garde interpretations. Each prompt should feel fresh while keeping the niche unmistakable.`
}

${discoveryPrompt
    ? Number(variation) <= 20
        ? `VARIATION FROM ORIGINAL PROMPT (${variation}/100 — MINIMAL): Original: "${discoveryPrompt}". Stay as close as possible — ONLY change 1-2 nouns or adjectives. Same subject, composition, mood. Think micro-variations: a different species, a slightly different pose, one replaced keyword.`
        : Number(variation) <= 45
        ? `VARIATION FROM ORIGINAL PROMPT (${variation}/100 — SLIGHT): Original: "${discoveryPrompt}". Keep the same general scene structure and mood but vary the specific subject or one key element. Different but recognizably related.`
        : Number(variation) <= 70
        ? `VARIATION FROM ORIGINAL PROMPT (${variation}/100 — MODERATE): Original: "${discoveryPrompt}" — style and tone reference only. Create distinct subjects sharing the same visual language but clearly different scenes.`
        : Number(variation) <= 85
        ? `VARIATION FROM ORIGINAL PROMPT (${variation}/100 — HIGH): Original: "${discoveryPrompt}" — loose inspiration only. Each situation should be a fresh, independent subject within the niche.`
        : `VARIATION FROM ORIGINAL PROMPT (${variation}/100 — TOTAL): Ignore the original prompt entirely. Generate fully independent prompts — maximum diversity within the niche.`
    : ""
}

Write each prompt in English, 25-55 words. No style keywords (added automatically).

Return ONLY a JSON array: [{"situation":"<2-4 word label in Spanish>","prompt":"<scene prompt in English>"}]`;

            const raw = await generateTextWithLLM(system, user);
            const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
            const start = clean.indexOf("[");
            const end = clean.lastIndexOf("]");
            if (start === -1 || end === -1) return reply.status(502).send({ error: `La IA no devolvió JSON válido: ${clean.slice(0, 150)}` });
            let situations: Array<{ situation: string; prompt: string }>;
            try { situations = JSON.parse(clean.slice(start, end + 1)); }
            catch { return reply.status(502).send({ error: "JSON de situaciones malformado" }); }
            situations = situations.filter(s => s?.situation && s?.prompt).slice(0, n);
            if (situations.length === 0) return reply.status(502).send({ error: "La IA no detectó situaciones" });

            // 2. Modelo: el elegido o el configurado en Ajustes
            const aiModel = (model?.provider && model?.modelId)
                ? model
                : await getAutopilotImageModel();

            // 3. Crear un catálogo por situación — el primero arranca, el resto en cola
            const hasActive = await Catalog.exists({ status: { $in: ["queued", "pending", "running"] } });
            const created: any[] = [];
            for (let i = 0; i < situations.length; i++) {
                const s = situations[i];
                const initialStatus = (i === 0 && !hasActive) ? "pending" : "queued";
                const catalog = await Catalog.create({
                    name: `${niche.name} — ${s.situation}`,
                    prompt: s.prompt.trim(),
                    rawPrompt: false,
                    productType: niche.productType ?? "coloring-book",
                    creativity: 50,
                    negativePrompt: "",
                    aiModel,
                    width: 1024,
                    height: 1024,
                    totalImages: imgsPer,
                    images: [],
                    status: initialStatus,
                    queueOrder: Date.now() + i,
                    nicheIds: [String(niche._id)],
                });
                created.push(catalog);
                if (initialStatus === "pending") {
                    const agenda = getAgenda();
                    await agenda.now("generate-catalog-image", { catalogId: String(catalog._id) });
                }
            }

            // 4. Vincular al nicho
            await Niche.findByIdAndUpdate(niche._id, {
                $addToSet: { catalogIds: { $each: created.map(c => String(c._id)) } },
                $set: { pipelineHasCatalogs: true, phase: niche.phase === "niche" ? "catalog" : niche.phase },
            });

            return reply.status(201).send({
                catalogs: created,
                situations: situations.map(s => s.situation),
            });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // GET /niches/:id/situations?count=N&imagination=0-100&variation=0-100 — generate N situation prompts without creating catalogs
    app.get("/niches/:id/situations", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const n = Math.min(Math.max(2, Number(request.query?.count ?? 4)), 10);
            const imagination = Math.min(100, Math.max(0, Number(request.query?.imagination ?? 50)));
            const variation = Math.min(100, Math.max(0, Number(request.query?.variation ?? 50)));
            const niche = await Niche.findById(request.params.id).lean() as any;
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            const { generateTextWithLLM } = await import("../lib/ai.js");
            const { buildColoringBookPrompt } = await import("./autopilot.js");

            const style = niche.styleCategory ?? "generic";
            const visualCoreName = niche.name
                .split(":")[0]
                .replace(/\s+(coloring\s*book|activity\s*book|printable|for\s+adults?|for\s+kids?|for\s+seniors?|with\s+\d+|vol\s*\.|volume\s*\d)\b.*/i, "")
                .trim() || niche.name.split(":")[0].trim();

            const discoveryPrompt = (niche.discoveryImagePrompt || niche.generatedPrompt || "").trim();
            const discoveryAnchorBlock = discoveryPrompt
                ? `\n\nAPPROVED VISUAL STYLE (this is the EXACT prompt that generated the accepted sample image — every situation MUST match this visual style, same technique, same line art quality):\n"${discoveryPrompt}"\nIMPORTANT: Do NOT reinvent the visual style. Keep the same drawing technique, level of detail, and aesthetic. Only change the SUBJECT or SCENE.`
                : "";

            // Pull sample prompts from existing catalogs of this niche as concrete on-topic anchors
            const existingCatalogs = await Catalog.find(
                { nicheIds: String(niche._id), status: { $in: ["completed", "published"] } },
                { prompt: 1, name: 1 }
            ).sort({ createdAt: -1 }).limit(5).lean() as any[];

            // confirmedPrompts are hand-picked by the user — highest quality anchor
            const confirmedPrompts: string[] = (niche.confirmedPrompts ?? []).map((p: any) => p.prompt).filter(Boolean);
            const referencePrompts = confirmedPrompts.length > 0
                ? confirmedPrompts
                : existingCatalogs.map((c: any) => c.prompt).filter(Boolean);

            const existingPromptsBlock = referencePrompts.length > 0
                ? `\n\n${confirmedPrompts.length > 0 ? "USER-APPROVED PROMPTS (hand-picked by the owner as working well for this niche)" : "ON-TOPIC REFERENCE (prompts from completed catalogs)"}:\n${referencePrompts.slice(0, 5).map((p, i) => `  ${i + 1}. "${p}"`).join("\n")}\nStudy these carefully — they define exactly what subject matter belongs in this niche. Your new situations must match this specificity and keep "${visualCoreName}" as the undeniable core.`
                : "";

            const audienceHint: Record<string, string> = {
                children: "TARGET AUDIENCE: Children (ages 4-10). Simple, bold, friendly subjects — animals, toys, fairy-tale scenes.",
                teens:    "TARGET AUDIENCE: Teens (ages 11-17). Trendy, expressive subjects — pop culture, fantasy, anime-adjacent, nature.",
                adults:   "TARGET AUDIENCE: Adults. Intricate, detailed, meditative subjects — fine patterns, architecture, botanicals, elaborate fantasy.",
            };
            const audience = niche.targetAudience && niche.targetAudience !== "all"
                ? audienceHint[niche.targetAudience] ?? ""
                : "";

            const user = `You are an expert in "${visualCoreName}" as a visual art niche for coloring books. You know every sub-genre, iconic character type, signature scene, and distinctive motif that defines this niche.

Niche: "${visualCoreName}"
Full title: "${niche.name}"
Description: ${niche.description || "(none)"}
Style: ${style}${audience ? `\n${audience}` : ""}${discoveryAnchorBlock}${existingPromptsBlock}

YOUR TASK: Generate exactly ${n} image prompts. Each prompt must describe something that lives 100% INSIDE the world of "${visualCoreName}" — not something generic that uses "${visualCoreName}" as a tag or backdrop.

MENTAL STEP (do this first, don't output it): Think of the 6-8 most iconic, specific visual sub-categories, character archetypes, signature scenes, or motifs that are NATIVE to "${visualCoreName}". Use those as your source material, not generic concepts.

THE TEST — before finalising each prompt, ask: "If a person who has never heard of ${visualCoreName} saw this image, would they immediately think of ${visualCoreName}?" If NO → the prompt is wrong.

WRONG approach (niche as tag/modifier):
- Niche "Anime" → "a sports competition scene" ✗ (sports exist without anime)
- Niche "Anime" → "a space battle with rockets" ✗ (space battles exist without anime)
- Niche "Mandalas" → "a zen garden with raked gravel" ✗ (zen gardens exist without mandalas)

RIGHT approach (niche as the actual subject):
- Niche "Anime" → "a shōnen hero mid-battle, explosive ki aura radiating outward, dynamic action lines and dramatic expression" ✓
- Niche "Anime" → "a magical girl mid-transformation, flowing ribbons and sparkling particles forming around her silhouette" ✓
- Niche "Mandalas" → "an intricate lotus mandala with nested geometric petals and sacred geometry in concentric rings" ✓

VARIATION RULE: The ${n} situations must be visually distinct — vary the specific sub-type, iconic character/motif, or signature scenario WITHIN "${visualCoreName}". Do NOT vary by external settings or unrelated genres.${discoveryPrompt ? "\n\nSTYLE RULE: Each prompt MUST preserve the visual technique from the approved style anchor above. Change the subject, not the drawing style." : ""}

${imagination <= 25
    ? `CREATIVITY LEVEL: CONVENTIONAL (${imagination}/100). Choose the most iconic, recognisable, bestselling subjects of this niche. Think top-sellers on Amazon KDP — the scenes that immediately define what this niche IS. Safe, proven, high-demand images.`
    : imagination <= 50
    ? `CREATIVITY LEVEL: BALANCED (${imagination}/100). Mix recognisable bestselling subjects with some fresh angles. Mostly proven concepts, one or two less-obvious variations.`
    : imagination <= 75
    ? `CREATIVITY LEVEL: CREATIVE (${imagination}/100). Go beyond the obvious. Explore unexpected sub-genres, unusual character archetypes, or non-standard compositions that still belong 100% within "${visualCoreName}". Surprise without losing the niche identity.`
    : `CREATIVITY LEVEL: EXPERIMENTAL (${imagination}/100). Be bold and unconventional. Unusual moods, unexpected fusion of styles within the niche, surreal or avant-garde interpretations. Each prompt should feel fresh and unexpected while keeping "${visualCoreName}" as the unmistakable core.`
}

${discoveryPrompt
    ? variation <= 20
        ? `VARIATION FROM ORIGINAL PROMPT (${variation}/100 — MINIMAL): The original prompt is: "${discoveryPrompt}". Each new prompt must stay as close as possible to this. ONLY change 1-2 nouns or adjectives. Keep the same subject, composition, and mood. Think micro-variations — a different animal species, a slightly different pose, one replaced keyword.`
        : variation <= 45
        ? `VARIATION FROM ORIGINAL PROMPT (${variation}/100 — SLIGHT): The original prompt is: "${discoveryPrompt}". Use it as the base. Keep the same general scene structure and mood but vary the specific subject or one key element. Different but recognizably related.`
        : variation <= 70
        ? `VARIATION FROM ORIGINAL PROMPT (${variation}/100 — MODERATE): The original prompt is: "${discoveryPrompt}" — use it as a style and tone reference only. Create distinct subjects and compositions that share the same visual language but are clearly different scenes.`
        : variation <= 85
        ? `VARIATION FROM ORIGINAL PROMPT (${variation}/100 — HIGH): The original prompt is: "${discoveryPrompt}" — treat it as loose inspiration only. Each situation should be a fresh, independent subject within the niche.`
        : `VARIATION FROM ORIGINAL PROMPT (${variation}/100 — TOTAL): Ignore the original prompt entirely. Generate fully independent prompts — maximum diversity within the niche.`
    : ""
}

Write each prompt in English, 25-55 words, describing only the scene/subject — no style keywords (added automatically).

Return ONLY a JSON array: [{"situation":"<2-4 word label in Spanish>","prompt":"<scene prompt in English>"}]`;

            const raw = await generateTextWithLLM(
                `You are an expert visual content creator for coloring book publishing. Reply ONLY with a valid JSON array. No markdown, no explanations, no extra text.`,
                user
            );

            const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
            const start = clean.indexOf("[");
            const end = clean.lastIndexOf("]");
            if (start === -1 || end === -1) return reply.status(502).send({ error: "AI did not return valid JSON" });

            let parsed: Array<{ situation: string; prompt: string }>;
            try { parsed = JSON.parse(clean.slice(start, end + 1)); }
            catch { return reply.status(502).send({ error: "Malformed JSON from AI" }); }

            const situations = parsed
                .filter(s => s?.situation && s?.prompt)
                .slice(0, n)
                .map(s => ({
                    label: s.situation,
                    prompt: buildColoringBookPrompt(s.prompt.trim(), style),
                }));

            return reply.send({ situations });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /niches/:id/fork — clone a niche and recreate all its catalogs with a new model
    app.post("/niches/:id/fork", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { model, imagesPerCatalog } = request.body ?? {};
            if (!model?.provider || !model?.modelId) {
                return reply.status(400).send({ error: "Falta el modelo (model.provider + model.modelId)" });
            }
            const imgsPer = imagesPerCatalog ? Math.min(Math.max(1, Number(imagesPerCatalog)), 20) : null;

            const source = await Niche.findById(request.params.id).lean() as any;
            if (!source) return reply.status(404).send({ error: "Nicho no encontrado" });

            // Determine version suffix — count existing forks by checking names
            const baseName = source.name.replace(/ v\d+$/, "").trim();
            const existingForks = await Niche.countDocuments({ name: new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} v\\d+$`) });
            const versionNumber = existingForks + 2; // v2, v3, …
            const newName = `${baseName} v${versionNumber}`;

            // Find all catalogs linked to source niche
            const sourceCatalogs = await Catalog.find({ nicheIds: String(source._id) }).lean() as any[];

            // Create the new niche (copy of source, empty pipeline state)
            const newNiche = await Niche.create({
                name: newName,
                nickname: source.nickname ?? "",
                description: source.description ?? "",
                tags: source.tags ?? [],
                status: "active",
                competition: source.competition,
                demand: source.demand,
                productType: source.productType ?? "coloring-book",
                styleCategory: source.styleCategory ?? "generic",
                styleCategories: source.styleCategories ?? [],
                notes: source.notes ?? "",
                generatedPrompt: source.generatedPrompt ?? "",
                discoveryImagePrompt: source.discoveryImagePrompt ?? "",
                catalogIds: [],
                phase: "catalog",
                pipelineHasCatalogs: false,
                pipelineHasListings: false,
                pipelineHasPdf: false,
            });

            // Create one catalog per source catalog — same prompt, new model, empty images
            const hasActive = await Catalog.exists({ status: { $in: ["queued", "pending", "running"] } });
            const newCatalogIds: string[] = [];

            for (let i = 0; i < sourceCatalogs.length; i++) {
                const src = sourceCatalogs[i];
                const initialStatus = (i === 0 && !hasActive) ? "pending" : "queued";
                const newCatalog = await Catalog.create({
                    name: src.name.replace(source.name, newName),
                    prompt: src.prompt,
                    promptParts: src.promptParts,
                    productType: src.productType ?? "coloring-book",
                    creativity: src.creativity ?? 50,
                    negativePrompt: src.negativePrompt ?? "",
                    aiModel: model,
                    width: src.width ?? 1024,
                    height: src.height ?? 1024,
                    totalImages: imgsPer ?? src.totalImages ?? 5,
                    images: [],
                    status: initialStatus,
                    queueOrder: Date.now() + i,
                    nicheIds: [String(newNiche._id)],
                });
                newCatalogIds.push(String(newCatalog._id));

                if (initialStatus === "pending") {
                    const agenda = getAgenda();
                    await agenda.now("generate-catalog-image", { catalogId: String(newCatalog._id) });
                }
            }

            // Link catalogs to new niche
            await Niche.findByIdAndUpdate(newNiche._id, {
                $set: { catalogIds: newCatalogIds, pipelineHasCatalogs: newCatalogIds.length > 0 },
            });

            const result = await Niche.findById(newNiche._id).lean();
            return reply.status(201).send({ niche: result, catalogCount: newCatalogIds.length });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── POST /niches/clone-bestseller ─────────────────────────────────────────
    // Dado un ASIN o URL de Amazon, analiza el bestseller y genera 5 clones de nicho
    app.post("/niches/clone-bestseller", async (request: any, reply) => {
        const { asin, url: rawUrl } = request.body || {};

        let cleanAsin: string | null = null;
        let originalDomain = "www.amazon.com";
        if (asin?.trim()) {
            cleanAsin = asin.trim().toUpperCase();
        } else if (rawUrl?.trim()) {
            const domainMatch = rawUrl.match(/https?:\/\/(www\.amazon\.[a-z.]+)\//i);
            if (domainMatch) originalDomain = domainMatch[1];
            const m = rawUrl.match(/\/dp\/([A-Z0-9]{10})/i) ?? rawUrl.match(/([A-Z0-9]{10})/i);
            cleanAsin = m?.[1]?.toUpperCase() ?? null;
        }
        if (!cleanAsin) return reply.status(400).send({ error: "Proporciona un ASIN o URL de Amazon válidos" });

        // Try original domain first, fall back to amazon.com
        const amazonUrl = `https://${originalDomain}/dp/${cleanAsin}`;

        try {
            let pageText = "";
            const jinaKey = process.env.JINA_API_KEY;
            const urlsToTry = [amazonUrl, `https://www.amazon.com/dp/${cleanAsin}`];
            const headerVariants = [
                { "X-Return-Format": "text", ...(jinaKey ? { Authorization: `Bearer ${jinaKey}` } : {}), "Accept-Language": "en-US,en;q=0.9" },
                { "X-Return-Format": "markdown", "X-No-Cache": "true", ...(jinaKey ? { Authorization: `Bearer ${jinaKey}` } : {}) },
                { "X-Return-Format": "text", "X-No-Cache": "true" },
            ];
            outer: for (const url of urlsToTry) {
                for (const hdrs of headerVariants) {
                    try {
                        const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
                            headers: hdrs as Record<string, string>,
                            signal: AbortSignal.timeout(35_000),
                        });
                        if (jinaRes.ok) {
                            const text = (await jinaRes.text()).slice(0, 50_000);
                            if (text.length >= 200) { pageText = text; break outer; }
                        }
                    } catch { /* try next variant */ }
                    await new Promise(r => setTimeout(r, 800));
                }
            }
            if (!pageText) return reply.status(502).send({ error: "Amazon bloqueó la petición. Inténtalo de nuevo en unos segundos." });

            const { generateTextWithLLM } = await import("../lib/ai.js");

            const SYSTEM = `Eres un estratega de productos KDP. Se te mostrará la página de un bestseller de Amazon (libro de colorear, activity book, journal o similar).
Tu misión: analizar la fórmula de éxito del libro y proponer 5 CLONES de nicho — libros adyacentes que usen la misma fórmula pero en un nicho distinto.

Un clon NO es una copia. Es aplicar la misma fórmula de éxito (demografía, estilo visual, complejidad, formato) a una temática diferente.

REGLAS CRÍTICAS para el campo "title":
- Escribe un título CONCRETO y REAL, listo para publicar en Amazon KDP (en inglés)
- NUNCA uses placeholders, variables ni corchetes como {número}, [tema], [X], {X}
- Usa números reales: "50 Designs", "101 Pages", "100 Unique Illustrations"
- Ejemplo correcto: "Exotic Travel Coloring Book: 50 Stunning Destinations for Adults"
- Ejemplo INCORRECTO: "Travel Coloring Book: {número} illustrations of {tema}"

IMPORTANTE: Responde ÚNICA Y EXCLUSIVAMENTE con JSON puro, sin markdown, sin comentarios, sin texto adicional.

Estructura exacta:
{"source":{"title":"string","bsr":"string","price":"string","reviews":"string","pages":"string","formula":"string"},"clones":[{"nicheName":"string","title":"string","audience":"string","coverBrief":"string","keywords":["kw1","kw2","kw3","kw4","kw5"],"whyItWorks":"string","competition":"low"}]}`;

            const raw = await generateTextWithLLM(SYSTEM, `PÁGINA DEL BESTSELLER:\n${pageText}`);
            const cleaned = raw
                .replace(/```[a-z]*\n?/gi, "")
                .replace(/\/\/[^\n]*/g, "")
                .replace(/,\s*([}\]])/g, "$1")
                .trim();
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (!match) return reply.status(500).send({ error: "La IA no devolvió JSON válido" });
            const parsed = JSON.parse(match[0]);
            return reply.send(parsed);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message ?? "Error analizando el bestseller" });
        }
    });

    // ── POST /niches/clone-telegram ────────────────────────────────────────────
    // AI cover prompt → TelegramAction → respond immediately → generate image + send in background
    app.post("/niches/clone-telegram", async (request: any, reply) => {
        const { clone, sourceTitle, sourceUrl } = request.body as {
            clone: { nicheName: string; titleTemplate: string; audience: string; coverBrief: string; keywords: string[]; whyItWorks: string; competition: string };
            sourceTitle?: string;
            sourceUrl?: string;
        };

        if (!clone?.nicheName) return reply.status(400).send({ error: "Datos del clon inválidos" });

        const { generateTextWithLLM } = await import("../lib/ai.js");

        const title = (clone as any).title || clone.titleTemplate || clone.nicheName;
        const kws = (clone.keywords ?? []).join(", ");

        try {
            // 1 · AI genera prompt de imagen (escena base, rápido ~3s)
            const imagePrompt = await generateTextWithLLM(
                `You are an expert at writing image generation prompts for KDP coloring book covers. Write ONE prompt in English (max 20 words). The prompt must describe a coloring book scene — black line art, white background, detailed illustration. RULES: max 1-2 creatures per scene; never count limbs or fingers; hide all hands inside clothing or behind objects; describe creatures by posture/action, never by limb count. Output ONLY the prompt, no explanation, no JSON.`,
                `Niche: ${clone.nicheName}\nKeywords: ${kws}\nAudience: ${clone.audience}`
            );

            // 2 · Construir el fullPrompt con la MISMA fórmula que el catalog job
            const baseScene = imagePrompt.trim().replace(/['"]/g, "");
            const fullPrompt = buildColoringBookPrompt(baseScene, "generic");
            const aiModel = await getAutopilotImageModel();

            // 3 · Crear TelegramAction ANTES de generar la imagen — respondemos al frontend ya
            const action = await TelegramAction.create({
                type: "clone-decision",
                nicheName: clone.nicheName,
                imagePrompt: fullPrompt,
                aiModel,
                cloneData: { ...clone, title, sourceTitle, sourceUrl },
                autoApproveAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
            });

            // 4 · Responder al frontend inmediatamente (no esperar 90s de imagen)
            reply.send({ ok: true, actionId: String(action._id), prompt: fullPrompt });

            // 5 · Generar imagen + enviar a Telegram en background
            setImmediate(async () => {
                try {
                    let imageBytes: Buffer | null = null;

                    // Intento 1: pollinationsFetch directo (sin capa HTTP interna — sin límite de 150s de ai.ts)
                    if (aiModel.provider === "Pollinations") {
                        try {
                            const { pollinationsFetch } = await import("../lib/pollinations-circuit.js");
                            const isSlowModel = (aiModel.modelId ?? "").includes("dev") || (aiModel.modelId ?? "").includes("pro");
                            const seed = Math.floor(Math.random() * 999999);
                            const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=768&height=1024&seed=${seed}&model=${encodeURIComponent(aiModel.modelId ?? "flux")}&enhance=false&nologo=true`;
                            console.log(`[clone-telegram bg] Pollinations directo model=${aiModel.modelId} slow=${isSlowModel}`);
                            const res = await pollinationsFetch(pollinationsUrl, {
                                signal: AbortSignal.timeout(isSlowModel ? 240_000 : 90_000),
                            });
                            const ct = res.headers.get("content-type") ?? "";
                            if (res.ok && ct.startsWith("image/")) {
                                imageBytes = Buffer.from(await res.arrayBuffer());
                                console.log(`[clone-telegram bg] Pollinations OK (${imageBytes.length} bytes)`);
                            } else {
                                await res.body?.cancel().catch(() => {});
                                console.warn(`[clone-telegram bg] Pollinations ${res.status}`);
                            }
                        } catch (e: any) {
                            console.warn(`[clone-telegram bg] Pollinations error: ${e?.message}`);
                        }
                    }

                    // Intento 2: cadena completa de proveedores (Pollinations schnell → Cloudflare → SiliconFlow → HF)
                    if (!imageBytes) {
                        console.log(`[clone-telegram bg] Fallback generateImage (provider=${aiModel.provider} model=${aiModel.modelId})`);
                        const { generateImage } = await import("../lib/image-gen.js");
                        imageBytes = await generateImage(fullPrompt).catch((e: any) => {
                            console.warn(`[clone-telegram bg] generateImage falló: ${e?.message}`);
                            return null;
                        });
                        if (imageBytes) console.log(`[clone-telegram bg] generateImage OK (${imageBytes.length} bytes)`);
                        else console.warn("[clone-telegram bg] generateImage también falló — enviando texto");
                    }

                    const compEmoji = clone.competition === "low" ? "🟢" : clone.competition === "medium" ? "🟡" : "🔴";
                    const compLabel = clone.competition === "low" ? "Baja" : clone.competition === "medium" ? "Media" : "Alta";
                    const captionFull = [
                        `🎯 <b>Clone Engine — Nicho candidato</b>`,
                        ``,
                        `📚 <b>${clone.nicheName}</b>`,
                        `<i>${title}</i>`,
                        ``,
                        `👥 ${clone.audience}`,
                        `💡 ${clone.whyItWorks}`,
                        `🔑 ${kws}`,
                        ``,
                        `${compEmoji} Competencia: <b>${compLabel}</b>`,
                        ...(sourceTitle ? [`📖 Basado en: <i>${sourceTitle.slice(0, 70)}</i>`] : []),
                    ].join("\n");
                    // Telegram limita caption de sendPhoto a 1024 chars
                    const caption = captionFull.length > 1020 ? captionFull.slice(0, 1017) + "..." : captionFull;

                    const rows = [[
                        { text: "✅ Crear nicho", callback_data: `continuar:${String(action._id)}` },
                        { text: "🗑️ Descartar",  callback_data: `descartar:${String(action._id)}` },
                    ]];

                    let msgId: number | null = null;
                    if (imageBytes) {
                        msgId = await sendTelegramImageWithButtons(imageBytes, caption, rows);
                        if (msgId) console.log(`[clone-telegram bg] Telegram imagen OK msgId=${msgId}`);
                        else console.warn("[clone-telegram bg] sendTelegramImageWithButtons devolvió null — fallback a texto");
                    }
                    if (!msgId) {
                        const { sendTelegramButtons } = await import("../lib/telegram.js");
                        msgId = await sendTelegramButtons(captionFull, rows);
                        if (msgId) console.log(`[clone-telegram bg] Telegram texto OK msgId=${msgId}`);
                        else console.warn("[clone-telegram bg] sendTelegramButtons también falló");
                    }

                    if (msgId) { action.messageId = msgId; await action.save(); }
                } catch (e: any) {
                    console.error(`[clone-telegram bg] Error para "${clone.nicheName}":`, e.message);
                }
            });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message ?? "Error enviando a Telegram" });
        }
    });
}
