import { FastifyInstance } from "fastify";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { TelegramAction } from "../models/telegram-action.js";
import { getMongoStatus } from "../lib/mongo.js";
import { sendTelegram, sendTelegramPhotoDiscovery, sendTelegramApproval } from "../lib/telegram.js";

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerAutoPilotRoutes(app: FastifyInstance, deps: { agenda?: any }) {
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
            let samplePrompt: string;
            let sampleModel = "flux";
            if (productType === "printable-poster") {
                samplePrompt = `${(niche as any).name} printable wall art poster, colorful illustration, clean design, no text`;
                sampleModel = "flux-realism";
            } else if (style === "anime") {
                samplePrompt = `Anime coloring page ${(niche as any).name}, ultra thick clean black outlines, white background, zero shading`;
                sampleModel = "flux-anime";
            } else if (style === "children") {
                samplePrompt = `Cute children coloring page ${(niche as any).name}, thick clean black outlines, white background, simple shapes`;
            } else {
                samplePrompt = `Coloring page ${(niche as any).name}, ultra thick clean black outlines, white background, zero shading`;
            }
            const seed = Math.floor(Math.random() * 99999);
            const sampleUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(samplePrompt)}?model=${sampleModel}&width=1024&height=1024&nologo=true&seed=${seed}`;
            await Niche.findByIdAndUpdate(nicheId, { $set: { sampleImageUrl: sampleUrl } });

            // Upload sample image to Cloudinary (fire-and-forget, ~10s delay for Pollinations to render)
            const port = process.env.PORT || 3001;
            const base = `http://localhost:${port}`;
            setTimeout(async () => {
                try {
                    const cldRes = await fetch(`${base}/cloudinary/upload-url`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url: sampleUrl, nicheId }),
                    });
                    if (cldRes.ok) {
                        const cldData = await cldRes.json() as any;
                        const cloudUrl = cldData.image?.url;
                        if (cloudUrl) {
                            await Niche.findByIdAndUpdate(nicheId, { $set: { sampleImageUrl: cloudUrl } });
                        }
                    }
                } catch { /* non-critical */ }
            }, 10_000);

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
                imageUrl: sampleUrl,
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
                imageUrl: sampleUrl,
                caption,
                actionId: String(action._id),
            });

            if (msgId) { action.messageId = msgId; await action.save(); }

            return reply.send({ ok: true, nicheId, sampleImageUrl: sampleUrl, actionId: String(action._id) });
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
}
