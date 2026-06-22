import mongoose, { Schema, Document } from "mongoose";

export interface IPromptDNA extends Document {
    partType: "theme" | "specs" | "details" | "particulars";
    partValue: string;
    favoriteHits: number;
    bookHits: number;
    totalSeen: number;
    dnaScore: number;
    lastSignalAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PromptDNASchema = new Schema<IPromptDNA>(
    {
        partType: { type: String, enum: ["theme", "specs", "details", "particulars"], required: true },
        partValue: { type: String, required: true },
        favoriteHits: { type: Number, default: 0 },
        bookHits: { type: Number, default: 0 },
        totalSeen: { type: Number, default: 0 },
        dnaScore: { type: Number, default: 0 },
        lastSignalAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

PromptDNASchema.index({ partType: 1, partValue: 1 }, { unique: true });
PromptDNASchema.index({ dnaScore: -1 });

export const PromptDNA = mongoose.model<IPromptDNA>("PromptDNA", PromptDNASchema);
