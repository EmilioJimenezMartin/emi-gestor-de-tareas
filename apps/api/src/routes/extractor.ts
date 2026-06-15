import { FastifyInstance } from "fastify";
import type { Server as SocketIOServer } from "socket.io";
import axios from "axios";
import { ExtractedData } from "../models/extracted-data.js";
import { analyzeWithAI } from "../lib/ai.js";

interface JobPayload {
    urls?: string[];
    apis?: string[];
    prompt?: string;
    excludeKeywords?: string[];
}

function log(io: SocketIOServer | undefined, jobId: string, level: "info" | "success" | "error" | "warning", message: string) {
    io?.emit("extractor:log", { jobId, timestamp: new Date(), level, message });
}

async function htmlToText(html: string): Promise<string> {
    // Strip HTML tags and collapse whitespace
    return html.replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

export async function registerExtractorRoutes(
    app: FastifyInstance,
    deps: { io?: SocketIOServer }
) {
    // GET /extractor/data  – filterable
    app.get("/extractor/data", async (request: any, reply) => {
        try {
            const { q, source_type, from, to, page = "1", limit = "50" } = request.query ?? {};
            const filter: any = {};

            if (q) filter.$text = { $search: q };
            if (source_type) filter["source.source_type"] = source_type;
            if (from || to) {
                filter["temporal.created_at"] = {};
                if (from) filter["temporal.created_at"].$gte = new Date(from);
                if (to) filter["temporal.created_at"].$lte = new Date(to);
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const [data, total] = await Promise.all([
                ExtractedData.find(filter).sort({ "temporal.created_at": -1 }).skip(skip).limit(parseInt(limit)),
                ExtractedData.countDocuments(filter)
            ]);
            return reply.send({ data, total, page: parseInt(page) });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to fetch extracted data" });
        }
    });

    // POST /extractor/jobs  – start a scraping job
    app.post("/extractor/jobs", async (request: any, reply) => {
        try {
            const { urls = [], apis = [], prompt = "Extract all relevant information", excludeKeywords = [] }: JobPayload = request.body || {};
            const allTargets = [...urls, ...apis];

            if (allTargets.length === 0) {
                return reply.status(400).send({ error: "At least one URL or API endpoint is required" });
            }

            const jobId = `job-${Date.now()}`;
            log(deps.io, jobId, "info", `[INIT] Solicitud recibida. Iniciando trabajo ${jobId}...`);
            log(deps.io, jobId, "info", `[CONFIG] Analizando ${allTargets.length} fuente(s)`);
            log(deps.io, jobId, "info", `[CONFIG] Prompt: "${prompt.substring(0, 80)}..."`);
            if (excludeKeywords.length > 0) {
                log(deps.io, jobId, "info", `[CONFIG] Excluding keywords: ${excludeKeywords.join(", ")}`);
            }

            // Fire and forget — run in background
            (async () => {
                for (const target of allTargets) {
                    try {
                        log(deps.io, jobId, "info", `[FETCH] Requesting ${target}`);

                        let rawContent = "";
                        try {
                            const https = await import("https");
                            const response = await axios.get(target, {
                                timeout: 20000,
                                maxRedirects: 5,
                                maxContentLength: 5 * 1024 * 1024,
                                httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                                headers: {
                                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                                    "Accept": "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
                                    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                                    "Accept-Encoding": "identity",
                                    "Cache-Control": "no-cache"
                                },
                                responseType: "text",
                                validateStatus: (status) => status < 500
                            });

                            if (response.status >= 400) {
                                log(deps.io, jobId, "warning", `[FETCH] HTTP ${response.status} for ${target} — intentando extraer de todos modos`);
                            }

                            rawContent = typeof response.data === "string"
                                ? response.data
                                : JSON.stringify(response.data);
                        } catch (fetchErr: any) {
                            log(deps.io, jobId, "error", `[FETCH] ✗ No se pudo obtener ${target}: ${fetchErr?.message || "Unknown"}`);
                            continue;
                        }

                        const isHtml = rawContent.trimStart().startsWith("<") || rawContent.toLowerCase().includes("<html");
                        const text = isHtml ? await htmlToText(rawContent) : rawContent;

                        log(deps.io, jobId, "info", `[FETCH] ✓ Retrieved ${text.length} chars from ${target}`);

                        // Filter out excluded keywords
                        const hasExcluded = excludeKeywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
                        if (hasExcluded) {
                            log(deps.io, jobId, "warning", `[FILTER] Skipped ${target} — matched exclude keyword`);
                            continue;
                        }

                        log(deps.io, jobId, "info", `[AI] Analyzing with AI model...`);

                        const items = await analyzeWithAI(text, prompt, target);

                        if (items.length === 0) {
                            log(deps.io, jobId, "warning", `[AI] No relevant items found in ${target}`);
                            continue;
                        }

                        log(deps.io, jobId, "success", `[AI] ✓ Extracted ${items.length} item(s) from ${target}`);

                        for (const item of items) {
                            const staged: Record<string, any> = {
                                id: `${item.id}-${Date.now()}`,
                                title: item.title,
                                description: item.description,
                                type: item.type || "article",
                                source: {
                                    name: new URL(target).hostname,
                                    url: target,
                                    source_type: target.includes("api") ? "api" : "web",
                                    retrieved_at: new Date()
                                },
                                content: {
                                    raw: item.raw || text.substring(0, 1000),
                                    clean: item.description,
                                    structured: {}
                                },
                                metadata: {
                                    tags: item.tags || [],
                                    confidence_score: item.confidence ?? 0.5,
                                    relevance_score: item.relevance ?? 0.5
                                },
                                temporal: { created_at: new Date(), updated_at: new Date(), is_recurring: false }
                            };

                            log(deps.io, jobId, "info", `[RESULT] → "${item.title.substring(0, 60)}"`);
                            deps.io?.emit("extractor:result", { jobId, item: staged });
                        }

                    } catch (err: any) {
                        log(deps.io, jobId, "error", `[ERROR] Failed on ${target}: ${err?.message || "Unknown error"}`);
                    }
                }

                log(deps.io, jobId, "success", `[DONE] Job ${jobId} completed.`);
                deps.io?.emit("extractor:done", { jobId });
            })();

            return reply.send({ success: true, jobId, message: "Job launched" });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to start job" });
        }
    });

    // POST /extractor/save  – save a staged result to MongoDB
    app.post("/extractor/save", async (request: any, reply) => {
        try {
            const data = request.body;
            if (!data || !data.title) return reply.status(400).send({ error: "Missing required fields" });

            // Ensure unique id
            const id = data.id || `saved-${Date.now()}`;
            const doc = await ExtractedData.findOneAndUpdate(
                { id },
                { ...data, id },
                { upsert: true, returnDocument: 'after' }
            );
            // Auto-prune: keep last 500 ExtractedData records
            const oldDocs = await ExtractedData.find({}).sort({ "temporal.created_at": -1 }).skip(500).select("_id").lean();
            if (oldDocs.length > 0) await ExtractedData.deleteMany({ _id: { $in: oldDocs.map((r: any) => r._id) } }).catch(() => {});
            return reply.send({ success: true, data: doc });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to save data" });
        }
    });

    // DELETE /extractor/data/:id  – delete a record
    app.delete("/extractor/data/:id", async (request: any, reply) => {
        try {
            const { id } = request.params;
            await ExtractedData.deleteOne({ id });
            return reply.send({ success: true });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to delete data" });
        }
    });

    // DELETE /extractor/data — purge all extracted data
    app.delete("/extractor/data", async (_request, reply) => {
        try {
            const { deletedCount } = await ExtractedData.deleteMany({});
            return reply.send({ success: true, deleted: deletedCount });
        } catch (error: any) {
            return reply.status(500).send({ error: "Failed to purge data" });
        }
    });
}
