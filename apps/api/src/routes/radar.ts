import { FastifyInstance } from "fastify";
import type { Server as SocketIOServer } from "socket.io";
import type { Agenda } from "agenda";
import { z } from "zod";
import { RadarJob } from "../models/radar-job.js";
import { RADAR_JOB_NAME } from "../jobs/radar.js";

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

export const ETSY_SYSTEM_PROMPT = `Eres un analista experto en investigación de mercado para productos digitales en Etsy. Tu objetivo es extraer y estructurar TODOS los listados de productos visibles en la página de resultados, especialmente los relacionados con libros de colorear, coloring pages PDF, printables, pósters digitales o cualquier producto digital descargable.

Para CADA producto encontrado en la página, aplica estas reglas de extracción:
1. Extrae el título completo y límpialo de caracteres extraños o codificaciones HTML.
2. Identifica si tiene la etiqueta "Bestseller", "Best Seller", "Popular ahora" o similar — marca bestseller como true.
3. Busca textos de urgencia como "En el carrito de más de X personas", "X people have this in their carts" o "Solo queda 1". Extrae el número X; si dice "more than 20" o "más de 20", usa 20.
4. Extrae el número total de reseñas si está visible junto al producto (no el rating, sino el conteo: "1,234 reseñas").
5. Deduce el micronicho específico a partir de las palabras clave del título: busca términos como animales, estilos visuales, temáticas, audiencias (niños, adultos, mandala, kawaii, gótico, etc.).

Extrae TODOS los productos que veas, no solo los que parecen más relevantes. El objetivo es detectar patrones de demanda.`;

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
    deps: { io?: SocketIOServer; agenda?: Agenda }
) {
    // POST /radar/analyze — crea job en DB y lo encola en Agenda
    app.post("/radar/analyze", async (request: any, reply) => {
        const { url, mode = "general", nicheName, context, geminiModel = "gemini-2.0-flash" } = request.body || {};
        if (!url?.trim()) return reply.status(400).send({ error: "url es requerida" });

        const googleKey = await getGoogleKey();
        if (!googleKey) return reply.status(400).send({ error: "Google API key no configurada. Añádela en Ajustes." });

        if (!deps.agenda) return reply.status(503).send({ error: "Agenda no disponible aún, espera unos segundos" });

        const jobId = `radar-${Date.now()}`;

        const jobDoc = await RadarJob.create({
            jobId,
            url,
            mode,
            nicheName,
            context,
            geminiModel,
            status: "running",
            logs: [{ timestamp: new Date(), level: "info", message: `[INIT] Análisis encolado · modo: ${mode} · modelo: ${geminiModel}` }],
        });

        deps.io?.emit("radar:log", { timestamp: new Date(), level: "info", message: `[INIT] Análisis encolado · modo: ${mode} · URL: ${url}` });

        await deps.agenda.now(RADAR_JOB_NAME, { jobId });

        return reply.send({ success: true, jobId });
    });

    // GET /radar/jobs/latest — devuelve el job más reciente (para restaurar estado en el frontend)
    app.get("/radar/jobs/latest", async (_request, reply) => {
        const job = await RadarJob.findOne().sort({ createdAt: -1 }).lean();
        if (!job) return reply.send({ job: null });
        return reply.send({ job });
    });

    // GET /radar/jobs/:jobId — estado de un job concreto
    app.get("/radar/jobs/:jobId", async (request: any, reply) => {
        const job = await RadarJob.findOne({ jobId: request.params.jobId }).lean();
        if (!job) return reply.status(404).send({ error: "Job no encontrado" });
        return reply.send({ job });
    });

    // ── POST /radar/pre-nichos — agrupa listados en pre-nichos (síncrono, rápido) ──
    const PreNichoSchema = z.object({
        nombre: z.string().describe("Nombre de la categoría de pre-nicho (corto y memorable)"),
        descripcion: z.string().describe("Por qué este pre-nicho tiene potencial en Etsy (1-2 frases)"),
        potencial: z.enum(["low", "medium", "high"]).describe("Potencial de mercado estimado"),
        sub_nichos: z.array(z.string()).describe("Sub-nichos específicos que pertenecen a esta categoría"),
        keywords_clave: z.array(z.string()).describe("3-5 keywords principales para este pre-nicho"),
    });
    const PreNichosResultSchema = z.object({
        pre_nichos: z.array(PreNichoSchema).describe("Categorías de pre-nichos identificadas (máximo 6)"),
    });

    app.post("/radar/pre-nichos", async (request: any, reply) => {
        const { nichos } = request.body || {};
        if (!Array.isArray(nichos) || nichos.length === 0) {
            return reply.status(400).send({ error: "nichos array es requerido" });
        }
        const googleKey = await getGoogleKey();
        if (!googleKey) return reply.status(400).send({ error: "Google API key no configurada" });

        try {
            const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
            const { generateObject } = await import("ai");
            const google = createGoogleGenerativeAI({ apiKey: googleKey });

            const listSummary = nichos
                .map((n: any) => `- "${n.titulo_producto}" | sub_nicho: ${n.sub_nicho_estimado} | bestseller: ${n.bestseller} | reseñas: ${n.total_reseñas}`)
                .join("\n");

            const { object } = await generateObject({
                model: google("gemini-2.0-flash"),
                schema: PreNichosResultSchema as any,
                prompt: `Eres un experto en investigación de mercado para productos digitales en Etsy (libros de colorear, printables, PDF descargables).

Analiza la siguiente lista de productos detectados en Etsy y agrúpalos en categorías de "pre-nichos".

REGLAS:
- Agrupa los sub_nichos similares en categorías coherentes (máximo 6 pre-nichos)
- El nombre debe ser específico y accionable (ej: "Animales lindos Kawaii", "Mandalas Zen Adultos")
- Evalúa el potencial basándote en cuántos productos bestseller hay en el grupo y el número de reseñas
- keywords_clave deben ser los términos de búsqueda reales que usaría un comprador en Etsy

PRODUCTOS DETECTADOS:
${listSummary}`,
            });

            return reply.send(object);
        } catch (err: any) {
            const isHardQuota = /limit:\s*0/i.test(err?.message ?? "");
            const msg = isHardQuota
                ? "Cuota diaria de Gemini agotada. Vuelve mañana o activa facturación en Google AI Studio."
                : (err?.message ?? "Error generando pre-nichos");
            return reply.status(500).send({ error: msg });
        }
    });
}
