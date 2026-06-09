import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { Settings } from "../models/settings.js";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production-min-32-chars!!";
const JWT_EXPIRY = "24h";

// Único usuario autorizado — credenciales en MongoDB (nunca en texto plano en código)
export const AUTHORIZED_EMAIL = "emi_jmn91@hotmail.com";
const PASSWORD_HASH = "$2b$12$XvfnnlLwZEaLR4UigHQ3HOkMVbwXBju1ee4G7mSqT0Fh7TUrzXdF6";

export async function verifyPassword(plain: string): Promise<boolean> {
    return bcrypt.compare(plain, PASSWORD_HASH);
}

export function generateJWT(email: string): string {
    return jwt.sign({ sub: email, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyJWT(token: string): { sub: string } | null {
    try {
        return jwt.verify(token, JWT_SECRET) as { sub: string };
    } catch {
        return null;
    }
}

// ── TOTP (2FA) ────────────────────────────────────────────────────────────────

const TOTP_SETTINGS_KEY = "AUTH_TOTP_SECRET";

async function getTotpSecret(): Promise<string | null> {
    try {
        const row = await Settings.findOne({ key: TOTP_SETTINGS_KEY }).lean();
        return (row as any)?.value || null;
    } catch {
        return null;
    }
}

async function saveTotpSecret(secret: string): Promise<void> {
    await Settings.findOneAndUpdate(
        { key: TOTP_SETTINGS_KEY },
        { key: TOTP_SETTINGS_KEY, value: secret, is_secret: true },
        { upsert: true }
    );
}

export async function isTotpEnabled(): Promise<boolean> {
    const secret = await getTotpSecret();
    return !!secret;
}

export async function generateTotpSetup(): Promise<{ secret: string; qrCodeUrl: string; otpauthUrl: string }> {
    // Generate 20 random bytes as the TOTP secret
    const randomBytes = crypto.getRandomValues(new Uint8Array(20));
    const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let base32 = "";
    for (let i = 0; i < randomBytes.length; i += 5) {
        const b = [randomBytes[i] ?? 0, randomBytes[i+1] ?? 0, randomBytes[i+2] ?? 0, randomBytes[i+3] ?? 0, randomBytes[i+4] ?? 0];
        base32 += base32Chars[(b[0] >> 3) & 0x1f];
        base32 += base32Chars[((b[0] & 0x07) << 2) | (b[1] >> 6)];
        base32 += base32Chars[(b[1] >> 1) & 0x1f];
        base32 += base32Chars[((b[1] & 0x01) << 4) | (b[2] >> 4)];
        base32 += base32Chars[((b[2] & 0x0f) << 1) | (b[3] >> 7)];
        base32 += base32Chars[(b[3] >> 2) & 0x1f];
        base32 += base32Chars[((b[3] & 0x03) << 3) | (b[4] >> 5)];
        base32 += base32Chars[b[4] & 0x1f];
    }
    const totp = new OTPAuth.TOTP({
        issuer: "EMI Gestor",
        label: AUTHORIZED_EMAIL,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(base32),
    });
    const otpauthUrl = totp.toString();
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
    await saveTotpSecret(totp.secret.base32);
    return { secret: totp.secret.base32, qrCodeUrl, otpauthUrl };
}

export async function verifyTotp(token: string): Promise<boolean> {
    const secretB32 = await getTotpSecret();
    if (!secretB32) return false;
    const totp = new OTPAuth.TOTP({
        issuer: "EMI Gestor",
        label: AUTHORIZED_EMAIL,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secretB32),
    });
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
}
