import type { FastifyInstance } from "fastify";
import { AutoCloneItem } from "../models/auto-clone-item.js";
import { Niche } from "../models/niche.js";
import { generateTextWithLLM } from "../lib/ai.js";
import { sendTelegramButtons, answerCallbackQuery, sendTelegram } from "../lib/telegram.js";

const _SERVER_API_KEY = process.env.SERVER_API_KEY || "";
function internalFetch(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, {
        ...init,
        headers: {
            ...(_SERVER_API_KEY ? { Authorization: `Bearer ${_SERVER_API_KEY}` } : {}),
            ...(init.headers as Record<string, string> ?? {}),
        },
    });
}

// Search Amazon via Jina.ai (markdown format) and extract first ASIN + title
async function findBestsellerAsin(searchQuery: string): Promise<{ asin: string | null; title: string | null; bsr: string | null; amazonUrl: string | null }> {
    try {
        const base = searchQuery.toLowerCase().includes("coloring book") ? searchQuery : `${searchQuery} coloring book`;
        const encoded = encodeURIComponent(base);
        const searchUrl = `https://www.amazon.com/s?k=${encoded}&i=stripbooks&s=review-rank`;
        // Use default (markdown) format — plain text strips hyperlinks that contain ASINs
        const res = await fetch(`https://r.jina.ai/${searchUrl}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(35_000),
        });
        if (!res.ok) return { asin: null, title: null, bsr: null, amazonUrl: null };
        const md = await res.text();

        // Markdown has lines like: ## [Book Title](https://www.amazon.com/slug/dp/B0XXXXXXXX/ref=...)
        const titleAsinRx = /##\s+\[([^\]]{10,200})\]\([^)]*\/dp\/([A-Z0-9]{10})\//gi;
        const match = titleAsinRx.exec(md);
        if (!match) {
            // Fallback: extract first /dp/ASIN from any link
            const fallback = /amazon\.com\/[^)"\s]*\/dp\/([A-Z0-9]{10})\//i.exec(md);
            if (!fallback) return { asin: null, title: null, bsr: null, amazonUrl: null };
            const asin = fallback[1].toUpperCase();
            return { asin, title: null, bsr: null, amazonUrl: `https://www.amazon.com/dp/${asin}` };
        }
        const title = match[1].trim();
        const asin  = match[2].toUpperCase();
        return { asin, title, bsr: null, amazonUrl: `https://www.amazon.com/dp/${asin}` };
    } catch {
        return { asin: null, title: null, bsr: null, amazonUrl: null };
    }
}

async function runCloneInBackground(item: any, io: any) {
    try {
        await AutoCloneItem.findByIdAndUpdate(item._id, { status: "cloning" });
        io.emit("autoclone:updated", { id: item._id.toString(), status: "cloning" });

        const origin = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
        const res = await internalFetch(`${origin}/niches/clone-bestseller`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ asin: item.asin }),
        });
        if (!res.ok) throw new Error(`clone-bestseller error ${res.status}`);
        const data: any = await res.json();
        await AutoCloneItem.findByIdAndUpdate(item._id, {
            status: "done",
            clones: data.clones ?? [],
        });
        io.emit("autoclone:updated", { id: item._id.toString(), status: "done", clones: data.clones ?? [] });

        // Send each clone to Telegram via existing clone-telegram flow
        for (const clone of (data.clones ?? []).slice(0, 3)) {
            await internalFetch(`${origin}/niches/clone-telegram`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clone,
                    sourceTitle: item.foundTitle,
                    sourceUrl: item.amazonUrl,
                }),
            });
        }
    } catch (e: any) {
        console.error("[AutoClone] runCloneInBackground error:", e.message);
        await AutoCloneItem.findByIdAndUpdate(item._id, { status: "pending_approval" });
        io.emit("autoclone:updated", { id: item._id.toString(), status: "pending_approval" });
    }
}

