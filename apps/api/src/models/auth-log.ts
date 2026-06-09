import mongoose, { Schema } from "mongoose";

const AuthLogSchema = new Schema({
    event:   { type: String, required: true }, // "login_ok" | "login_fail" | "2fa_ok" | "2fa_fail" | "logout"
    email:   { type: String },
    ip:      { type: String },
    ua:      { type: String },
    at:      { type: Date, default: () => new Date() },
}, { timestamps: false });

// TTL: borra logs de más de 90 días automáticamente
AuthLogSchema.index({ at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const AuthLog = mongoose.models.AuthLog || mongoose.model("AuthLog", AuthLogSchema);
