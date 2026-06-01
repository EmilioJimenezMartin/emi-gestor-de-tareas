import { FastifyInstance } from "fastify";
import { Niche } from "../models/niche.js";
import { Catalog } from "../models/catalog.js";
import { Settings } from "../models/settings.js";
import { imageSemaphore, llmSemaphore } from "../lib/ai-semaphore.js";
import { PromptMetric } from "../models/prompt-metric.js";
import { getMongoStatus } from "../lib/mongo.js";

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

            return reply.send({ metrics });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /niches/:id/pipeline/run — trigger server-side pipeline for a specific niche
    app.post("/niches/:id/pipeline/run", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const body = (request.body ?? {}) as { catalogsPerNiche?: number; imagesPerCatalog?: number };

            const niche = await Niche.findById(id);
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

            // Persist run config to Settings so the autopilot job picks them up
            if (body.catalogsPerNiche) {
                await Settings.findOneAndUpdate(
                    { key: "AUTOPILOT_CATALOGS_PER_NICHE" },
                    { $set: { key: "AUTOPILOT_CATALOGS_PER_NICHE", value: String(body.catalogsPerNiche) } },
                    { upsert: true }
                );
            }
            if (body.imagesPerCatalog) {
                await Settings.findOneAndUpdate(
                    { key: "AUTOPILOT_IMAGES_PER_CATALOG" },
                    { $set: { key: "AUTOPILOT_IMAGES_PER_CATALOG", value: String(body.imagesPerCatalog) } },
                    { upsert: true }
                );
            }

            // Enable autopilot on this niche so runPipeline picks it up
            await Niche.findByIdAndUpdate(id, {
                $set: { autoPilotEnabled: true, status: "active" },
            });

            deps?.io?.emit("niches:updated");
            deps?.io?.emit("autopilot:log", {
                nicheId: id,
                message: `🚀 Pipeline lanzado para "${(niche as any).name}"`,
            });

            // Schedule an immediate autopilot run
            if (deps?.agenda) {
                await deps.agenda.schedule("in 2 seconds", "autopilot-run", {}).catch(() => {});
            }

            return reply.send({ ok: true, nicheId: id, message: "Pipeline iniciado en servidor" });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
