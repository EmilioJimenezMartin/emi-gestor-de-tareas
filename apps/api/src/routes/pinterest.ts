import { FastifyInstance } from "fastify";
import { PinterestPin } from "../models/pinterest-pin.js";
import { Niche } from "../models/niche.js";
import { Catalog } from "../models/catalog.js";
import { getMongoStatus } from "../lib/mongo.js";

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") { reply.status(503).send({ error: "MongoDB no disponible" }); return false; }
    return true;
}

export async function registerPinterestRoutes(app: FastifyInstance) {

    // ── Queue management ─────────────────────────────────────────────────────

    // GET /pinterest/queue — list pins (filter by status)
    app.get("/pinterest/queue", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { status, nicheId, limit = 50 } = request.query ?? {};
            const filter: any = {};
            if (status) filter.status = status;
            if (nicheId) filter.nicheId = nicheId;
            const pins = await PinterestPin.find(filter)
                .sort({ createdAt: -1 })
                .limit(Number(limit))
                .lean();
            const total = await PinterestPin.countDocuments({ status: "pending" });
            return reply.send({ pins, pendingTotal: total });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // PATCH /pinterest/pins/:id — update status or fields
    app.patch("/pinterest/pins/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { status, boardId, title, description, scheduledFor } = request.body ?? {};
            const update: any = {};
            if (status) update.status = status;
            if (boardId !== undefined) update.boardId = boardId;
            if (title) update.title = title;
            if (description) update.description = description;
            if (scheduledFor) update.scheduledFor = new Date(scheduledFor);
            if (status === "posted") update.postedAt = new Date();
            const pin = await PinterestPin.findByIdAndUpdate(request.params.id, { $set: update }, { new: true });
            if (!pin) return reply.status(404).send({ error: "Pin no encontrado" });
            return reply.send({ pin });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // DELETE /pinterest/pins/:id
    app.delete("/pinterest/pins/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            await PinterestPin.findByIdAndDelete(request.params.id);
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Pin generation ────────────────────────────────────────────────────────

    // POST /pinterest/generate — generate pins for published niches
    app.post("/pinterest/generate", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { nicheId, samplesPerNiche = 3 } = request.body ?? {};

            const { generateCoverPin, generateSamplePin } = await import("../lib/pinterest-content.js");

            const filter: any = { status: "active", phase: "published" };
            if (nicheId) filter._id = nicheId;

            const niches = await Niche.find(filter).lean();
            if (niches.length === 0) return reply.status(404).send({ error: "No hay nichos publicados." });

            let created = 0;

            for (const niche of niches) {
                const listing = ((niche as any).listings ?? [])[0];
                const coverUrl = (niche as any).coverUrl;
                const asin = (niche as any).asin;

                if (!asin) continue; // Skip niches without ASIN

                // Check how many pins already exist for this niche to avoid duplicates
                const existing = await PinterestPin.countDocuments({ nicheId: String(niche._id), status: { $ne: "skipped" } });
                if (existing >= 8) continue; // Already enough pins queued

                // Cover pin (up to 2 variants)
                if (coverUrl) {
                    for (let v = 0; v < 2; v++) {
                        const alreadyExists = await PinterestPin.exists({ nicheId: String(niche._id), imageUrl: coverUrl, pinType: "cover" });
                        if (!alreadyExists) {
                            const content = generateCoverPin(niche, listing, coverUrl, v);
                            await PinterestPin.create({
                                nicheId: String(niche._id),
                                nicheName: (niche as any).name,
                                ...content,
                            });
                            created++;
                        }
                    }
                }

                // Sample pins from catalog images
                const catalogs = await Catalog.find({
                    nicheIds: String(niche._id),
                    status: "completed",
                }).sort({ createdAt: -1 }).limit(3).lean();

                const sampleUrls: string[] = [];
                for (const cat of catalogs) {
                    const imgs = ((cat as any).images ?? []).filter((img: any) => img.url);
                    // Pick 1-2 best-looking images per catalog (first ones, assuming they're sorted by quality)
                    sampleUrls.push(...imgs.slice(0, 2).map((img: any) => img.url));
                    if (sampleUrls.length >= samplesPerNiche) break;
                }

                for (let i = 0; i < Math.min(sampleUrls.length, samplesPerNiche); i++) {
                    const url = sampleUrls[i];
                    const alreadyExists = await PinterestPin.exists({ nicheId: String(niche._id), imageUrl: url });
                    if (!alreadyExists) {
                        const content = generateSamplePin(niche, listing, url, i);
                        await PinterestPin.create({
                            nicheId: String(niche._id),
                            nicheName: (niche as any).name,
                            ...content,
                        });
                        created++;
                    }
                }
            }

            return reply.status(201).send({ created, nichesProcessed: niches.length });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Option A: API publishing ──────────────────────────────────────────────

    // GET /pinterest/status — check if connected + token validity
    app.get("/pinterest/status", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { isConnected } = await import("../lib/pinterest-client.js");
            const connected = await isConnected();
            return reply.send({ connected });
        } catch (e: any) {
            return reply.send({ connected: false, error: e.message });
        }
    });

    // GET /pinterest/auth-url — returns the OAuth URL to redirect the user to
    app.get("/pinterest/auth-url", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { getAuthUrl } = await import("../lib/pinterest-client.js");
            const port = process.env.PORT || 3001;
            const redirectUri = `http://localhost:${port}/pinterest/callback`;
            const url = await getAuthUrl(redirectUri);
            return reply.send({ url, redirectUri });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // GET /pinterest/callback — OAuth callback, exchanges code for tokens
    app.get("/pinterest/callback", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { code, error } = request.query as any;
            if (error) return reply.status(400).send({ error });
            if (!code) return reply.status(400).send({ error: "No se recibió el código de autorización" });

            const { exchangeCode } = await import("../lib/pinterest-client.js");
            const port = process.env.PORT || 3001;
            const redirectUri = `http://localhost:${port}/pinterest/callback`;
            await exchangeCode(code, redirectUri);

            // Redirect to frontend success page
            const frontendPort = process.env.FRONTEND_PORT || 3000;
            return reply.redirect(`http://localhost:${frontendPort}/tareas/kdp-factory?pinterest=connected`);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // GET /pinterest/boards — list user boards
    app.get("/pinterest/boards", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { listBoards } = await import("../lib/pinterest-client.js");
            const boards = await listBoards();
            return reply.send({ boards });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /pinterest/pins/:id/publish — publish a single pin via API
    app.post("/pinterest/pins/:id/publish", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const pin = await PinterestPin.findById(request.params.id);
            if (!pin) return reply.status(404).send({ error: "Pin no encontrado" });
            if (pin.status === "posted") return reply.status(409).send({ error: "Pin ya publicado" });

            const { createPin } = await import("../lib/pinterest-client.js");
            const boardId = pin.boardId ?? request.body?.boardId;
            if (!boardId) return reply.status(400).send({ error: "Selecciona un board antes de publicar" });

            const fullDescription = `${pin.description}\n\n${pin.hashtags.join(" ")}`;
            const pinterestPinId = await createPin({
                boardId,
                imageUrl: pin.imageUrl,
                title: pin.title,
                description: fullDescription,
                link: pin.amazonUrl,
            });

            await PinterestPin.findByIdAndUpdate(pin._id, {
                $set: { status: "posted", postedAt: new Date(), pinterestPinId, boardId },
            });

            return reply.send({ ok: true, pinterestPinId });
        } catch (e: any) {
            await PinterestPin.findByIdAndUpdate(request.params.id, {
                $set: { status: "failed", error: e.message },
            });
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /pinterest/publish-batch — publish all pending pins with a board
    app.post("/pinterest/publish-batch", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { boardId, limit = 5 } = request.body ?? {};
            if (!boardId) return reply.status(400).send({ error: "Se requiere boardId" });

            const pending = await PinterestPin.find({ status: "pending" }).limit(Number(limit));
            const { createPin } = await import("../lib/pinterest-client.js");

            let published = 0;
            const errors: string[] = [];
            for (const pin of pending) {
                try {
                    const fullDescription = `${pin.description}\n\n${pin.hashtags.join(" ")}`;
                    const pinterestPinId = await createPin({
                        boardId,
                        imageUrl: pin.imageUrl,
                        title: pin.title,
                        description: fullDescription,
                        link: pin.amazonUrl,
                    });
                    await PinterestPin.findByIdAndUpdate(pin._id, {
                        $set: { status: "posted", postedAt: new Date(), pinterestPinId, boardId },
                    });
                    published++;
                    // Spread pins: 3 second gap to avoid rate limits
                    await new Promise(r => setTimeout(r, 3000));
                } catch (e: any) {
                    errors.push(`${pin.title}: ${e.message}`);
                    await PinterestPin.findByIdAndUpdate(pin._id, { $set: { status: "failed", error: e.message } });
                }
            }
            return reply.send({ published, errors });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
