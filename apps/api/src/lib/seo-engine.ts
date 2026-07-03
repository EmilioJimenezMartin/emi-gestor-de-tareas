/**
 * SEO Engine — keywords reales + validación dura de reglas por plataforma.
 *
 * Principios (algoritmo A9/A10 de Amazon):
 *  - Título/subtítulo = máximo peso de indexación → keyword principal primero, lectura natural.
 *  - 7 casillas backend: long-tail REAL (lo que la gente teclea), sin repetir palabras del
 *    título/subtítulo (Amazon ya las indexa — repetirlas desperdicia el slot), ≤50 chars/slot.
 *  - Prohibido en keywords: claims subjetivos (best, top...), términos temporales (new, sale),
 *    marcas y palabras redundantes (book, kindle, amazon).
 *  - Etsy: 13 tags de ≤20 chars, multi-palabra mejor que single (el matching de Etsy es por frase).
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Recolección de keywords reales ───────────────────────────────────────────

async function amazonSuggest(prefix: string, host = "amazon.com", mid = "ATVPDKIKX0DER", alias = "stripbooks"): Promise<string[]> {
    try {
        const url = `https://completion.${host}/api/2017/suggestions?mid=${mid}&alias=${alias}&prefix=${encodeURIComponent(prefix)}&limit=10&plain=1`;
        const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12_000) });
        if (!res.ok) return [];
        const data = await res.json() as any;
        return (data.suggestions ?? []).map((s: any) => String(s.value ?? "").trim()).filter(Boolean);
    } catch {
        return [];
    }
}

async function googleSuggest(query: string): Promise<string[]> {
    try {
        const url = `https://suggestqueries.google.com/complete/search?q=${encodeURIComponent(query)}&client=firefox&hl=en&gl=US`;
        const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12_000) });
        if (!res.ok) return [];
        const data = await res.json() as any;
        return Array.isArray(data?.[1]) ? data[1].map((s: any) => String(s).trim()).filter(Boolean) : [];
    } catch {
        return [];
    }
}

export interface KeywordIntel {
    /** Términos reales de búsqueda, ordenados por nº de fuentes que los confirman */
    terms: string[];
    sources: { amazon: number; google: number };
}

/**
 * Expande el nombre de un nicho a términos de búsqueda reales.
 * Acotado: máx ~8 peticiones, sin reintentos.
 */
export async function gatherKeywordIntel(nicheName: string, productType: string): Promise<KeywordIntel> {
    const core = nicheName.toLowerCase().trim();
    const productTerm =
        productType === "printable-poster" ? "wall art" :
        productType === "seamless-pattern" ? "seamless pattern" :
        "coloring book";

    // Los nombres de nicho largos ("Adult Stress Relief Mandalas") no disparan autocomplete.
    // Extraer también los sustantivos clave: última palabra y pares de palabras significativas.
    const words = core.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length > 2);
    const lastWord = words[words.length - 1] ?? core;
    const shortCore = words.slice(-2).join(" ");

    // Prefijos que disparan el autocomplete desde ángulos distintos (acotado)
    const amazonPrefixes = [...new Set([
        `${core} ${productTerm}`,
        `${lastWord} ${productTerm}`,            // "mandalas coloring book"
        `${lastWord} ${productTerm} for`,        // → "for adults", "for kids"...
        shortCore !== lastWord ? `${shortCore} ${productTerm}` : "",
        `${productTerm} ${lastWord}`,
    ].filter(Boolean))];
    const googleQueries = [
        `${lastWord} ${productTerm}`,
        `best ${shortCore} ${productTerm}`,      // Google sí permite "best" — revela intención
    ];

    const alias = productType === "coloring-book" ? "stripbooks" : "aps";
    const [amazonResults, googleResults] = await Promise.all([
        Promise.all(amazonPrefixes.map(p => amazonSuggest(p, "amazon.com", "ATVPDKIKX0DER", alias))),
        Promise.all(googleQueries.map(q => googleSuggest(q))),
    ]);

    // Contar en cuántas fuentes aparece cada término (más fuentes = más demanda real)
    const counts = new Map<string, number>();
    const add = (t: string) => {
        const k = t.toLowerCase().replace(/\s+/g, " ").trim();
        if (k.length < 3 || k.length > 60) return;
        counts.set(k, (counts.get(k) ?? 0) + 1);
    };
    amazonResults.flat().forEach(add);
    googleResults.flat().forEach(add);

    const terms = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
        .map(([t]) => t);

    return {
        terms,
        sources: { amazon: amazonResults.flat().length, google: googleResults.flat().length },
    };
}

