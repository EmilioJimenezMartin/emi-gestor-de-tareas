import type { Agenda, Job } from "agenda";
import { RadarJob } from "../models/radar-job.js";
import { EtsyNicheResultSchema, NicheInsightSchema, ETSY_SYSTEM_PROMPT, AMAZON_SYSTEM_PROMPT, TRENDS_SYSTEM_PROMPT, OPPORTUNITY_SYSTEM_PROMPT, MOVERS_SYSTEM_PROMPT, REDDIT_SYSTEM_PROMPT, CROSS_NICHE_SYSTEM_PROMPT, GAP_FINDER_SYSTEM_PROMPT } from "../routes/radar.js";
import { analyzePageForRadar } from "../lib/ai.js";
import { AUTOPILOT_JOB_NAME } from "./autopilot.js";

export const RADAR_JOB_NAME = "run-radar-analysis";

// Compute a 0–100 score from raw radar product data
function computeNicheScore(product: any): number {
    let score = 40; // base
    if (product.bestseller) score += 25;
    const reviews = parseInt(String(product.total_reseñas ?? "0").replace(/[^\d]/g, "")) || 0;
    if (reviews > 10_000) score += 20;
    else if (reviews > 5_000) score += 15;
    else if (reviews > 1_000) score += 10;
    else if (reviews > 100) score += 5;
    const cart = parseInt(String(product.personas_carrito ?? "0").replace(/[^\d]/g, "")) || 0;
    if (cart > 100) score += 15;
    else if (cart > 20) score += 10;
    else if (cart > 5) score += 5;
    return Math.min(score, 100);
}

