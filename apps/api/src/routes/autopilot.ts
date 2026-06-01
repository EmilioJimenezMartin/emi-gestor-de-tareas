import { FastifyInstance } from "fastify";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { TelegramAction } from "../models/telegram-action.js";
import { AutopilotRun } from "../models/autopilot-run.js";
import { getMongoStatus } from "../lib/mongo.js";
import { sendTelegram, sendTelegramPhotoDiscovery, sendTelegramApproval } from "../lib/telegram.js";

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
            const niche = await Niche.findByIdAndUpdate(id, { $set: { autoPilotEnabled: enabled } }, { new: true }).lean();
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
    app.post("/autopilot/discover/:nicheId", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { nicheId } = request.params as { nicheId: string };
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

            // Generate prompt if needed (fire-and-forget for speed, use existing if present)
            let prompt = (niche as any).generatedPrompt as string | undefined;
            if (!prompt) {
                const port = process.env.PORT || 3001;
                const base = `http://localhost:${port}`;
                const productType = (niche as any).productType ?? "coloring-book";
                const style = (niche as any).styleCategory ?? "generic";
                const aiType = productType === "printable-poster" ? "printable-particulars" : "niche-particulars";
                try {
                    const aiRes = await fetch(`${base}/ai/generate-text`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: aiType, niche: (niche as any).name, productType, extras: style }),
                        signal: AbortSignal.timeout(25_000),
                    });
                    if (aiRes.ok) {
                        const aiData = await aiRes.json() as any;
                        prompt = [aiData.result?.theme, aiData.result?.specs, aiData.result?.details, aiData.result?.particulars].filter(Boolean).join("\n\n");
                        if (prompt) await Niche.findByIdAndUpdate(nicheId, { $set: { generatedPrompt: prompt } });
                    }
                } catch { /* non-critical, continue without prompt */ }
            }

            // Build Pollinations sample image URL
            const style = (niche as any).styleCategory ?? "generic";
            const productType = (niche as any).productType ?? "coloring-book";
            // Use the first line of the AI-generated prompt as scene description, fallback to niche name
            const sceneDesc = (prompt?.split("\n")[0]?.trim()) || (niche as any).name;
            let samplePrompt: string;
            let sampleModel = "flux";
            if (productType === "printable-poster") {
                samplePrompt = `${sceneDesc}, professional printable wall art poster, vibrant cohesive color palette, premium illustration quality, balanced centered composition, suitable for A4 print, no text no watermarks`;
                sampleModel = "flux-realism";
            } else if (style === "anime") {
                samplePrompt = `${sceneDesc}, anime coloring page illustration, ultra thick crisp black outlines 4px weight, pure white background, zero shading zero grey tones, black and white line art only, high contrast, intricate detailed scene, professional adult coloring book quality`;
                sampleModel = "flux-anime";
            } else if (style === "children") {
                samplePrompt = `${sceneDesc}, children's coloring page, thick clean black outlines, pure white background, simple friendly rounded shapes, cute kawaii style, zero shading zero grey tones, professional coloring book illustration`;
            } else {
                samplePrompt = `${sceneDesc}, professional adult coloring page illustration, ultra thick crisp black outlines 3-4px weight, pure white background, zero grey tones zero shading, black and white line art only, high contrast, intricate detailed scene, masterful illustration quality`;
            }
            const seed = Math.floor(Math.random() * 99999);
            const sampleUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(samplePrompt)}?model=${sampleModel}&width=1024&height=1024&nologo=true&seed=${seed}`;
            await Niche.findByIdAndUpdate(nicheId, { $set: { sampleImageUrl: sampleUrl } });
            deps.io?.emit("niches:updated");

            // Wait for Pollinations to render the image, then upload to Cloudinary so Telegram
            // receives a stable CDN URL (Pollinations URLs often aren't ready immediately)
            const port = process.env.PORT || 3001;
            const base = `http://localhost:${port}`;
            let telegramImageUrl = sampleUrl;
            try {
                // Pre-fetch the Pollinations image to ensure it's rendered (up to 35s)
                await fetch(sampleUrl, { signal: AbortSignal.timeout(35_000) });
                // Upload to Cloudinary for a stable URL
                const cldRes = await fetch(`${base}/cloudinary/upload-url`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: sampleUrl, nicheId }),
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
            } catch { /* non-critical — fall back to raw Pollinations URL */ }

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

            const msgId = await sendTelegramPhotoDiscovery({
                imageUrl: telegramImageUrl,
                caption,
                actionId: String(action._id),
            });

            if (msgId) { action.messageId = msgId; await action.save(); }

            return reply.send({ ok: true, nicheId, sampleImageUrl: sampleUrl, actionId: String(action._id) });
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
