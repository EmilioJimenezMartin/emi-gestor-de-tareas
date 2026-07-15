// Variation hints are ONLY about spatial composition, zoom, and density.
// They NEVER introduce a new subject, creature, or scene concept — the niche subject
// is always the anchor and must dominate every generated image.
const STYLE_VARIATION_HINTS: Record<string, string[]> = {
    anime: [
        "close-up face and upper body, centered composition",
        "wide shot showing full figure with minimal environment cues",
        "slight low-angle view looking up at the subject",
        "slight high-angle view, overhead perspective",
        "3/4 angle view, subject turned slightly to one side",
        "extreme close-up on a single detail of the subject",
    ],
    botanical: [
        "single specimen centered, filling the page, minimal negative space",
        "wide view of an arrangement, multiple specimens spread across the page",
        "close-up of a single structural detail — leaf, stem, seed pod",
        "overhead flat-lay composition",
        "slight low-angle, subject viewed from below",
        "two specimens side-by-side, comparative layout",
    ],
    celestial: [
        "perfectly centered radial symmetry, filling the page",
        "slightly off-center, asymmetric balance",
        "tight crop on the central motif, border cut off",
        "wide view with significant negative space in corners",
        "zoomed-in on one quadrant detail",
        "full-page tiling, edge-to-edge repetition",
    ],
    geometric: [
        "center-weighted mandala, full-page fill",
        "corner-anchored design, diagonal axis",
        "single repeating unit zoomed in to fill the page",
        "wide view showing the full pattern repeat",
        "tight crop on the innermost ring of detail",
        "asymmetric offset, pattern shifted to one side",
    ],
    children: [
        "centered subject, generous white space all around",
        "subject slightly lower in frame, open sky or space above",
        "close-up showing face and upper body only",
        "wide shot with subject small in the middle of open space",
        "subject in the corner, large open area to color freely",
        "two of the same subject side by side, mirrored",
    ],
    "wall-art": [
        "centered portrait orientation, balanced negative space",
        "wide landscape crop, subject spanning the full width",
        "close-up on the central motif, border cropped out",
        "zoomed out, full decorative border visible",
        "slight diagonal tilt, dynamic balance",
        "triptych-style, subject repeated three times across the width",
    ],
    retro: [
        "centered, poster-style composition with clear horizon",
        "close-up on the focal element, cropped tight",
        "wide establishing shot, small subject in large setting",
        "low-angle heroic perspective",
        "flat overhead bird's-eye view",
        "two-thirds rule — subject offset to the left or right",
    ],
};

// Safe fallback: purely about zoom/angle/density — never about subject matter.
export const DEFAULT_VARIATION_HINTS = [
    "centered composition, subject filling 70% of the frame, even white margins",
    "close-up crop on the upper portion of the subject, detailed texture emphasis",
    "wide view, subject centered but smaller, generous negative space all around",
    "slight low-angle perspective, subject seen from just below center",
    "slight high-angle perspective, subject seen from just above center",
    "tight crop on the most intricate region of the subject, maximum detail density",
];

/** Hint de variación composicional para un slot dado. */
export function getVariationHint(style: string, slotIndex: number): string {
    const hints = STYLE_VARIATION_HINTS[style] ?? DEFAULT_VARIATION_HINTS;
    return hints[slotIndex % hints.length];
}

/**
 * Inyecta el hint de variación en un prompt ya formado.
 * Solo añade información de composición/zoom — nunca cambia el sujeto.
 */
export function injectVariationHint(prompt: string, style: string, slotIndex: number): string {
    const hint = getVariationHint(style, slotIndex);
    if (prompt.toLowerCase().includes(hint.slice(0, 30).toLowerCase())) return prompt;
    const anchor = ", no color, no shading";
    const idx = prompt.indexOf(anchor);
    if (idx >= 0) return `${prompt.slice(0, idx)}, ${hint}${prompt.slice(idx)}`;
    return `${prompt}, ${hint}`;
}

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
    evolutionSeed?: string,
    targetAudience?: string,
): Promise<string | null> {
    const aiType = productType === "printable-poster" ? "printable-particulars" : "niche-particulars";

    // Use only spatial/zoom hint — never a subject-changing hint
    const hints = STYLE_VARIATION_HINTS[style] ?? DEFAULT_VARIATION_HINTS;
    const hint = hints[slotIndex % hints.length];

    const audiencePart = targetAudience && targetAudience !== "all" ? `audience: ${targetAudience}` : "";
    const extras = [
        style,
        audiencePart,
        `composition: ${hint}`,
        discoveryPrompt ? `visual reference: ${discoveryPrompt.slice(0, 120)}` : "",
        evolutionSeed || "",
    ].filter(Boolean).join("; ");

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
