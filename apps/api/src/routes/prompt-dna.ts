import type { FastifyInstance } from "fastify";
import { PromptDNA } from "../models/prompt-dna.js";
import { Catalog } from "../models/catalog.js";

type SignalType = "favorite" | "unfavorite" | "book";

const DNA_PARTS = ["theme", "specs", "details", "particulars"] as const;

async function recordSignal(catalogId: string, signal: SignalType): Promise<void> {
    const catalog = await Catalog.findById(catalogId).lean();
    if (!catalog?.promptParts) return;

    const { theme, specs, details, particulars } = catalog.promptParts;
    const parts: [typeof DNA_PARTS[number], string][] = [
        ["theme", theme],
        ["specs", specs],
        ["details", details],
        ["particulars", particulars],
    ];

    const favoriteInc = signal === "favorite" ? 1 : signal === "unfavorite" ? -1 : 0;
    const bookInc = signal === "book" ? 1 : 0;

    for (const [partType, rawValue] of parts) {
        const partValue = rawValue?.trim().slice(0, 300);
        if (!partValue) continue;

        const doc = await PromptDNA.findOneAndUpdate(
            { partType, partValue },
            {
                $inc: { favoriteHits: favoriteInc, bookHits: bookInc },
                $max: { totalSeen: 1 },
                $set: { lastSignalAt: new Date() },
            },
            { upsert: true, new: true }
        );

        if (doc) {
            const score = Math.max(0, doc.favoriteHits * 2 + doc.bookHits * 3);
            await PromptDNA.updateOne({ _id: doc._id }, { $set: { dnaScore: score } });
        }
    }
}

export async function registerPromptDNARoutes(app: FastifyInstance) {
    // POST /prompt-dna/signal — record a behavioral signal for a catalog
    app.post("/prompt-dna/signal", async (request: any, reply) => {
        const { catalogId, signal } = request.body ?? {};
        if (!catalogId || !["favorite", "unfavorite", "book"].includes(signal)) {
            return reply.status(400).send({ error: "catalogId and signal (favorite|unfavorite|book) required" });
        }
        await recordSignal(catalogId, signal as SignalType);
        return reply.send({ ok: true });
    });

    // GET /prompt-dna/top — top performing prompt parts per type
    app.get("/prompt-dna/top", async (request: any, reply) => {
        const limit = Math.min(parseInt(request.query?.limit ?? "10"), 30);
        const results: Record<string, any[]> = {};
        for (const partType of DNA_PARTS) {
            results[partType] = await PromptDNA.find({ partType, dnaScore: { $gt: 0 } })
                .sort({ dnaScore: -1 })
                .limit(limit)
                .lean();
        }
        return reply.send(results);
    });

    // GET /prompt-dna/stats — aggregate overview
    app.get("/prompt-dna/stats", async (_req, reply) => {
        const total = await PromptDNA.countDocuments();
        const withSignals = await PromptDNA.countDocuments({ dnaScore: { $gt: 0 } });
        const top = await PromptDNA.findOne().sort({ dnaScore: -1 }).lean();
        return reply.send({ total, withSignals, topScore: top?.dnaScore ?? 0 });
    });
}
