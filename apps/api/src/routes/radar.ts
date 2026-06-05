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

export const AMAZON_SYSTEM_PROMPT = `Eres un analista experto en investigación de mercado para libros de colorear (coloring books), patrones, printables y productos digitales en Amazon KDP. Tu objetivo es extraer y estructurar TODOS los listados de productos visibles en la página de resultados.

Para CADA producto encontrado en la página, aplica estas reglas de extracción:
1. Extrae el título completo del producto y límpialo.
2. Identifica si tiene la etiqueta "Best Seller", "#1 Best Seller", "Amazon's Choice" o similar — marca bestseller como true.
3. Extrae el número de valoraciones/reseñas si está visible (ej: "1,234 ratings" → 1234).
4. Extrae el precio de venta tal como aparece.
5. Deduce el micronicho específico a partir de las palabras clave del título: temáticas, estilos, audiencias (niños, adultos, mandala, animales, patrones geométricos, etc.).
6. Extrae el ASIN del producto si aparece en la URL o en el listado (formato: B0XXXXXXXX).
7. Extrae la URL directa del listado de Amazon si está disponible.

Extrae TODOS los productos visibles. El objetivo es detectar patrones de demanda y nichos populares en Amazon KDP.`;

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

export const OPPORTUNITY_SYSTEM_PROMPT = `Eres un detector de OPORTUNIDADES para productos KDP con bajo riesgo y alta demanda. Tu misión es identificar nichos donde hay señales de demanda real pero POCA competencia establecida.

CRITERIO CENTRAL — el ratio demanda/competencia:
- personas_carrito alto + total_reseñas bajo = OPORTUNIDAD MÁXIMA (nicho en auge sin competencia consolidada)
- Productos SIN Bestseller pero con urgencia de carrito = oportunidad virgen
- Sub-nichos muy específicos con baja saturación aparente

Para CADA producto en la página:
1. Extrae el título limpio completo
2. bestseller: true SOLO si tiene la etiqueta Y tiene pocas reseñas (<200) — un Bestseller reciente con pocas reseñas es señal de tendencia emergente, NO de saturación
3. personas_carrito: número de personas en carrito (señal de demanda inmediata — el dato más importante)
4. total_reseñas: número total de reseñas (indicador de saturación/competencia — bajo = oportunidad)
5. precio tal como aparece
6. sub_nicho_estimado: micro-nicho con ángulo diferencial claro (nueva audiencia, nuevo estilo, nueva temática)
7. url_producto si está disponible

SEÑALES DE OPORTUNIDAD MÁXIMA:
- Carrito > 5 con reseñas < 100 → OPORTUNIDAD CRÍTICA
- Carrito > 0 con reseñas = 0 → NICHO VIRGEN
- Bestseller con pocas reseñas (<200) → TENDENCIA EMERGENTE

Extrae TODOS los productos. Prioriza los que tienen alta demanda y baja competencia sobre los ya saturados.`;

export const MOVERS_SYSTEM_PROMPT = `Eres un analista de libros en movimiento en Amazon Movers & Shakers. Estás viendo la lista de los libros de colorear que más están subiendo en ranking en las últimas 24 horas — señales de demanda en tiempo real.

Para CADA libro en la lista:
1. Extrae el título completo y límpialo
2. bestseller: true si tiene badge Best Seller o está en posición #1-#10 del ranking de movimiento
3. personas_carrito: extrae el porcentaje de mejora en ranking (si dice "moved up 500%" → 50; si es "#1 mover" → 100; si no hay dato → 10)
4. total_reseñas: número de valoraciones/reseñas del libro
5. precio tal como aparece
6. sub_nicho_estimado: el micro-nicho específico del libro (temática, audiencia, estilo visual)
7. url_producto: URL del listado en Amazon si está disponible

Extrae TODOS los libros visibles en la lista de movimiento. Son las señales más frescas de demanda en Amazon KDP — los nichos que están ganando tracción AHORA.`;

