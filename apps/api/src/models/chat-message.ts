import mongoose, { Schema, type Document } from "mongoose";

export interface ChatMessageDoc extends Document {
    role: "user" | "assistant";
    text: string;
    source: "ui" | "telegram";
    createdAt: Date;
}

const ChatMessageSchema = new Schema<ChatMessageDoc>(
    {
        role:   { type: String, enum: ["user", "assistant"], required: true },
        text:   { type: String, required: true },
        source: { type: String, enum: ["ui", "telegram"], required: true },
    },
    { timestamps: true }
);

ChatMessageSchema.index({ createdAt: -1 });

export const ChatMessage = mongoose.model<ChatMessageDoc>("ChatMessage", ChatMessageSchema);
