import type { FastifyInstance } from "fastify";
import {
    AUTHORIZED_EMAIL,
    verifyPassword,
    generateJWT,
    verifyJWT,
    isTotpEnabled,
    generateTotpSetup,
    verifyTotp,
} from "../lib/auth.js";
import { getMongoStatus } from "../lib/mongo.js";

// In-memory rate limiter for login (no deps needed)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return true;
    }
    if (entry.count >= MAX_ATTEMPTS) return false;
    entry.count++;
    return true;
}

function clearRateLimit(ip: string) {
    loginAttempts.delete(ip);
}

export async function registerAuthRoutes(app: FastifyInstance) {
    // POST /auth/login — step 1: validate email + password, return partial token if 2FA enabled
    app.post("/auth/login", async (req, reply) => {
        const ip = req.ip || "unknown";
        if (!checkRateLimit(ip)) {
            return reply.code(429).send({ error: "Demasiados intentos. Espera 15 minutos." });
        }

        const { email, password } = req.body as { email?: string; password?: string };
        if (!email || !password) {
            return reply.code(400).send({ error: "Email y contraseña requeridos" });
        }
        if (email.toLowerCase().trim() !== AUTHORIZED_EMAIL) {
            return reply.code(401).send({ error: "Credenciales incorrectas" });
        }

        const valid = await verifyPassword(password);
        if (!valid) {
            return reply.code(401).send({ error: "Credenciales incorrectas" });
        }

        clearRateLimit(ip);
        const totpEnabled = getMongoStatus() === "connected" ? await isTotpEnabled() : false;

        if (!totpEnabled) {
            // No 2FA configured — issue full JWT immediately
            const token = generateJWT(email);
            return reply.send({ token, twoFactorRequired: false });
        }

        // Issue a short-lived "pending 2FA" token
        const pendingToken = generateJWT(email + ":pending2fa");
        return reply.send({ pendingToken, twoFactorRequired: true });
    });

    // POST /auth/verify-2fa — step 2: verify TOTP code and exchange for full JWT
    app.post("/auth/verify-2fa", async (req, reply) => {
        const { pendingToken, code } = req.body as { pendingToken?: string; code?: string };
        if (!pendingToken || !code) {
            return reply.code(400).send({ error: "Token y código requeridos" });
        }

        const payload = verifyJWT(pendingToken);
        if (!payload || !payload.sub.endsWith(":pending2fa")) {
            return reply.code(401).send({ error: "Token inválido o expirado" });
        }

        const valid = await verifyTotp(code.replace(/\s/g, ""));
        if (!valid) {
            return reply.code(401).send({ error: "Código 2FA incorrecto" });
        }

        const email = payload.sub.replace(":pending2fa", "");
        const token = generateJWT(email);
        return reply.send({ token });
    });

    // POST /auth/setup-2fa — configure TOTP (requires valid JWT)
    app.post("/auth/setup-2fa", async (req, reply) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "No autorizado" });
        const payload = verifyJWT(auth.slice(7));
        if (!payload || payload.sub !== AUTHORIZED_EMAIL) return reply.code(401).send({ error: "No autorizado" });

        if (getMongoStatus() !== "connected") {
            return reply.code(503).send({ error: "MongoDB no disponible" });
        }

        const setup = await generateTotpSetup();
        return reply.send({
            secret: setup.secret,
            qrCodeUrl: setup.qrCodeUrl,
            otpauthUrl: setup.otpauthUrl,
            message: "Escanea el QR con Google Authenticator. Guarda el secreto como backup.",
        });
    });

    // POST /auth/confirm-2fa — verify a TOTP code against the saved secret (used after setup to confirm it works)
    app.post("/auth/confirm-2fa", async (req, reply) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "No autorizado" });
        const payload = verifyJWT(auth.slice(7));
        if (!payload || payload.sub !== AUTHORIZED_EMAIL) return reply.code(401).send({ error: "No autorizado" });

        const { code } = req.body as { code?: string };
        if (!code) return reply.code(400).send({ error: "Código requerido" });

        const valid = await verifyTotp(code.replace(/\s/g, ""));
        if (!valid) return reply.code(401).send({ error: "Código incorrecto" });
        return reply.send({ ok: true });
    });

    // POST /auth/disable-2fa — remove TOTP secret (requires JWT + current TOTP code to confirm)
    app.post("/auth/disable-2fa", async (req, reply) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "No autorizado" });
        const payload = verifyJWT(auth.slice(7));
        if (!payload || payload.sub !== AUTHORIZED_EMAIL) return reply.code(401).send({ error: "No autorizado" });

        if (getMongoStatus() !== "connected") {
            return reply.code(503).send({ error: "MongoDB no disponible" });
        }

        const { code } = req.body as { code?: string };
        if (!code) return reply.code(400).send({ error: "Introduce el código 2FA actual para confirmar" });

        const valid = await verifyTotp(code.replace(/\s/g, ""));
        if (!valid) return reply.code(401).send({ error: "Código incorrecto" });

        const { Settings } = await import("../models/settings.js");
        await Settings.deleteOne({ key: "AUTH_TOTP_SECRET" });
        return reply.send({ ok: true });
    });

    // POST /auth/logout — client-side only (just returns 200; tokens are stateless)
    app.post("/auth/logout", async (_req, reply) => {
        return reply.send({ ok: true });
    });

    // GET /auth/me — validate current token
    app.get("/auth/me", async (req, reply) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "No autorizado" });
        const payload = verifyJWT(auth.slice(7));
        if (!payload || payload.sub.endsWith(":pending2fa")) return reply.code(401).send({ error: "Token inválido" });
        return reply.send({ email: payload.sub, twoFactorEnabled: await isTotpEnabled() });
    });
}