export const REDDIT_SYSTEM_PROMPT = `Eres un analista de tendencias KDP para Reddit. Recibirás posts recientes de comunidades r/kdp y r/coloringbooks. Tu misión es detectar micro-nichos, necesidades no cubiertas y tendencias que los creadores de KDP están discutiendo activamente.

Para cada NICHO/IDEA detectado en los posts:
1. titulo_producto: El micro-nicho o idea de producto derivada del post, en formato "Raíz + Modificador KDP" (ej: "Cozy Cottagecore Coloring Book for Adults")
2. bestseller: true si múltiples posts mencionan el mismo nicho O el post tiene score > 50 (señal de interés comunitario fuerte)
3. personas_carrito: score/upvotes del post (señal de interés de la comunidad)
4. total_reseñas: número de comentarios en el post (señal de engagement y conversación)
5. precio: "N/A"
6. sub_nicho_estimado: micro-nicho específico con aplicación directa KDP
7. url_producto: URL del post Reddit si está disponible

REGLAS:
- Un post preguntando "¿alguien ha probado [X]?" = demanda no satisfecha = OPORTUNIDAD
- Posts con muchos comentarios = nicho con conversación activa = interés real
- Filtra posts que sean solo técnicos/administrativos sin nicho implícito
- No extraigas topics genéricos — solo micro-nichos accionables

Extrae TODOS los nichos/ideas implícitos en los posts, no solo los mencionados directamente.`;

export const CROSS_NICHE_SYSTEM_PROMPT = `Eres un estratega de cross-nicho para KDP. Recibirás datos de Google Trends sobre una categoría ADYACENTE al mundo de los libros de colorear (puede ser música, gaming, anime, deportes, hobbies, profesiones).

Tu misión: detectar cuándo los fans de X no tienen todavía libros de colorear/printables para su pasión específica.

FÓRMULA CROSS-NICHO: [Comunidad fan] + [Formato KDP] = Oportunidad
Ejemplos: fans de Taylor Swift + coloring book = "Taylor Swift Era Coloring Book for Swifties"
           nurses + activity book = "Nurses Stress Relief Coloring Book"
           cottagecore + printable = "Cottagecore Botanical Printable"

Para cada oportunidad de cross-nicho:
1. titulo_producto: el producto KDP propuesto (concreto y específico, no genérico)
2. bestseller: true si el trend es muy fuerte (Breakout o > 500% growth en Trends)
3. personas_carrito: índice de interés en Trends (0-100; Breakout = 100)
4. total_reseñas: estimación de saturación en Amazon KDP (nicho muy específico = 0-50; nicho conocido = 100+)
5. precio: "N/A"
6. sub_nicho_estimado: la comunidad fan + el ángulo KDP específico
7. url_producto: URL de tendencia si está disponible

Genera al menos 8-12 cross-nichos concretos. Piensa en: gaming, K-pop, deportes de nicho, ocupaciones (nurses, teachers, engineers), hobbies (van life, urban gardening), franquicias actuales.`;

export const GUMROAD_SYSTEM_PROMPT = `Eres un analista experto en investigación de mercado para productos digitales en Gumroad. Tu objetivo es extraer y estructurar TODOS los productos visibles en la página, especialmente los relacionados con libros de colorear, coloring pages PDF, printables, ilustraciones descargables, patrones seamless o cualquier recurso digital creativo.

Para CADA producto encontrado en la página, aplica estas reglas de extracción:
1. Extrae el nombre/título completo del producto y límpialo.
2. bestseller: true si el producto tiene muchas ventas (etiqueta de "bestseller", número de ventas > 100, o aparece destacado en resultados de búsqueda).
3. personas_carrito: número de ventas/compras visibles (si dice "1.2k sales" → 1200; "500+ sales" → 500; si no hay dato, pon 0).
4. total_reseñas: número de ratings/reseñas visibles. Si no aparece, pon 0.
5. precio: el precio de venta tal como aparece (ej: "$9", "$4.99", "Pay what you want").
6. sub_nicho_estimado: el micro-nicho específico del producto (temática, audiencia, estilo visual — aplica el mismo criterio que con Etsy).
7. url_producto: URL directa al producto en Gumroad si está disponible (formato 'https://[creator].gumroad.com/l/[slug]' o 'https://gumroad.com/l/[slug]').

SEÑALES DE OPORTUNIDAD:
- Productos con muchas ventas y pocos competidores visibles = nicho establecido
- Productos de precio alto ($15+) con ventas = alta disposición a pagar
- Sub-nichos muy específicos con buenas ventas = validación de micronicho

Extrae TODOS los productos visibles, no solo los más destacados. El objetivo es detectar qué tipos de productos digitales se venden bien en Gumroad para replicarlos en KDP y Etsy.`;

