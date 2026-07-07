// Tipos compartidos del dominio KDP Factory.
// Extraídos de kdp-factory-app.tsx — importados por la app principal y los paneles.

export type NicheStatus = "found" | "active" | "research" | "archived";
export type NicheProductType = "coloring-book" | "printable-poster" | "seamless-pattern" | "other";
export type NicheStyle = "generic" | "anime" | "illustration" | "children" | "realistic" | "watercolor" | "abstract"
    | "wall-art" | "botanical" | "affirmation" | "geometric" | "celestial" | "retro" | "funko";

export interface NicheRoyaltyEntry {
    month: string;
    sales: number;
    revenue: number;
}

export interface NicheKDPListing {
    _id: string;
    title: string;
    subtitle: string;
    description: string;
    keywords: string[];
    etsyTags?: string[];
    categories?: string[];
    seoNotes?: string;
    appliedAt?: string;
    generatedAt: string;
    language?: string;
    platform?: "kdp" | "etsy" | "both";
}

export interface NicheFE {
    _id: string;
    name: string;
    nickname?: string;
    description: string;
    tags: string[];
    status: NicheStatus;
    competition: "unknown" | "low" | "medium" | "high";
    demand: "unknown" | "low" | "medium" | "high";
    productType: NicheProductType;
    styleCategory: NicheStyle;
    styleCategories?: NicheStyle[];
    notes: string;
    generatedPrompt?: string;
    discoveryImagePrompt?: string;
    pendingCatalogPrompts?: string[];
    catalogIds?: string[];
    phase?: "niche" | "catalog" | "libro" | "seo" | "pdf" | "cover" | "published";
    publishedAt?: string;
    lifecycleStage?: "pre-published" | "published" | "end-of-life";
    lifecycleAlertsSent?: number[];
    asin?: string;
    etsyUrl?: string;
    gumroadUrl?: string;
    sourceTitulo?: string;
    royalties?: NicheRoyaltyEntry[];
    listings?: NicheKDPListing[];
    targetAudience?: "children" | "teens" | "adults" | "all";
    score?: number;
    scoreBreakdown?: { demand: number; competition: number; uniqueness: number; potential: number };
    scoreReason?: string;
    scoredAt?: string;
    marketScan?: {
        score: number;
        verdict: "gold" | "good" | "saturated" | "dead";
        scoreBreakdown?: { demand: number; supply: number; competition: number };
        us?: { resultCount: number | null; medianReviews: number | null; bestsellerBadges: number };
        es?: { resultCount: number | null; medianReviews: number | null; bestsellerBadges: number };
        scannedAt?: string;
    };
    radarInsight?: Record<string, unknown>;
    competitorIntel?: Record<string, unknown>;
    autoPilotEnabled?: boolean;
    currentPrice?: number;
    suggestedPrice?: number;
    autopilotLog?: Array<{ type: string; details: string; suggestedPrice?: number; executedAt: string }>;
    sampleImageUrl?: string;
    coverUrl?: string;
    backCoverUrl?: string;
    bookPdfUrl?: string;
    coverCandidates?: string[];
    coverCandidatesData?: Record<string, { rawUrl: string; layers: unknown[] }>;
    phaseChangedAt?: string;
    pipelineHasCatalogs?: boolean;
    pipelineHasPdf?: boolean;
    pipelineHasListings?: boolean;
    pipelineHasCover?: boolean;
    saturationScore?: number;
    saturationLabel?: "low" | "medium" | "high";
    saturationData?: {
        topProducts: Array<{ title: string; reviews: number; bestseller: boolean; price: string }>;
        avgReviews: number;
        lowReviewCount: number;
        totalAnalyzed: number;
        opportunityScore: number;
    };
    saturationScannedAt?: string;
    catalogImageOrder?: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface CatalogImageFE {
    publicId: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
    createdAt: string;
}

export interface FavoriteImage {
    url: string;
    label: string;
    source: "vault" | "catalog" | "cloudinary" | "generated";
    savedAt: string;
    catalogId?: string;
}

export interface IACatalogFE {
    _id: string;
    name: string;
    prompt: string;
    promptParts?: { theme: string; specs: string; details: string; particulars: string };
    productType?: "coloring-book" | "printable-poster" | "seamless-pattern" | "other";
    creativity?: number;
    negativePrompt?: string;
    aiModel: { id: string; name: string; provider: string; modelId: string };
    width: number;
    height: number;
    totalImages: number;
    images: CatalogImageFE[];
    status: "queued" | "pending" | "running" | "completed" | "failed" | "cancelled";
    lastError?: string;
    skippedImages?: number;
    nicheIds?: string[];
    currentPrompt?: string;
    createdAt: string;
    imageStartedAt?: number;
    rawPrompt?: boolean;
}

export type CloudinaryImage = {
    publicId: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
    nicheId?: string | null;
    nicheIds?: string[];
    createdAt?: string;
};

export interface PageTextStyle {
    content: string;
    bold: boolean;
    italic: boolean;
    fontSize: number;
    color: string;
    align: "left" | "center" | "right";
    verticalAlign: "top" | "middle" | "bottom";
    fontFamily: "helvetica" | "times" | "courier";
}

export interface BookPage {
    id: string;
    type: "image" | "text" | "both" | "owner";
    image?: { url: string; scale: number; label?: string; border?: { width: number; color: string } };
    text: PageTextStyle;
}

export interface KdpSaleFE {
    _id: string;
    period: string;
    asin: string;
    nicheId: string | null;
    title: string;
    marketplace: string;
    unitsSold: number;
    royaltiesUsd: number;
}

export interface BookDraft {
    id: string;
    fileName: string;
    pages: BookPage[];
    savedAt: string;
    nicheId?: string;
}

export type PublishEventStatus = "planned" | "inprogress" | "published" | "idea";

export interface PublishEvent {
    id: string;
    title: string;
    date: string;
    nicheId?: string;
    status: PublishEventStatus;
    color: string;
}

export interface TimePrediction {
    nicheName: string;
    season: string;
    peakWeek: string;
    optimalPublishDate: string;
    weeksUntilPublish: number;
    urgency: "critical" | "soon" | "ok" | "evergreen";
    tip: string;
}