// Inverted scoring: rewards high demand (cart) + low competition (few reviews)
function computeOpportunityScore(product: any): number {
    let score = 25;
    const reviews = parseInt(String(product.total_reseñas ?? "0").replace(/[^\d]/g, "")) || 0;
    const cart = parseInt(String(product.personas_carrito ?? "0").replace(/[^\d]/g, "")) || 0;
    if (cart > 100) score += 35;
    else if (cart > 20) score += 25;
    else if (cart > 10) score += 15;
    else if (cart > 5) score += 10;
    else if (cart > 0) score += 5;
    // Inverted reviews: fewer = more opportunity
    if (reviews === 0 && cart > 0) score += 30;
    else if (reviews < 20) score += 25;
    else if (reviews < 100) score += 15;
    else if (reviews < 500) score += 5;
    if (product.bestseller) score += 5;
    return Math.min(score, 100);
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Returns true if the error is a permanent free-tier exhaustion (limit: 0)
function isHardQuota(err: any): boolean {
    const msg: string = err?.message ?? err?.toString() ?? "";
    return /limit:\s*0/i.test(msg);
}

// Extracts retry delay from Gemini messages like "retry in 26.2s"
function parseRetryMs(err: any): number | null {
    const msg: string = err?.message ?? err?.toString() ?? "";
    const match = msg.match(/retry in ([0-9.]+)s/i);
    if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 2000;
    if (/quota exceeded|rate limit|429/i.test(msg)) return 45000;
    return null;
}

async function runWithRetry<T>(fn: () => Promise<T>, onWait: (secs: number, attempt: number) => void, maxRetries = 1): Promise<T> {
    let lastErr: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            if (isHardQuota(err)) throw err; // quota diaria agotada — no tiene sentido reintentar
            const waitMs = parseRetryMs(err);
            if (waitMs !== null && attempt < maxRetries) {
                onWait(Math.round(waitMs / 1000), attempt + 1);
                await delay(waitMs);
                lastErr = err;
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

const LISTING_MODES = new Set(["etsy-niches", "amazon-niches", "trends-niches", "opportunity", "amazon-movers", "reddit-niches", "cross-niche", "gap-finder"]);

function buildRadarSystemPrompt(mode: string, nicheName?: string, context?: string): string {
    const isListingMode = LISTING_MODES.has(mode);
    const schemaHint = isListingMode
        ? `{"nichos_detectados":[{"titulo_producto":"string","precio":"string","bestseller":true/false,"personas_carrito":number,"total_reseñas":number,"sub_nicho_estimado":"string","url_producto":"string|undefined"}]}`
        : `{"niche":"string","competition":"low|medium|high","demand":"low|medium|high","trend":"rising|stable|declining","topKeywords":["string"],"priceRange":"string","topCompetitors":["string"],"entryOpportunity":"string","buyerProfile":"string","summary":"string"}`;

    if (mode === "amazon-niches" || mode === "amazon-movers") return `${mode === "amazon-movers" ? MOVERS_SYSTEM_PROMPT : AMAZON_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n${schemaHint}`;
    if (mode === "etsy-niches") return `${ETSY_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n${schemaHint}`;
    if (mode === "opportunity") return `${OPPORTUNITY_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n${schemaHint}`;
    if (mode === "trends-niches") return `${TRENDS_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n${schemaHint}`;
    if (mode === "reddit-niches") return `${REDDIT_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n${schemaHint}`;
    if (mode === "cross-niche") return `${CROSS_NICHE_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n${schemaHint}`;
    if (mode === "gap-finder") return `${GAP_FINDER_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n${schemaHint}`;
    return [
        nicheName ? `Niche objetivo: "${nicheName}".` : "",
        context ? `Contexto adicional: ${context}.` : "",
        `Analiza la página de marketplace. Responde ÚNICAMENTE con JSON válido sin markdown:\n${schemaHint}`,
    ].filter(Boolean).join(" ");
}

async function getActiveProvider(): Promise<string> {
    try {
        const { Settings } = await import("../models/settings.js");
        const row = await Settings.findOne({ key: "DEFAULT_LLM_PROVIDER" }).lean();
        return (row as any)?.value ?? "google";
    } catch { return "google"; }
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

function pushLog(jobDoc: InstanceType<typeof RadarJob>, io: any, level: "info" | "success" | "error" | "warning", message: string) {
    const entry = { timestamp: new Date(), level, message };
    jobDoc.logs.push(entry);
    io?.emit("radar:log", entry);
}

const TRENDS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://trends.google.com/",
};

async function fetchTrendsData(url: string): Promise<string> {
    const urlObj = new URL(url);

    // ── Trending searches → reliable RSS feed ────────────────────────────────
    if (url.includes("trendingsearches")) {
        const geo = urlObj.searchParams.get("geo") ?? "US";
        const rssUrl = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`;
        const res = await fetch(rssUrl, {
            headers: { ...TRENDS_HEADERS, "Accept": "application/rss+xml, text/xml, */*" },
            signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) throw new Error(`Google Trends RSS: HTTP ${res.status}`);
        const xml = await res.text();
        // Keep CDATA content readable for the AI
        return xml
            .replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    // ── Explore URL → 2-step undocumented API ────────────────────────────────
    if (url.includes("/explore")) {
        const query = urlObj.searchParams.get("q");
        const geo = urlObj.searchParams.get("geo") ?? "US";

        if (query) {
            try {
                // Step 1: get widget metadata + tokens
                const req = encodeURIComponent(JSON.stringify({
                    comparisonItem: [{ keyword: query, geo, time: "today 12-m" }],
                    category: 0, property: "",
                }));
                const exploreRes = await fetch(
                    `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${req}`,
                    { headers: { ...TRENDS_HEADERS, "Accept": "application/json, */*" }, signal: AbortSignal.timeout(15_000) }
                );
                if (!exploreRes.ok) throw new Error(`explore API: ${exploreRes.status}`);
                const exploreRaw = (await exploreRes.text()).replace(/^\)\]\}'\n/, "");
                const { widgets = [] } = JSON.parse(exploreRaw) as { widgets: any[] };

                // Step 2: fetch related queries (rising + top) using the widget token
                const relWidget = widgets.find((w: any) => w.id === "RELATED_QUERIES");
                let parts: string[] = [`Google Trends — Explore: "${query}" (${geo})\n`];

                if (relWidget?.token) {
                    const relReq = encodeURIComponent(JSON.stringify(relWidget.request));
                    const relRes = await fetch(
                        `https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=en-US&tz=0&req=${relReq}&token=${encodeURIComponent(relWidget.token)}&geo=${geo}`,
                        { headers: { ...TRENDS_HEADERS, "Accept": "application/json, */*" }, signal: AbortSignal.timeout(15_000) }
                    );
                    if (relRes.ok) {
                        const relRaw = (await relRes.text()).replace(/^\)\]\}'\n/, "");
                        const relData = JSON.parse(relRaw);
                        const rising: any[] = relData?.default?.rankedList?.[1]?.rankedKeyword ?? [];
                        const top: any[] = relData?.default?.rankedList?.[0]?.rankedKeyword ?? [];
                        if (rising.length) parts.push("RISING QUERIES:\n" + rising.map((r: any) => `- ${r.query} (${r.formattedValue ?? "breakout"})`).join("\n"));
                        if (top.length) parts.push("TOP QUERIES:\n" + top.map((r: any) => `- ${r.query} (${r.formattedValue ?? ""})`).join("\n"));
                    }
                }

                // Also include related topics if available
                const topicWidget = widgets.find((w: any) => w.id === "RELATED_TOPICS");
                if (topicWidget) parts.push(`RELATED TOPICS: ${topicWidget.title?.query ?? query}`);

                if (parts.length > 1) return parts.join("\n\n");
            } catch { /* fall through to plain page fetch */ }
        }

        // Fallback: plain fetch of the explore page (less data but better than nothing)
        const res = await fetch(url, {
            headers: { ...TRENDS_HEADERS, "Accept": "text/html,application/xhtml+xml,*/*" },
            signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) throw new Error(`Google Trends: HTTP ${res.status}`);
        const html = await res.text();
        return html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&[a-z#0-9]+;/gi, " ")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    throw new Error("URL de Google Trends no reconocida. Usa trends.google.com/trends/explore?q=... o .../trendingsearches/daily");
}

const REDDIT_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function redditPostsToText(posts: any[]): string {
    const lines = posts.map((p: any) => {
        const d = p.data ?? p;
        return `- "${d.title}" | score: ${d.score ?? 0} | comments: ${d.num_comments ?? 0} | flair: ${d.link_flair_text ?? "none"} | url: ${d.url ?? ""}`;
    });
    return `Reddit posts (${posts.length} entradas):\n\n` + lines.join("\n");
}

async function fetchRedditJson(jsonUrl: string): Promise<any[] | null> {
    try {
        const res = await fetch(jsonUrl, {
            headers: {
                "User-Agent": REDDIT_UA,
                "Accept": "application/json, text/javascript, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "no-cache",
                "Referer": "https://www.reddit.com/",
            },
            signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) return null;
        const data: any = await res.json();
        // Multi-subreddit response (r/kdp+coloringbooks) → array of listings
        if (Array.isArray(data)) return data.flatMap((d: any) => d?.data?.children ?? []);
        return data?.data?.children ?? null;
    } catch { return null; }
}

async function fetchRedditRss(subredditPath: string): Promise<string | null> {
    // Extract base subreddit path (strip query params, .json suffix)
    const base = subredditPath.replace(/\.json.*$/, "").replace(/\?.*$/, "").replace(/\/$/, "");
    const rssUrl = `https://www.reddit.com${base}.rss?limit=100`;
    try {
        const res = await fetch(rssUrl, {
            headers: { "User-Agent": REDDIT_UA, "Accept": "application/rss+xml, text/xml, */*" },
            signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) return null;
        const xml = await res.text();
        // Extract <title> elements (skip first which is the feed title)
        const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/gs)]
            .map(m => m[1].trim())
            .filter((t, i) => i > 0 && t.length > 5)
            .slice(0, 100);
        if (titles.length === 0) return null;
        return `Reddit posts vía RSS (${titles.length} entradas):\n\n` + titles.map(t => `- "${t}"`).join("\n");
    } catch { return null; }
}

async function fetchRedditData(url: string): Promise<string> {
    // Normalize to JSON URL
    const parsed = new URL(url.startsWith("http") ? url : `https://www.reddit.com${url}`);
    const pathJson = parsed.pathname.replace(/\.json$/, "") + ".json";
    const jsonUrl = `https://www.reddit.com${pathJson}${parsed.search ? parsed.search : "?limit=100"}`;

    // Strategy 1: www.reddit.com with browser UA
    let posts = await fetchRedditJson(jsonUrl);

    // Strategy 2: old.reddit.com (less aggressive bot detection)
    if (!posts || posts.length === 0) {
        const oldUrl = jsonUrl.replace("www.reddit.com", "old.reddit.com");
        posts = await fetchRedditJson(oldUrl);
    }

    if (posts && posts.length > 0) return redditPostsToText(posts);

    // Strategy 3: RSS feed
    const rssText = await fetchRedditRss(parsed.pathname);
    if (rssText) return rssText;

    throw new Error("Reddit bloqueó todas las estrategias de acceso (403/rate-limit). Espera unos minutos e inténtalo de nuevo.");
}

async function readNichesForGapFinder(): Promise<string> {
    const { Niche } = await import("../models/niche.js");
    const niches = await Niche.find({ status: { $ne: "archived" } }).lean();
    if (niches.length === 0) return "El catálogo está vacío — no hay nichos existentes para analizar.";
    const lines = niches.map((n: any) =>
        `- "${n.name}" | fase: ${n.phase} | estilo: ${n.styleCategory} | tipo: ${n.productType} | score: ${n.score ?? "?"}`
    );
    return `Catálogo actual (${niches.length} nichos):\n\n` + lines.join("\n");
}

export function defineRadarJob(agenda: Agenda, io: any) {
    agenda.define(RADAR_JOB_NAME, async (job: Job) => {
        const { jobId } = (job.attrs.data ?? {}) as { jobId: string };

        const jobDoc = await RadarJob.findOne({ jobId });
        if (!jobDoc) { console.error(`[radar-job] No encontrado jobId=${jobId}`); return; }

        const { url, mode, nicheName, context, geminiModel = "gemini-2.0-flash", storageKey = "RADAR_ETSY_RESULT" } = jobDoc as any;
        let browser: any = null;

        try {
            // ── Google Trends: skip Playwright entirely — direct HTTP avoids 429 ───
            if (mode === "trends-niches") {
                pushLog(jobDoc, io, "info", `[FETCH] Google Trends — descargando via API directa (sin navegador)...`);
                await jobDoc.save();

                const trendsText = await fetchTrendsData(url);

                pushLog(jobDoc, io, "info", `[FETCH] ✓ ${trendsText.length.toLocaleString()} chars extraídos`);
                await jobDoc.save();

                const activeProvider = await getActiveProvider();
                pushLog(jobDoc, io, "info", `[AI] Analizando tendencias con ${activeProvider}...`);
                await jobDoc.save();

                const systemPrompt = buildRadarSystemPrompt(mode, nicheName, context);
                const data = await analyzePageForRadar(trendsText, systemPrompt, {
                    onLog: (msg) => { pushLog(jobDoc, io, "warning", msg); void jobDoc.save(); },
                });

                const count = (data?.nichos_detectados ?? []).length;
                pushLog(jobDoc, io, "success", `[AI] ✓ ${count} tendencias detectadas`);

                // Stamp source and date
                if (data?.nichos_detectados) {
                    const ts = new Date().toISOString();
                    data.nichos_detectados = (data.nichos_detectados as any[]).map((n: any) => ({
                        ...n, fecha_detectado: n.fecha_detectado ?? ts, fuente: n.fuente ?? "trends",
                    }));
                }

                jobDoc.status = "completed";
                jobDoc.result = data;
                await jobDoc.save();

                // Persist to settings and emit
                let dataToEmit = data;
                try {
                    const { Settings } = await import("../models/settings.js");
                    if (data?.nichos_detectados) {
                        const existing = await Settings.findOne({ key: storageKey }).lean() as any;
                        if (existing?.value) {
                            try {
                                const saved = JSON.parse(existing.value);
                                if (saved?.nichos_detectados?.length) {
                                    const incoming: any[] = data.nichos_detectados;
                                    const incomingTitles = new Set(incoming.map((r: any) => r.titulo_producto));
                                    const preserved = (saved.nichos_detectados as any[]).filter((r: any) => !incomingTitles.has(r.titulo_producto));
                                    const merged = incoming.map((r: any) => ({
                                        ...r,
                                        _nichoCreado: (saved.nichos_detectados as any[]).find((s: any) => s.titulo_producto === r.titulo_producto)?._nichoCreado ?? r._nichoCreado,
                                    }));
                                    dataToEmit = { ...data, nichos_detectados: [...merged, ...preserved] };
                                }
                            } catch { /* keep dataToEmit = data */ }
                        }
                        await Settings.findOneAndUpdate({ key: storageKey }, { key: storageKey, value: JSON.stringify(dataToEmit) }, { upsert: true });
                    }
                } catch { /* non-critical */ }

                io?.emit("radar:result", { jobId, mode, storageKey, data: dataToEmit });
                io?.emit("radar:done", { jobId });

                try {
                    const { sendTelegram, shouldNotify } = await import("../lib/telegram.js");
                    const count2 = (dataToEmit?.nichos_detectados ?? []).length;
                    if (await shouldNotify("radar.found") && count2 > 0) {
                        await sendTelegram(`📈 <b>Google Trends completado</b>\n\n<b>${count2}</b> tendencia${count2 !== 1 ? "s" : ""} detectada${count2 !== 1 ? "s" : ""}\n<b>URL:</b> ${url}`);
                    }
                } catch { /* Telegram not configured */ }

                return; // Done — skip the Playwright branch below
            }

            // ── Gap-finder: no HTTP, reads niches from DB + AI ─────────────────────
            if (mode === "gap-finder") {
                pushLog(jobDoc, io, "info", `[DB] Leyendo catálogo de nichos...`);
                await jobDoc.save();

                const catalogText = await readNichesForGapFinder();
                pushLog(jobDoc, io, "info", `[DB] ✓ ${catalogText.split("\n").length - 2} nichos en catálogo`);
                await jobDoc.save();

                pushLog(jobDoc, io, "info", `[AI] Buscando huecos con IA...`);
                await jobDoc.save();

                const systemPrompt = buildRadarSystemPrompt(mode);
                const data = await analyzePageForRadar(catalogText, systemPrompt, {
                    onLog: (msg) => { pushLog(jobDoc, io, "warning", msg); void jobDoc.save(); },
                });

                const count = (data?.nichos_detectados ?? []).length;
                pushLog(jobDoc, io, "success", `[AI] ✓ ${count} huecos detectados`);

                if (data?.nichos_detectados) {
                    const ts = new Date().toISOString();
                    data.nichos_detectados = (data.nichos_detectados as any[]).map((n: any) => ({
                        ...n, fecha_detectado: n.fecha_detectado ?? ts, fuente: "gap",
                    }));
                }

                jobDoc.status = "completed";
                jobDoc.result = data;
                await jobDoc.save();

                try {
                    const { Settings } = await import("../models/settings.js");
                    if (data?.nichos_detectados) {
                        await Settings.findOneAndUpdate({ key: storageKey }, { key: storageKey, value: JSON.stringify(data) }, { upsert: true });
                    }
                } catch { /* non-critical */ }

                io?.emit("radar:result", { jobId, mode, storageKey, data });
                io?.emit("radar:done", { jobId });
                return;
            }

            // ── Reddit: direct HTTP (no Playwright) ────────────────────────────────
            if (mode === "reddit-niches") {
                pushLog(jobDoc, io, "info", `[FETCH] Obteniendo posts de Reddit...`);
                await jobDoc.save();

                const redditText = await fetchRedditData(url);
                pushLog(jobDoc, io, "info", `[FETCH] ✓ ${redditText.split("\n").length} líneas extraídas`);
                await jobDoc.save();

                pushLog(jobDoc, io, "info", `[AI] Analizando tendencias de Reddit con IA...`);
                await jobDoc.save();

                const systemPrompt = buildRadarSystemPrompt(mode);
                const data = await analyzePageForRadar(redditText, systemPrompt, {
                    onLog: (msg) => { pushLog(jobDoc, io, "warning", msg); void jobDoc.save(); },
                });

                const count = (data?.nichos_detectados ?? []).length;
                pushLog(jobDoc, io, "success", `[AI] ✓ ${count} nichos detectados en Reddit`);

                if (data?.nichos_detectados) {
                    const ts = new Date().toISOString();
                    data.nichos_detectados = (data.nichos_detectados as any[]).map((n: any) => ({
                        ...n, fecha_detectado: n.fecha_detectado ?? ts, fuente: "reddit",
                    }));
                }

                jobDoc.status = "completed";
                jobDoc.result = data;
                await jobDoc.save();

                // Normalise: guarantee nichos_detectados is always an array
                const redditData: any = { nichos_detectados: [], ...(data ?? {}) };
                let dataToEmit: any = redditData;
                try {
                    const { Settings } = await import("../models/settings.js");
                    const existing = await Settings.findOne({ key: storageKey }).lean() as any;
                    if (existing?.value) {
                        try {
                            const saved = JSON.parse(existing.value as string);
                            if (saved?.nichos_detectados?.length) {
                                const incoming: any[] = redditData.nichos_detectados;
                                const incomingTitles = new Set(incoming.map((r: any) => r.titulo_producto));
                                const preserved = (saved.nichos_detectados as any[]).filter((r: any) => !incomingTitles.has(r.titulo_producto));
                                const mergedRows = incoming.map((r: any) => ({
                                    ...r,
                                    _nichoCreado: (saved.nichos_detectados as any[]).find((s: any) => s.titulo_producto === r.titulo_producto)?._nichoCreado ?? r._nichoCreado,
                                }));
                                dataToEmit = { ...redditData, nichos_detectados: [...mergedRows, ...preserved] };
                            }
                        } catch { /* malformed saved data — overwrite */ }
                    }
                    await Settings.findOneAndUpdate(
                        { key: storageKey },
                        { key: storageKey, value: JSON.stringify(dataToEmit) },
                        { upsert: true }
                    );
                    console.log(`[reddit-job] Guardado en Settings key=${storageKey} · ${(dataToEmit.nichos_detectados ?? []).length} nichos`);
                } catch (saveErr: any) {
                    console.error(`[reddit-job] Error al guardar en Settings (${storageKey}): ${saveErr?.message}`);
                }

                io?.emit("radar:result", { jobId, mode, storageKey, data: dataToEmit });
                io?.emit("radar:done", { jobId });

                // ── Telegram + niche creation (same as Playwright branch) ────────────
                try {
                    const { sendTelegram, shouldNotify } = await import("../lib/telegram.js");
                    const newNiches = (redditData?.nichos_detectados ?? []).filter((n: any) => !n._nichoCreado);
                    const count2 = (dataToEmit?.nichos_detectados ?? []).length;

                    if (await shouldNotify("radar.found") && count2 > 0) {
                        await sendTelegram(
                            `🔍 <b>Radar completado — Reddit KDP</b>\n\n` +
                            `<b>${count2}</b> producto${count2 !== 1 ? "s" : ""} en el listado` +
                            (newNiches.length > 0 ? ` · <b>${newNiches.length} nuevo${newNiches.length !== 1 ? "s" : ""}</b>` : " · sin novedades") + `\n` +
                            `<b>URL:</b> ${url}\n\n` +
                            (newNiches.length > 0 ? `⏳ Generando imágenes de muestra…` : "")
                        );
                    }

                    if (newNiches.length > 0) {
                        const { Niche } = await import("../models/niche.js");
                        const port = process.env.PORT || 3001;
                        const base = `http://localhost:${port}`;

                        setImmediate(async () => {
                            let createdCount = 0;
                            for (let i = 0; i < newNiches.length; i++) {
                                const product = newNiches[i];
                                const nicheName = ((product.sub_nicho_estimado as string) || (product.titulo_producto as string) || "").trim();
                                if (!nicheName) continue;
                                try {
                                    const existing = await Niche.findOne({ sourceTitulo: product.titulo_producto }).lean();
                                    if (existing) continue;
                                    const niche = await Niche.create({
                                        name: nicheName,
                                        status: "found",
                                        sourceTitulo: (product.titulo_producto as string) ?? "",
                                        productType: "coloring-book",
                                        styleCategory: "generic",
                                        styleCategories: ["generic"],
                                        score: computeNicheScore(product),
                                        scoreReason: `Reddit: score=${product.score ?? 0}, comments=${product.total_reseñas ?? 0}`,
                                    });
                                    io?.emit("niches:updated");
                                    createdCount++;
                                    await fetch(`${base}/autopilot/discover/${niche._id}`, { method: "POST" });
                                } catch (e: any) {
                                    console.error("[reddit-queue] Error creating niche:", e.message);
                                }
                                if (i < newNiches.length - 1) await new Promise(r => setTimeout(r, 15_000));
                            }
                            if (createdCount > 0) {
                                try {
                                    const { sendTelegram: tg } = await import("../lib/telegram.js");
                                    await tg(`📬 <b>${createdCount} nicho${createdCount !== 1 ? "s" : ""} de Reddit enviado${createdCount !== 1 ? "s" : ""} a Telegram</b>\n\nResponde a cada imagen para confirmar o descartar.\nLos de score alto se lanzan automáticamente.`);
                                } catch { /* non-critical */ }
                                try { await agenda.schedule("in 10 seconds", AUTOPILOT_JOB_NAME, {}); } catch { /* non-critical */ }
                            }
                        });
                    }
                } catch { /* Telegram not configured */ }

                return;
            }

            // ── Cross-niche: Google Trends HTTP (no Playwright) ────────────────────
            if (mode === "cross-niche") {
                pushLog(jobDoc, io, "info", `[FETCH] Google Trends (cross-niche) — descargando via API directa...`);
                await jobDoc.save();

                const trendsText = await fetchTrendsData(url);
                pushLog(jobDoc, io, "info", `[FETCH] ✓ ${trendsText.length.toLocaleString()} chars extraídos`);
                await jobDoc.save();

                pushLog(jobDoc, io, "info", `[AI] Detectando cross-nichos KDP...`);
                await jobDoc.save();

                const systemPrompt = buildRadarSystemPrompt(mode);
                const data = await analyzePageForRadar(trendsText, systemPrompt, {
                    onLog: (msg) => { pushLog(jobDoc, io, "warning", msg); void jobDoc.save(); },
                });

                const count = (data?.nichos_detectados ?? []).length;
                pushLog(jobDoc, io, "success", `[AI] ✓ ${count} cross-nichos detectados`);

                if (data?.nichos_detectados) {
                    const ts = new Date().toISOString();
                    data.nichos_detectados = (data.nichos_detectados as any[]).map((n: any) => ({
                        ...n, fecha_detectado: n.fecha_detectado ?? ts, fuente: "cross",
                    }));
                }

                jobDoc.status = "completed";
                jobDoc.result = data;
                await jobDoc.save();

                let dataToEmit = data;
                try {
                    const { Settings } = await import("../models/settings.js");
                    if (data?.nichos_detectados) {
                        const existing = await Settings.findOne({ key: storageKey }).lean() as any;
                        if (existing?.value) {
                            try {
                                const saved = JSON.parse(existing.value);
                                if (saved?.nichos_detectados?.length) {
                                    const incoming: any[] = data.nichos_detectados;
                                    const incomingTitles = new Set(incoming.map((r: any) => r.titulo_producto));
                                    const preserved = (saved.nichos_detectados as any[]).filter((r: any) => !incomingTitles.has(r.titulo_producto));
                                    const merged = incoming.map((r: any) => ({
                                        ...r,
                                        _nichoCreado: (saved.nichos_detectados as any[]).find((s: any) => s.titulo_producto === r.titulo_producto)?._nichoCreado ?? r._nichoCreado,
                                    }));
                                    dataToEmit = { ...data, nichos_detectados: [...merged, ...preserved] };
                                }
                            } catch { /* keep dataToEmit = data */ }
                        }
                        await Settings.findOneAndUpdate({ key: storageKey }, { key: storageKey, value: JSON.stringify(dataToEmit) }, { upsert: true });
                    }
                } catch { /* non-critical */ }

                io?.emit("radar:result", { jobId, mode, storageKey, data: dataToEmit });
                io?.emit("radar:done", { jobId });
                return;
            }

            // ── Normal Playwright flow for Etsy, Amazon, Opportunity, Movers, General
            pushLog(jobDoc, io, "info", `[BROWSER] Lanzando navegador headless (modo stealth)...`);
            await jobDoc.save();

            const { chromium } = await import("playwright");
            browser = await chromium.launch({
                headless: true,
                args: [
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--no-first-run",
                    "--no-zygote",
                    "--disable-gpu",
                ],
            });

            // Create a context with realistic browser fingerprint
            const browserCtx = await browser.newContext({
                viewport: { width: 1440, height: 900 },
                locale: "es-ES",
                timezoneId: "Europe/Madrid",
                userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                extraHTTPHeaders: {
                    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"macOS"',
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Upgrade-Insecure-Requests": "1",
                },
            });

            // Mask all bot-detection signals before any page script runs
            await browserCtx.addInitScript(() => {
                Object.defineProperty(navigator, "webdriver", { get: () => undefined });
                // @ts-ignore
                window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
                Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, "languages", { get: () => ["es-ES", "es", "en-US", "en"] });
                Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
            });

            const page = await browserCtx.newPage();

            pushLog(jobDoc, io, "info", `[FETCH] Cargando página: ${url}`);
            await jobDoc.save();
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

            // Wait for JS hydration (SPAs like Etsy render after domcontentloaded)
            await page.waitForTimeout(2500);

            // Detect anti-bot / CAPTCHA screens before wasting time
            const pageTitle: string = await page.title().catch(() => "");
            if (/captcha|attention required|just a moment|checking|ddos-guard/i.test(pageTitle)) {
                throw new Error(`Página bloqueada por anti-bot: "${pageTitle}". Intenta de nuevo en unos minutos.`);
            }

            if (mode === "etsy-niches" || mode === "amazon-niches" || mode === "opportunity" || mode === "amazon-movers") {
                pushLog(jobDoc, io, "info", `[FETCH] Scroll para cargar resultados lazy...`);
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)");
                await page.waitForTimeout(1500);
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
                await page.waitForTimeout(1500);
            }

            // Capture full HTML BEFORE pruning — this is what the HF fallback uses
            const rawHtml: string = await page.content().catch(() => "");
            const pageText = rawHtml
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/&[a-z#0-9]+;/gi, " ")
                .replace(/\s{2,}/g, " ")
                .trim();

            if (pageText.length < 500) {
                pushLog(jobDoc, io, "warning", `[FETCH] ⚠ Contenido corto (${pageText.length} chars) — posible bloqueo anti-bot`);
            } else {
                pushLog(jobDoc, io, "info", `[FETCH] ✓ ${pageText.length.toLocaleString()} chars extraídos`);
            }

            // Prune DOM for LLMScraper (Gemini) — after text capture, reduces token count
            await page.evaluate(`
                ["script","style","header","footer","noscript","iframe",
                 ".wt-b-badge","nav","svg","picture source"].forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => el.remove());
                });
            `);

            pushLog(jobDoc, io, "success", `[FETCH] ✓ DOM podado — listo para análisis`);
            await jobDoc.save();

            const activeProvider = await getActiveProvider();
            let data: any;

            // Google provider → use llm-scraper (structured DOM extraction, most accurate)
            if (activeProvider === "google") {
                const googleKey = await getGoogleKey();
                if (!googleKey) throw new Error("Google API key no configurada. Añádela en Ajustes.");
                pushLog(jobDoc, io, "info", `[AI] Analizando con Gemini (${geminiModel}) · modo: ${mode}...`);
                await jobDoc.save();

                const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
                const { default: LLMScraper } = await import("llm-scraper");
                const { Output } = await import("ai");

                const google = createGoogleGenerativeAI({ apiKey: googleKey });
                const scraper = new LLMScraper(google(geminiModel));

                try {
                    if (LISTING_MODES.has(mode)) {
                        const systemPrompt = buildRadarSystemPrompt(mode);
                        const output = Output.object(EtsyNicheResultSchema as any);
                        const result = await runWithRetry(
                            () => scraper.run(page, output, { format: "markdown", system: systemPrompt }),
                            (secs, attempt) => {
                                pushLog(jobDoc, io, "warning", `[QUOTA] Límite RPM · esperando ${secs}s (intento ${attempt}/1)...`);
                                jobDoc.save().catch(() => {});
                            }
                        );
                        data = result.data;
                    } else {
                        const output = Output.object(NicheInsightSchema as any);
                        const systemPrompt = buildRadarSystemPrompt(mode, nicheName, context);
                        const result = await runWithRetry(
                            () => scraper.run(page, output, { format: "markdown", system: systemPrompt }),
                            (secs, attempt) => {
                                pushLog(jobDoc, io, "warning", `[QUOTA] Límite RPM · esperando ${secs}s (intento ${attempt}/1)...`);
                                jobDoc.save().catch(() => {});
                            }
                        );
                        data = result.data;
                    }
                    const count = (data?.nichos_detectados ?? []).length;
                    pushLog(jobDoc, io, "success",
                        LISTING_MODES.has(mode)
                            ? `[AI] ✓ Gemini · ${count} ${mode === "trends-niches" || mode === "cross-niche" ? "tendencias" : mode === "gap-finder" ? "huecos" : "productos"} detectados`
                            : `[AI] ✓ Gemini · análisis completado`
                    );
                } catch (geminiErr: any) {
                    if (!isHardQuota(geminiErr)) throw geminiErr;
                    pushLog(jobDoc, io, "warning", `[QUOTA] Cuota diaria de Gemini agotada → buscando siguiente provider...`);
                    await jobDoc.save();
                    // Fall through to text-based chain, skip google since it's exhausted
                    const systemPrompt = buildRadarSystemPrompt(mode, nicheName, context);
                    data = await analyzePageForRadar(pageText, systemPrompt, {
                        skipProviders: ["google"],
                        onLog: (msg) => { pushLog(jobDoc, io, "warning", msg); void jobDoc.save(); },
                    });
                }
            } else {
                // Any other provider (openrouter, groq, huggingface) → text-based extraction with fallback
                if (activeProvider === "huggingface") {
                    pushLog(jobDoc, io, "warning", `[INFO] HuggingFace puede tardar entre 30-90s. Por favor, espera...`);
                }
                await jobDoc.save();
                const systemPrompt = buildRadarSystemPrompt(mode, nicheName, context);
                pushLog(jobDoc, io, "info", `[AI] Analizando con ${activeProvider} · modo: ${mode}...`);
                data = await analyzePageForRadar(pageText, systemPrompt, {
                    onLog: (msg) => { pushLog(jobDoc, io, "warning", msg); void jobDoc.save(); },
                });
            }

            if (data) {
                const count = (data?.nichos_detectados ?? []).length;
                if (LISTING_MODES.has(mode)) {
                    pushLog(jobDoc, io, "success", `[AI] ✓ ${count} ${mode === "trends-niches" || mode === "cross-niche" ? "tendencias detectadas" : mode === "gap-finder" ? "huecos detectados" : "productos detectados"}`);
                } else {
                    pushLog(jobDoc, io, "success", `[AI] ✓ Análisis completado`);
                }
            }

            // Stamp detection date and source on every listing
            if (data?.nichos_detectados) {
                const ts = new Date().toISOString();
                const fuente = mode === "amazon-niches" || mode === "amazon-movers" ? "amazon"
                    : mode === "etsy-niches" || mode === "opportunity" ? "etsy"
                    : mode === "trends-niches" ? "trends"
                    : mode === "reddit-niches" ? "reddit"
                    : mode === "cross-niche" ? "cross"
                    : mode === "gap-finder" ? "gap"
                    : "general";
                data.nichos_detectados = (data.nichos_detectados as any[]).map(n => ({ ...n, fecha_detectado: ts, fuente: n.fuente ?? fuente }));
            }

            jobDoc.status = "completed";
            jobDoc.result = data;
            await jobDoc.save();

            // Merge with existing saved results and persist — frontend may not be mounted
            let dataToEmit = data;
            try {
                const { Settings } = await import("../models/settings.js");

                if (data?.nichos_detectados) {
                    // Merge: preserve existing rows not in this scan, keep _nichoCreado flags
                    const existing = await Settings.findOne({ key: storageKey }).lean() as any;
                    if (existing?.value) {
                        try {
                            const saved = JSON.parse(existing.value);
                            if (saved?.nichos_detectados?.length) {
                                const incoming: any[] = data.nichos_detectados;
                                const incomingTitles = new Set(incoming.map((r: any) => r.titulo_producto));
                                const preserved = (saved.nichos_detectados as any[]).filter(
                                    r => !incomingTitles.has(r.titulo_producto)
                                );
                                const merged = incoming.map((r: any) => ({
                                    ...r,
                                    _nichoCreado: (saved.nichos_detectados as any[]).find(
                                        (s: any) => s.titulo_producto === r.titulo_producto
                                    )?._nichoCreado ?? r._nichoCreado,
                                }));
                                dataToEmit = { ...data, nichos_detectados: [...merged, ...preserved] };
                            }
                        } catch { /* keep dataToEmit = data */ }
                    }
                }

                await Settings.findOneAndUpdate(
                    { key: storageKey },
                    { key: storageKey, value: JSON.stringify(dataToEmit) },
                    { upsert: true }
                );
            } catch (settingsErr) {
                console.warn("[radar-job] No se pudo guardar en Settings:", settingsErr);
            }

            io?.emit("radar:result", { jobId, mode, storageKey, data: dataToEmit });

            // Send Telegram summary on success
            try {
                const { sendTelegram, shouldNotify } = await import("../lib/telegram.js");
                const newNiches = (data?.nichos_detectados ?? []).filter((n: any) => !n._nichoCreado);
                const count = (dataToEmit?.nichos_detectados ?? []).length;
                const modeLabel = mode === "etsy-niches" ? "Etsy"
                    : mode === "amazon-niches" ? "Amazon"
                    : mode === "trends-niches" ? "Google Trends"
                    : mode === "opportunity" ? "Oportunidad"
                    : mode === "amazon-movers" ? "Amazon Movers"
                    : mode === "reddit-niches" ? "Reddit KDP"
                    : mode === "cross-niche" ? "Cross-Nicho"
                    : mode === "gap-finder" ? "Detector Huecos"
                    : "General";

                if (await shouldNotify("radar.found") && count > 0) {
                    await sendTelegram(
                        `🔍 <b>Radar completado — ${modeLabel}</b>\n\n` +
                        `<b>${count}</b> producto${count !== 1 ? "s" : ""} en el listado` +
                        (newNiches.length > 0 ? ` · <b>${newNiches.length} nuevo${newNiches.length !== 1 ? "s" : ""}</b>` : " · sin novedades") + `\n` +
                        `<b>URL:</b> ${url}\n\n` +
                        (newNiches.length > 0 ? `⏳ Generando imágenes de muestra…` : "")
                    );
                }

                // Queue: create niches + send Telegram photo sequentially for each new product
                if (newNiches.length > 0 && mode !== "gap-finder" && mode !== "cross-niche") {
                    const { Niche } = await import("../models/niche.js");
                    const port = process.env.PORT || 3001;
                    const base = `http://localhost:${port}`;

                    // Run in background so the radar job can close the browser
                    setImmediate(async () => {
                        let createdCount = 0;

                        for (let i = 0; i < newNiches.length; i++) {
                            const product = newNiches[i];
                            const nicheName = ((product.sub_nicho_estimado as string) || (product.titulo_producto as string) || "").trim();
                            if (!nicheName) continue;

                            try {
                                // Skip if already exists by sourceTitulo
                                const existing = await Niche.findOne({ sourceTitulo: product.titulo_producto }).lean();
                                if (existing) continue;

                                const nicheScore = mode === "opportunity" ? computeOpportunityScore(product) : computeNicheScore(product);
                                const niche = await Niche.create({
                                    name: nicheName,
                                    status: "found",
                                    sourceTitulo: (product.titulo_producto as string) ?? "",
                                    productType: "coloring-book",
                                    styleCategory: "generic",
                                    styleCategories: ["generic"],
                                    score: nicheScore,
                                    scoreReason: `Radar: bestseller=${product.bestseller ?? false}, reseñas=${product.total_reseñas ?? 0}, carrito=${product.personas_carrito ?? 0}`,
                                });
                                io?.emit("niches:updated");
                                createdCount++;

                                // Trigger discover: generates prompt + sends Telegram photo with buttons
                                await fetch(`${base}/autopilot/discover/${niche._id}`, { method: "POST" });

                            } catch (e: any) {
                                console.error("[radar-queue] Error creating niche:", e.message);
                            }

                            // Wait between niches so Pollinations doesn't receive parallel requests
                            if (i < newNiches.length - 1) await new Promise(r => setTimeout(r, 15_000));
                        }

                        // Final message + autopilot trigger after all photos are sent
                        if (createdCount > 0) {
                            try {
                                const { sendTelegram: tg } = await import("../lib/telegram.js");
                                await tg(
                                    `📬 <b>${createdCount} nicho${createdCount !== 1 ? "s" : ""} enviado${createdCount !== 1 ? "s" : ""} a Telegram</b>\n\n` +
                                    `Responde a cada imagen para confirmar o descartar.\n` +
                                    `Los de score alto se lanzan automáticamente.`
                                );
                            } catch { /* non-critical */ }

                            // Schedule autopilot-run: picks up auto-approved niches immediately
                            try {
                                await agenda.schedule("in 10 seconds", AUTOPILOT_JOB_NAME, {});
                                console.log("[radar-queue] Scheduled autopilot-run after niche creation");
                            } catch { /* non-critical */ }
                        }
                    });
                }
            } catch { /* Telegram not configured — ignore */ }

            await page.close();
        } catch (err: any) {
            const msg = `[ERROR] ${err?.message ?? "Error desconocido"}`;
            pushLog(jobDoc, io, "error", msg);
            jobDoc.status = "failed";
            jobDoc.error = msg;
            await jobDoc.save();

            io?.emit("radar:error", { jobId, message: msg });

            // Notify via Telegram if configured
            try {
                const { sendTelegram, shouldNotify } = await import("../lib/telegram.js");
                if (await shouldNotify("api.error.quota")) {
                    await sendTelegram(
                        `⚠️ <b>Radar — Todos los providers fallaron</b>\n\n` +
                        `<b>URL:</b> ${url}\n` +
                        `<b>Modo:</b> ${mode}\n` +
                        `<b>Error:</b> ${err?.message ?? "Desconocido"}`
                    );
                }
            } catch { /* Telegram not configured — ignore */ }
        } finally {
            if (browser) { try { await browser.close(); } catch { /* ignore */ } }
            io?.emit("radar:done", { jobId });
        }
    });
}
