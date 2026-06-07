import mongoose, { Schema, Document } from "mongoose";

export interface IRoyaltyEntry {
    month: string;
    sales: number;
    revenue: number;
}

export interface IKDPListing {
    title: string;
    subtitle: string;
    description: string;
    keywords: string[];
    generatedAt: Date;
    language?: string;
}

export interface INiche extends Document {
    name: string;
    description: string;
    tags: string[];
    status: "found" | "active" | "research" | "archived" | "discarded";
    competition: "unknown" | "low" | "medium" | "high";
    demand: "unknown" | "low" | "medium" | "high";
    productType: "coloring-book" | "printable-poster" | "seamless-pattern" | "other";
    styleCategory: "generic" | "anime" | "illustration" | "children" | "realistic" | "watercolor" | "abstract" | "wall-art" | "botanical" | "affirmation" | "geometric" | "celestial" | "retro";
    styleCategories: ("generic" | "anime" | "illustration" | "children" | "realistic" | "watercolor" | "abstract" | "wall-art" | "botanical" | "affirmation" | "geometric" | "celestial" | "retro")[];
    notes: string;
    generatedPrompt: string;
    catalogIds: string[];
    phase: "niche" | "catalog" | "libro" | "seo" | "cover" | "published";
    bookPdfUrl?: string;
    coverUrl?: string;
    backCoverUrl?: string;
    publishedAt?: Date;
    asin?: string;
    etsyUrl?: string;
    gumroadUrl?: string;
    nickname?: string;
    sourceTitulo?: string;
    discoveryImagePrompt?: string;
    royalties?: IRoyaltyEntry[];
    listings?: IKDPListing[];
    score?: number;
    scoreBreakdown?: { demand: number; competition: number; uniqueness: number; potential: number };
    scoreReason?: string;
    scoredAt?: Date;
    pendingCatalogPrompts?: string[];
    autoPilotEnabled?: boolean;
    sampleImageUrl?: string;
    catalogImageOrder?: string[];
    coverCandidates?: string[];
    phaseChangedAt?: Date;
    // Pipeline artifact flags — source of truth for phase computation
    pipelineHasCatalogs?: boolean;
    pipelineHasPdf?: boolean;
    pipelineHasListings?: boolean;
    pipelineHasCover?: boolean;
    pipelineErrors?: number;
    createdAt: Date;
    updatedAt: Date;
}

const NicheSchema = new Schema<INiche>(
    {
        name: { type: String, required: true },
        description: { type: String, default: "" },
        tags: [{ type: String }],
        status: { type: String, enum: ["found", "active", "research", "archived", "discarded"], default: "found" },
        competition: { type: String, enum: ["unknown", "low", "medium", "high"], default: "unknown" },
        demand: { type: String, enum: ["unknown", "low", "medium", "high"], default: "unknown" },
        productType: { type: String, enum: ["coloring-book", "printable-poster", "seamless-pattern", "other"], default: "coloring-book" },
        styleCategory: { type: String, enum: ["generic", "anime", "illustration", "children", "realistic", "watercolor", "abstract", "wall-art", "botanical", "affirmation", "geometric", "celestial", "retro"], default: "generic" },
        styleCategories: [{ type: String, enum: ["generic", "anime", "illustration", "children", "realistic", "watercolor", "abstract", "wall-art", "botanical", "affirmation", "geometric", "celestial", "retro"] }],
        notes: { type: String, default: "" },
        generatedPrompt: { type: String, default: "" },
        catalogIds: [{ type: String }],
        phase: { type: String, enum: ["niche", "catalog", "libro", "seo", "cover", "published"], default: "niche" },
        bookPdfUrl: { type: String },
        coverUrl: { type: String },
        backCoverUrl: { type: String },
        publishedAt: { type: Date },
        asin: { type: String, default: "" },
        etsyUrl: { type: String, default: "" },
        gumroadUrl: { type: String, default: "" },
        nickname: { type: String, default: "" },
        sourceTitulo: { type: String, default: "" },
        discoveryImagePrompt: { type: String, default: "" },
        royalties: [{
            month: { type: String, required: true },
            sales: { type: Number, default: 0 },
            revenue: { type: Number, default: 0 },
        }],
        listings: [{
            title: { type: String, default: "" },
            subtitle: { type: String, default: "" },
            description: { type: String, default: "" },
            keywords: [{ type: String }],
            generatedAt: { type: Date, default: Date.now },
            language: { type: String, default: "en" },
        }],
        score: { type: Number },
        scoreBreakdown: {
            demand: { type: Number },
            competition: { type: Number },
            uniqueness: { type: Number },
            potential: { type: Number },
        },
        scoreReason: { type: String },
        scoredAt: { type: Date },
        pendingCatalogPrompts: [{ type: String }],
        autoPilotEnabled: { type: Boolean, default: false },
        sampleImageUrl: { type: String },
        catalogImageOrder: [{ type: String }],
        coverCandidates: [{ type: String }],
        phaseChangedAt: { type: Date },
        pipelineHasCatalogs: { type: Boolean, default: false },
        pipelineHasPdf: { type: Boolean, default: false },
        pipelineHasListings: { type: Boolean, default: false },
        pipelineHasCover: { type: Boolean, default: false },
        pipelineErrors: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Auto-set phaseChangedAt whenever phase is written via findOneAndUpdate / findByIdAndUpdate
NicheSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"] as any, function (this: any) {
    const update = this.getUpdate() as any;
    if (update?.$set?.phase) {
        update.$set.phaseChangedAt = new Date();
    }
});

export const Niche = mongoose.model<INiche>("Niche", NicheSchema);
