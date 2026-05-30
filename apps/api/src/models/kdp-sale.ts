import mongoose, { Schema, Document } from "mongoose";

export interface IKdpSale extends Document {
    period: string;        // "2026-04"
    asin: string;
    nicheId?: string;
    title: string;
    marketplace: string;
    unitsSold: number;
    royaltiesUsd: number;
    createdAt: Date;
    updatedAt: Date;
}

const KdpSaleSchema = new Schema<IKdpSale>(
    {
        period: { type: String, required: true },
        asin: { type: String, required: true },
        nicheId: { type: String, default: null },
        title: { type: String, default: "" },
        marketplace: { type: String, default: "" },
        unitsSold: { type: Number, default: 0 },
        royaltiesUsd: { type: Number, default: 0 },
    },
    { timestamps: true }
);

KdpSaleSchema.index({ period: 1, asin: 1, marketplace: 1 }, { unique: true });
KdpSaleSchema.index({ nicheId: 1 });

export const KdpSale = mongoose.model<IKdpSale>("KdpSale", KdpSaleSchema);
