import mongoose, { Schema, Document } from "mongoose";

export interface IViralNiche extends Document {
    term: string;
    termEs: string;
    sources: string[];
    velocity: number;
    colorableScore: number;
    status: "new" | "watched" | "converted" | "dismissed";
    detectedAt: Date;
    scanId: string;
    convertedNicheId?: string;
    raw?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

const ViralNicheSchema = new Schema<IViralNiche>(
    {
        term: { type: String, required: true },
        termEs: { type: String, default: "" },
        sources: [{ type: String }],
        velocity: { type: Number, default: 0 },
        colorableScore: { type: Number, default: 0 },
        status: { type: String, enum: ["new", "watched", "converted", "dismissed"], default: "new" },
        detectedAt: { type: Date, default: Date.now },
        scanId: { type: String, required: true },
        convertedNicheId: { type: String },
        raw: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

ViralNicheSchema.index({ scanId: 1 });
ViralNicheSchema.index({ velocity: -1 });
ViralNicheSchema.index({ term: 1, scanId: 1 }, { unique: true });

export const ViralNiche = mongoose.model<IViralNiche>("ViralNiche", ViralNicheSchema);
