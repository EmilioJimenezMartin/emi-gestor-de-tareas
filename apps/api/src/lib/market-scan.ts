/**
 * Market scan — balanza demanda / oferta / competencia para nichos KDP.
 *
 * Fuentes (todas gratuitas):
 *  - amazon.com  → vía r.jina.ai (las IPs de Jina pasan el bot-manager de .com)
 *  - amazon.es   → fetch directo con warm-up de cookies (Akamai bm-verify)
 *  - demanda     → autocomplete de Amazon (alias stripbooks) en ambos marketplaces
 *
 * Señales por marketplace:
 *  - oferta:      nº de resultados de búsqueda
 *  - competencia: mediana de reseñas del top de resultados + badges de bestseller
 *  - demanda:     nº de sugerencias de autocomplete que contienen el término
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface MarketplaceSignals {
    marketplace: "amazon.com" | "amazon.es";
    ok: boolean;
    error?: string;
    resultCount: number | null;       // oferta
    medianReviews: number | null;     // competencia (mediana reseñas top ~16)
    maxReviews: number | null;
    bestsellerBadges: number;
    sampleReviewCounts: number[];
}

export interface DemandSignals {
    usSuggestions: string[];
    esSuggestions: string[];
    usHits: number;  // sugerencias que contienen el keyword completo
    esHits: number;
}

export interface NicheMarketScan {
    keyword: string;
    keywordEs?: string;
    us: MarketplaceSignals;
    es: MarketplaceSignals;
    demand: DemandSignals;
    score: number;            // 0-100 — balanza demanda-oferta-competencia
    scoreBreakdown: { demand: number; supply: number; competition: number };
    verdict: "gold" | "good" | "saturated" | "dead";
    scannedAt: string;
}

function parseNumber(s: string): number {
    return parseInt(s.replace(/[.,\s]/g, ""), 10) || 0;
}

function median(nums: number[]): number | null {
    if (!nums.length) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

// ── amazon.com vía Jina Reader ────────────────────────────────────────────────
export async function scanAmazonCom(keyword: string): Promise<MarketplaceSignals> {
    const base: MarketplaceSignals = {
        marketplace: "amazon.com", ok: false, resultCount: null,
        medianReviews: null, maxReviews: null, bestsellerBadges: 0, sampleReviewCounts: [],
    };
    try {
        const url = `https://r.jina.ai/https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`;
        // La IP de Jina rota — Amazon le devuelve 503 intermitente. Reintentos acotados (máx 3).
        let text = "";
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await sleep(7_000);
            const res = await fetch(url, {
                headers: { "X-Return-Format": "text", "User-Agent": UA },
                signal: AbortSignal.timeout(60_000),
            });
            if (!res.ok) { base.error = `Jina HTTP ${res.status}`; continue; }
            text = await res.text();
            if (text.length >= 2_000) { base.error = undefined; break; }
            base.error = "Página bloqueada o vacía";
        }
        if (text.length < 2_000) return base;

        const rm = text.match(/(?:over\s+)?([\d,]+)\s+results/i);
        base.resultCount = rm ? parseNumber(rm[1]) : null;

        // "4.8 out of 5 stars ... 814" — pares estrella/reseñas del listado
        const reviews = [...text.matchAll(/[\d.]+ out of 5 stars[^\d]{0,40}([\d,]+)/g)]
            .map(m => parseNumber(m[1]))
            .filter(n => n > 0)
            .slice(0, 16);
        base.sampleReviewCounts = reviews;
        base.medianReviews = median(reviews);
        base.maxReviews = reviews.length ? Math.max(...reviews) : null;
        base.bestsellerBadges = (text.match(/Best Seller/g) ?? []).length;
        base.ok = base.resultCount !== null || reviews.length > 0;
        if (!base.ok) base.error = "No se pudieron extraer señales";
        return base;
    } catch (e: any) {
        base.error = e?.message ?? "fetch error";
        return base;
    }
}

// ── amazon.es directo con warm-up de cookies ─────────────────────────────────
let _esCookies = "";
let _esCookiesAt = 0;

async function fetchAmazonEs(url: string): Promise<Response> {
    return fetch(url, {
        headers: {
            "User-Agent": UA,
            "Accept-Language": "es-ES,es;q=0.9",
            "Accept": "text/html,application/xhtml+xml",
            ...(_esCookies ? { Cookie: _esCookies } : {}),
        },
        signal: AbortSignal.timeout(30_000),
    });
}

function absorbCookies(res: Response) {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    if (!setCookies.length) return;
    const jar = new Map<string, string>(
        _esCookies.split("; ").filter(Boolean).map(c => [c.split("=")[0], c] as [string, string])
    );
    for (const sc of setCookies) {
        const pair = sc.split(";")[0];
        jar.set(pair.split("=")[0], pair);
    }
    _esCookies = [...jar.values()].join("; ");
    _esCookiesAt = Date.now();
}

export async function scanAmazonEs(keyword: string): Promise<MarketplaceSignals> {
    const base: MarketplaceSignals = {
        marketplace: "amazon.es", ok: false, resultCount: null,
        medianReviews: null, maxReviews: null, bestsellerBadges: 0, sampleReviewCounts: [],
    };
    try {
        const searchUrl = `https://www.amazon.es/s?k=${encodeURIComponent(keyword)}`;
        // Cookies viejas pueden estar envenenadas por un challenge anterior — caducan a los 30 min
        if (_esCookies && Date.now() - _esCookiesAt > 30 * 60_000) _esCookies = "";
        let html = "";
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await sleep(6_000);
            const res = await fetchAmazonEs(searchUrl);
            absorbCookies(res);
            html = await res.text();
            if (html.length > 100_000 && !html.includes("bm-verify")) break;
            // Challenge recibido: el último intento parte de cero por si la cookie está envenenada
            if (attempt === 1) _esCookies = "";
        }
        if (html.length < 100_000 || html.includes("bm-verify")) { base.error = "Bloqueado por bot-manager"; return base; }

        const rm = html.match(/([\d.,]+)\s+resultados/) || html.match(/de más de ([\d.,]+)/);
        base.resultCount = rm ? parseNumber(rm[1]) : null;

        // aria-label="123 calificaciones"
        const reviews = [...html.matchAll(/aria-label="([\d.,]+)\s*calificaciones?"/g)]
            .map(m => parseNumber(m[1]))
            .filter(n => n > 0)
            .slice(0, 16);
        base.sampleReviewCounts = reviews;
        base.medianReviews = median(reviews);
        base.maxReviews = reviews.length ? Math.max(...reviews) : null;
        base.bestsellerBadges = (html.match(/Más vendido|Best Seller/g) ?? []).length;
        base.ok = base.resultCount !== null || reviews.length > 0;
        if (!base.ok) base.error = "No se pudieron extraer señales";
        return base;
    } catch (e: any) {
        base.error = e?.message ?? "fetch error";
        return base;
    }
}

// ── Demanda vía autocomplete de Amazon (libros) ──────────────────────────────
async function amazonSuggestions(host: string, mid: string, prefix: string): Promise<string[]> {
    try {
        const url = `https://completion.${host}/api/2017/suggestions?mid=${mid}&alias=stripbooks&prefix=${encodeURIComponent(prefix)}&limit=10&plain=1`;
        const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return [];
        const data = await res.json() as any;
        return (data.suggestions ?? [])
            .map((s: any) => String(s.value ?? ""))
            .filter(Boolean);
    } catch {
        return [];
    }
}

export async function getDemandSignals(keyword: string, keywordEs?: string): Promise<DemandSignals> {
    // Prefijo corto (primeras 2-3 palabras) — así medimos si Amazon "completa" hacia el nicho
    const usPrefix = keyword.split(/\s+/).slice(0, 3).join(" ");
    const esKw = keywordEs ?? keyword;
    const esPrefix = esKw.split(/\s+/).slice(0, 3).join(" ");

    const [usSuggestions, esSuggestions] = await Promise.all([
        amazonSuggestions("amazon.com", "ATVPDKIKX0DER", usPrefix),
        amazonSuggestions("amazon.es", "A1RKKUPIHCS9HS", esPrefix),
    ]);

    // Demanda = cuántas sugerencias devuelve Amazon que contienen el prefijo del nicho.
    // (No el keyword completo: "capybara coloring book for adults" no está contenido
    // en la sugerencia "capybara coloring book", pero esa sugerencia SÍ valida demanda.)
    const usHits = usSuggestions.filter(s => s.toLowerCase().includes(usPrefix.toLowerCase())).length;
    const esHits = esSuggestions.filter(s => s.toLowerCase().includes(esPrefix.toLowerCase())).length;
    return { usSuggestions, esSuggestions, usHits, esHits };
}

// ── Score: balanza demanda-oferta-competencia ────────────────────────────────
// Demanda alta + oferta baja + competencia débil = nicho "gold".
function scoreSupply(resultCount: number | null): number {
    if (resultCount === null) return 10; // sin dato — neutro
    if (resultCount < 1_000) return 30;
    if (resultCount < 5_000) return 24;
    if (resultCount < 10_000) return 17;
    if (resultCount < 50_000) return 9;
    return 3;
}

function scoreCompetition(medianReviews: number | null, bestsellers: number): number {
    let pts: number;
    if (medianReviews === null) pts = 10;
    else if (medianReviews < 30) pts = 28;
    else if (medianReviews < 100) pts = 22;
    else if (medianReviews < 500) pts = 14;
    else if (medianReviews < 2_000) pts = 7;
    else pts = 2;
    // Muchos bestsellers en el SERP = mercado vivo pero dominado — pequeña penalización
    if (bestsellers > 6) pts = Math.max(0, pts - 3);
    return Math.min(pts, 30);
}

function scoreDemand(demand: DemandSignals, usBestsellers: number, esBestsellers: number): number {
    let pts = 0;
    pts += Math.min(demand.usHits * 5, 20);   // autocomplete US — señal más fuerte
    pts += Math.min(demand.esHits * 3, 9);    // autocomplete ES
    // Bestsellers presentes = la gente compra en este nicho
    if (usBestsellers > 0) pts += 6;
    if (esBestsellers > 0) pts += 5;
    return Math.min(pts, 40);
}

export async function scanNicheMarket(keyword: string, keywordEs?: string): Promise<NicheMarketScan> {
    const [us, es, demand] = [
        await scanAmazonCom(keyword),
        await scanAmazonEs(keywordEs ?? keyword),
        await getDemandSignals(keyword, keywordEs),
    ];

    const sDemand = scoreDemand(demand, us.bestsellerBadges, es.bestsellerBadges);
    // Oferta y competencia: media ponderada (US pesa más — mercado principal KDP)
    const sSupply = Math.round(scoreSupply(us.resultCount) * 0.65 + scoreSupply(es.resultCount) * 0.35);
    const sCompetition = Math.round(
        scoreCompetition(us.medianReviews, us.bestsellerBadges) * 0.65 +
        scoreCompetition(es.medianReviews, es.bestsellerBadges) * 0.35
    );

    const score = Math.min(sDemand + sSupply + sCompetition, 100);
    const verdict: NicheMarketScan["verdict"] =
        score >= 70 ? "gold" : score >= 50 ? "good" : score >= 30 ? "saturated" : "dead";

    return {
        keyword,
        keywordEs,
        us, es, demand,
        score,
        scoreBreakdown: { demand: sDemand, supply: sSupply, competition: sCompetition },
        verdict,
        scannedAt: new Date().toISOString(),
    };
}

/**
 * Escanea varios keywords en serie (con pausa) para no quemar Jina ni Amazon.
 * MAX 10 por llamada — sin bucles infinitos ni reintentos agresivos.
 */
export async function scanNicheMarketBatch(
    keywords: Array<{ keyword: string; keywordEs?: string }>,
    onProgress?: (done: number, total: number, last: NicheMarketScan) => void,
): Promise<NicheMarketScan[]> {
    const list = keywords.slice(0, 10);
    const out: NicheMarketScan[] = [];
    for (let i = 0; i < list.length; i++) {
        const scan = await scanNicheMarket(list[i].keyword, list[i].keywordEs);
        out.push(scan);
        onProgress?.(i + 1, list.length, scan);
        if (i < list.length - 1) await sleep(6_000);
    }
    return out;
}
