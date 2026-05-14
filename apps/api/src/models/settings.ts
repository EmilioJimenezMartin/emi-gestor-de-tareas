import mongoose, { Schema, Document } from "mongoose";

export interface ISettings extends Document {
    key: string;
    value: any;
    is_secret: boolean;
}

const SettingsSchema = new Schema({
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    is_secret: { type: Boolean, default: false }
}, { timestamps: true });

export const Settings = mongoose.models.Settings || mongoose.model<ISettings>("Settings", SettingsSchema);
