import { FastifyInstance } from "fastify";
import type { Server as SocketIOServer } from "socket.io";
import type { Agenda } from "agenda";
import { z } from "zod";
import { RadarJob } from "../models/radar-job.js";
import { RADAR_JOB_NAME } from "../jobs/radar.js";
import { getMongoStatus } from "../lib/mongo.js";

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
    url_producto: z.string().optional().describe("URL directa del listado en Etsy (href del enlace <a> que lleva al producto, empieza por 'https://www.etsy.com/listing/'). Omite si no está disponible."),
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
6. Extrae la URL directa del listado: busca el href del enlace <a> que rodea el título o la imagen del producto. Las URLs tienen el formato 'https://www.etsy.com/listing/NNNNNN/slug'. Si no encuentras el href exacto, omite url_producto.

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

export async function getHFKey(): Promise<string> {
    let key = process.env.HUGGINGFACE_API_KEY ?? "";
    try {
        const { Settings } = await import("../models/settings.js");
        const row = await Settings.findOne({ key: "HUGGINGFACE_API_KEY" }).lean();
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
        const { url, mode = "general", nicheName, context, geminiModel = "gemini-2.0-flash", storageKey = "RADAR_ETSY_RESULT" } = request.body || {};
        if (!url?.trim()) return reply.status(400).send({ error: "url es requerida" });

        const googleKey = await getGoogleKey();
        const hfKey = await getHFKey();
        if (!googleKey && !hfKey) return reply.status(400).send({ error: "No hay API key configurada. Añade Google API key o HuggingFace API key en Ajustes." });

        if (!deps.agenda) return reply.status(503).send({ error: "Agenda no disponible aún, espera unos segundos" });

        const jobId = `radar-${Date.now()}`;

        const jobDoc = await RadarJob.create({
            jobId,
            url,
            mode,
            nicheName,
            context,
            geminiModel,
            storageKey,
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

    // PUT /radar/jobs/latest/pre-nichos — persists the pre-nichos list in the latest job (legacy)
    app.put("/radar/jobs/latest/pre-nichos", async (request: any, reply) => {
        const { preNichos } = request.body || {};
        if (!Array.isArray(preNichos)) return reply.status(400).send({ error: "preNichos array requerido" });
        const job = await RadarJob.findOneAndUpdate(
            {},
            { $set: { preNichos } },
            { sort: { createdAt: -1 }, new: true }
        ).lean();
        if (!job) return reply.status(404).send({ error: "No hay jobs" });
        return reply.send({ success: true });
    });

    // GET /radar/saved-pre-nichos — lee pre-nichos persistidos en Settings
    app.get("/radar/saved-pre-nichos", async (_req, reply) => {
        const { Settings } = await import("../models/settings.js");
        const row = await Settings.findOne({ key: "RADAR_PRE_NICHOS" }).lean();
        if (!row?.value) return reply.send({ preNichos: [] });
        try {
            return reply.send({ preNichos: JSON.parse(row.value as string) });
        } catch {
            return reply.send({ preNichos: [] });
        }
    });

    // PUT /radar/saved-pre-nichos — guarda pre-nichos en Settings (persiste entre jobs)
    app.put("/radar/saved-pre-nichos", async (request: any, reply) => {
        const { preNichos } = request.body || {};
        if (!Array.isArray(preNichos)) return reply.status(400).send({ error: "preNichos array requerido" });
        const { Settings } = await import("../models/settings.js");
        await Settings.findOneAndUpdate(
            { key: "RADAR_PRE_NICHOS" },
            { key: "RADAR_PRE_NICHOS", value: JSON.stringify(preNichos) },
            { upsert: true }
        );
        return reply.send({ success: true });
    });

    // GET /radar/saved-etsy-result — lee último resultado Etsy persistido en Settings
    // ?key=<storageKey> permite aislar resultados por app (default: RADAR_ETSY_RESULT)
    app.get("/radar/saved-etsy-result", async (request: any, reply) => {
        const storageKey = (request.query?.key as string) || "RADAR_ETSY_RESULT";
        const { Settings } = await import("../models/settings.js");
        const row = await Settings.findOne({ key: storageKey }).lean();
        if (!row?.value) return reply.send({ result: null });
        try {
            return reply.send({ result: JSON.parse(row.value as string) });
        } catch {
            return reply.send({ result: null });
        }
    });

    // PUT /radar/saved-etsy-result — persiste el resultado Etsy en Settings
    app.put("/radar/saved-etsy-result", async (request: any, reply) => {
        const storageKey = (request.query?.key as string) || "RADAR_ETSY_RESULT";
        const { result } = request.body || {};
        const { Settings } = await import("../models/settings.js");
        await Settings.findOneAndUpdate(
            { key: storageKey },
            { key: storageKey, value: result ? JSON.stringify(result) : "null" },
            { upsert: true }
        );
        return reply.send({ success: true });
    });

    // DELETE /radar/etsy-row — elimina una fila del resultado Etsy en Settings Y en el RadarJob
    app.delete("/radar/etsy-row", async (request: any, reply) => {
        if (getMongoStatus() !== "connected") return reply.status(503).send({ error: "Base de datos no disponible" });
        const { titulo_producto, key: storageKey = "RADAR_ETSY_RESULT" } = (request.body as any) || {};
        if (!titulo_producto) return reply.status(400).send({ error: "titulo_producto requerido" });
        const { Settings } = await import("../models/settings.js");
        const filterRow = (nichos: any[]) => nichos.filter((r: any) => r.titulo_producto !== titulo_producto);
        // Actualizar Settings
        const settingsRow = await Settings.findOne({ key: storageKey }).lean();
        if (settingsRow?.value) {
            try {
                const saved = JSON.parse(settingsRow.value as string);
                if (saved?.nichos_detectados) {
                    saved.nichos_detectados = filterRow(saved.nichos_detectados);
                    await Settings.findOneAndUpdate(
                        { key: storageKey },
                        { $set: { value: JSON.stringify(saved) } }
                    );
                }
            } catch {}
        }
        // Actualizar también el RadarJob más reciente (solo cuando es el key por defecto)
        if (storageKey === "RADAR_ETSY_RESULT") {
            const latestJob = await RadarJob.findOne().sort({ createdAt: -1 });
            if (latestJob?.result?.nichos_detectados) {
                latestJob.result = { ...latestJob.result, nichos_detectados: filterRow(latestJob.result.nichos_detectados) };
                latestJob.markModified("result");
                await latestJob.save();
            }
        }
        return reply.send({ ok: true });
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
        const hfKey = await getHFKey();
        if (!googleKey && !hfKey) {
            return reply.status(400).send({ error: "Configura Google API key o HuggingFace API key en Ajustes." });
        }

        const listSummary = nichos
            .map((n: any) => `- "${n.titulo_producto}" | sub_nicho: ${n.sub_nicho_estimado} | bestseller: ${n.bestseller} | reseñas: ${n.total_reseñas}`)
            .join("\n");

        const PROMPT = `Eres un experto en investigación de mercado para productos digitales en Etsy (libros de colorear, printables, PDF descargables).

Analiza la siguiente lista de productos detectados en Etsy y agrúpalos en categorías de "pre-nichos".

REGLAS:
- Agrupa los sub_nichos similares en categorías coherentes (máximo 6 pre-nichos)
- El nombre debe ser específico y accionable (ej: "Animales lindos Kawaii", "Mandalas Zen Adultos")
- Evalúa el potencial basándote en cuántos productos bestseller hay en el grupo y el número de reseñas
- keywords_clave deben ser los términos de búsqueda reales que usaría un comprador en Etsy

PRODUCTOS DETECTADOS:
${listSummary}`;

        // ── Try Gemini first ──────────────────────────────────────────────────
        if (googleKey) {
            try {
                const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
                const { generateObject } = await import("ai");
                const google = createGoogleGenerativeAI({ apiKey: googleKey });
                const { object } = await generateObject({
                    model: google("gemini-2.0-flash"),
                    schema: PreNichosResultSchema as any,
                    prompt: PROMPT,
                });
                return reply.send(object);
            } catch (geminiErr: any) {
                const isQuota = /limit:\s*0|quota|rate.?limit|429/i.test(geminiErr?.message ?? "");
                app.log.warn(`[pre-nichos] Gemini falló (${isQuota ? "cuota" : geminiErr?.message?.slice(0, 80)}), probando HuggingFace...`);
                if (!hfKey) {
                    const msg = isQuota
                        ? "Cuota diaria de Gemini agotada. Configura HuggingFace API key como respaldo en Ajustes."
                        : (geminiErr?.message ?? "Error con Gemini");
                    return reply.status(500).send({ error: msg });
                }
            }
        }

        // ── HuggingFace fallback ──────────────────────────────────────────────
        try {
            const { HfInference } = await import("@huggingface/inference");
            const hf = new HfInference(hfKey);
            const schemaHint = `{"pre_nichos":[{"nombre":"string","descripcion":"string","potencial":"low|medium|high","sub_nichos":["string"],"keywords_clave":["string"]}]}`;
            const response = await hf.chatCompletion({
                model: "meta-llama/Llama-3.3-70B-Instruct",
                messages: [
                    {
                        role: "system",
                        content: `Eres un experto en mercados digitales Etsy. Agrupa productos en pre-nichos. Responde ÚNICAMENTE con un JSON válido sin markdown con esta estructura exacta:\n${schemaHint}`,
                    },
                    { role: "user", content: `${PROMPT}` },
                ],
                max_tokens: 2048,
                temperature: 0.1,
            });
            const text = (response.choices[0]?.message?.content ?? "").trim();
            const jsonMatch = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/(\{[\s\S]*\})/s);
            if (!jsonMatch) throw new Error(`HuggingFace no devolvió JSON válido: ${text.slice(0, 150)}`);
            const parsed = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
            return reply.send(parsed);
        } catch (hfErr: any) {
            return reply.status(500).send({ error: hfErr?.message ?? "Error generando pre-nichos con HuggingFace" });
        }
    });
}