// ── Validación dura de reglas KDP / Etsy ─────────────────────────────────────

// Palabras que Amazon penaliza o que desperdician slot en las 7 casillas
const KDP_BANNED_IN_KEYWORDS = new Set([
    "best", "bestseller", "best-seller", "top", "new", "sale", "free", "cheap", "discount",
    "amazon", "kindle", "kdp", "book", "books", "ebook", "paperback",
    "great", "amazing", "beautiful", "perfect", "ultimate", "premium",
]);

const STOPWORDS = new Set(["a", "an", "the", "of", "for", "and", "or", "in", "on", "with", "to", "de", "para", "y", "el", "la"]);

function significantWords(text: string): Set<string> {
    return new Set(
        text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
            .filter(w => w.length > 2 && !STOPWORDS.has(w))
    );
}

export interface KdpKeywordValidation {
    keywords: string[];
    fixed: string[];   // qué se corrigió, para log/UI
}

/**
 * Aplica las reglas duras de las 7 casillas KDP:
 *  - ≤50 chars por casilla, sin términos prohibidos, sin repetir palabras del título/subtítulo
 *  - exactamente 7 — si faltan, rellena con términos reales del intel que pasen las reglas
 */
export function validateKdpKeywords(
    rawKeywords: string[],
    title: string,
    subtitle: string,
    intel?: KeywordIntel,
): KdpKeywordValidation {
    const usedWords = new Set([...significantWords(title), ...significantWords(subtitle)]);
    const fixed: string[] = [];
    const seen = new Set<string>();
    const clean: string[] = [];

    const tryAdd = (kw: string, origin: string) => {
        if (clean.length >= 7) return;
        let k = kw.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
        if (!k) return;
        // quitar palabras prohibidas dentro de la frase
        const words = k.split(" ").filter(w => !KDP_BANNED_IN_KEYWORDS.has(w));
        if (words.length === 0) { fixed.push(`"${kw}" eliminada (términos prohibidos)`); return; }
        if (words.length !== k.split(" ").length) fixed.push(`"${kw}" → sin términos prohibidos`);
        k = words.join(" ");
        if (k.length > 50) { k = k.slice(0, 50).replace(/\s\S*$/, ""); fixed.push(`"${kw}" recortada a 50 chars`); }
        // descartar si TODAS sus palabras significativas ya están en título/subtítulo
        const sig = [...significantWords(k)];
        if (sig.length > 0 && sig.every(w => usedWords.has(w))) {
            fixed.push(`"${kw}" descartada (todas sus palabras ya están en título/subtítulo)`);
            return;
        }
        if (seen.has(k)) return;
        seen.add(k);
        clean.push(k);
        if (origin === "intel") fixed.push(`slot rellenado con término real: "${k}"`);
    };

    rawKeywords.forEach(kw => tryAdd(kw, "llm"));
    // Rellenar slots vacíos con términos reales del autocomplete
    if (intel) for (const t of intel.terms) { if (clean.length >= 7) break; tryAdd(t, "intel"); }

    return { keywords: clean.slice(0, 7), fixed };
}