export async function registerAutoCloneRoutes(app: FastifyInstance, deps: { io: any }) {
    const { io } = deps;

    // GET /auto-clone/queue
    app.get("/auto-clone/queue", async (_req, reply) => {
        const items = await AutoCloneItem.find().sort({ createdAt: -1 }).limit(50).lean();
        return reply.send(items);
    });

    // POST /auto-clone/discover — AI discovers uncovered topics + finds Amazon bestseller ASINs
    app.post("/auto-clone/discover", async (request: any, reply) => {
        const { count = 5 } = request.body ?? {};

        // Get existing niche names
        const existingNiches = await Niche.find({}, "name").lean();
        const nicheNames = (existingNiches as any[]).map((n: any) => n.name).join(", ");

        // AI generates uncovered coloring book topics
        const topicsRaw = await generateTextWithLLM(
            `You are a KDP market researcher specializing in adult coloring books on Amazon.
Analyze the existing niches and suggest NEW coloring book topics not yet covered.

RULES:
- Every topic MUST be a coloring book (libro de colorear) niche — no activity books, journals, or other formats
- searchQuery MUST include "coloring book" so Amazon returns the right results
- Focus on niches with proven Amazon demand (nature, animals, fantasy, mandala, travel, etc.)
- Do NOT suggest the same or very similar topics to the existing ones

Return ONLY a JSON array: [{"topic":"...","searchQuery":"..."}]
- topic: short name in Spanish (e.g. "Vehículos de construcción", "Mitología nórdica")
- searchQuery: English Amazon search with "coloring book" (e.g. "construction vehicles coloring book adults", "nordic mythology coloring book")`,
            `Existing niches (DO NOT suggest close variations): ${nicheNames}\n\nSuggest ${count} NEW coloring book niches.`
        );

        let topics: { topic: string; searchQuery: string }[] = [];
        try {
            const cleaned = topicsRaw.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
            const match = cleaned.match(/\[[\s\S]*\]/);
            topics = match ? JSON.parse(match[0]) : [];
        } catch {
            return reply.status(500).send({ error: "AI no devolvió JSON válido" });
        }

        const created: any[] = [];
        let skipped = 0;
        for (const t of topics.slice(0, count)) {
            const { asin, title, bsr, amazonUrl } = await findBestsellerAsin(t.searchQuery);

            // Skip if no ASIN found — we only want real coloring book bestsellers
            if (!asin) {
                skipped++;
                console.log(`[AutoClone] No ASIN for "${t.topic}" (${t.searchQuery}) — skipped`);
                continue;
            }

            const item = await AutoCloneItem.create({
                topic: t.topic,
                searchQuery: t.searchQuery,
                asin,
                amazonUrl: amazonUrl ?? undefined,
                ...(title ? { foundTitle: title } : {}),
                ...(bsr ? { foundBsr: bsr } : {}),
                status: "pending_approval",
            });

            const id = (item as any)._id.toString();

            const msgId = await sendTelegramButtons(
                `🔍 <b>AutoClone — Bestseller encontrado</b>\n\n📚 <b>${t.topic}</b>\n🔗 <a href="${amazonUrl}">${asin}</a>${title ? `\n📖 ${title.slice(0, 80)}` : ""}\n\n¿Quieres clonar este libro de colorear?`,
                [[
                    { text: "✅ Aprobar", callback_data: `autoclone:approve:${id}` },
                    { text: "❌ Descartar", callback_data: `autoclone:reject:${id}` },
                ]]
            );
            if (msgId) await AutoCloneItem.findByIdAndUpdate(id, { telegramMsgId: msgId });

            created.push(item);
            io.emit("autoclone:new", { item: { ...((item as any).toObject()), _id: id } });
        }

        return reply.send({ ok: true, count: created.length, skipped, items: created });
    });

    // POST /auto-clone/:id/approve
    app.post("/auto-clone/:id/approve", async (request: any, reply) => {
        const item = await AutoCloneItem.findById(request.params.id);
        if (!item) return reply.status(404).send({ error: "Not found" });
        if (!item.asin) return reply.status(400).send({ error: "Sin ASIN — no se puede clonar automáticamente" });
        await item.updateOne({ status: "approved" });
        io.emit("autoclone:updated", { id: request.params.id, status: "approved" });
        runCloneInBackground(item, io);
        return reply.send({ ok: true });
    });

    // POST /auto-clone/:id/reject
    app.post("/auto-clone/:id/reject", async (request: any, reply) => {
        const { reason } = request.body ?? {};
        const item = await AutoCloneItem.findById(request.params.id);
        if (!item) return reply.status(404).send({ error: "Not found" });
        await item.updateOne({ status: "rejected", rejectionReason: reason ?? "" });
        io.emit("autoclone:updated", { id: request.params.id, status: "rejected" });
        return reply.send({ ok: true });
    });

    // DELETE /auto-clone/:id — asks via Telegram before deleting (if pending/approved)
    app.delete("/auto-clone/:id", async (request: any, reply) => {
        const item = await AutoCloneItem.findById(request.params.id);
        if (!item) return reply.status(404).send({ error: "Not found" });
        // For active items send confirmation; for terminal items delete directly
        if (item.status === "cloning") {
            return reply.status(409).send({ error: "No se puede eliminar mientras se está clonando" });
        }
        await AutoCloneItem.findByIdAndDelete(request.params.id);
        io.emit("autoclone:deleted", { id: request.params.id });
        await sendTelegram(`🗑️ AutoClone eliminado: <b>${item.topic}</b>`);
        return reply.send({ ok: true });
    });
}

// Called from telegram-polling when callback_data starts with "autoclone:"
export async function handleAutoCloneTelegramCallback(
    callbackQueryId: string,
    data: string,
    io: any
): Promise<void> {
    const [, action, id] = data.split(":");
    if (!id) return;
    await answerCallbackQuery(callbackQueryId);

    const item = await AutoCloneItem.findById(id);
    if (!item) {
        await sendTelegram("⚠️ AutoClone: item no encontrado");
        return;
    }

    if (action === "approve") {
        if (!item.asin) {
            await sendTelegram(`⚠️ <b>${item.topic}</b> no tiene ASIN — ve a la UI para introducirlo manualmente`);
            return;
        }
        await item.updateOne({ status: "approved" });
        io.emit("autoclone:updated", { id, status: "approved" });
        await sendTelegram(`⚙️ Clonando bestseller para <b>${item.topic}</b>…`);
        runCloneInBackground(item, io);
    } else if (action === "reject") {
        await item.updateOne({ status: "rejected" });
        io.emit("autoclone:updated", { id, status: "rejected" });
        await sendTelegram(`❌ <b>${item.topic}</b> descartado`);
    }
}
