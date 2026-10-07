import type { FastifyInstance } from "fastify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AUTHORIZED_EMAIL, generateJWT } from "../lib/auth.js";
import {
    DICTIONARY, IMAGE_MODELS, LIMITS, PHASE_REQUIREMENTS, keysOf,
    NICHE_STATUS, LEVEL, PRODUCT_TYPE, STYLE_CATEGORY, PHASE, CATALOG_STATUS, LISTING_LANGUAGE,
} from "./dictionaries.js";

// Las tools no reimplementan lógica: llaman a las rutas existentes dentro del
// mismo proceso (app.inject), así heredan validación, dedupe, colas y eventos
// de Socket.IO. El token interno pasa el mismo middleware JWT que el frontend.

const MAX_RESULT_CHARS = 24_000;

type ToolResult = { content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>; isError?: boolean };

function text(data: unknown): ToolResult {
    let out = typeof data === "string" ? data : JSON.stringify(data, null, 1);
    if (out.length > MAX_RESULT_CHARS) out = `${out.slice(0, MAX_RESULT_CHARS)}\n… [recortado: usa filtros o un límite menor]`;
    return { content: [{ type: "text", text: out }] };
}

function fail(message: string): ToolResult {
    return { content: [{ type: "text", text: message }], isError: true };
}

class ApiError extends Error {}

const PHASE_ORDER = keysOf(PHASE);

/** Requisito que cumple (o no) un nicho para poder estar en cada fase. */
const PHASE_CHECKS: Record<string, (n: any) => boolean> = {
    niche: () => true,
    catalog: n => !!n.pipelineHasCatalogs || (n.catalogIds?.length ?? 0) > 0,
    libro: n => !!n.pipelineHasPdf || !!n.bookPdfUrl,
    seo: n => !!n.pipelineHasListings || (n.listings?.length ?? 0) > 0,
    cover: n => !!n.pipelineHasCover || !!n.coverUrl,
    published: n => !!n.asin,
};

/** Fases cuyo requisito aún no cumple el nicho, en orden. */
function missingFor(n: any): string[] {
    return PHASE_ORDER.filter(p => !PHASE_CHECKS[p](n));
}

function nicheSummary(n: any) {
    return {
        id: String(n._id),
        name: n.name,
        status: n.status,
        phase: n.phase,
        productType: n.productType,
        styleCategories: n.styleCategories,
        score: n.score ?? null,
        demand: n.demand,
        competition: n.competition,
        asin: n.asin || null,
        lifecycleStage: n.lifecycleStage ?? null,
        catalogs: n.catalogIds?.length ?? 0,
        listings: n.listings?.length ?? 0,
        falta: missingFor(n),
        autoPilotEnabled: !!n.autoPilotEnabled,
        createdAt: n.createdAt,
    };
}

function catalogSummary(c: any) {
    return {
        id: String(c._id),
        name: c.name,
        status: c.status,
        images: `${c.images?.length ?? 0}/${c.totalImages}`,
        model: c.aiModel?.name,
        nicheIds: c.nicheIds,
        lastError: c.lastError || null,
        createdAt: c.createdAt,
    };
}

