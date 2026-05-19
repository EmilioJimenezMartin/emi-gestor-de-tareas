import { FastifyInstance } from "fastify";
import type { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import { Settings } from "../models/settings.js";

// ── Mode: General market analysis ────────────────────────────────────────────
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

// ── Mode: Etsy niche detection ────────────────────────────────────────────────
export const EtsyListingSchema = z.object({
    titulo_producto: z.string().describe("El título completo del listado en Etsy, limpio de caracteres extraños"),
    precio: z.string().describe("El precio de venta visible tal como aparece (ej: '$4.99', '3,50 €')"),
    bestseller: z.boolean().describe("true si el listado tiene la insignia de Bestseller o 'Popular ahora', false en caso contrario"),
    personas_carrito: z.number().describe("Número de personas que tienen el producto en el carrito. Si dice 'Más de 20', pon 20. Si no aparece, pon 0."),
    total_reseñas: z.number().describe("Número total de reseñas/opiniones del artículo. Si no aparece, pon 0."),
    sub_nicho_estimado: z.string().describe("Micronicho específico deducido por las palabras clave del título (ej: 'Mushroom Fairy', 'Spooky Cute Goth', 'Axolotl Kids')"),
});
export const EtsyNicheResultSchema = z.object({
    nichos_detectados: z.array(EtsyListingSchema).describe("Lista completa de productos/nichos detectados en la página de resultados"),
});
export type EtsyNicheResult = z.infer<typeof EtsyNicheResultSchema>;

const ETSY_SYSTEM_PROMPT = `Eres un analista experto en investigación de mercado para productos digitales en Etsy. Tu objetivo es extraer y estructurar TODOS los listados de productos visibles en la página de resultados, especialmente los relacionados con libros de colorear, coloring pages PDF, printables, pósters digitales o cualquier producto digital descargable.

Para CADA producto encontrado en la página, aplica estas reglas de extracción:
1. Extrae el título completo y límpialo de caracteres extraños o codificaciones HTML.
2. Identifica si tiene la etiqueta "Bestseller", "Best Seller", "Popular ahora" o similar — marca bestseller como true.
3. Busca textos de urgencia como "En el carrito de más de X personas", "X people have this in their carts" o "Solo queda 1". Extrae el número X; si dice "more than 20" o "más de 20", usa 20.
4. Extrae el número total de reseñas si está visible junto al producto (no el rating, sino el conteo: "1,234 reseñas").
5. Deduce el micronicho específico a partir de las palabras clave del título: busca términos como animales, estilos visuales, temáticas, audiencias (niños, adultos, mandala, kawaii, gótico, etc.).

Extrae TODOS los productos que veas, no solo los que parecen más relevantes. El objetivo es detectar patrones de demanda.`;

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
    // POST /radar/analyze — Playwright + llm-scraper + Gemini
    // Body: { url, mode: "etsy-niches" | "general", nicheName?, context? }
    app.post("/radar/analyze", async (request: any, reply) => {
        const { url, mode = "general", nicheName, context } = request.body || {};
        if (!url?.trim()) return reply.status(400).send({ error: "url es requerida" });

        const googleKey = await getGoogleKey();
        if (!googleKey) return reply.status(400).send({ error: "Google API key no configurada. Añádela en Ajustes." });

        const jobId = `radar-${Date.now()}`;
        log(deps.io, "info", `[INIT] Iniciando análisis · modo: ${mode} · URL: ${url}`);

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

                // For Etsy: scroll to load lazy content
                if (mode === "etsy-niches") {
                    log(deps.io, "info", `[FETCH] Scroll para cargar resultados lazy...`);
                    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
                    await page.waitForTimeout(1500);
                    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                    await page.waitForTimeout(1000);
                }

                log(deps.io, "success", `[FETCH] ✓ Página cargada`);
                log(deps.io, "info", `[AI] Analizando con Gemini · modo: ${mode}...`);

                const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
                const { default: LLMScraper } = await import("llm-scraper");
                const { Output } = await import("ai");

                const google = createGoogleGenerativeAI({ apiKey: googleKey });
                const scraper = new LLMScraper(google("gemini-1.5-flash"));

                let data: any;

                if (mode === "etsy-niches") {
                    const output = Output.object(EtsyNicheResultSchema as any);
                    const result = await scraper.run(page, output, {
                        format: "html",
                        system: ETSY_SYSTEM_PROMPT,
                    });
                    data = result.data;
                    const count = (data?.nichos_detectados ?? []).length;
                    log(deps.io, "success", `[AI] ✓ ${count} productos/nichos detectados`);
                } else {
                    const contextHint = [
                        nicheName ? `Niche objetivo: "${nicheName}".` : "",
                        context ? `Contexto adicional: ${context}.` : "",
                        "Analiza esta página de marketplace (Amazon, Etsy, Google, etc.) para investigar el nicho de mercado.",
                    ].filter(Boolean).join(" ");
                    const output = Output.object(NicheInsightSchema as any);
                    const result = await scraper.run(page, output, {
                        format: "html",
                        system: contextHint || undefined,
                    });
                    data = result.data;
                    log(deps.io, "success", `[AI] ✓ Análisis completado`);
                }

                deps.io?.emit("radar:result", { jobId, mode, data });
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
