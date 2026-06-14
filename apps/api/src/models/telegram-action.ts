import mongoose, { Schema, model } from "mongoose";

export interface ITelegramAction {
    type: "niche-discovery" | "phase-approve" | "img-test" | "clone-decision";
    nicheId: string;
    nicheName: string;
    targetPhase?: string;
    messageId?: number;
    status: "pending" | "continuar" | "omitir" | "descartar" | "approved" | "rejected";
    imageUrl?: string;
    imagePrompt?: string;
    aiModel?: { id: string; name: string; provider: string; modelId: string };
    cloneData?: Record<string, unknown>;
    autoApproveAt: Date;
    createdAt: Date;
    resolvedAt?: Date;
}

const schema = new Schema<ITelegramAction>({
    type: { type: String, required: true },
    nicheId: { type: String, default: "" },
    nicheName: { type: String, required: true },
    targetPhase: String,
    messageId: Number,
    status: { type: String, default: "pending" },
    imageUrl: String,
    imagePrompt: String,
    aiModel: { type: Schema.Types.Mixed },
    cloneData: { type: Schema.Types.Mixed },
    autoApproveAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: Date,
});

export const TelegramAction = model<ITelegramAction>("TelegramAction", schema);
