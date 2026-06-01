import mongoose, { Schema, Document } from "mongoose";

export interface IRejectedImage extends Document {
    catalogId: string;
    catalogName: string;
    nicheIds: string[];
    imageUrl: string;
    publicId: string;
    reason: string;
    score: number;
    prompt: string;
    reviewStatus: "pending" | "approved" | "deleted";
    telegramMessageId?: number;
    approvedToCatalogId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const RejectedImageSchema = new Schema<IRejectedImage>(
    {
        catalogId: { type: String, required: true, index: true },
        catalogName: { type: String, required: true },
        nicheIds: [{ type: String }],
        imageUrl: { type: String, required: true },
        publicId: { type: String, required: true },
        reason: { type: String, required: true },
        score: { type: Number, required: true },
        prompt: { type: String, default: "" },
        reviewStatus: { type: String, enum: ["pending", "approved", "deleted"], default: "pending" },
        telegramMessageId: { type: Number },
        approvedToCatalogId: { type: String },
    },
    { timestamps: true }
);

export const RejectedImage = mongoose.model<IRejectedImage>("RejectedImage", RejectedImageSchema);
