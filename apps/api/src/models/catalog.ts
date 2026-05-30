import mongoose, { Schema, Document } from "mongoose";

export interface CatalogImage {
    publicId: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
    createdAt: string;
}

export interface ICatalog extends Document {
    name: string;
    prompt: string;
    promptParts?: {
        theme: string;
        specs: string;
        details: string;
        particulars: string;
    };
    productType?: "coloring-book" | "printable-poster" | "seamless-pattern" | "other";
    creativity?: number;
    negativePrompt?: string;
    aiModel: {
        id: string;
        name: string;
        provider: string;
        modelId: string;
    };
    width: number;
    height: number;
    totalImages: number;
    images: CatalogImage[];
    status: "queued" | "pending" | "running" | "completed" | "failed" | "cancelled";
    lastError?: string;
    retries: number;
    skippedImages: number;
    queueOrder: number;
    nicheIds: string[];
    createdAt: Date;
    updatedAt: Date;
}

const CatalogImageSchema = new Schema<CatalogImage>(
    {
        publicId: String,
        url: String,
        width: Number,
        height: Number,
        bytes: Number,
        createdAt: String,
    },
    { _id: false }
);

const CatalogSchema = new Schema<ICatalog>(
    {
        name: { type: String, required: true },
        prompt: { type: String, required: true },
        promptParts: {
            theme: { type: String, default: "" },
            specs: { type: String, default: "" },
            details: { type: String, default: "" },
            particulars: { type: String, default: "" },
        },
        productType: { type: String, enum: ["coloring-book", "printable-poster", "seamless-pattern", "other"], default: "coloring-book" },
        creativity: { type: Number, default: 50 },
        negativePrompt: { type: String, default: "" },
        aiModel: {
            id: String,
            name: String,
            provider: String,
            modelId: String,
        },
        width: { type: Number, default: 1024 },
        height: { type: Number, default: 1024 },
        totalImages: { type: Number, required: true },
        images: { type: [CatalogImageSchema], default: [] },
        status: {
            type: String,
            enum: ["queued", "pending", "running", "completed", "failed", "cancelled"],
            default: "pending",
        },
        lastError: { type: String, default: "" },
        retries: { type: Number, default: 0 },
        skippedImages: { type: Number, default: 0 },
        queueOrder: { type: Number, default: 0 },
        nicheIds: [{ type: String }],
    },
    { timestamps: true }
);

export const Catalog = mongoose.model<ICatalog>("Catalog", CatalogSchema);
