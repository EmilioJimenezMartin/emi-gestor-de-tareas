import sharp from "sharp";
import { Catalog } from "../models/catalog.js";

const COVER_W = 768;
const COVER_H = 1024;
const GAP = 10;
const BG = { r: 250, g: 250, b: 250 };

export type CollageLayout = "grid2x2" | "triptych" | "hero-sidebar" | "strips3";

async function fetchBuf(url: string): Promise<Buffer> {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

async function tile(buf: Buffer, w: number, h: number): Promise<Buffer> {
    return sharp(buf).resize(w, h, { fit: "cover", position: "centre" }).toBuffer();
}

function base(w = COVER_W, h = COVER_H) {
    return sharp({ create: { width: w, height: h, channels: 3, background: BG } });
}

export async function buildCollage(
    urls: string[],
    layout: CollageLayout,
    w = COVER_W,
    h = COVER_H,
): Promise<Buffer> {
    const needed = layout === "grid2x2" ? 4 : 3;
    const bufs: Buffer[] = [];
    for (const url of urls) {
        if (bufs.length >= needed) break;
        try { bufs.push(await fetchBuf(url)); } catch { /* skip failed */ }
    }
    if (bufs.length < 2) throw new Error("Not enough images for collage");

    // Pad by repeating from the start
    const origLen = bufs.length;
    while (bufs.length < needed) bufs.push(bufs[bufs.length % origLen]);

    if (layout === "grid2x2") {
        const tw = Math.floor((w - GAP * 3) / 2);
        const th = Math.floor((h - GAP * 3) / 2);
        const tiles = await Promise.all(bufs.slice(0, 4).map(b => tile(b, tw, th)));
        return base(w, h).composite([
            { input: tiles[0], left: GAP, top: GAP },
            { input: tiles[1], left: GAP * 2 + tw, top: GAP },
            { input: tiles[2], left: GAP, top: GAP * 2 + th },
            { input: tiles[3], left: GAP * 2 + tw, top: GAP * 2 + th },
        ]).jpeg({ quality: 93 }).toBuffer();
    }

    if (layout === "triptych") {
        const topH = Math.floor(h * 0.58);
        const botH = h - topH - GAP * 3;
        const botW = Math.floor((w - GAP * 3) / 2);
        const [top, b1, b2] = await Promise.all([
            tile(bufs[0], w - GAP * 2, topH),
            tile(bufs[1], botW, botH),
            tile(bufs[2], botW, botH),
        ]);
        return base(w, h).composite([
            { input: top, left: GAP, top: GAP },
            { input: b1, left: GAP, top: topH + GAP * 2 },
            { input: b2, left: botW + GAP * 2, top: topH + GAP * 2 },
        ]).jpeg({ quality: 93 }).toBuffer();
    }

    if (layout === "hero-sidebar") {
        const heroW = Math.floor(w * 2 / 3) - GAP;
        const sideW = w - heroW - GAP * 3;
        const sideH = Math.floor((h - GAP * 3) / 2);
        const [hero, s1, s2] = await Promise.all([
            tile(bufs[0], heroW, h - GAP * 2),
            tile(bufs[1], sideW, sideH),
            tile(bufs[2], sideW, sideH),
        ]);
        return base(w, h).composite([
            { input: hero, left: GAP, top: GAP },
            { input: s1, left: heroW + GAP * 2, top: GAP },
            { input: s2, left: heroW + GAP * 2, top: sideH + GAP * 2 },
        ]).jpeg({ quality: 93 }).toBuffer();
    }

    // strips3: 3 equal horizontal strips
    const stripH = Math.floor((h - GAP * 4) / 3);
    const strips = await Promise.all(bufs.slice(0, 3).map(b => tile(b, w - GAP * 2, stripH)));
    return base(w, h).composite(
        strips.map((s, i) => ({ input: s, left: GAP, top: GAP + i * (stripH + GAP) }))
    ).jpeg({ quality: 93 }).toBuffer();
}

// Half-colored effect: left side = grayscale (uncolored), right side = full color
export async function buildHalfColored(imageUrl: string, w = COVER_W, h = COVER_H): Promise<Buffer> {
    const buf = await fetchBuf(imageUrl);
    const resized = await sharp(buf).resize(w, h, { fit: "cover", position: "centre" }).jpeg({ quality: 95 }).toBuffer();

    const halfW = Math.floor(w / 2);
    const gray = await sharp(resized).grayscale().toBuffer();

    // Extract the colored right half and composite it over the grayscale base
    const colorRight = await sharp(resized)
        .extract({ left: halfW, top: 0, width: w - halfW, height: h })
        .toBuffer();

    // Add a thin dividing line between the two halves
    const divider = await sharp({
        create: { width: 3, height: h, channels: 4, background: { r: 200, g: 200, b: 200, alpha: 200 } }
    }).png().toBuffer();

    return sharp(gray)
        .composite([
            { input: colorRight, left: halfW, top: 0 },
            { input: divider, left: halfW - 1, top: 0 },
        ])
        .jpeg({ quality: 93 })
        .toBuffer();
}

// Collect catalog image URLs for a niche (from completed catalogs, shuffled for variety)
export async function pickCatalogImages(nicheId: string, count = 8): Promise<string[]> {
    const catalogs = await Catalog.find({
        nicheIds: nicheId,
        status: "completed",
    }).sort({ createdAt: -1 }).limit(6).lean();

    const all: string[] = [];
    for (const c of catalogs) {
        for (const img of (c as any).images ?? []) {
            if (img.url) all.push(img.url);
        }
    }

    // Fisher-Yates shuffle
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }

    return all.slice(0, count);
}
