// Generates a unique image-generation prompt for a single catalog slot.
// discoveryPrompt: the AI-enhanced core saved during discovery (optional, improves coherence).
// slotIndex: 0-based index for this slot (drives variation instructions).
export async function generateCatalogPrompt(
    base: string,
    nicheName: string,
    productType: string,
    style: string,
    discoveryPrompt?: string,
    slotIndex = 0,
): Promise<string | null> {
    const aiType = productType === "printable-poster" ? "printable-particulars" : "niche-particulars";

    // Variation seeds so each slot within a catalog gets meaningfully different content
    const variationHints = [
        "simple, large shapes, suitable for young children, minimal detail",
        "medium complexity, decorative borders, flowing organic shapes",
        "intricate detailed patterns, fine linework, for adults or older children",
        "geometric repetition, symmetrical design, mandala-inspired",
        "nature-inspired elements, botanical motifs, organic composition",
        "bold playful shapes, cartoon-like, rounded outlines",
    ];
    const hint = variationHints[slotIndex % variationHints.length];

    const extras = [style, hint, discoveryPrompt ? `inspired by: ${discoveryPrompt}` : ""].filter(Boolean).join("; ");

    try {
        const res = await fetch(`${base}/ai/generate-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: aiType, niche: nicheName, productType, extras }),
            signal: AbortSignal.timeout(25_000),
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        return data.result?.particulars || null;
    } catch {
        return null;
    }
}
