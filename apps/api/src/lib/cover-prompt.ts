/**
 * Cover prompt generation — thumbnail-optimized prompts for KDP book covers.
 *
 * Thumbnail science (Amazon A10):
 *  - Cover renders at ~1.5cm on mobile. A cluttered or low-contrast image
 *    is invisible at that size — it needs ONE dominant subject, high contrast,
 *    and a simple palette (2-3 colors max).
 *  - Composition strategy drives visual variety across variants without
 *    changing the subject or style.
 */

import { generateTextWithLLM } from "./ai.js";

export interface CoverPromptContext {
    nicheName: string;
    productType: string;
    style: string;
    audience?: string;
    colorTheme?: string;
}

// Four distinct composition strategies — each produces a visually different result.
// Used for variant generation: each variant uses one strategy.
export const COVER_COMPOSITION_STRATEGIES = [
    "centered hero: single dominant subject perfectly centered, fills 70% of the frame, simple solid or soft-gradient background — maximum clarity at thumbnail size",
    "asymmetric tension: subject placed at left golden-ratio third, strong value contrast with background, generous negative space on the right — dramatic and eye-catching",
    "extreme close-up: tight crop on the most intricate and beautiful detail of the subject, texture-rich and immersive, fills the entire frame edge to edge with no background",
    "symmetrical ornamental: radially symmetric or mirrored composition, decorative border elements echoing the central motif, jewel-tone colors, elegant and balanced",
] as const;

const STYLE_VISUAL_LANGUAGE: Record<string, string> = {
    anime:       "anime art style, cel-shaded professional illustration, vibrant saturated colors, clean confident lines",
    children:    "cute colorful children's book illustration, friendly rounded shapes, bright cheerful pastel colors, soft outlines",
    realistic:   "photorealistic digital painting, rich vibrant colors, cinematic lighting, highly detailed professional illustration",
    watercolor:  "loose expressive watercolor illustration, soft washes of color, visible brushwork, delicate and artistic",
    abstract:    "bold abstract composition, vibrant geometric shapes, dynamic color contrasts, striking graphic design",
    "wall-art":  "premium decorative wall art, elegant illustration, sophisticated rich color palette, fine art quality",
    botanical:   "detailed scientific botanical illustration, lush vibrant plants and flowers, elegant naturalistic style",
    affirmation: "warm uplifting decorative illustration, soft vibrant tones, positive joyful mood, inspirational feel",
    geometric:   "intricate colorful geometric mandala art, perfect mathematical symmetry, jewel-tone colors, mesmerizing",
    celestial:   "mystical cosmic illustration, deep jewel tones, luminous stars and celestial elements, magical atmosphere",
    retro:       "retro vintage poster illustration, warm bold saturated palette, graphic shapes, nostalgic professional quality",
    funko:       "stylized collectible figurine art, bold simplified rounded shapes, vibrant pop colors, glossy finish",
};

const SYSTEM_PROMPT = `You are an expert at writing image generation prompts for professional KDP book covers.

THUMBNAIL LAW — the cover must work at 1.5cm width on a phone:
- ONE dominant subject that fills 60-80% of the frame
- HIGH CONTRAST: subject must stand out sharply from the background
- SIMPLE PALETTE: maximum 2-3 dominant colors — complexity destroys thumbnails
- NO CLUTTER: avoid busy backgrounds, multiple competing elements, or fine details that disappear at small size
- NO TEXT, NO LETTERS, NO NUMBERS, NO WATERMARKS (title is added by the author separately)
- Portrait orientation (taller than wide)

Write ONLY the image generation prompt in English. 45-70 words. No explanation, no preamble, no quotes.`;

export async function generateAICoverPrompt(ctx: CoverPromptContext, strategy: string): Promise<string> {
    const visualLang = STYLE_VISUAL_LANGUAGE[ctx.style] ?? "colorful professional illustration, vibrant rich colors";
    const productLabel = ctx.productType === "coloring-book" ? "coloring book cover"
        : ctx.productType === "printable-poster" ? "printable poster cover"
        : "book cover";

    const userMsg = [
        `Niche: ${ctx.nicheName}`,
        `Product type: ${productLabel}`,
        `Visual style: ${visualLang}`,
        ctx.colorTheme ? `Color preference: ${ctx.colorTheme}` : "",
        ctx.audience ? `Target audience: ${ctx.audience}` : "",
        `Composition strategy for this variant: ${strategy}`,
    ].filter(Boolean).join("\n");

    try {
        const result = await generateTextWithLLM(SYSTEM_PROMPT, userMsg);
        const clean = result.trim().replace(/^["']|["']$/g, "").replace(/\n+/g, " ").trim();
        if (clean.length > 25) return clean;
    } catch { /* fall through to deterministic fallback */ }

    return buildFallbackCoverPrompt(ctx, strategy);
}

function buildFallbackCoverPrompt(ctx: CoverPromptContext, strategy: string): string {
    const visualLang = STYLE_VISUAL_LANGUAGE[ctx.style] ?? "colorful professional illustration, vibrant rich colors";
    const productLabel = ctx.productType === "coloring-book" ? "coloring book cover artwork"
        : "printable poster cover";
    const strategyLabel = strategy.split(":")[0].trim();
    return `${ctx.nicheName} ${productLabel}, ${visualLang}, ${strategyLabel} composition, single dominant subject with high contrast against clean background, simple bold color palette, thumbnail-optimized, no text, no letters, no watermarks, portrait orientation`;
}
