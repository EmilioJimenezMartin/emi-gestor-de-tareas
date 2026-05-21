import mongoose, { Schema, Document } from "mongoose";

export interface IIntegration extends Document {
    name: string;
    icon: string;
    status: "dev" | "paused" | "study" | "active";
    statusLabel: string;
    desc: string;
    url?: string;
    createdAt: Date;
    updatedAt: Date;
}

const IntegrationSchema = new Schema<IIntegration>(
    {
        name: { type: String, required: true },
        icon: { type: String, default: "🔗" },
        status: { type: String, enum: ["dev", "paused", "study", "active"], default: "study" },
        statusLabel: { type: String, default: "En estudio" },
        desc: { type: String, default: "" },
        url: { type: String, default: "" },
    },
    { timestamps: true }
);

export const Integration = mongoose.model<IIntegration>("Integration", IntegrationSchema);
