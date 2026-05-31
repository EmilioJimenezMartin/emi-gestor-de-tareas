import mongoose, { Schema, model } from "mongoose";

export interface ITelegramAction {
    type: "niche-discovery" | "phase-approve" | "img-test";
    nicheId: string;
    nicheName: string;
    targetPhase?: string;
    messageId?: number;
    status: "pending" | "continuar" | "omitir" | "descartar" | "approved" | "rejected";
    imageUrl?: string;
    autoApproveAt: Date;
    createdAt: Date;
    resolvedAt?: Date;
}

const schema = new Schema<ITelegramAction>({
    type: { type: String, required: true },
    nicheId: { type: String, required: true },
    nicheName: { type: String, required: true },
    targetPhase: String,
    messageId: Number,
    status: { type: String, default: "pending" },
    imageUrl: String,
    autoApproveAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: Date,
});

export const TelegramAction = model<ITelegramAction>("TelegramAction", schema);
