import type { FastifyInstance } from "fastify";
import { ViralNiche } from "../models/viral-niche.js";
import { Niche } from "../models/niche.js";
import { generateTextWithLLM } from "../lib/ai.js";
import { TelegramAction } from "../models/telegram-action.js";
import { sendTelegramButtons, sendTelegramImageWithButtons } from "../lib/telegram.js";
import { buildColoringBookPrompt } from "../routes/autopilot.js";
import { getAutopilotImageModel } from "../lib/image-gen.js";

const VIRAL_SCAN_SYSTEM_PROMPT = `You are a market intelligence analyst specializing in Amazon KDP coloring books.
Your task is to identify COLORING BOOK niches that are trending RIGHT NOW.

Analyze the page content and extract niches that show viral potential.

STRICT RULES:
- ONLY coloring book niches — no journals, activity books, puzzle books, etc.
- Focus on niches that are NEW or GAINING traction, not established ones
- Assign a velocity score (0-100) reflecting how fast this niche is growing
- Assign a colorableScore (0-100) reflecting how suitable this niche is for coloring books
- Provide the English term AND the Spanish translation

Return ONLY valid JSON (no markdown):
{"viral_niches":[{"term":"English niche name","termEs":"Nombre en español","velocity":85,"colorableScore":90,"source":"amazon-movers","reason":"Brief reason for velocity score"}]}`;

const SOURCES_CONFIG = [
    {
        id: "amazon-movers",
        label: "Amazon Movers & Shakers",
        url: "https://www.amazon.com/gp/movers-and-shakers/books/283155",
    },
    {
        id: "amazon-search",
        label: "Amazon New Releases Coloring",
        url: "https://www.amazon.com/s?k=coloring+book+adults+2025&i=stripbooks&s=date-desc-rank",
    },
    {
        id: "google-trends-craft",
        label: "Pinterest Craft Trends",
        url: "https://www.pinterest.com/search/pins/?q=coloring+book+2025+trending",
    },
];

async function fetchPageText(url: string): Promise<string> {
    try {
        const res = await fetch(`https://r.jina.ai/${url}`, {
            headers: { "User-Agent": "Mozilla/5.0", "X-Return-Format": "text" },
            signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) return "";
        const text = await res.text();
        return text.slice(0, 8000); // limit context
    } catch {
        return "";
    }
}

async function scanSource(source: typeof SOURCES_CONFIG[number], existingTerms: string[]): Promise<IViralResult[]> {
    const pageText = await fetchPageText(source.url);
    if (!pageText) return [];

    const avoidBlock = existingTerms.length > 0
        ? `\n\nALREADY IN SYSTEM (avoid these): ${existingTerms.slice(0, 30).join(", ")}`
        : "";

    const raw = await generateTextWithLLM(
        VIRAL_SCAN_SYSTEM_PROMPT + avoidBlock,
        `Source: ${source.label}\n\n${pageText}`
    ).catch(() => "");

    if (!raw) return [];

    try {
        const cleaned = raw.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) return [];
        const parsed = JSON.parse(match[0]);
        return (parsed.viral_niches ?? []).map((n: any) => ({ ...n, source: source.id }));
    } catch {
        return [];
    }
}

interface IViralResult {
    term: string;
    termEs: string;
    velocity: number;
    colorableScore: number;
    source: string;
    reason?: string;
}