/** Etsy: 13 tags, ≤20 chars cada uno, sin duplicados. Rellena con intel si faltan. */
export function validateEtsyTags(rawTags: string[], intel?: EtsyKeywordIntel | KeywordIntel): string[] {
    const seen = new Set<string>();
    const clean: string[] = [];
    const tryAdd = (t: string) => {
        if (clean.length >= 13) return;
        let k = t.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
        if (!k || k.length < 3) return;
        if (k.length > 20) k = k.slice(0, 20).replace(/\s\S*$/, "");
        if (!k || seen.has(k)) return;
        seen.add(k);
        clean.push(k);
    };
    rawTags.forEach(tryAdd);
    // Prefer Etsy-specific terms (occasion/mood) when filling
    if (intel && "occasionTerms" in intel) {
        for (const t of intel.occasionTerms) { if (clean.length >= 13) break; tryAdd(t); }
        for (const t of intel.moodTerms) { if (clean.length >= 13) break; tryAdd(t); }
    }
    const fallbackTerms = intel?.terms ?? [];
    for (const t of fallbackTerms) { if (clean.length >= 13) break; tryAdd(t); }
    return clean.slice(0, 13);
}

// ── Calidad editorial: legibilidad del título + densidad de keywords ─────────

/**
 * Detecta títulos que "suenan a robot": palabra repetida, ristras de sustantivos
 * sin conectores, longitud excesiva. Amazon no los rechaza — los penaliza por
 * conversión baja, que es peor. Devuelve avisos para seoNotes.
 */
export function checkTitleReadability(title: string): string[] {
    const warnings: string[] = [];
    const words = title.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean);

    // Palabra significativa repetida (keyword stuffing clásico)
    const counts = new Map<string, number>();
    for (const w of words) {
        if (w.length <= 3 || STOPWORDS.has(w)) continue;
        counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    const repeated = [...counts.entries()].filter(([, c]) => c >= 2).map(([w]) => w);
    if (repeated.length > 0) warnings.push(`título repite "${repeated.join('", "')}" — suena a stuffing`);

    // Ristra de 5+ palabras significativas seguidas sin un solo conector → lista de keywords
    let run = 0, maxRun = 0;
    for (const w of words) {
        if (STOPWORDS.has(w) || /^[-:|·]$/.test(w)) run = 0;
        else { run++; maxRun = Math.max(maxRun, run); }
    }
    if (maxRun >= 6) warnings.push(`${maxRun} palabras seguidas sin conectores — no se lee natural`);

    if (title.length > 130) warnings.push(`título de ${title.length} chars — Amazon corta ~115 en resultados`);

    return warnings;
}

/**
 * Densidad de keywords en la descripción: las 2-3 principales deben aparecer
 * (A9 también indexa la descripción) pero <3 veces cada una (sobre-optimización).
 */
export function checkDescriptionKeywordCoverage(
    descriptionHtml: string,
    title: string,
    keywords: string[],
): string[] {
    const warnings: string[] = [];
    const plain = descriptionHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();
    if (plain.length < 50) return warnings; // descripción vacía — no evaluar densidad

    // Keywords principales: las 2 primeras del backend + la frase inicial del título
    const titleHead = title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
        .filter(w => w.length > 3 && !STOPWORDS.has(w)).slice(0, 2).join(" ");
    const mainTerms = [...new Set([titleHead, ...keywords.slice(0, 2).map(k => k.toLowerCase())])].filter(t => t.length > 3);

    for (const term of mainTerms) {
        // contar ocurrencias de la frase completa; si es multi-palabra y no aparece, probar su palabra clave
        const occurrences = plain.split(term).length - 1;
        if (occurrences === 0) {
            const fallbackWord = term.split(" ").sort((a, b) => b.length - a.length)[0];
            const wordHits = fallbackWord ? plain.split(fallbackWord).length - 1 : 0;
            if (wordHits === 0) warnings.push(`"${term}" no aparece en la descripción — A9 también la indexa`);
        } else if (occurrences >= 3) {
            warnings.push(`"${term}" aparece ${occurrences}× en la descripción — sobre-optimización (máx. 2)`);
        }
    }
    return warnings;
}

// ── Competitor title scraping ─────────────────────────────────────────────────

