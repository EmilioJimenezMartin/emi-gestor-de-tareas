import mongoose, { Schema, Document } from "mongoose";

export interface ISavedPrompt extends Document {
    name: string;
    category: string;
    promptParts: {
        theme: string;
        specs: string;
        details: string;
        particulars: string;
    };
    aiModel?: {
        id: string;
        name: string;
        provider: string;
        modelId: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

const SavedPromptSchema = new Schema<ISavedPrompt>(
    {
        name: { type: String, required: true },
        category: { type: String, required: true, default: "General" },
        promptParts: {
            theme: { type: String, default: "" },
            specs: { type: String, default: "" },
            details: { type: String, default: "" },
            particulars: { type: String, default: "" },
        },
        aiModel: {
            id: { type: String, default: "" },
            name: { type: String, default: "" },
            provider: { type: String, default: "" },
            modelId: { type: String, default: "" },
        },
    },
    { timestamps: true }
);

export const SavedPrompt = mongoose.model<ISavedPrompt>("SavedPrompt", SavedPromptSchema);
