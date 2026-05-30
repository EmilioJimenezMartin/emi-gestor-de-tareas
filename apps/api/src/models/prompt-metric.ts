import mongoose, { Schema, Document } from "mongoose";

export interface IPromptMetric extends Document {
    promptHash: string;
    promptPreview: string;
    productType: string;
    attempts: number;
    successes: number;
    skips: number;
    totalScore: number;
    avgScore: number;
    successRate: number;
    lastUsed: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PromptMetricSchema = new Schema<IPromptMetric>(
    {
        promptHash: { type: String, required: true },
        promptPreview: { type: String, default: "" },
        productType: { type: String, default: "coloring-book" },
        attempts: { type: Number, default: 0 },
        successes: { type: Number, default: 0 },
        skips: { type: Number, default: 0 },
        totalScore: { type: Number, default: 0 },
        avgScore: { type: Number, default: 0 },
        successRate: { type: Number, default: 0 },
        lastUsed: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

PromptMetricSchema.index({ promptHash: 1, productType: 1 }, { unique: true });
PromptMetricSchema.index({ successRate: -1 });

export const PromptMetric = mongoose.model<IPromptMetric>("PromptMetric", PromptMetricSchema);