export interface CompetitorListing {
    title: string;
    reviews: number;
    bestseller: boolean;
}

/**
 * Scrapes the top Amazon search results for the niche keyword via Jina Reader.
 * Extracts product titles + review counts using regex — no extra LLM call.
 * Returns an empty array on failure (non-blocking).
 */
export async function scrapeTopCompetitorTitles(nicheName: string, productType: string): Promise<CompetitorListing[]> {
    try {
        const productTerm =
            productType === "printable-poster" ? "printable art" :
            productType === "seamless-pattern" ? "seamless pattern" :
            "coloring book";

        const words = nicheName.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length > 2);
        const shortName = words.slice(-3).join(" ");
        const keyword = `${shortName} ${productTerm}`;

        const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}&i=stripbooks`;
        const jinaUrl = `https://r.jina.ai/${amazonUrl}`;

        const res = await fetch(jinaUrl, {
            headers: { Accept: "text/plain", "X-Timeout": "8", "X-Return-Format": "text" },
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return [];

        const text = await res.text();

        // Jina renders Amazon search results as markdown. Product titles appear as:
        //   [Title text](https://www.amazon.com/...)
        // or as bold text near review counts.
        const listings: CompetitorListing[] = [];
        const seen = new Set<string>();

        // Pattern 1: markdown links to amazon.com product pages
        const linkRe = /\[([^\]]{30,200})\]\(https:\/\/www\.amazon\.com[^\)]+\)/g;
        let m: RegExpExecArray | null;
        while ((m = linkRe.exec(text)) !== null) {
            const title = m[1].replace(/\*\*/g, "").trim();
            if (!seen.has(title)) { seen.add(title); listings.push({ title, reviews: 0, bestseller: false }); }
        }

        // Pattern 2: lines that look like product titles (long lines near "4.X out of 5" review text)
        if (listings.length < 4) {
            const lines = text.split("\n");
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].replace(/\*\*|\[|\]\([^\)]+\)/g, "").trim();
                if (line.length >= 30 && line.length <= 200 && !line.startsWith("http") && !line.startsWith("#")) {
                    const lower = line.toLowerCase();
                    if (lower.includes("color") || lower.includes("pattern") || lower.includes("mandala") || lower.includes("adult") || lower.includes("book")) {
                        if (!seen.has(line)) { seen.add(line); listings.push({ title: line, reviews: 0, bestseller: false }); }
                    }
                }
            }
        }

        // Enrich with review counts: look for "X,XXX ratings" or "X ratings" after each listing block
        const reviewRe = /(\d[\d,]+)\s*(?:ratings?|reseñas?|reviews?)/gi;
        const reviewMatches = [...text.matchAll(reviewRe)].map(r => parseInt(r[1].replace(/,/g, ""), 10));
        const bestsellerPositions = [...text.matchAll(/bestseller/gi)].length;

        // Assign review counts to listings in order (approximate but useful)
        listings.forEach((l, i) => {
            l.reviews = reviewMatches[i] ?? 0;
            l.bestseller = i < bestsellerPositions;
        });

        return listings.slice(0, 8);
    } catch {
        return [];
    }
}

// ── Deep Competitor SEO Analysis ─────────────────────────────────────────────

export interface CompetitorBook {
    rank: number;
    title: string;
    subtitle: string;
    asin: string;
    reviews: number;
    rating: number;
    price: string;
    bsr: number | null;
    categories: string[];
    bullets: string[];
    bestseller: boolean;
}

export interface KeywordFrequency {
    word: string;
    count: number;
    pct: number;
}

export interface CompetitorSEOIntelligence {
    keyword: string;
    totalFound: number;
    topBooks: CompetitorBook[];
    topKeywords: KeywordFrequency[];
    audienceTerms: string[];
    benefitTerms: string[];
    titlePatterns: string[];
    subtitlePatterns: string[];
    categories: string[];
    avgReviews: number;
    priceRange: { min: string; max: string };
    scrapedAt: string;
}

