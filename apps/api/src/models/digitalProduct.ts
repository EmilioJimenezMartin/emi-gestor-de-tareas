import mongoose, { Schema, Document } from "mongoose";

export interface IProductPlatform {
    name: string;
    earnings: number;
    url?: string;
    date?: string;
}

export interface IDigitalProduct extends Document {
    type: string;
    title: string;
    description: string;
    status: "activo" | "pausado" | "borrador";
    platforms: IProductPlatform[];
    totalEarnings: number;
    nicheId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const PlatformSchema = new Schema<IProductPlatform>(
    {
        name: { type: String, default: "" },
        earnings: { type: Number, default: 0 },
        url: { type: String, default: "" },
        date: { type: String, default: "" },
    },
    { _id: false }
);

const DigitalProductSchema = new Schema<IDigitalProduct>(
    {
        type: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, default: "" },
        status: { type: String, enum: ["activo", "pausado", "borrador"], default: "activo" },
        platforms: [PlatformSchema],
        totalEarnings: { type: Number, default: 0 },
        nicheId: { type: String, default: "" },
    },
    { timestamps: true }
);

export const DigitalProduct = mongoose.model<IDigitalProduct>("DigitalProduct", DigitalProductSchema);