export async function registerViralNicheRoutes(app: FastifyInstance, deps: { io: any }) {
    const { io } = deps;

    // POST /viral-niches/scan — run multi-source viral scan
    app.post("/viral-niches/scan", async (request: any, reply) => {
        const scanId = `scan-${Date.now()}`;
        const existingNiches = await Niche.find({}, "name").lean();
        const existingTerms = (existingNiches as any[]).map((n: any) => n.name);

        io.emit("viral:scan-started", { scanId });

        // Fire all source scans in parallel
        const allResults = await Promise.all(
            SOURCES_CONFIG.map(src => scanSource(src, existingTerms))
        );

        // Merge: deduplicate by term (case-insensitive), keep highest velocity per term
        const merged = new Map<string, IViralResult & { sources: string[] }>();
        for (const results of allResults) {
            for (const r of results) {
                const key = r.term.toLowerCase().trim();
                const existing = merged.get(key);
                if (existing) {
                    existing.velocity = Math.max(existing.velocity, r.velocity);
                    existing.colorableScore = Math.max(existing.colorableScore, r.colorableScore);
                    if (!existing.sources.includes(r.source)) existing.sources.push(r.source);
                } else {
                    merged.set(key, { ...r, sources: [r.source] });
                }
            }
        }

        // Boost velocity for terms found in multiple sources
        for (const item of merged.values()) {
            if (item.sources.length > 1) item.velocity = Math.min(100, item.velocity + 10 * (item.sources.length - 1));
        }

        // Persist to MongoDB
        const saved: any[] = [];
        for (const item of merged.values()) {
            try {
                const doc = await ViralNiche.findOneAndUpdate(
                    { term: { $regex: new RegExp(`^${item.term}$`, "i") }, scanId },
                    {
                        $set: {
                            termEs: item.termEs,
                            sources: item.sources,
                            velocity: item.velocity,
                            colorableScore: item.colorableScore,
                            status: "new",
                            detectedAt: new Date(),
                            raw: item,
                        },
                    },
                    { upsert: true, new: true }
                );
                saved.push(doc);
            } catch {
                // duplicate key race — skip
            }
        }

        io.emit("viral:scan-done", { scanId, count: saved.length });
        return reply.send({ ok: true, scanId, count: saved.length, items: saved });
    });

    // GET /viral-niches — list (most recent scan or all)
    app.get("/viral-niches", async (request: any, reply) => {
        const status = request.query?.status;
        const filter: any = {};
        if (status) filter.status = status;
        const items = await ViralNiche.find(filter).sort({ velocity: -1, detectedAt: -1 }).limit(100).lean();
        return reply.send(items);
    });

    // PATCH /viral-niches/:id/status — update status
    app.patch("/viral-niches/:id/status", async (request: any, reply) => {
        const { status } = request.body ?? {};
        if (!["new", "watched", "converted", "dismissed"].includes(status)) {
            return reply.status(400).send({ error: "Invalid status" });
        }
        const doc = await ViralNiche.findByIdAndUpdate(request.params.id, { status }, { new: true });
        if (!doc) return reply.status(404).send({ error: "Not found" });
        return reply.send(doc);
    });

    // POST /viral-niches/:id/send-telegram — send to Telegram for approval (same flow as clone-telegram)
    app.post("/viral-niches/:id/send-telegram", async (request: any, reply) => {
        const viral = await ViralNiche.findById(request.params.id);
        if (!viral) return reply.status(404).send({ error: "Not found" });
        if (viral.status === "converted") return reply.status(409).send({ error: "Ya convertido" });

        const nicheName = viral.termEs || viral.term;

        // 1 · AI generates a coloring book image prompt for this niche
        const imagePrompt = await generateTextWithLLM(
            `You are an expert at writing image generation prompts for KDP coloring book covers. Write ONE prompt in English (max 20 words). The prompt must describe a coloring book scene — black line art, white background, detailed illustration. RULES: max 1-2 creatures per scene; never count limbs or fingers; hide all hands inside clothing or behind objects; describe creatures by posture/action, never by limb count. Output ONLY the prompt, no explanation, no JSON.`,
            `Niche: ${nicheName}\nTrending term: ${viral.term}\nSources: ${viral.sources.join(", ")}`
        ).catch(() => nicheName);

        const baseScene = imagePrompt.trim().replace(/['"]/g, "");
        const fullPrompt = buildColoringBookPrompt(baseScene, "generic");
        const aiModel = await getAutopilotImageModel();

        // 2 · Create TelegramAction (same type as clone-decision so the approval flow reuses existing logic)
        const action = await TelegramAction.create({
            type: "clone-decision",
            nicheName,
            imagePrompt: fullPrompt,
            aiModel,
            cloneData: {
                nicheName,
                title: `${nicheName} Coloring Book`,
                titleTemplate: `${nicheName} Coloring Book`,
                audience: "adults",
                coverBrief: `Coloring book cover for ${nicheName}`,
                keywords: [viral.term, ...viral.sources],
                whyItWorks: `Detectado como tendencia viral con velocidad ${viral.velocity}/100 en: ${viral.sources.join(", ")}`,
                competition: "unknown",
                sourceTitle: `Viral Radar — ${viral.sources.join(", ")}`,
                sourceUrl: "",
            },
            autoApproveAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        });

        // 3 · Generate image + send to Telegram (synchronous — respond only after confirmed delivery)
        const port = process.env.PORT || 3001;
        let imageBytes: Buffer | null = null;
        try {
            const imgRes = await fetch(`http://localhost:${port}/ai/generate-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(process.env.SERVER_API_KEY ? { Authorization: `Bearer ${process.env.SERVER_API_KEY}` } : {}) },
                body: JSON.stringify({ prompt: fullPrompt, modelId: aiModel.modelId, provider: aiModel.provider, width: 768, height: 1024 }),
                signal: AbortSignal.timeout(30_000),
            });
            if (imgRes.ok && (imgRes.headers.get("content-type") ?? "").startsWith("image/")) {
                imageBytes = Buffer.from(await imgRes.arrayBuffer());
            }
        } catch { /* fallback to text-only below */ }

        const caption = [
            `🔥 <b>Viral Radar — Nicho en tendencia</b>`,
            ``,
            `📚 <b>${nicheName}</b>`,
            `⚡️ Velocidad: <b>${viral.velocity}/100</b>`,
            `🔗 Detectado en: <i>${viral.sources.join(", ")}</i>`,
            ``,
            `¿Quieres convertirlo en nicho y lanzar catálogos?`,
        ].join("\n");

        const rows = [[
            { text: "✅ Crear nicho", callback_data: `continuar:${String(action._id)}` },
            { text: "🗑️ Descartar",   callback_data: `descartar:${String(action._id)}` },
        ]];

        let msgId: number | null = null;
        if (imageBytes) {
            msgId = await sendTelegramImageWithButtons(imageBytes, caption, rows);
        }
        if (!msgId) {
            msgId = await sendTelegramButtons(caption, rows);
        }

        if (!msgId) {
            // Telegram send failed — clean up action and let frontend retry
            await action.deleteOne();
            return reply.status(502).send({ error: "No se pudo enviar a Telegram — revisa la configuración del bot" });
        }

        action.messageId = msgId;
        await action.save();

        // 4 · Mark as watched only after confirmed Telegram delivery
        await viral.updateOne({ status: "watched" });
        io.emit("viral:updated", { id: viral._id.toString(), status: "watched" });

        return reply.send({ ok: true, actionId: String(action._id) });
    });
}
