/**
 * Ingesta de tendencias en tiempo real sin scraping de sitios protegidos.
 * Fuentes que no bloquean:
 *   - Google Trends RSS (daily trending US/ES) — feed público sin auth
 *   - Reddit JSON API (r/kdp, r/coloringbook, r/selfpublish) — JSON libre con User-Agent
 *   - Amazon Movers & Shakers Books vía Jina Reader — URL pública, rara vez bloqueada
 */

export interface TrendSignal {
    source: "google-trends" | "reddit" | "amazon-movers";
    title: string;
    url?: string;
    traffic?: string;    // "200K+" para Google Trends
    subreddit?: string;
    score?: number;
    capturedAt: string;
}

export interface TrendsReport {
    signals: TrendSignal[];
    nicheMatches: string[];   // señales que contienen palabras clave KDP
    capturedAt: string;
}

// Palabras clave KDP/crafts para filtrar señales relevantes
const KDP_KEYWORDS = [
    "coloring", "colouring", "coloring book", "activity book", "mandala", "puzzle",
    "sticker", "journal", "planner", "notebook", "printable", "illustration",
    "pattern", "crafts", "drawing", "sketch", "doodle", "kids activity",
    "adult coloring", "stress relief", "mindfulness", "zentangle",
];

async function fetchGoogleTrendsRSS(geo = "US"): Promise<TrendSignal[]> {
    try {
        const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`;
        const res = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; feed-reader/1.0)" },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const xml = await res.text();
        const signals: TrendSignal[] = [];

        // Parse <item> entries from RSS
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
        for (const item of items.slice(0, 20)) {
            const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
                ?? item.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
            const traffic = item.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/)?.[1] ?? "";
            if (title) {
                signals.push({ source: "google-trends", title, traffic, capturedAt: new Date().toISOString() });
            }
        }
        return signals;
    } catch {
        return [];
    }
}

async function fetchRedditPosts(subreddits = ["kdp", "coloringbook", "selfpublish"]): Promise<TrendSignal[]> {
    const signals: TrendSignal[] = [];
    for (const sub of subreddits) {
        try {
            const res = await fetch(`https://www.reddit.com/r/${sub}/new.json?limit=15`, {
                headers: { "User-Agent": "kdp-radar/1.0 (research bot)" },
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) continue;
            const data = await res.json() as any;
            const posts = data?.data?.children ?? [];
            for (const p of posts) {
                const d = p.data;
                if (!d?.title) continue;
                signals.push({
                    source: "reddit",
                    title: d.title,
                    url: `https://reddit.com${d.permalink}`,
                    subreddit: sub,
                    score: d.score ?? 0,
                    capturedAt: new Date().toISOString(),
                });
            }
        } catch {
            // skip this subreddit
        }
    }
    return signals;
}

async function fetchAmazonMovers(): Promise<TrendSignal[]> {
    try {
        // Activity Books for Children (4951) + Coloring Books (1240853011) movers & shakers
        const urls = [
            "https://www.amazon.com/gp/bestsellers/books/4951",   // Activity Books
            "https://www.amazon.com/gp/bestsellers/books/1240853011", // Coloring Books
        ];
        const signals: TrendSignal[] = [];

        for (const targetUrl of urls) {
            const jinaUrl = `https://r.jina.ai/${targetUrl}`;
            const res = await fetch(jinaUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "text/plain",
                },
                signal: AbortSignal.timeout(12000),
            });
            if (!res.ok) continue;
            const text = await res.text();

            // Extract book titles from the Jina markdown
            const lines = text.split("\n").filter(l => l.trim().length > 10 && l.trim().length < 120);
            const bookLines = lines.filter(l =>
                !l.includes("http") && !l.includes("amazon.com") &&
                /^[\d#*\-\s]*[A-Z]/.test(l.trim())
            );

            for (const line of bookLines.slice(0, 15)) {
                const title = line.replace(/^[\d#*\-\s]+/, "").trim();
                if (title.length > 5) {
                    signals.push({ source: "amazon-movers", title, url: targetUrl, capturedAt: new Date().toISOString() });
                }
            }
        }
        return signals;
    } catch {
        return [];
    }
}

function detectNicheMatches(signals: TrendSignal[]): string[] {
    const matches: string[] = [];
    const kw = KDP_KEYWORDS.map(k => k.toLowerCase());

    for (const s of signals) {
        const lower = s.title.toLowerCase();
        const hit = kw.find(k => lower.includes(k));
        if (hit) {
            const label = `[${s.source}] ${s.title}`;
            if (!matches.includes(label)) matches.push(label);
        }
    }
    return matches.slice(0, 20);
}

export async function fetchTrendsReport(): Promise<TrendsReport> {
    const [googleUS, googleES, reddit, movers] = await Promise.all([
        fetchGoogleTrendsRSS("US"),
        fetchGoogleTrendsRSS("ES"),
        fetchRedditPosts(),
        fetchAmazonMovers(),
    ]);

    const signals = [...googleUS, ...googleES, ...reddit, ...movers];
    const nicheMatches = detectNicheMatches(signals);

    return { signals, nicheMatches, capturedAt: new Date().toISOString() };
}
