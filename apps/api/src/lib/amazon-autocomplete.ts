/**
 * Amazon autocomplete — extrae términos de búsqueda reales para enriquecer listings SEO.
 * Usa el endpoint público de sugerencias de Amazon (sin auth).
 */
export async function getAmazonKeywords(query: string, maxResults = 8): Promise<string[]> {
    try {
        const url = `https://completion.amazon.com/api/2017/suggestions?mid=ATVPDKIKX0DER&alias=aps&prefix=${encodeURIComponent(query)}&limit=${maxResults}&plain=1`;
        const res = await fetch(url, {
            signal: AbortSignal.timeout(6_000),
            headers: { "User-Agent": "Mozilla/5.0 (compatible; bot)" },
        });
        if (!res.ok) return [];
        const data = await res.json() as any;
        return (data.suggestions ?? [])
            .map((s: any) => (s.value as string)?.trim())
            .filter(Boolean)
            .slice(0, maxResults) as string[];
    } catch {
        return [];
    }
}
