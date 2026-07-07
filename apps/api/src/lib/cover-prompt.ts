/**
 * Cover prompt generation — thumbnail-optimized prompts for KDP book covers.
 *
 * Thumbnail science (Amazon A10):
 *  - Cover renders at ~1.5cm on mobile. ONE dominant subject, high contrast,
 *    bold color palette (2-3 rich colors). No clutter.
 *  - Bestselling coloring book covers show FULLY COLORED illustrations
 *    (not line art) to demonstrate the potential of the book.
 */

import { generateTextWithLLM } from "./ai.js";

export interface CoverPromptContext {
    nicheName: string;
    productType: string;
    style: string;
    audience?: string;
    colorTheme?: string;
}

// Six composition strategies matching real Amazon bestseller patterns.
export const COVER_COMPOSITION_STRATEGIES = [
    "centered hero: ONE subject fills 70-80% of frame, perfectly centered, richly colored, jewel-tone palette (deep purple, gold, teal), high contrast against simple dark or gradient background — maximum thumbnail impact",
    "full-bleed illustration: subject bleeds edge to edge with no margin, intricate colorful details filling every corner, immersive and stunning, feels premium and hand-crafted",
    "symmetrical mandala: perfect radial symmetry, ornate geometric patterns, deep jewel tones (sapphire, amethyst, gold, emerald), centered on page, mystical and meditative atmosphere",
    "nature close-up: extreme close-up of the most beautiful detail — flower petals, animal fur, crystal facets, leaf veins — rich warm colors, macro photography aesthetic, fills entire frame",
    "layered depth: foreground element in sharp detail, middle subject prominently featured, soft dreamy background gradient, creates sense of depth and dimension, cinematic quality",
    "bold graphic: single simplified iconic shape at large scale, bold color blocks (2-3 maximum), strong geometric composition, modern poster aesthetic, pops instantly at small thumbnail size",
] as const;

const STYLE_VISUAL_LANGUAGE: Record<string, string> = {
    anime:       "anime art style, vibrant cel-shaded illustration, bold saturated colors, clean confident linework, professional manga aesthetic",
    children:    "bright colorful children's book illustration, friendly rounded shapes, cheerful warm palette, playful and inviting, professional print quality",
    realistic:   "photorealistic digital painting, cinematic lighting, rich saturated colors, hyperdetailed professional artwork",
    watercolor:  "vibrant watercolor illustration, lush color washes, loose expressive brushwork, beautiful and artistic, professional art quality",
    abstract:    "bold colorful abstract composition, dynamic geometric shapes, vivid color contrasts, striking graphic design, high visual impact",
    "wall-art":  "premium decorative illustration, elegant rich color palette, sophisticated fine art quality, beautiful enough to frame",
    botanical:   "lush detailed botanical illustration, rich vibrant greens and florals, naturalistic and elegant, premium print quality",
    affirmation: "warm uplifting illustration, soft vibrant tones, positive joyful mood, beautiful decorative elements, inspirational and welcoming",
    geometric:   "intricate colorful geometric mandala, perfect mathematical symmetry, deep jewel tones (sapphire, gold, ruby, emerald), mesmerizing and meditative",
    celestial:   "mystical cosmic illustration, deep indigo and violet background, luminous gold stars and moons, magical and ethereal atmosphere",
    retro:       "retro vintage poster illustration, warm bold palette (burnt orange, teal, cream), graphic mid-century aesthetic, nostalgic and professional",
    funko:       "stylized collectible figurine art, bold rounded shapes, vibrant pop colors, glossy finish, playful and fun",
    generic:     "professional digital illustration, rich vibrant colors, high contrast, stunning visual impact, bestseller-quality artwork",
};

const SYSTEM_PROMPT = `You are an expert at writing image generation prompts for professional KDP coloring book covers that SELL.

BESTSELLER RULES — the cover must look like a TOP-10 Amazon coloring book:
- The illustration must be FULLY COLORED (rich, vibrant colors) — NOT black and white line art
- ONE dominant subject that fills 60-80% of the frame — no clutter
- JEWEL TONES: deep, rich, saturated colors (purple, teal, gold, emerald, ruby, sapphire)
- HIGH CONTRAST: the subject must pop sharply against the background
- PROFESSIONAL QUALITY: the illustration should look like it was done by a professional artist
- PORTRAIT orientation (taller than wide, ~1600×2560 KDP ratio)
- NO TEXT, NO LETTERS, NO NUMBERS, NO WATERMARKS

Write ONLY the image generation prompt in English. 50-80 words. No explanation, no preamble, no quotes.`;

export async function generateAICoverPrompt(ctx: CoverPromptContext, strategy: string): Promise<string> {
    const visualLang = STYLE_VISUAL_LANGUAGE[ctx.style] ?? STYLE_VISUAL_LANGUAGE.generic;
    const productLabel = ctx.productType === "coloring-book" ? "KDP coloring book cover"
        : ctx.productType === "printable-poster" ? "KDP printable poster cover"
        : "KDP book cover";

    const userMsg = [
        `Niche: ${ctx.nicheName}`,
        `Product type: ${productLabel}`,
        `Visual style: ${visualLang}`,
        ctx.colorTheme ? `Color preference: ${ctx.colorTheme}` : "",
        ctx.audience ? `Target audience: ${ctx.audience}` : "",
        `Composition strategy for this variant: ${strategy}`,
        `Remember: FULLY COLORED illustration, jewel tones, one dominant subject, no text.`,
    ].filter(Boolean).join("\n");

    try {
        const result = await generateTextWithLLM(SYSTEM_PROMPT, userMsg);
        const clean = result.trim().replace(/^["']|["']$/g, "").replace(/\n+/g, " ").trim();
        if (clean.length > 25) return clean;
    } catch { /* fall through to deterministic fallback */ }

    return buildFallbackCoverPrompt(ctx, strategy);
}

function buildFallbackCoverPrompt(ctx: CoverPromptContext, strategy: string): string {
    const visualLang = STYLE_VISUAL_LANGUAGE[ctx.style] ?? STYLE_VISUAL_LANGUAGE.generic;
    const strategyLabel = strategy.split(":")[0].trim();
    return `${ctx.nicheName} coloring book cover, ${visualLang}, ${strategyLabel} composition, richly colored vibrant illustration, jewel tones (deep purple, gold, teal, emerald), one dominant subject high contrast against background, professional KDP bestseller quality, portrait orientation, no text no watermarks`;
}
