import mongoose, { Schema, model } from "mongoose";

export interface ITelegramAction {
    type: "phase-approve";
    nicheId: string;
    nicheName: string;
    targetPhase: string;       // phase to advance TO if approved
    messageId?: number;        // Telegram message ID (for editing after response)
    status: "pending" | "approved" | "rejected";
    imageUrl?: string;
    autoApproveAt: Date;       // auto-approve if no response after 24h
    createdAt: Date;
    resolvedAt?: Date;
}

const schema = new Schema<ITelegramAction>({
    type: { type: String, required: true },
    nicheId: { type: String, required: true },
    nicheName: { type: String, required: true },
    targetPhase: { type: String, required: true },
    messageId: Number,
    status: { type: String, default: "pending" },
    imageUrl: String,
    autoApproveAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: Date,
});

export const TelegramAction = model<ITelegramAction>("TelegramAction", schema);
