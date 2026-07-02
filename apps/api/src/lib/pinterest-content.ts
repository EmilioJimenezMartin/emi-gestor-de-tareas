/**
 * Pinterest pin content generator.
 * Builds ready-to-post pin data from niche + listing without calling any external API.
 */

export interface PinContent {
    title: string;
    description: string;
    hashtags: string[];
    imageUrl: string;
    amazonUrl: string;
    boardSuggestion: string;
    pinType: "cover" | "sample";
}

const BOARD_BY_PRODUCT: Record<string, string> = {
    "coloring-book":      "Adult Coloring Books",
    "printable-poster":   "Printable Wall Art",
    "seamless-pattern":   "Pattern Design & Surface Art",
};

const STANDARD_TAGS: Record<string, string[]> = {
    "coloring-book":    ["#coloringbook", "#adultcoloring", "#coloringforadults", "#stressrelief", "#mindfulness", "#coloringtherapy", "#arttherapy", "#coloringpages"],
    "printable-poster": ["#printableart", "#walldecor", "#digitaldownload", "#printablewall", "#homedecor", "#artprint"],
    "seamless-pattern": ["#seamlesspattern", "#surfacedesign", "#patterndesign", "#digitalart", "#textiledesign"],
};

const COVER_TITLES = [
    (name: string, title: string) => title || `${name} Coloring Book for Adults`,
    (name: string, _: string) => `${name} — Perfect Gift for Coloring Lovers`,
    (name: string, _: string) => `New Release: ${name} Coloring Book`,
    (name: string, _: string) => `Stress Relief Gift Idea: ${name}`,
];

const SAMPLE_TITLES = [
    (name: string) => `Inside Look: ${name} Coloring Pages`,
    (name: string) => `${name} — See What's Inside!`,
    (name: string) => `Beautiful ${name} Designs to Color`,
    (name: string) => `Preview: ${name} Coloring Book Pages`,
];

function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildNicheTags(nicheName: string): string[] {
    return nicheName
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 4)
        .map(w => `#${w}`);
}

function buildKeywordTags(keywords: string[]): string[] {
    return keywords
        .slice(0, 4)
        .map(k => `#${k.replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "")}`)
        .filter(t => t.length > 2 && t.length <= 22);
}

export function generateCoverPin(niche: any, listing: any, coverUrl: string, variantIndex = 0): PinContent {
    const asin = niche.asin ?? "";
    const amazonUrl = asin
        ? `https://www.amazon.com/dp/${asin}`
        : `https://www.amazon.com/s?k=${encodeURIComponent(niche.name + " coloring book")}`;

    const titleFn = COVER_TITLES[variantIndex % COVER_TITLES.length];
    const title = titleFn(niche.name, listing?.title ?? "").slice(0, 100);

    const listingDesc = listing?.description ? stripHtml(listing.description).slice(0, 250) : "";
    const description = [
        listingDesc || `${niche.name} — a beautiful coloring book for adults.`,
        "",
        "🔗 Available now on Amazon (link in bio)",
    ].join("\n");

    const productType = niche.productType ?? "coloring-book";
    const standard = STANDARD_TAGS[productType] ?? STANDARD_TAGS["coloring-book"];
    const nicheHashtags = buildNicheTags(niche.name);
    const kwHashtags = buildKeywordTags(listing?.keywords ?? []);
    const hashtags = [...new Set([...standard, ...nicheHashtags, ...kwHashtags])].slice(0, 15);

    return {
        title,
        description,
        hashtags,
        imageUrl: coverUrl,
        amazonUrl,
        boardSuggestion: BOARD_BY_PRODUCT[productType] ?? "Adult Coloring Books",
        pinType: "cover",
    };
}

export function generateSamplePin(niche: any, listing: any, sampleImageUrl: string, variantIndex = 0): PinContent {
    const asin = niche.asin ?? "";
    const amazonUrl = asin
        ? `https://www.amazon.com/dp/${asin}`
        : `https://www.amazon.com/s?k=${encodeURIComponent(niche.name + " coloring book")}`;

    const titleFn = SAMPLE_TITLES[variantIndex % SAMPLE_TITLES.length];
    const title = titleFn(niche.name).slice(0, 100);

    const description = [
        `Take a peek inside our ${niche.name} coloring book! These are real pages — intricate designs perfect for stress relief and mindfulness.`,
        "",
        "🎨 Grab your copy on Amazon (link in bio)",
    ].join("\n");

    const productType = niche.productType ?? "coloring-book";
    const standard = STANDARD_TAGS[productType] ?? STANDARD_TAGS["coloring-book"];
    const nicheHashtags = buildNicheTags(niche.name);
    const kwHashtags = buildKeywordTags(listing?.keywords ?? []);
    const hashtags = [...new Set([...standard, ...nicheHashtags, ...kwHashtags, "#insidelook", "#coloringpagepreview"])].slice(0, 15);

    return {
        title,
        description,
        hashtags,
        imageUrl: sampleImageUrl,
        amazonUrl,
        boardSuggestion: BOARD_BY_PRODUCT[productType] ?? "Adult Coloring Books",
        pinType: "sample",
    };
}