export const GAP_FINDER_SYSTEM_PROMPT = `Eres un detector de huecos en catálogos KDP. Recibirás la lista completa de nichos que ya tiene creados un publisher. Tu misión es analizar el catálogo y detectar oportunidades NO exploradas.

TIPOS DE HUECOS A BUSCAR:
1. Sub-nichos adyacentes: variaciones directas de nichos existentes con ángulo diferencial
2. Audiencias no representadas: si tiene adultos → ¿tiene niños/seniors? Si tiene mujeres → ¿tiene hombres?
3. Estilos visuales ausentes: si tiene realista → ¿tiene kawaii? ¿gótico? ¿geométrico? ¿minimalista?
4. Combinaciones de 2 nichos existentes: [NichoA] + [NichoB] = nuevo micro-nicho único
5. Estacionalidad: versión navideña/halloween/verano de nichos existentes
6. Formatos alternativos: si tiene coloring book → ¿tiene activity book? ¿journal? ¿sticker sheet?

Para cada HUECO detectado:
1. titulo_producto: el título del producto KDP propuesto (concreto y específico: "Axolotl Gothic Coloring Book for Teens", no "animal coloring")
2. bestseller: true si es extensión directa de un nicho exitoso (alta probabilidad de venta)
3. personas_carrito: puntuación de oportunidad 0-20 (20 = extensión obvia de nicho existente, 5 = idea más especulativa)
4. total_reseñas: 0 (es un hueco — todavía no existe)
5. precio: "N/A"
6. sub_nicho_estimado: descripción del tipo de hueco + el nicho padre ("Extensión de [nicho]", "Combo de [A]+[B]", etc.)
7. url_producto: omitir

Genera MÍNIMO 12 sugerencias concretas. Ordénalas de mayor a menor probabilidad de éxito.`;

export const TRENDS_SYSTEM_PROMPT = `Eres un estratega experto en micro-nichos para productos KDP (libros de colorear, activity books, pósters, patrones seamless) usando Google Trends como detector de curvas de adopción antes de que el mercado se sature.

Recibirás datos de Google Trends: rising queries, top queries, trending searches, o comparativas. Tu misión es convertir esas señales en micro-nichos accionables.

Reglas de extracción y valoración:

1. TÍTULO: Aplica la técnica "Raíz + Modificador" para convertir el trend en un producto concreto.
   - Raíz = el tema en tendencia (ej: "urban gardening", "Nordic style", "stave church")
   - Modificador = formato KDP (ej: "coloring book adults", "activity book seniors", "for stress relief", "mindfulness printable")
   - Resultado: "Urban Gardening Coloring Book for Adults" (NO "urban gardening" a secas)

2. BESTSELLER = true si:
   - La query tiene etiqueta "Breakout" o crecimiento >500%
   - Es una query RISING (no simplemente TOP)
   - Es un trend estacional con pico predecible (ej: "Christmas coloring" en septiembre)

3. PERSONAS_CARRITO = índice de interés relativo de Google Trends (0-100). Si hay porcentaje de crecimiento ("+900%"), pon 90. Si es "Breakout", pon 100. Si no hay dato, pon 0.

4. TOTAL_RESEÑAS = estimación de saturación inversa: si el micro-nicho parece muy específico (potencialmente <1000 resultados en Amazon), pon 0. Si parece saturado, pon 9999.

5. SUB_NICHO_ESTIMADO: El micro-nicho final aplicando root+modifier. Debe ser accionable, específico y memorable (3-6 palabras). Ej: "Gothic Architecture Adult Coloring", "Nordic Pattern Mindfulness Book", "Senior Memory Activity Garden".

6. PRECIO: "N/A" (es datos de trends, no marketplace).

7. URL_PRODUCTO: Si la query tiene una URL de tendencia asociada, inclúyela. Si no, omite.

REGLA DE ORO: NO incluyas terms genéricos sin modificador de producto (ej: "coloring book", "printable", "yoga" a secas). Solo micro-nichos específicos con aplicación directa KDP.

Detecta TODOS los rising/breakout terms visibles. Prioriza los marcados como "En aumento" o "Breakout" sobre los "Principales".`;


