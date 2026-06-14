// Style-specific variation hints — each set generates semantically distinct pages
// for that art style rather than cycling through generic complexity levels.
const STYLE_VARIATION_HINTS: Record<string, string[]> = {
    anime: [
        "chibi character close-up portrait, expressive large eyes, kawaii pose",
        "dynamic action pose, diagonal energy, speed motion lines",
        "magical girl or hero transformation, sparkles and ribbons, dramatic spread",
        "cozy slice-of-life scene, multiple characters, indoor setting",
        "fantasy landscape with character silhouette, epic wide shot",
        "group scene, characters interacting, cheerful energy",
    ],
    botanical: [
        "close-up single specimen filling the page, high botanical detail",
        "garden arrangement with 3-5 different plants, overhead flat lay",
        "wild meadow scene, scattered organic composition, insects included",
        "potted plant collection on a windowsill, domestic cozy setting",
        "pressed botanical plate style, scientific specimen layout with labels",
        "seasonal harvest — fruits, flowers and foliage, abundant composition",
    ],
    celestial: [
        "central sun mandala with symmetrical radiating rays and geometric border",
        "full moon with constellation ring, sacred geometry overlay",
        "zodiac wheel — 12 symbols arranged in intricate circular pattern",
        "crystal cluster and gem arrangement, sacred geometry lines",
        "celestial eye mandala, third-eye symmetrical composition",
        "phases of the moon sequence, horizontal banner with star fill",
    ],
    geometric: [
        "central mandala with 8-fold symmetry, intricate petal layers",
        "tessellated hexagonal pattern filling the full page",
        "concentric circles with interlocking ornamental details",
        "kaleidoscope star pattern, 6-fold radial symmetry",
        "Islamic geometric lattice, star polygon interlace",
        "fractal-inspired spiral, Fibonacci growth pattern",
    ],
    children: [
        "single cute character, large simple shapes, centered, easy to color",
        "two animal friends in a fun outdoor scene, simple backgrounds",
        "animal close-up portrait, big expressive face, bold outlines",
        "magical vehicle or object, simple shape, playful details",
        "repeating pattern of simple cute icons, grid layout",
        "cozy scene — child's bedroom or garden — simple furniture, happy mood",
    ],
    "wall-art": [
        "centered portrait composition, Art Nouveau ornamental border",
        "botanical wreath with decorative lettering space in center",
        "abstract floral explosion, filling the frame edge to edge",
        "architectural archway with nature framing, elegant symmetry",
        "goddess or nature figure, flowing robes, organic motifs surrounding",
        "geometric triptych pattern, three vertical panels with connecting motifs",
    ],
    retro: [
        "vintage travel poster composition, bold horizon, simple scenery",
        "mid-century modern abstract, geometric shapes, 50s palette reference",
        "retro diner or soda shop scene, cheerful Americana",
        "vintage botanical label illustration, bordered, decorative typography space",
        "pin-up style character silhouette, clean graphic composition",
        "retro space race illustration, rocket and stars, bold geometry",
    ],
};

// Hints designed to be safe for coloring book format: isolated focal subject,
// no complex backgrounds, no conflicting lighting instructions.
export const DEFAULT_VARIATION_HINTS = [
    "centered isolated subject filling the page, clean white space around, no background elements",
    "close-up portrait of the main subject, highly detailed face and features, no scene context",
    "full-body or full-form view, subject posed elegantly, pure white background",
    "decorative ornamental arrangement of the subject, symmetrical layout, mandala-like framing",
    "two or three instances of the subject grouped together, playful arrangement, no background",
    "subject shown mid-action, flowing lines suggesting movement, isolated on white",
];

/** Hint de variación composicional para un slot dado — cada imagen del catálogo sale distinta. */
export function getVariationHint(style: string, slotIndex: number): string {
    const hints = STYLE_VARIATION_HINTS[style] ?? DEFAULT_VARIATION_HINTS;
    return hints[slotIndex % hints.length];
}

/**
 * Inyecta el hint de variación en un prompt ya formado.
 * Si el prompt lleva la fórmula de coloring (con exclusiones al final), lo inserta ANTES
 * de las exclusiones para que FLUX le dé peso; si no, lo añade al final.
 */
export function injectVariationHint(prompt: string, style: string, slotIndex: number): string {
    const hint = getVariationHint(style, slotIndex);
    if (prompt.toLowerCase().includes(hint.slice(0, 30).toLowerCase())) return prompt; // ya inyectado
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
): Promise<string | null> {
    const aiType = productType === "printable-poster" ? "printable-particulars" : "niche-particulars";

    // Pick style-specific variation hint so each slot is semantically different
    const hints = STYLE_VARIATION_HINTS[style] ?? DEFAULT_VARIATION_HINTS;
    const hint = hints[slotIndex % hints.length];

    const extras = [
        style,
        `composition variation: ${hint}`,
        discoveryPrompt ? `visual reference: ${discoveryPrompt.slice(0, 120)}` : "",
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
