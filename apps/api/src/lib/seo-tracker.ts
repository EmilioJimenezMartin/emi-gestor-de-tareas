/**
 * SEO Tracker — posición real de tus libros en Amazon por keyword.
 *
 * Para cada nicho publicado (con ASIN):
 *  - Busca cada keyword del último listing en amazon.com (vía Jina) y localiza
 *    la posición del ASIN entre los ~60 resultados de la página 1.
 *  - Autocomplete-watch: ¿aparece ya el nicho en el autocomplete? (= generas demanda)
 *  - Review velocity: reseñas propias + del top del SERP en cada snapshot.
 *
 * Acotado: máx 5 keywords por nicho, 1 petición por keyword, sin reintentos.
 */
import { SeoSnapshot } from "../models/seo-snapshot.js";
import { Niche } from "../models/niche.js";
import { sendTelegram, shouldNotify } from "./telegram.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface SerpResult {
    asins: string[];                 // en orden de aparición
    reviewByAsin: Map<string, number>;
}

/** Busca una keyword en amazon.com y devuelve los ASINs en orden de SERP. */
async function fetchSerp(keyword: string): Promise<SerpResult | null> {
    try {
        const url = `https://r.jina.ai/https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`;
        const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
        if (!res.ok) return null;
        const md = await res.text();
        if (md.length < 5_000) return null;

        // Recorrer el documento en orden: cada contador de reseñas "[(1,234)](...)"
        // pertenece al último ASIN visto antes de él.
        const asins: string[] = [];
        const seen = new Set<string>();
        const reviewByAsin = new Map<string, number>();
        let lastAsin = "";
        for (const m of md.matchAll(/\/dp\/([A-Z0-9]{10})|\[\((\d[\d,]*)\)\]/g)) {
            if (m[1]) {
                lastAsin = m[1];
                if (!seen.has(m[1])) { seen.add(m[1]); asins.push(m[1]); }
            } else if (m[2] && lastAsin && !reviewByAsin.has(lastAsin)) {
                reviewByAsin.set(lastAsin, parseInt(m[2].replace(/,/g, ""), 10) || 0);
            }
        }
        return { asins, reviewByAsin };
    } catch {
        return null;
    }
}

async function checkAutocomplete(nicheName: string): Promise<{ hit: boolean; terms: string[] }> {
    try {
        const words = nicheName.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length > 2);
        const prefix = words.slice(0, 2).join(" ");
        const url = `https://completion.amazon.com/api/2017/suggestions?mid=ATVPDKIKX0DER&alias=stripbooks&prefix=${encodeURIComponent(prefix)}&limit=10&plain=1`;
        const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12_000) });
        if (!res.ok) return { hit: false, terms: [] };
        const data = await res.json() as any;
        const terms = (data.suggestions ?? []).map((s: any) => String(s.value ?? "")).filter(Boolean);
        const sig = words.filter(w => w.length > 3);
        const hit = terms.some((t: string) => sig.filter(w => t.toLowerCase().includes(w)).length >= Math.min(2, sig.length));
        return { hit, terms };
    } catch {
        return { hit: false, terms: [] };
    }
}

export interface TrackResult {
    nicheId: string;
    nicheName: string;
    asin: string;
    snapshot: any;
    drops: Array<{ keyword: string; from: number; to: number | null }>;
}

/** Trackea un nicho publicado. Devuelve el snapshot + caídas vs el snapshot anterior. */
export async function trackNicheSeo(nicheId: string): Promise<TrackResult | null> {
    const niche = await Niche.findById(nicheId).lean() as any;
    if (!niche?.asin?.trim()) return null;
    const asin = niche.asin.trim();

    // Keywords del último listing (máx 5) — si no hay listing, usa el nombre del nicho
    const lastListing = (niche.listings ?? [])[niche.listings?.length - 1];
    const keywords: string[] = (lastListing?.keywords ?? []).slice(0, 5);
    if (keywords.length === 0) keywords.push(`${niche.name} coloring book`.toLowerCase());

    const ranks: Array<{ keyword: string; position: number | null; page1: boolean }> = [];
    let ownReviews: number | null = null;
    const competitorReviews: number[] = [];

    for (let i = 0; i < keywords.length; i++) {
        if (i > 0) await sleep(5_000); // no quemar Jina
        const serp = await fetchSerp(keywords[i]);
        if (!serp) { ranks.push({ keyword: keywords[i], position: null, page1: false }); continue; }
        const idx = serp.asins.indexOf(asin);
        ranks.push({ keyword: keywords[i], position: idx >= 0 ? idx + 1 : null, page1: idx >= 0 && idx < 16 });
        if (idx >= 0 && ownReviews === null) ownReviews = serp.reviewByAsin.get(asin) ?? null;
        if (competitorReviews.length === 0) {
            for (const a of serp.asins.slice(0, 5)) {
                const r = serp.reviewByAsin.get(a);
                if (r !== undefined) competitorReviews.push(r);
            }
        }
    }

    const autocomplete = await checkAutocomplete(niche.name);

    // Comparar con el snapshot anterior para detectar caídas
    const prev = await SeoSnapshot.findOne({ nicheId }).sort({ createdAt: -1 }).lean() as any;
    const drops: TrackResult["drops"] = [];
    if (prev?.ranks) {
        for (const r of ranks) {
            const old = prev.ranks.find((p: any) => p.keyword === r.keyword);
            if (old?.position != null && (r.position === null || r.position - old.position > 10)) {
                drops.push({ keyword: r.keyword, from: old.position, to: r.position });
            }
        }
    }

    const snapshot = await SeoSnapshot.create({
        nicheId, asin, ranks,
        autocompleteHit: autocomplete.hit,
        autocompleteTerms: autocomplete.terms.slice(0, 10),
        ownReviews,
        topCompetitorReviews: competitorReviews,
    });

    return { nicheId, nicheName: niche.name, asin, snapshot: snapshot.toObject(), drops };
}

/** Trackea todos los nichos publicados con ASIN. Notifica caídas por Telegram. */
export async function trackAllPublishedNiches(io?: any): Promise<TrackResult[]> {
    const published = await Niche.find({
        asin: { $nin: ["", null] },
        status: { $ne: "archived" },
    }).select("_id name").lean() as any[];

    const results: TrackResult[] = [];
    for (let i = 0; i < published.slice(0, 20).length; i++) {
        if (i > 0) await sleep(10_000);
        try {
            const r = await trackNicheSeo(String(published[i]._id));
            if (r) {
                results.push(r);
                io?.emit("seo:tracked", { nicheId: r.nicheId, nicheName: r.nicheName });
            }
        } catch (e: any) {
            console.warn(`[seo-tracker] ${published[i].name}: ${e?.message}`);
        }
    }

    // Alertas de caídas
    const allDrops = results.flatMap(r => r.drops.map(d => ({ ...d, niche: r.nicheName })));
    if (allDrops.length > 0 && await shouldNotify("seo.rank-drop")) {
        const lines = allDrops.slice(0, 8).map(d =>
            `· <b>${d.niche}</b> — "${d.keyword}": #${d.from} → ${d.to === null ? "fuera del top 60" : `#${d.to}`}`
        );
        await sendTelegram(`📉 <b>SEO: caída de posiciones en Amazon</b>\n\n${lines.join("\n")}\n\nRevisa metadatos/portada o refuerza la keyword.`);
    }

    return results;
}