const COMP_STOPWORDS = new Set(["the","a","an","and","or","for","of","in","to","with","by","at","on","is","are","was","be","this","that","it","its","as","from","your","my","our","all","more","most","very","also","can","will","has","have","had","not","but","their","them","they","these","those","just","only","even","about","into","than","other","such","out","up","so","no"]);
const AUDIENCE  = ["adults","women","men","seniors","kids","teens","beginners","girls","boys","mothers","grandma","grandpa","couples","friends","family"];
const BENEFITS  = ["stress relief","stress-relief","relaxation","mindfulness","meditation","anxiety relief","calming","calming","therapeutic","self-care","self care","creative","fun","peaceful","tranquil","soothing","anti-stress"];

function extractAsin(url: string): string {
    const m = url.match(/\/dp\/([A-Z0-9]{10})/);
    return m?.[1] ?? "";
}

function splitTitleSubtitle(full: string): { title: string; subtitle: string } {
    const sep = full.search(/[:–—](?!\s*\d)/);
    if (sep > 10 && sep < full.length - 5) {
        return { title: full.slice(0, sep).trim(), subtitle: full.slice(sep + 1).trim() };
    }
    return { title: full.trim(), subtitle: "" };
}

function analyzeFrequency(titles: string[]): KeywordFrequency[] {
    const freq = new Map<string, number>();
    for (const title of titles) {
        const words = title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length > 2 && !COMP_STOPWORDS.has(w));
        const seen = new Set<string>();
        // Unigrams
        for (const w of words) { if (!seen.has(w)) { freq.set(w, (freq.get(w) ?? 0) + 1); seen.add(w); } }
        // Bigrams
        for (let i = 0; i < words.length - 1; i++) {
            const bg = `${words[i]} ${words[i+1]}`;
            if (!seen.has(bg)) { freq.set(bg, (freq.get(bg) ?? 0) + 1); seen.add(bg); }
        }
    }
    const n = titles.length || 1;
    return [...freq.entries()]
        .map(([word, count]) => ({ word, count, pct: Math.round(count / n * 100) }))
        .filter(k => k.pct >= 15 && k.count >= 2)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 25);
}

async function jinaFetch(url: string): Promise<string> {
    const jinaKey = process.env.JINA_API_KEY;
    try {
        const res = await fetch(`https://r.jina.ai/${url}`, {
            headers: {
                "Accept": "text/plain",
                "X-Return-Format": "text",
                "X-No-Cache": "true",
                "X-Timeout": "12",
                ...(jinaKey ? { Authorization: `Bearer ${jinaKey}` } : {}),
            },
            signal: AbortSignal.timeout(15_000),
        });
        return res.ok ? await res.text() : "";
    } catch { return ""; }
}

