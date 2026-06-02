import { Schema, model } from "mongoose";

export interface IRadarInsight {
    _id: string;
    createdAt: Date;
    filters: {
        platforms: string[];
        dateRange: string;
        totalProducts: number;
    };
    analysis: {
        summary: string;
        topNiches: { name: string; count: number; platforms: string[] }[];
        emergingNiches: { name: string; reason: string; confidence: "high" | "medium" | "low" }[];
        repeatedThemes: { theme: string; count: number }[];
        platformBreakdown: { platform: string; count: number; percentage: number }[];
        recommendations: string[];
    };
    aiProvider: string;
}

const RadarInsightSchema = new Schema<IRadarInsight>(
    {
        filters: {
            platforms: [{ type: String }],
            dateRange: { type: String, default: "all" },
            totalProducts: { type: Number, default: 0 },
        },
        analysis: {
            summary: { type: String, default: "" },
            topNiches: [{
                name: { type: String },
                count: { type: Number },
                platforms: [{ type: String }],
            }],
            emergingNiches: [{
                name: { type: String },
                reason: { type: String },
                confidence: { type: String, enum: ["high", "medium", "low"] },
            }],
            repeatedThemes: [{
                theme: { type: String },
                count: { type: Number },
            }],
            platformBreakdown: [{
                platform: { type: String },
                count: { type: Number },
                percentage: { type: Number },
            }],
            recommendations: [{ type: String }],
        },
        aiProvider: { type: String, default: "google" },
    },
    { timestamps: true, collection: "radarinsights" }
);

export const RadarInsight = model<IRadarInsight>("RadarInsight", RadarInsightSchema);
