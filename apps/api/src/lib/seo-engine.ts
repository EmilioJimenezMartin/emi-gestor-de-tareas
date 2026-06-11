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