async function scrapeProductPage(asin: string): Promise<{ title: string; categories: string[]; bullets: string[]; bsr: number | null; rating: number; reviews: number; price: string; bestseller: boolean }> {
    const empty = { title: "", categories: [], bullets: [], bsr: null, rating: 0, reviews: 0, price: "", bestseller: false };
    try {
        const text = await jinaFetch(`https://www.amazon.com/dp/${asin}`);
        if (!text || text.length < 200) return empty;

        // Title: first meaningful line that looks like a product title (not Amazon UI)
        const PAGE_UI = /^(Skip|About this|Buying options|Videos|Reviews|Keyboard|Amazon|Best Sellers|Under \$|Health|Home|Add to|See more|Report|Delivering|Update location|All Departments|Alexa|Audible|Automotive|To move between|shift|alt|Cart|Orders|Product summary|Show\/Hide|EN |Hello)/i;
        const titleLines = text.split("\n").map(l => l.trim()).filter(l =>
            l.length > 30 && l.length < 300 &&
            /[A-Za-z]/.test(l[0]) &&
            !PAGE_UI.test(l) &&
            /[a-z]{5}/.test(l) &&
            (l.includes("Coloring") || l.includes("Book") || l.includes("Mandala") || l.includes("Pattern") || l.includes("Design") || l.includes("Art"))
        );
        const title = titleLines[0] ?? "";

        // BSR — "#7,367 in Arts, Crafts & Sewing"
        const bsrM = text.match(/#([\d,]+)\s+in\s+(?:Books|Arts|Crafts)/i);
        const bsr = bsrM ? parseInt(bsrM[1].replace(/,/g, ""), 10) : null;

        // Rating
        const ratingM = text.match(/(\d\.\d)\s+out of\s+5/i);
        const rating = ratingM ? parseFloat(ratingM[1]) : 0;

        // Reviews — "614 global ratings"
        const reviewM = text.match(/([\d,]+)\s+global ratings?/i);
        const reviews = reviewM ? parseInt(reviewM[1].replace(/,/g, ""), 10) : 0;

        // Price
        const priceM = text.match(/\$([\d]+\.\d{2})/);
        const price = priceM ? `$${priceM[1]}` : "";

        // Categories from BSR table: "#7,367 in Arts, Crafts & Sewing\n#109 in Sketchbooks"
        const categories: string[] = [];
        const catRe = /#[\d,]+\s+in\s+([A-Za-z ,&']+?)(?:\n|\(|$)/g;
        let cm: RegExpExecArray | null;
        while ((cm = catRe.exec(text)) !== null) {
            const cat = cm[1].trim();
            if (cat.length > 3 && cat.length < 70 && !categories.includes(cat)) categories.push(cat);
            if (categories.length >= 5) break;
        }

        // Bullets — second "About this item" block contains real product bullets
        const bullets: string[] = [];
        const firstAbout = text.indexOf("About this item");
        const secondAbout = firstAbout !== -1 ? text.indexOf("About this item", firstAbout + 20) : -1;
        const bulletSection = text.slice(secondAbout !== -1 ? secondAbout : firstAbout, (secondAbout !== -1 ? secondAbout : firstAbout) + 4000);
        const NAV_SKIP = /^(About this item|Buying options|Videos|Reviews|Keyboard|Skip|Best Sellers|Under \$|Health|Home|Amazon|Books|#\d|Add to|\$|See more|Report an issue|alt|shift|\+|Cart|Search|Orders|Product summary|Show\/Hide)/i;
        const lineRe2 = /^(.{30,300})$/gm;
        let bm: RegExpExecArray | null;
        while ((bm = lineRe2.exec(bulletSection)) !== null) {
            const line = bm[1].trim();
            if (line.length > 30 && !NAV_SKIP.test(line) && /[a-z]{4}/.test(line)) {
                bullets.push(line);
                if (bullets.length >= 5) break;
            }
        }

        const bestseller = /Best\s*Seller/i.test(text);
        return { title, categories, bullets, bsr, rating, reviews, price, bestseller };
    } catch {
        return empty;
    }
}

export async function analyzeCompetitorSEO(keyword: string, productType = "coloring-book"): Promise<CompetitorSEOIntelligence> {
    const productTerm = productType === "printable-poster" ? "printable art" : productType === "seamless-pattern" ? "seamless pattern" : "coloring book";
    const searchKeyword = keyword.toLowerCase().includes(productTerm) ? keyword : `${keyword} ${productTerm}`;

    // Step 1: Search via DuckDuckGo (Amazon blocks Jina; DDG indexes Amazon and is scrappeable)
    const ddgUrl = `https://html.duckduckgo.com/html/?q=site:amazon.com+${encodeURIComponent(searchKeyword)}`;
    const ddgText = await jinaFetch(ddgUrl);

    // Extract Amazon product URLs with ASINs and titles from DDG results
    // DDG format:
    //   Title - Amazon                   ← line i-1 (heading)
    //    www.amazon.com/.../dp/ASIN      ← line i   (url)
    //   Snippet text...                  ← line i+1 (description)
    const rawBooks: Array<{ full: string; asin: string; snippet: string }> = [];
    const seen = new Set<string>();
    const lines = ddgText.split("\n");
    const SKIP_TITLE = /^(Amazon\.com|Amazon Best Sellers|Feedback|Ad$|Viewing ads|etsy\.com|springbok)/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const asinMatch = line.match(/amazon\.com\/[^\s]*\/dp\/([A-Z0-9]{10})/);
        if (!asinMatch || seen.has(asinMatch[1])) continue;
        const asin = asinMatch[1];
        seen.add(asin);

        // Title: look at preceding non-empty lines for the heading text
        let title = "";
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
            const prev = lines[j].trim();
            if (prev.length > 15 && !SKIP_TITLE.test(prev) && !/^www\./.test(prev)) {
                // Strip "- Amazon" suffix DDG often appends
                title = prev.replace(/\s*[-–]\s*Amazon\s*$/i, "").trim();
                break;
            }
        }

        // Fallback: snippet from lines after the URL
        const snippet = lines.slice(i + 1, i + 4).map(l => l.trim()).filter(Boolean).join(" ");

        const full = title.length > 15 ? title : snippet.slice(0, 200);
        if (full.length > 10) {
            rawBooks.push({ full, asin, snippet });
        }
        if (rawBooks.length >= 20) break;
    }

    // Step 2: Deep scrape product pages (up to 8 in parallel batches of 4)
    const toScrape = rawBooks.slice(0, 8);
    const batch1 = await Promise.all(toScrape.slice(0, 4).map(b => scrapeProductPage(b.asin)));
    const batch2 = await Promise.all(toScrape.slice(4, 8).map(b => scrapeProductPage(b.asin)));
    const deepResults = [...batch1, ...batch2];

    // Merge: prefer title from product page (more accurate), fall back to DDG title
    const topBooks: CompetitorBook[] = rawBooks.slice(0, 10).map((b, i) => {
        const deep = deepResults[i] ?? { title: "", categories: [], bullets: [], bsr: null, rating: 0, reviews: 0, price: "", bestseller: false };
        const fullTitle = deep.title || b.full;
        const { title, subtitle } = splitTitleSubtitle(fullTitle);
        return {
            rank: i + 1,
            title: title || fullTitle,
            subtitle,
            asin: b.asin,
            reviews: deep.reviews,
            rating: deep.rating,
            price: deep.price,
            bsr: deep.bsr,
            categories: deep.categories,
            bullets: deep.bullets,
            bestseller: deep.bestseller,
        };
    }).filter(b => b.title.length > 5);

    // Step 3: Frequency analysis on all collected titles
    const allTitles = topBooks.map(b => [b.title, b.subtitle].filter(Boolean).join(" "));
    const topKeywords = analyzeFrequency(allTitles);
    const allCats = [...new Set(deepResults.flatMap(d => d.categories))].slice(0, 10);
    const audienceTerms = AUDIENCE.filter(a => allTitles.some(t => t.toLowerCase().includes(a)));
    const benefitTerms  = BENEFITS.filter(b => allTitles.some(t => t.toLowerCase().includes(b)));

    const titlePatterns: string[] = [];
    const subtitlePatterns: string[] = [];
    for (const b of topBooks.slice(0, 5)) {
        if (b.title && !titlePatterns.includes(b.title)) titlePatterns.push(b.title);
        if (b.subtitle && !subtitlePatterns.includes(b.subtitle)) subtitlePatterns.push(b.subtitle);
    }

    const prices = deepResults.map(d => d.price).filter(Boolean).map(p => parseFloat(p.replace("$", ""))).filter(n => !isNaN(n));
    const priceRange = prices.length > 0
        ? { min: `$${Math.min(...prices).toFixed(2)}`, max: `$${Math.max(...prices).toFixed(2)}` }
        : { min: "", max: "" };

    const allReviews = deepResults.map(d => d.reviews).filter(r => r > 0);
    const avgReviews = allReviews.length > 0 ? Math.round(allReviews.reduce((s, r) => s + r, 0) / allReviews.length) : 0;

    return {
        keyword: searchKeyword,
        totalFound: topBooks.length,
        topBooks,
        topKeywords,
        audienceTerms,
        benefitTerms,
        titlePatterns,
        subtitlePatterns,
        categories: allCats,
        avgReviews,
        priceRange,
        scrapedAt: new Date().toISOString(),
    };
}

