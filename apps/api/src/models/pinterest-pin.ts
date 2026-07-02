import mongoose, { Schema, Document } from "mongoose";

export type PinStatus = "pending" | "posted" | "skipped" | "scheduled" | "failed";
export type PinType = "cover" | "sample";

export interface IPinterestPin extends Document {
    nicheId: string;
    nicheName: string;
    imageUrl: string;
    title: string;
    description: string;
    hashtags: string[];
    amazonUrl: string;
    boardId?: string;
    boardSuggestion: string;
    pinType: PinType;
    status: PinStatus;
    scheduledFor?: Date;
    postedAt?: Date;
    pinterestPinId?: string;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

const PinterestPinSchema = new Schema<IPinterestPin>({
    nicheId:          { type: String, required: true, index: true },
    nicheName:        { type: String, required: true },
    imageUrl:         { type: String, required: true },
    title:            { type: String, required: true },
    description:      { type: String, required: true },
    hashtags:         [{ type: String }],
    amazonUrl:        { type: String, required: true },
    boardId:          { type: String },
    boardSuggestion:  { type: String, required: true },
    pinType:          { type: String, enum: ["cover", "sample"], required: true },
    status:           { type: String, enum: ["pending", "posted", "skipped", "scheduled", "failed"], default: "pending" },
    scheduledFor:     { type: Date },
    postedAt:         { type: Date },
    pinterestPinId:   { type: String },
    error:            { type: String },
}, { timestamps: true });

export const PinterestPin = mongoose.models.PinterestPin
    || mongoose.model<IPinterestPin>("PinterestPin", PinterestPinSchema);