export function buildMcpServer(app: FastifyInstance): McpServer {
    const server = new McpServer(
        { name: "kdp-factory", version: "1.0.0" },
        {
            instructions:
                "Gestor de libros de colorear para Amazon KDP de un único usuario.\n"
                + "Modelo de datos: un NICHO es una idea de libro; tiene CATÁLOGOS (tandas de imágenes generadas "
                + "por IA) y LISTINGS SEO (título, subtítulo, descripción, 7 keywords). Cada nicho avanza por las "
                + "fases niche → catalog → libro → seo → cover → published.\n"
                + "Para situarte: resumen_general da la foto completa; obtener_diccionario da los valores válidos "
                + "de cada parámetro, los requisitos de cada fase y el orden de tools por objetivo. En cada nicho, "
                + "el campo `falta` lista las fases cuyo requisito aún no cumple.\n"
                + "Reglas: la generación de imágenes es asíncrona (lanzar_catalogo devuelve ids; el progreso se ve "
                + "con listar_catalogos) y consume cuota, confirma antes de lanzarla. El PDF interior, la portada y "
                + "la publicación en KDP se hacen fuera del MCP: no las des por hechas, comprueba `falta`. Las "
                + "ventas solo reflejan los CSV de KDP importados; si no hay periodos, dilo en vez de estimar.",
        },
    );

    const api = async (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown): Promise<any> => {
        const res = await app.inject({
            method,
            url,
            headers: { authorization: `Bearer ${generateJWT(AUTHORIZED_EMAIL)}` },
            ...(payload !== undefined ? { payload: payload as object } : {}),
        });
        let body: any;
        try { body = res.json(); } catch { body = res.body; }
        if (res.statusCode >= 400) {
            throw new ApiError(`${method} ${url} → ${res.statusCode}: ${typeof body === "string" ? body.slice(0, 300) : body?.error ?? JSON.stringify(body).slice(0, 300)}`);
        }
        return body;
    };

    const run = <A>(fn: (args: A) => Promise<ToolResult>) => async (args: A): Promise<ToolResult> => {
        try {
            return await fn(args);
        } catch (e: any) {
            if (e instanceof ApiError) return fail(e.message);
            throw e;
        }
    };

    const readOnly = { readOnlyHint: true, openWorldHint: false };
    // Los ids se interpolan en rutas internas que llevan un token con todos los
    // permisos: se exige ObjectId para que no puedan contener "/" ni "..".
    const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Debe ser un id de 24 caracteres hexadecimales");
    const nicheId = objectId.describe("id del nicho (campo id de listar_nichos)");
    const catalogId = objectId.describe("id del catálogo (campo id de listar_catalogos)");

    // ── Contexto ─────────────────────────────────────────────────────────────

    server.registerTool("obtener_diccionario", {
        description: "Valores válidos de todos los parámetros (estados, fases, estilos, modelos de imagen, límites) y el orden recomendado de tools para cada objetivo. Llamar una vez al empezar.",
        inputSchema: {},
        annotations: readOnly,
    }, run(async () => text(DICTIONARY)));

    server.registerTool("resumen_general", {
        description: "Foto completa del negocio: nichos por fase y estado, catálogos por estado, cola de generación, nichos listos para avanzar de fase y nichos atascados. Empieza por aquí cuando el usuario pregunte cómo va todo o qué hacer ahora.",
        inputSchema: {},
        annotations: readOnly,
    }, run(async () => {
        const [{ niches }, { catalogs }] = await Promise.all([api("GET", "/niches"), api("GET", "/catalogs")]);
        const count = (rows: any[], key: string) => rows.reduce((acc: Record<string, number>, r) => {
            const k = r[key] ?? "sin dato"; acc[k] = (acc[k] ?? 0) + 1; return acc;
        }, {});
        const brief = (n: any) => ({ id: String(n._id), name: n.name, phase: n.phase });
        const ns = niches as any[], cs = catalogs as any[];
        const next = (n: any) => PHASE_ORDER[PHASE_ORDER.indexOf(n.phase) + 1];
        return text({
            nichos: { total: ns.length, por_fase: count(ns, "phase"), por_estado: count(ns, "status") },
            catalogos: {
                total: cs.length,
                por_estado: count(cs, "status"),
                imagenes_generadas: cs.reduce((a, c) => a + (c.images?.length ?? 0), 0),
                en_cola_o_en_curso: cs.filter(c => ["queued", "pending", "running"].includes(c.status)).map(catalogSummary),
                fallidos_recientes: cs.filter(c => c.status === "failed").slice(0, 10).map(catalogSummary),
            },
            listos_para_avanzar: ns.filter(n => next(n) && PHASE_CHECKS[next(n)](n)).slice(0, 25).map(n => ({ ...brief(n), siguiente: next(n) })),
            con_catalogos_sin_seo: ns.filter(n => PHASE_CHECKS.catalog(n) && !PHASE_CHECKS.seo(n)).slice(0, 25).map(brief),
            publicados_sin_asin: ns.filter(n => n.phase === "published" && !n.asin).slice(0, 25).map(brief),
        });
    }));

    // ── Nichos ───────────────────────────────────────────────────────────────

    server.registerTool("listar_nichos", {
        description: "Lista resumida de nichos (sin los descartados). Sirve para no duplicar y para elegir sobre cuál actuar.",
        inputSchema: {
            status: z.enum(keysOf(NICHE_STATUS)).optional(),
            phase: z.enum(keysOf(PHASE)).optional(),
            buscar: z.string().optional().describe("Texto contenido en el nombre o los tags"),
            limite: z.number().int().min(1).max(200).default(50),
        },
        annotations: readOnly,
    }, run(async ({ status, phase, buscar, limite }) => {
        const { niches } = await api("GET", "/niches");
        const q = buscar?.toLowerCase();
        const rows = (niches as any[])
            .filter(n => !status || n.status === status)
            .filter(n => !phase || n.phase === phase)
            .filter(n => !q || n.name?.toLowerCase().includes(q) || n.tags?.some((t: string) => t.toLowerCase().includes(q)));
        return text({ total: rows.length, nichos: rows.slice(0, limite).map(nicheSummary) });
    }));

    server.registerTool("ver_nicho", {
        description: "Detalle de un nicho: descripción, tags, prompt, último escaneo de mercado, listings SEO, regalías y sus catálogos.",
        inputSchema: { nicheId },
        annotations: readOnly,
    }, run(async ({ nicheId }) => {
        const [{ niches }, { catalogs }] = await Promise.all([
            api("GET", "/niches"),
            api("GET", `/catalogs?nicheId=${encodeURIComponent(nicheId)}`),
        ]);
        const n = (niches as any[]).find(x => String(x._id) === nicheId);
        if (!n) return fail(`No existe un nicho con id ${nicheId} (o está descartado)`);
        return text({
            ...nicheSummary(n),
            description: n.description,
            tags: n.tags,
            notes: n.notes,
            targetAudience: n.targetAudience ?? null,
            generatedPrompt: n.generatedPrompt,
            scoreBreakdown: n.scoreBreakdown ?? null,
            scoreReason: n.scoreReason ?? null,
            artefactos: { pdf: n.bookPdfUrl || null, portada: n.coverUrl || null, imagen_muestra: n.sampleImageUrl || null },
            marketScan: n.marketScan ?? null,
            saturation: n.saturationLabel ? { label: n.saturationLabel, score: n.saturationScore } : null,
            currentPrice: n.currentPrice ?? null,
            royalties: n.royalties ?? [],
            listings: (n.listings ?? []).map((l: any) => ({
                id: String(l._id), language: l.language, platform: l.platform, title: l.title, subtitle: l.subtitle,
                keywords: l.keywords, categories: l.categories, appliedAt: l.appliedAt ?? null, description: l.description,
            })),
            catalogos: (catalogs as any[]).map(catalogSummary),
        });
    }));

    server.registerTool("crear_nicho", {
        description: "Crea un nicho nuevo. Si ya existe uno con el mismo nombre devuelve el existente (duplicate=true) sin crear nada.",
        inputSchema: {
            name: z.string().min(3).describe("Nombre corto y vendible del nicho"),
            description: z.string().default("").describe("Qué es, para quién y por qué tiene hueco"),
            tags: z.array(z.string()).default([]),
            productType: z.enum(keysOf(PRODUCT_TYPE)).default("coloring-book"),
            styleCategories: z.array(z.enum(keysOf(STYLE_CATEGORY))).min(1).default(["generic"]),
            demand: z.enum(keysOf(LEVEL)).default("unknown"),
            competition: z.enum(keysOf(LEVEL)).default("unknown"),
            notes: z.string().default("").describe("Evidencia usada: keywords escaneadas, competidores, tendencia"),
            puntuar: z.boolean().default(true).describe("Calcular y guardar el score 0-100 con la IA del backend"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, run(async ({ puntuar, ...body }) => {
        const { niche, duplicate } = await api("POST", "/niches", { ...body, status: "found" });
        let score: unknown = null;
        if (puntuar && !duplicate) {
            // El score es un extra: si la IA del backend falla, el nicho ya está creado.
            score = await api("POST", "/ai/score-niche", {
                nicheId: String(niche._id), name: body.name, tags: body.tags, competition: body.competition,
                demand: body.demand, productType: body.productType, styleCategory: body.styleCategories[0], description: body.description,
            }).catch((e: Error) => ({ error: e.message }));
        }
        return text({ duplicate: !!duplicate, nicho: nicheSummary(niche), score });
    }));

    server.registerTool("actualizar_nicho", {
        description: "Modifica campos de un nicho. Solo se cambian los campos enviados. status=discarded lo saca de los listados.",
        inputSchema: {
            nicheId,
            name: z.string().min(3).optional(),
            description: z.string().optional(),
            tags: z.array(z.string()).optional(),
            status: z.enum(keysOf(NICHE_STATUS)).optional(),
            demand: z.enum(keysOf(LEVEL)).optional(),
            competition: z.enum(keysOf(LEVEL)).optional(),
            styleCategories: z.array(z.enum(keysOf(STYLE_CATEGORY))).min(1).optional(),
            notes: z.string().optional(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, run(async ({ nicheId, ...changes }) => {
        if (Object.keys(changes).length === 0) return fail("No se envió ningún campo a cambiar");
        const { niche } = await api("PATCH", `/niches/${nicheId}`, changes);
        return text({ nicho: nicheSummary(niche) });
    }));

    server.registerTool("avanzar_fase", {
        description: "Cambia la fase de un nicho. Sin `fase` pasa a la siguiente. Se rechaza si el nicho no cumple el requisito de la fase destino (ver requisitos_fase en el diccionario), salvo forzar=true. Solo cambia el estado: no genera nada ni dispara el autopilot.",
        inputSchema: {
            nicheId,
            fase: z.enum(PHASE_ORDER).optional().describe("Fase destino. Si se omite, la siguiente a la actual"),
            forzar: z.boolean().default(false).describe("Saltarse la comprobación de requisitos. Solo si el usuario lo pide"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, run(async ({ nicheId, fase, forzar }) => {
        const { niches } = await api("GET", "/niches");
        const n = (niches as any[]).find(x => String(x._id) === nicheId);
        if (!n) return fail(`No existe un nicho con id ${nicheId} (o está descartado)`);
        const target = fase ?? PHASE_ORDER[PHASE_ORDER.indexOf(n.phase) + 1];
        if (!target) return fail(`"${n.name}" ya está en la última fase (${n.phase})`);
        if (target === n.phase) return text({ sin_cambios: true, nicho: nicheSummary(n) });
        if (!forzar && !PHASE_CHECKS[target](n)) {
            return fail(`"${n.name}" no puede pasar a "${target}". Requisito: ${PHASE_REQUIREMENTS[target]}`);
        }
        const { niche } = await api("PATCH", `/niches/${nicheId}`, { phase: target });
        return text({ de: n.phase, a: target, forzado: forzar, nicho: nicheSummary(niche) });
    }));

    // ── Mercado ──────────────────────────────────────────────────────────────

    server.registerTool("escanear_mercado", {
        description: "Escanea Amazon (.com y .es) para una keyword: número de resultados, sugerencias de autocompletado y score de oportunidad. No guarda nada. Los datos salen de scraping y pueden venir incompletos (ok=false por marketplace).",
        inputSchema: {
            keyword: z.string().min(3).describe("Búsqueda en inglés tal como la haría un comprador, p. ej. 'axolotl coloring book for kids'"),
            keywordEs: z.string().optional().describe("Equivalente en español para amazon.es"),
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, run(async (body) => text(await api("POST", "/niches/market-scan", body))));

    server.registerTool("tendencias", {
        description: "Señales de tendencia cacheadas (bestsellers de Amazon y similares). refrescar=true las vuelve a descargar, tarda más.",
        inputSchema: { refrescar: z.boolean().default(false) },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, run(async ({ refrescar }) => text(await api(refrescar ? "POST" : "GET", refrescar ? "/trends/refresh" : "/trends/signals"))));

    // ── Catálogos (generación de imágenes) ───────────────────────────────────

    server.registerTool("lanzar_catalogo", {
        description: "Encola generación de imágenes para un nicho. modo=rapido crea 1 catálogo con el prompt y el modelo del autopilot. modo=explotar crea varios catálogos, cada uno con una escena distinta del mismo nicho. Es asíncrono y consume cuota del proveedor de imagen: confirma con el usuario antes de lanzarlo.",
        inputSchema: {
            nicheId,
            modo: z.enum(["rapido", "explotar"]).default("rapido"),
            catalogos: z.number().int().min(LIMITS.explotar_catalogos.min).max(LIMITS.explotar_catalogos.max).default(LIMITS.explotar_catalogos.defecto)
                .describe("Solo modo=explotar: cuántos catálogos crear"),
            imagenesPorCatalogo: z.number().int().min(LIMITS.catalogo_imagenes.min).max(LIMITS.catalogo_imagenes.max).default(LIMITS.catalogo_imagenes.defecto)
                .describe("Solo modo=explotar"),
            escenas: z.array(z.string()).default([]).describe("Solo modo=explotar: escenas concretas a forzar, una por catálogo; el resto las inventa la IA"),
            modelo: z.enum(keysOf(IMAGE_MODELS)).optional().describe("Solo modo=explotar. Si se omite usa el modelo con el que se aprobó el nicho"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, run(async ({ nicheId, modo, catalogos, imagenesPorCatalogo, escenas, modelo }) => {
        if (modo === "rapido") {
            const r = await api("POST", `/autopilot/quick-catalog/${nicheId}`, {});
            return text({ modo, catalogo: r.catalog ? catalogSummary(r.catalog) : r });
        }
        let model: Record<string, string> | undefined;
        if (modelo) {
            const { nota: _nota, ...aiModel } = IMAGE_MODELS[modelo];
            model = aiModel;
        }
        const r = await api("POST", `/niches/${nicheId}/explode-catalogs`, { count: catalogos, imagesPerCatalog: imagenesPorCatalogo, hints: escenas, model });
        return text({ modo, escenas: r.situations, catalogos: (r.catalogs as any[]).map(catalogSummary) });
    }));

    server.registerTool("listar_catalogos", {
        description: "Catálogos con su progreso (imágenes hechas / total) y último error.",
        inputSchema: {
            nicheId: nicheId.optional(),
            status: z.enum(keysOf(CATALOG_STATUS)).optional(),
            limite: z.number().int().min(1).max(100).default(30),
        },
        annotations: readOnly,
    }, run(async ({ nicheId, status, limite }) => {
        const { catalogs } = await api("GET", `/catalogs${nicheId ? `?nicheId=${encodeURIComponent(nicheId)}` : ""}`);
        const rows = (catalogs as any[]).filter(c => !status || c.status === status);
        return text({ total: rows.length, catalogos: rows.slice(0, limite).map(catalogSummary) });
    }));

    server.registerTool("ver_imagenes_catalogo", {
        description: "URLs de las imágenes ya generadas de un catálogo, para revisarlas.",
        inputSchema: { catalogId },
        annotations: readOnly,
    }, run(async ({ catalogId }) => {
        const { catalog } = await api("GET", `/catalogs/${catalogId}`);
        return text({ ...catalogSummary(catalog), prompt: catalog.prompt, imagenes: (catalog.images ?? []).map((i: any) => i.url) });
    }));

    server.registerTool("cancelar_catalogo", {
        description: "Cancela un catálogo en cola o en curso. Las imágenes ya generadas se conservan.",
        inputSchema: { catalogId },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    }, run(async ({ catalogId }) => text(await api("POST", `/catalogs/${catalogId}/cancel`, {}))));

    // ── SEO ──────────────────────────────────────────────────────────────────

    server.registerTool("generar_seo", {
        description: "Genera y guarda un listing SEO (título, subtítulo, descripción, 7 keywords, categorías) con el motor del backend, que cruza autocompletado de Amazon y títulos de competidores. Puede tardar más de un minuto.",
        inputSchema: {
            nicheId,
            language: z.enum(keysOf(LISTING_LANGUAGE)).default("en"),
            indicaciones: z.string().optional().describe("Ángulo o términos a priorizar"),
            referenceUrl: z.url().optional().describe("URL de un libro competidor a tomar como referencia"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, run(async ({ nicheId, language, indicaciones, referenceUrl }) => {
        const r = await api("POST", `/niches/${nicheId}/listings`, { generate: true, language, seoAnnotation: indicaciones, referenceUrl });
        const listings = r.niche?.listings ?? [];
        return text({ listing: r.listing ?? listings[listings.length - 1] ?? r });
    }));

    server.registerTool("guardar_seo", {
        description: `Guarda un listing SEO redactado por ti, sin pasar por la IA del backend. KDP: título + subtítulo ≤ ${LIMITS.kdp_titulo_mas_subtitulo_max_caracteres} caracteres, ${LIMITS.kdp_keywords.cantidad} keywords de ≤ ${LIMITS.kdp_keywords.max_caracteres} caracteres.`,
        inputSchema: {
            nicheId,
            title: z.string().min(5),
            subtitle: z.string().default(""),
            description: z.string().min(50),
            keywords: z.array(z.string().max(LIMITS.kdp_keywords.max_caracteres)).length(LIMITS.kdp_keywords.cantidad),
            language: z.enum(keysOf(LISTING_LANGUAGE)).default("en"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, run(async ({ nicheId, ...listing }) => {
        if (listing.title.length + listing.subtitle.length > LIMITS.kdp_titulo_mas_subtitulo_max_caracteres) {
            return fail(`Título + subtítulo suman ${listing.title.length + listing.subtitle.length} caracteres; KDP admite ${LIMITS.kdp_titulo_mas_subtitulo_max_caracteres}`);
        }
        const r = await api("POST", `/niches/${nicheId}/listings`, listing);
        const listings = r.niche?.listings ?? [];
        return text({ guardado: true, listings: listings.length });
    }));

    server.registerTool("marcar_seo_aplicado", {
        description: "Marca un listing como el que está puesto ahora en KDP (fecha de hoy). Úsalo solo cuando el usuario confirme que lo ha pegado en KDP.",
        inputSchema: { nicheId, listingId: objectId.describe("id del listing (ver_nicho → listings[].id)") },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, run(async ({ nicheId, listingId }) => {
        await api("PATCH", `/niches/${nicheId}/listings/${listingId}/apply`, {});
        return text({ aplicado: true, nicheId, listingId });
    }));

    server.registerTool("rastrear_seo", {
        description: "Mide ahora la posición del libro en Amazon para sus keywords (requiere que el nicho tenga ASIN) y devuelve el histórico.",
        inputSchema: { nicheId },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, run(async ({ nicheId }) => {
        const actual = await api("POST", `/niches/${nicheId}/seo-track`, {});
        const historico = await api("GET", `/niches/${nicheId}/seo-history`).catch(() => null);
        return text({ actual, historico });
    }));

    // ── Informes ─────────────────────────────────────────────────────────────

    server.registerTool("informe_ventas", {
        description: "Unidades y regalías (USD) por periodo y por libro. Solo contiene lo importado desde los CSV de KDP: si el último periodo es antiguo, los datos están desactualizados y hay que decirlo.",
        inputSchema: {
            period: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("AAAA-MM. Si se omite devuelve todos los periodos"),
            nicheId: nicheId.optional(),
        },
        annotations: readOnly,
    }, run(async ({ period, nicheId }) => {
        const qs = new URLSearchParams({ limit: "1000", ...(period ? { period } : {}), ...(nicheId ? { nicheId } : {}) });
        const [{ sales, summary }, periods] = await Promise.all([api("GET", `/kdp-sales?${qs}`), api("GET", "/kdp-sales/periods")]);
        const byBook = new Map<string, { asin: string; title: string; nicheId: string | null; units: number; royaltiesUsd: number }>();
        for (const s of sales as any[]) {
            const b = byBook.get(s.asin) ?? { asin: s.asin, title: s.title, nicheId: s.nicheId ?? null, units: 0, royaltiesUsd: 0 };
            b.units += s.unitsSold ?? 0;
            b.royaltiesUsd += s.royaltiesUsd ?? 0;
            byBook.set(s.asin, b);
        }
        const libros = [...byBook.values()].sort((a, b) => b.royaltiesUsd - a.royaltiesUsd).map(b => ({ ...b, royaltiesUsd: Math.round(b.royaltiesUsd * 100) / 100 }));
        return text({ periodos_importados: periods, por_periodo: summary, libros });
    }));

    server.registerTool("importar_ventas_csv", {
        description: "Importa un informe de regalías de KDP en CSV (texto pegado). Reimportar el mismo periodo actualiza las filas existentes.",
        inputSchema: {
            csv: z.string().min(20).describe("Contenido del CSV, con la fila de cabeceras que incluye ASIN"),
            period: z.string().regex(/^\d{4}-\d{2}$/).describe("Periodo al que corresponde, AAAA-MM"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, run(async (body) => text(await api("POST", "/kdp-sales/import", body))));

    server.registerTool("informe_actividad", {
        description: "Producción por día (nichos creados, catálogos, imágenes) y rendimiento por cohortes de publicación.",
        inputSchema: { dias: z.number().int().min(1).max(90).default(30) },
        annotations: readOnly,
    }, run(async ({ dias }) => {
        const [series, cohortes] = await Promise.all([
            api("GET", `/insights/timeseries?days=${dias}`),
            api("GET", "/niches/cohorts").catch(() => null),
        ]);
        return text({ series, cohortes });
    }));

    server.registerTool("estado_pipeline", {
        description: "Foto del sistema ahora: fase de cada nicho en el pipeline, cola de catálogos y estado del autopilot.",
        inputSchema: {},
        annotations: readOnly,
    }, run(async () => {
        const [pipeline, autopilot, { catalogs }] = await Promise.all([
            api("GET", "/pipeline/status"),
            api("GET", "/autopilot/status"),
            api("GET", "/catalogs?limit=200"),
        ]);
        const activos = (catalogs as any[]).filter(c => ["queued", "pending", "running"].includes(c.status)).map(catalogSummary);
        return text({ autopilot, cola_catalogos: activos, pipeline });
    }));

    // ── Control ──────────────────────────────────────────────────────────────

    server.registerTool("parada_emergencia", {
        description: "Detiene el autopilot y cancela toda la cola de generación. Úsalo solo si el usuario lo pide de forma explícita.",
        inputSchema: {},
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    }, run(async () => text(await api("POST", "/autopilot/emergency-stop", {}))));

    return server;
}
