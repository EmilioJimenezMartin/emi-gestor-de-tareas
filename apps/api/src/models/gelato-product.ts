import mongoose, { Schema, Document } from "mongoose";

export interface IGelatoProduct extends Document {
    // Internal refs
    storeId: string;
    gelatoProductId: string;        // ID returned by Gelato ecommerce API
    templateId?: string;
    // Product details
    title: string;
    description?: string;
    status: "active" | "draft" | "deleted";
    productType: "physical" | "digital";
    // Linked to our catalog system
    catalogId?: string;             // MongoDB _id of our IACatalog
    nicheId?: string;               // MongoDB _id of our Niche
    // File
    printFileUrl?: string;          // PDF URL (Cloudinary)
    coverFileUrl?: string;
    // Pricing
    retailPrice?: number;
    currency?: string;
    gelatoCost?: number;
    // Etsy
    etsyListingId?: string;
    etsyListingUrl?: string;
    // Raw Gelato response
    gelatoData?: any;
    createdAt: Date;
    updatedAt: Date;
}

const GelatoProductSchema = new Schema<IGelatoProduct>(
    {
        storeId: { type: String, required: true },
        gelatoProductId: { type: String, required: true, unique: true },
        templateId: { type: String },
        title: { type: String, required: true },
        description: { type: String },
        status: { type: String, enum: ["active", "draft", "deleted"], default: "draft" },
        productType: { type: String, enum: ["physical", "digital"], default: "physical" },
        catalogId: { type: String },
        nicheId: { type: String },
        printFileUrl: { type: String },
        coverFileUrl: { type: String },
        retailPrice: { type: Number },
        currency: { type: String, default: "EUR" },
        gelatoCost: { type: Number },
        etsyListingId: { type: String },
        etsyListingUrl: { type: String },
        gelatoData: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

export const GelatoProduct = mongoose.model<IGelatoProduct>("GelatoProduct", GelatoProductSchema);
