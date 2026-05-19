import { FastifyInstance } from "fastify";
import type { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import { Settings } from "../models/settings.js";

// ── Niche insight schema ──────────────────────────────────────────────────────
export const NicheInsightSchema = z.object({
    niche: z.string().describe("Niche or market segment name"),
    competition: z.enum(["low", "medium", "high"]).describe("Competition level in this niche"),
    demand: z.enum(["low", "medium", "high"]).describe("Demand/interest level"),
    trend: z.enum(["rising", "stable", "declining"]).describe("Market trend direction"),
    topKeywords: z.array(z.string()).describe("Top 5 relevant keywords/search terms"),
    priceRange: z.string().describe("Typical price range for products in this niche (e.g. $5–$20)"),
    topCompetitors: z.array(z.string()).describe("Top 3-5 seller names or brands visible on the page"),
    entryOpportunity: z.string().describe("Brief assessment of the opportunity for a new seller (1-2 sentences)"),
    buyerProfile: z.string().describe("Who buys these products — demographics and motivations"),
    summary: z.string().describe("Short market summary in 2-3 sentences"),
});

export type NicheInsight = z.infer<typeof NicheInsightSchema>;

function log(io: SocketIOServer | undefined, level: "info" | "success" | "error" | "warning", message: string) {
    io?.emit("radar:log", { timestamp: new Date(), level, message });
}

async function getGoogleKey(): Promise<string> {
    let key = process.env.GOOGLE_API_KEY ?? "";
    try {
        const { Settings } = await import("../models/settings.js");
        const row = await Settings.findOne({ key: "GOOGLE_API_KEY" }).lean();
        if (row?.value) key = row.value as string;
    } catch { /* fallback to env */ }
    return key;
}

export async function registerRadarRoutes(
    app: FastifyInstance,
    deps: { io?: SocketIOServer }
) {
    // POST /radar/analyze — scrape URL with Playwright + llm-scraper + Gemini
    app.post("/radar/analyze", async (request: any, reply) => {
        const { url, nicheName, context } = request.body || {};
        if (!url?.trim()) return reply.status(400).send({ error: "url es requerida" });

        const googleKey = await getGoogleKey();
        if (!googleKey) return reply.status(400).send({ error: "Google API key no configurada. Añádela en Ajustes." });

        const jobId = `radar-${Date.now()}`;
        log(deps.io, "info", `[INIT] Iniciando análisis de radar para: ${url}`);

        // Fire and forget
        (async () => {
            let browser: any = null;
            try {
                log(deps.io, "info", `[BROWSER] Lanzando navegador headless...`);
                const { chromium } = await import("playwright");
                browser = await chromium.launch({ headless: true });
                const page = await browser.newPage();

                await page.setExtraHTTPHeaders({
                    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                });

                log(deps.io, "info", `[FETCH] Cargando página: ${url}`);
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
                log(deps.io, "success", `[FETCH] ✓ Página cargada`);

                log(deps.io, "info", `[AI] Analizando contenido con Gemini...`);

                const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
                const { default: LLMScraper } = await import("llm-scraper");

                const google = createGoogleGenerativeAI({ apiKey: googleKey });
                const scraper = new LLMScraper(google("gemini-1.5-flash"));

                const contextHint = [
                    nicheName ? `Niche objetivo: "${nicheName}".` : "",
                    context ? `Contexto adicional: ${context}.` : "",
                    "Analiza esta página de marketplace (Amazon, Etsy, Google, etc.) para investigar el nicho de mercado.",
                ].filter(Boolean).join(" ");

                const { Output } = await import("ai");
                // Zod v4 schema — cast needed due to ai SDK FlexibleSchema type mismatch with Zod v4
                const output = Output.object(NicheInsightSchema as any);

                const { data } = await scraper.run(page, output, {
                    format: "markdown",
                    system: contextHint || undefined,
                });

                log(deps.io, "success", `[AI] ✓ Análisis completado`);
                deps.io?.emit("radar:result", { jobId, data });

                await page.close();
            } catch (err: any) {
                log(deps.io, "error", `[ERROR] ${err?.message ?? "Error desconocido"}`);
                deps.io?.emit("radar:error", { jobId, message: err?.message ?? "Error desconocido" });
            } finally {
                if (browser) {
                    try { await browser.close(); } catch { /* ignore */ }
                }
                deps.io?.emit("radar:done", { jobId });
            }
        })();

        return reply.send({ success: true, jobId });
    });
}
