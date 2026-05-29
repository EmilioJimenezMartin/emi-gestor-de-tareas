import mongoose, { Schema, Document } from "mongoose";

export interface RadarLog {
    timestamp: Date;
    level: "info" | "success" | "error" | "warning";
    message: string;
}

export interface IRadarJob extends Document {
    jobId: string;
    url: string;
    mode: "etsy-niches" | "amazon-niches" | "general";
    geminiModel?: string;
    nicheName?: string;
    context?: string;
    storageKey?: string;
    status: "running" | "completed" | "failed";
    logs: RadarLog[];
    result?: any;
    preNichos?: any[];
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

const RadarJobSchema = new Schema<IRadarJob>(
    {
        jobId: { type: String, required: true, unique: true },
        url: { type: String, required: true },
        mode: { type: String, enum: ["etsy-niches", "amazon-niches", "general"], default: "general" },
        geminiModel: { type: String, default: "gemini-2.0-flash" },
        nicheName: { type: String },
        context: { type: String },
        storageKey: { type: String, default: "RADAR_ETSY_RESULT" },
        status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
        logs: [{ timestamp: Date, level: String, message: String }],
        result: { type: Schema.Types.Mixed },
        preNichos: { type: [Schema.Types.Mixed], default: undefined },
        error: { type: String },
    },
    { timestamps: true }
);

export const RadarJob = mongoose.model<IRadarJob>("RadarJob", RadarJobSchema);
