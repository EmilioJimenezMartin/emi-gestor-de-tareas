import { FastifyInstance } from "fastify";
import { Niche } from "../models/niche.js";
import { Catalog } from "../models/catalog.js";
import { Settings } from "../models/settings.js";
import { imageSemaphore, llmSemaphore } from "../lib/ai-semaphore.js";
import { PromptMetric } from "../models/prompt-metric.js";
import { getMongoStatus } from "../lib/mongo.js";
import { getAutopilotImageModel } from "../lib/image-gen.js";
import { getAgenda } from "../lib/agenda.js";
import { TelegramAction } from "../models/telegram-action.js";
import { getEvolutionStats } from "../lib/prompt-evolution.js";

const _SERVER_API_KEY = process.env.SERVER_API_KEY || "";
function internalFetch(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...init, headers: { ...(_SERVER_API_KEY ? { Authorization: `Bearer ${_SERVER_API_KEY}` } : {}), ...(init.headers as Record<string, string> ?? {}) } });
}

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerPipelineRoutes(app: FastifyInstance, deps?: { agenda?: any; io?: any }) {
    // GET /pipeline/status — full pipeline overview
    app.get("/pipeline/status", async (_req, reply) => {
        try {
            const niches = await Niche.find({}).lean();
            const catalogs = await Catalog.find({
                status: { $in: ["running", "queued", "pending", "completed"] },
            }).lean();

            const catalogsByNiche: Record<string, typeof catalogs> = {};
            for (const c of catalogs) {
                for (const nid of (c as any).nicheIds ?? []) {
                    if (!catalogsByNiche[nid]) catalogsByNiche[nid] = [];
                    catalogsByNiche[nid].push(c);
                }
            }

            const now = Date.now();

            const nichePipeline = niches.map(n => {
                const nid = String((n as any)._id);
                const cats = catalogsByNiche[nid] ?? [];
                const running = cats.filter(c => (c as any).status === "running");
                const completed = cats.filter(c => (c as any).status === "completed");
                const queued = cats.filter(c => ["queued", "pending"].includes((c as any).status));

                const imgsDone = completed.reduce((s, c) => s + ((c as any).images?.length ?? 0), 0) +
                    running.reduce((s, c) => s + ((c as any).images?.length ?? 0), 0);
                const imgsTotal = cats.reduce((s, c) => s + ((c as any).totalImages ?? 0), 0);

                // Last image activity across all catalogs
                const lastImageAt: string | null = cats
                    .flatMap(c => (c as any).images ?? [])
                    .map((img: any) => img.createdAt)
                    .filter(Boolean)
                    .sort()
                    .at(-1) ?? null;

                const lastError = running.map(c => (c as any).lastError).filter(Boolean).at(-1) ?? null;
                const phaseRef = (n as any).phaseChangedAt ?? (n as any).updatedAt;
                const phaseMs = now - new Date(phaseRef).getTime();

                return {
                    id: nid,
                    name: (n as any).name,
                    nickname: (n as any).nickname || undefined,
                    phase: (n as any).phase,
                    score: (n as any).score ?? null,
                    autoPilotEnabled: (n as any).autoPilotEnabled ?? false,
                    phaseMs,
                    catalogs: {
                        running: running.length,
                        completed: completed.length,
                        queued: queued.length,
                        total: cats.length,
                        imgsDone,
                        imgsTotal,
                    },
                    lastImageAt,
                    lastError,
                    updatedAt: (n as any).updatedAt,
                };
            });

            // All running catalogs not linked to active niches
            const activeNicheIds = new Set(niches.map(n => String((n as any)._id)));
            const orphanCatalogs = catalogs
                .filter(c => (c as any).status === "running")
                .filter(c => !((c as any).nicheIds ?? []).some((id: string) => activeNicheIds.has(id)))
                .map(c => ({
                    id: String((c as any)._id),
                    name: (c as any).name,
                    images: (c as any).images?.length ?? 0,
                    total: (c as any).totalImages,
                    lastError: (c as any).lastError ?? null,
                }));

            return reply.send({
                niches: nichePipeline,
                orphanCatalogs,
                semaphore: {
                    image: imageSemaphore.status(),
                    llm: llmSemaphore.status(),
                },
            });
        } catch (e: any) {
            app.log.error(e);
            return reply.status(500).send({ error: e.message });
        }
    });

    // GET /pipeline/prompt-metrics?productType=coloring-book&limit=20
    app.get("/pipeline/prompt-metrics", async (request: any, reply) => {
        try {
            const { productType, limit = "30", sort = "successRate" } = request.query ?? {};
            const filter: any = { attempts: { $gte: 3 } };
            if (productType) filter.productType = productType;

            const sortField = ["successRate", "avgScore", "attempts", "lastUsed"].includes(sort) ? sort : "successRate";

            const metrics = await PromptMetric.find(filter)
                .sort({ [sortField]: -1 })
                .limit(parseInt(limit) || 30)
                .lean();

            const evolutionStats = await getEvolutionStats(productType || "coloring-book").catch(() => ({ count: 0, avgScore: 0 }));
            return reply.send({ metrics, evolutionStats });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // DELETE /pipeline/prompt-metrics — purge all prompt metrics
    app.delete("/pipeline/prompt-metrics", async (_request, reply) => {
        try {
            const { deletedCount } = await PromptMetric.deleteMany({});
            return reply.send({ ok: true, deleted: deletedCount });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /niches/:id/pipeline/run — trigger server-side pipeline for a specific niche
    app.post("/niches/:id/pipeline/run", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const body = (request.body ?? {}) as { catalogsPerNiche?: number; imagesPerCatalog?: number; rawPrompt?: boolean };

            const niche = await Niche.findById(id);
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            const catalogsPerNiche = body.catalogsPerNiche ?? 3;
            const imagesPerCatalog = body.imagesPerCatalog ?? 5;
            const rawPrompt = body.rawPrompt ?? false;
            const port = process.env.PORT || 3001;
            const base = `http://localhost:${port}`;

            // Use exact prompt and model from the discovery image (same as Telegram)
            const discoveryPrompt = (niche as any).discoveryImagePrompt as string | undefined;
            const catalogPrompt = discoveryPrompt || (niche as any).generatedPrompt || niche.name;

            // Model priority: niche.discoveryAiModel → latest TelegramAction.aiModel → Settings
            let discoveryAiModel = (niche as any).discoveryAiModel as { id: string; name: string; provider: string; modelId: string } | undefined;
            if (!discoveryAiModel) {
                const lastAction = await TelegramAction.findOne({ nicheId: id, type: "niche-discovery" }).sort({ createdAt: -1 }).lean();
                if ((lastAction as any)?.aiModel) {
                    discoveryAiModel = (lastAction as any).aiModel;
                    // Backfill onto the niche so next call doesn't need to query TelegramAction
                    await Niche.findByIdAndUpdate(id, { $set: { discoveryAiModel } });
                }
            }
            const aiModel = discoveryAiModel ?? await getAutopilotImageModel();

            // Backfill generatedPrompt if it doesn't match discoveryImagePrompt
            if (discoveryPrompt && (niche as any).generatedPrompt !== discoveryPrompt) {
                await Niche.findByIdAndUpdate(id, { $set: { generatedPrompt: discoveryPrompt } });
            }

            deps?.io?.emit("autopilot:log", { nicheId: id, message: `🚀 Creando ${catalogsPerNiche} catálogos para "${niche.name}" · ${aiModel.name}` });

            let created = 0;
            for (let i = 0; i < catalogsPerNiche; i++) {
                const res = await internalFetch(`${base}/catalogs`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: `${niche.name} — v${i + 1}`,
                        prompt: catalogPrompt,
                        totalImages: imagesPerCatalog,
                        aiModel,
                        nicheIds: [id],
                        productType: (niche as any).productType ?? "coloring-book",
                        rawPrompt,
                    }),
                });
                if (res.ok) created++;
                await new Promise(r => setTimeout(r, 200));
            }

            await Niche.findByIdAndUpdate(id, { $set: { status: "active" } });
            deps?.io?.emit("niches:updated");
            deps?.io?.emit("catalogs:updated");

            return reply.send({ ok: true, nicheId: id, created, message: `${created} catálogos creados` });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /niches/:id/saturation-scan — analyze Amazon saturation for a niche
    app.post("/niches/:id/saturation-scan", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const niche = await Niche.findById(id);
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            const keyword = encodeURIComponent(`${niche.name} coloring book`);
            const amazonUrl = `https://www.amazon.com/s?k=${keyword}&i=stripbooks`;
            const jinaUrl = `https://r.jina.ai/${amazonUrl}`;

            // Fetch via Jina Reader (clean text, no Playwright needed)
            let pageText = "";
            try {
                const jinaRes = await fetch(jinaUrl, {
                    headers: { "Accept": "text/plain", "X-Timeout": "20" },
                    signal: AbortSignal.timeout(25_000),
                });
                if (jinaRes.ok) pageText = (await jinaRes.text()).slice(0, 50_000);
            } catch { /* fallback handled below */ }

            if (pageText.length < 300) {
                return reply.status(502).send({ error: "No se pudo obtener datos de Amazon. Inténtalo de nuevo." });
            }

            // Analyze with AI using existing radar infrastructure
            const { analyzePageForRadar } = await import("../lib/ai.js");
            const systemPrompt = `Eres un experto en Amazon KDP. Analiza estos resultados de búsqueda de Amazon y extrae los productos de libros para colorear que aparecen. Para cada producto extrae título, número de reseñas (total_reseñas), si es bestseller y precio. Responde ÚNICAMENTE con JSON válido:\n{"nichos_detectados":[{"titulo_producto":"string","precio":"string","bestseller":true/false,"personas_carrito":0,"total_reseñas":number,"sub_nicho_estimado":"string"}]}`;

            const raw = await analyzePageForRadar(pageText, systemPrompt, { mode: "amazon-niches" });
            const products: any[] = Array.isArray(raw?.nichos_detectados) ? raw.nichos_detectados : [];

            if (products.length === 0) {
                return reply.status(422).send({ error: "No se detectaron productos. Amazon puede estar bloqueando el acceso." });
            }

            // Compute saturation metrics
            const reviewCounts = products.map((p: any) =>
                parseInt(String(p.total_reseñas ?? "0").replace(/[^\d]/g, "")) || 0
            );
            const avgReviews = reviewCounts.length > 0
                ? Math.round(reviewCounts.reduce((a, b) => a + b, 0) / reviewCounts.length)
                : 0;
            const lowReviewCount = reviewCounts.filter(r => r < 50).length;
            const totalAnalyzed = products.length;

            // Opportunity: many products with low reviews = untapped market
            const opportunityScore = Math.round(
                Math.min(100, (lowReviewCount / Math.max(totalAnalyzed, 1)) * 100 * 1.2)
            );

            // Saturation label: based on avg reviews of top products
            const saturationLabel: "low" | "medium" | "high" =
                avgReviews < 100 ? "low" : avgReviews < 500 ? "medium" : "high";

            // Inverted: saturationScore = how saturated (high = bad)
            const saturationScore = Math.round(
                Math.min(100, avgReviews > 1000 ? 90 : avgReviews > 500 ? 70 : avgReviews > 100 ? 45 : 20)
            );

            const topProducts = products.slice(0, 10).map((p: any) => ({
                title: String(p.titulo_producto ?? "").slice(0, 80),
                reviews: parseInt(String(p.total_reseñas ?? "0").replace(/[^\d]/g, "")) || 0,
                bestseller: !!p.bestseller,
                price: String(p.precio ?? ""),
            }));

            const saturationData = { topProducts, avgReviews, lowReviewCount, totalAnalyzed, opportunityScore };

            await Niche.findByIdAndUpdate(id, {
                $set: { saturationScore, saturationLabel, saturationData, saturationScannedAt: new Date() },
            });

            deps?.io?.emit("niches:updated");
            return reply.send({ saturationScore, saturationLabel, saturationData });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