// ── Etsy Intel: ocasión + estado de ánimo ────────────────────────────────────

export interface EtsyKeywordIntel extends KeywordIntel {
    occasionTerms: string[];   // "gift for mom", "birthday gift", "mothers day"
    moodTerms: string[];       // "mindfulness gift", "stress relief", "self care"
    lifestyleTerms: string[];  // "cozy home decor", "boho aesthetic"
}

// Etsy buyers search by emotion and occasion — these prefixes reveal high-intent terms
const OCCASION_PREFIXES = ["gift for", "birthday gift", "mothers day", "christmas gift", "valentines gift", "self care gift", "gift for her", "unique gift"];
const MOOD_PREFIXES     = ["mindfulness", "stress relief", "relaxing activity", "meditation", "self care", "cozy", "zen"];
const LIFESTYLE_PREFIXES = ["boho", "minimalist", "aesthetic", "cottagecore", "home decor"];

async function etsySuggest(prefix: string): Promise<string[]> {
    // Etsy has an internal autocomplete but blocks bots — use Google with site filter instead
    return googleSuggest(`${prefix} site:etsy.com`);
}

/**
 * Reúne términos de búsqueda reales desde la perspectiva Etsy:
 * ocasión (regalo cumpleaños, día de la madre…), estado de ánimo y estilo de vida.
 * Complementa — no reemplaza — a gatherKeywordIntel.
 */