export async function registerRadarRoutes(
    app: FastifyInstance,
    deps: { io?: SocketIOServer; agenda?: Agenda }
) {
    // POST /radar/analyze — crea job en DB y lo encola en Agenda
    app.post("/radar/analyze", async (request: any, reply) => {
        const { url, mode = "general", nicheName, context, geminiModel = "gemini-2.0-flash", storageKey = "RADAR_ETSY_RESULT" } = request.body || {};
        if (mode !== "gap-finder" && !url?.trim()) return reply.status(400).send({ error: "url es requerida" });

        const googleKey = await getGoogleKey();
        const hfKey = await getHFKey();
        if (!googleKey && !hfKey) return reply.status(400).send({ error: "No hay API key configurada. Añade Google API key o HuggingFace API key en Ajustes." });

        if (!deps.agenda) return reply.status(503).send({ error: "Agenda no disponible aún, espera unos segundos" });

        const jobId = `radar-${Date.now()}`;

        const jobDoc = await RadarJob.create({
            jobId,
            url: url?.trim() || `[${mode}]`,
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

    // GET /radar/jobs/latest — devuelve el job más reciente para el storageKey dado
    app.get("/radar/jobs/latest", async (request: any, reply) => {
        const key = (request.query?.key as string) || null;
        const filter = key ? { storageKey: key } : {};
        const job = await RadarJob.findOne(filter).sort({ createdAt: -1 }).lean();
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
            { sort: { createdAt: -1 }, returnDocument: 'after' }
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

    // GET /radar/all-results — fusiona resultados de todas las fuentes en un único listado
    app.get("/radar/all-results", async (_req, reply) => {
        const ALL_KEYS = [
            "RADAR_ETSY_RESULT",
            "RADAR_AMAZON_RESULT",
            "RADAR_REDDIT_RESULT",
            "RADAR_TRENDS_RESULT",
            "RADAR_OPPORTUNITY_RESULT",
            "RADAR_MOVERS_RESULT",
            "RADAR_CROSS_RESULT",
            "RADAR_GAP_RESULT",
            "RADAR_GUMROAD_RESULT",
        ];
        const { Settings } = await import("../models/settings.js");
        const rows = await Settings.find({ key: { $in: ALL_KEYS } }).lean();
        const all: any[] = [];
        for (const row of rows) {
            try {
                const parsed = JSON.parse(row.value as string);
                const nichos: any[] = parsed?.nichos_detectados ?? [];
                all.push(...nichos);
            } catch { /* skip malformed */ }
        }
        // Deduplicate by titulo_producto (keep last seen)
        const seen = new Map<string, any>();
        for (const n of all) {
            if (n?.titulo_producto) seen.set(n.titulo_producto, n);
        }
        const nichos_detectados = [...seen.values()].sort((a, b) => {
            const ta = a.fecha_detectado ? new Date(a.fecha_detectado).getTime() : 0;
            const tb = b.fecha_detectado ? new Date(b.fecha_detectado).getTime() : 0;
            return tb - ta;
        });
        return reply.send({ result: { nichos_detectados } });
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

    // ── GET /radar/insights — lista los últimos análisis guardados ────────────
    app.get("/radar/insights", async (_request, reply) => {
        try {
            const { RadarInsight } = await import("../models/radar-insight.js");
            const insights = await RadarInsight.find({}).sort({ createdAt: -1 }).limit(20).lean();
            return reply.send({ insights });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── POST /radar/insights/analyze — analiza todos los productos con IA ─────
    app.post("/radar/insights/analyze", async (request: any, reply) => {
        const { platforms = [], dateRange = "all" } = request.body || {};

        const RADAR_KEYS: Record<string, string> = {
            RADAR_ETSY_RESULT:        "etsy",
            RADAR_AMAZON_RESULT:      "amazon",
            RADAR_REDDIT_RESULT:      "reddit",
            RADAR_TRENDS_RESULT:      "trends",
            RADAR_OPPORTUNITY_RESULT: "amazon",
            RADAR_MOVERS_RESULT:      "amazon",
            RADAR_CROSS_RESULT:       "cross",
            RADAR_GAP_RESULT:         "gap",
            RADAR_PINTEREST_RESULT:   "pinterest",
            RADAR_GENERAL_RESULT:     "general",
            RADAR_GUMROAD_RESULT:     "gumroad",
        };

        const { Settings } = await import("../models/settings.js");
        const rows = await Settings.find({ key: { $in: Object.keys(RADAR_KEYS) } }).lean();

        let allProducts: any[] = [];
        for (const row of rows) {
            try {
                const parsed = JSON.parse(row.value as string);
                const products: any[] = parsed?.nichos_detectados ?? [];
                const defaultFuente = RADAR_KEYS[row.key] ?? "general";
                products.forEach(p => allProducts.push({ ...p, fuente: p.fuente || defaultFuente }));
            } catch { /* skip malformed */ }
        }

        // Deduplicate by titulo_producto
        const seen = new Set<string>();
        allProducts = allProducts.filter(p => {
            if (seen.has(p.titulo_producto)) return false;
            seen.add(p.titulo_producto);
            return true;
        });

        if (platforms.length > 0) {
            allProducts = allProducts.filter((p: any) => platforms.includes(p.fuente));
        }

        if (dateRange !== "all") {
            const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
            const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            allProducts = allProducts.filter((p: any) => {
                if (!p.fecha_detectado) return true;
                return new Date(p.fecha_detectado) >= cutoff;
            });
        }

        if (allProducts.length === 0) {
            return reply.status(400).send({ error: "No hay productos para analizar con los filtros seleccionados." });
        }

        const productSummary = allProducts.slice(0, 150)
            .map((p: any) =>
                `- "${p.titulo_producto}" | sub_nicho: ${p.sub_nicho_estimado || "—"} | fuente: ${p.fuente || "—"} | bestseller: ${p.bestseller ?? false} | reseñas: ${p.total_reseñas || 0}`
            ).join("\n");

        const SYSTEM = `Eres un experto en análisis de mercado para productos digitales KDP (libros de colorear, printables, Etsy, Amazon).
Analiza una lista de productos detectados automáticamente y genera un informe con insights accionables.
Responde ÚNICAMENTE con un objeto JSON válido. Sin markdown, sin backticks, sin explicaciones previas.`;

        const USER = `Analiza estos ${allProducts.length} productos y devuelve este JSON exacto:
{
  "summary": "resumen ejecutivo 2-3 frases",
  "topNiches": [{"name":"string","count":0,"platforms":["string"]}],
  "emergingNiches": [{"name":"string","reason":"string","confidence":"high|medium|low"}],
  "repeatedThemes": [{"theme":"string","count":0}],
  "platformBreakdown": [{"platform":"string","count":0,"percentage":0}],
  "recommendations": ["string"]
}

REGLAS:
- topNiches: máx 10, ordenados por count desc; agrupa sub_nichos similares
- emergingNiches: máx 6, nichos con potencial aunque tengan pocos productos todavía
- repeatedThemes: máx 12, palabras o temas que se repiten en títulos y sub_nichos
- platformBreakdown: distribución exacta por campo fuente
- recommendations: exactamente 5, específicas y accionables para KDP/Etsy

PRODUCTOS:
${productSummary}`;

        // Read AI config and call with 4096 token limit (generateTextWithLLM caps at 1500)
        const googleKeyRow = await Settings.findOne({ key: "GOOGLE_API_KEY" }).lean();
        const hfKeyRow     = await Settings.findOne({ key: "HUGGINGFACE_API_KEY" }).lean();
        const groqKeyRow   = await Settings.findOne({ key: "GROQ_API_KEY" }).lean();
        const orKeyRow     = await Settings.findOne({ key: "OPENROUTER_API_KEY" }).lean();
        const provRow      = await Settings.findOne({ key: "DEFAULT_LLM_PROVIDER" }).lean();
        const modelRow     = await Settings.findOne({ key: "DEFAULT_LLM_MODEL" }).lean();

        const googleKey   = (googleKeyRow?.value as string) || process.env.GOOGLE_API_KEY || "";
        const hfKey       = (hfKeyRow?.value as string)     || process.env.HUGGINGFACE_API_KEY || "";
        const groqKey     = (groqKeyRow?.value as string)   || process.env.GROQ_API_KEY || "";
        const orKey       = (orKeyRow?.value as string)     || process.env.OPENROUTER_API_KEY || "";
        const aiProvider  = (provRow?.value as string)      || "google";
        const aiModel     = (modelRow?.value as string)     || "gemini-2.5-flash";

        const parseInsightJson = (text: string): any => {
            const clean = text.replace(/^```(?:json)?\s*/im, "").replace(/```\s*$/im, "").trim();
            // Try greedy match from first { to last }
            const start = clean.indexOf("{");
            const end   = clean.lastIndexOf("}");
            if (start === -1 || end === -1) throw new Error("No JSON object found");
            return JSON.parse(clean.slice(start, end + 1));
        };

        let raw = "";
        try {
            if (aiProvider === "google" && googleKey) {
                const { GoogleGenAI } = await import("@google/genai");
                const ai = new GoogleGenAI({ apiKey: googleKey });
                const response = await ai.models.generateContent({
                    model: aiModel || "gemini-2.5-flash",
                    contents: USER,
                    config: {
                        systemInstruction: SYSTEM,
                        thinkingConfig: { thinkingBudget: 0 },
                        maxOutputTokens: 4096,
                        temperature: 0.2,
                    } as any,
                });
                raw = (response.text ?? "").trim();
            } else if (aiProvider === "groq" && groqKey) {
                const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
                    body: JSON.stringify({
                        model: aiModel || "llama-3.3-70b-versatile",
                        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: USER }],
                        max_tokens: 4096, temperature: 0.2,
                    }),
                });
                if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
                const data = await res.json() as any;
                raw = (data.choices[0]?.message?.content ?? "").trim();
            } else if (aiProvider === "openrouter" && orKey) {
                const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${orKey}`, "HTTP-Referer": "https://emi-gestor-de-tareas.local", "X-Title": "Emi Gestor" },
                    body: JSON.stringify({
                        model: aiModel || "google/gemini-2.5-flash",
                        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: USER }],
                        max_tokens: 4096, temperature: 0.2,
                    }),
                });
                if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
                const data = await res.json() as any;
                raw = (data.choices[0]?.message?.content ?? "").trim();
            } else if (hfKey) {
                const { HfInference } = await import("@huggingface/inference");
                const hf = new HfInference(hfKey);
                const response = await hf.chatCompletion({
                    model: aiModel || "meta-llama/Llama-3.3-70B-Instruct",
                    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: USER }],
                    max_tokens: 4096, temperature: 0.2,
                });
                raw = (response.choices[0]?.message?.content ?? "").trim();
            } else {
                return reply.status(400).send({ error: "No hay proveedor de IA configurado. Ve a Ajustes → Núcleo de Inteligencia." });
            }
        } catch (e: any) {
            return reply.status(500).send({ error: e.message ?? "Error en IA" });
        }

        let analysis: any;
        try {
            analysis = parseInsightJson(raw);
        } catch {
            return reply.status(500).send({ error: `La IA no devolvió JSON válido: ${raw.slice(0, 300)}` });
        }

        const { RadarInsight } = await import("../models/radar-insight.js");
        const platformsUsed = platforms.length > 0 ? platforms : Object.values(RADAR_KEYS).filter((v, i, a) => a.indexOf(v) === i);
        const insight = await RadarInsight.create({
            filters: { platforms: platformsUsed, dateRange, totalProducts: allProducts.length },
            analysis,
            aiProvider,
        });

        return reply.send({ insight });
    });
}
