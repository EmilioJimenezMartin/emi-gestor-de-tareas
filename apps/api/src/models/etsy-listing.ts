import mongoose, { Schema, Document } from "mongoose";

export interface IEtsyListing extends Document {
    // Etsy IDs
    etsyListingId: string;
    shopId: string;
    // Product details
    title: string;
    description: string;
    price: number;
    currency: string;
    quantity: number;
    tags: string[];
    // Type
    listingType: "physical" | "download";
    status: "active" | "inactive" | "draft" | "expired" | "sold_out";
    // Files (for digital listings)
    digitalFiles: { fileId: string; filename: string; rank: number }[];
    // Linked entities
    gelatoProductId?: string;       // gelatoProductId if physical
    catalogId?: string;
    nicheId?: string;
    // Mockup images
    images: { url: string; listingImageId?: string }[];
    // Stats
    views?: number;
    favCount?: number;
    soldCount?: number;
    // Raw Etsy response
    etsyData?: any;
    createdAt: Date;
    updatedAt: Date;
}

const EtsyListingSchema = new Schema<IEtsyListing>(
    {
        etsyListingId: { type: String, required: true, unique: true },
        shopId: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, default: "" },
        price: { type: Number, required: true },
        currency: { type: String, default: "EUR" },
        quantity: { type: Number, default: 999 },
        tags: [{ type: String }],
        listingType: { type: String, enum: ["physical", "download"], default: "download" },
        status: { type: String, enum: ["active", "inactive", "draft", "expired", "sold_out"], default: "draft" },
        digitalFiles: [{ fileId: String, filename: String, rank: Number }],
        gelatoProductId: { type: String },
        catalogId: { type: String },
        nicheId: { type: String },
        images: [{ url: String, listingImageId: String }],
        views: { type: Number, default: 0 },
        favCount: { type: Number, default: 0 },
        soldCount: { type: Number, default: 0 },
        etsyData: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

export const EtsyListing = mongoose.model<IEtsyListing>("EtsyListing", EtsyListingSchema);
