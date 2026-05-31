// Generates a fresh, unique image generation prompt for a single catalog slot
// using the niche-particulars / printable-particulars AI types.
// Returns null on failure so callers can fall back to niche.generatedPrompt.
export async function generateCatalogPrompt(
    base: string,
    nicheName: string,
    productType: string,
    style: string,
): Promise<string | null> {
    const aiType = productType === "printable-poster" ? "printable-particulars" : "niche-particulars";
    try {
        const res = await fetch(`${base}/ai/generate-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: aiType, niche: nicheName, productType, extras: style }),
            signal: AbortSignal.timeout(25_000),
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        return data.result?.particulars || null;
    } catch {
        return null;
    }
}
