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
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    lastError?: string;
    skippedImages: number;
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
            enum: ["pending", "running", "completed", "failed", "cancelled"],
            default: "pending",
        },
        lastError: { type: String, default: "" },
        skippedImages: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export const Catalog = mongoose.model<ICatalog>("Catalog", CatalogSchema);
