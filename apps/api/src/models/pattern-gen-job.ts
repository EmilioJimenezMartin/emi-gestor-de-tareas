import mongoose, { Schema, Document } from "mongoose";

export interface PatternGenLog {
    timestamp: Date;
    level: "info" | "success" | "error" | "warning";
    message: string;
}

export interface IPatternGenJob extends Document {
    jobId: string;
    prompt: string;
    negativePrompt?: string;
    modelId: string;
    provider: string;
    seed: number;
    width: number;
    height: number;
    styleId?: string;
    styleLabel?: string;
    paletteId?: string;
    paletteLabel?: string;
    status: "running" | "completed" | "failed";
    logs: PatternGenLog[];
    resultDataUrl?: string;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

const PatternGenJobSchema = new Schema<IPatternGenJob>(
    {
        jobId:          { type: String, required: true, unique: true },
        prompt:         { type: String, required: true },
        negativePrompt: { type: String },
        modelId:        { type: String, required: true },
        provider:       { type: String, required: true },
        seed:           { type: Number, default: 0 },
        width:          { type: Number, default: 1024 },
        height:         { type: Number, default: 1024 },
        styleId:        { type: String },
        styleLabel:     { type: String },
        paletteId:      { type: String },
        paletteLabel:   { type: String },
        status:         { type: String, enum: ["running", "completed", "failed"], default: "running" },
        logs:           [{ timestamp: Date, level: String, message: String }],
        resultDataUrl:  { type: String },
        error:          { type: String },
    },
    { timestamps: true }
);

export const PatternGenJob = mongoose.model<IPatternGenJob>("PatternGenJob", PatternGenJobSchema);
