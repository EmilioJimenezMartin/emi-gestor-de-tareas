import mongoose, { Schema, type Document } from "mongoose";

export type AutoCloneStatus =
    | "pending_approval"   // discovered, waiting for user approval
    | "approved"           // approved, waiting in queue to clone
    | "cloning"            // clone-bestseller running
    | "done"               // clones created successfully
    | "rejected";          // user rejected

export interface AutoCloneItemDoc extends Document {
    topic: string;
    searchQuery: string;
    asin?: string;
    amazonUrl?: string;
    foundTitle?: string;
    foundBsr?: string;
    status: AutoCloneStatus;
    telegramMsgId?: number;
    clones?: any[];
    rejectionReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const AutoCloneItemSchema = new Schema<AutoCloneItemDoc>(
    {
        topic:          { type: String, required: true },
        searchQuery:    { type: String, required: true },
        asin:           { type: String },
        amazonUrl:      { type: String },
        foundTitle:     { type: String },
        foundBsr:       { type: String },
        status:         { type: String, enum: ["pending_approval","approved","cloning","done","rejected"], default: "pending_approval" },
        telegramMsgId:  { type: Number },
        clones:         { type: Schema.Types.Mixed },
        rejectionReason:{ type: String },
    },
    { timestamps: true }
);

export const AutoCloneItem = mongoose.model<AutoCloneItemDoc>("AutoCloneItem", AutoCloneItemSchema);