export async function gatherEtsyIntel(nicheName: string, productType: string): Promise<EtsyKeywordIntel> {
    const core = nicheName.toLowerCase().trim();
    const words = core.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length > 2);
    const lastWord = words[words.length - 1] ?? core;
    const shortCore = words.slice(-2).join(" ");

    const productTerm =
        productType === "printable-poster" ? "printable" :
        productType === "seamless-pattern" ? "pattern" :
        "coloring book";

    // Fetch occasion + mood signals
    const occasionQueries = OCCASION_PREFIXES.slice(0, 4).map(p => `${p} ${lastWord}`);
    const moodQueries     = MOOD_PREFIXES.slice(0, 3).map(p => `${p} ${productTerm}`);
    const lifestyleQueries = LIFESTYLE_PREFIXES.slice(0, 2).map(p => `${p} ${shortCore}`);

    const [occasionRes, moodRes, lifestyleRes, baseRes] = await Promise.all([
        Promise.all(occasionQueries.map(q => googleSuggest(q))),
        Promise.all(moodQueries.map(q => googleSuggest(q))),
        Promise.all(lifestyleQueries.map(q => googleSuggest(q))),
        // Also grab Etsy-style Amazon search for the product type
        Promise.all([
            googleSuggest(`${shortCore} ${productTerm} etsy`),
            googleSuggest(`${lastWord} ${productTerm} gift`),
        ]),
    ]);

    const toTerms = (results: string[][], maxLen = 20): string[] => {
        const seen = new Set<string>();
        return results.flat()
            .map(t => t.toLowerCase().replace(/\s+/g, " ").trim())
            .filter(t => t.length >= 4 && t.length <= maxLen && !seen.has(t) && (seen.add(t), true));
    };

    const occasionTerms = toTerms(occasionRes);
    const moodTerms     = toTerms(moodRes);
    const lifestyleTerms = toTerms(lifestyleRes);
    const baseTerms      = toTerms(baseRes);

    const allTerms = [...new Set([...occasionTerms, ...moodTerms, ...lifestyleTerms, ...baseTerms])];

    return {
        terms: allTerms,
        sources: { amazon: 0, google: allTerms.length },
        occasionTerms,
        moodTerms,
        lifestyleTerms,
    };
}
