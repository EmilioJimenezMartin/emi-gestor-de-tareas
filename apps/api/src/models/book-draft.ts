import mongoose, { Schema, Document } from "mongoose";

export interface IBookDraft extends Document {
    nicheId?: string;
    fileName: string;
    pages: any[];
    pdfUrl?: string;
    pageCount?: number;
    savedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const BookDraftSchema = new Schema<IBookDraft>(
    {
        nicheId: { type: String, index: true },
        fileName: { type: String, required: true, default: "libro-kdp" },
        pages: [Schema.Types.Mixed],
        pdfUrl: { type: String },
        pageCount: { type: Number },
        savedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export const BookDraft = mongoose.model<IBookDraft>("BookDraft", BookDraftSchema);
