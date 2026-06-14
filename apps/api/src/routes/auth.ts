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
import { AuthLog } from "../models/auth-log.js";
import { sendTelegram } from "../lib/telegram.js";

async function logEvent(event: string, ip: string, ua: string, email?: string) {
    try {
        if (getMongoStatus() === "connected") {
            await AuthLog.create({ event, email, ip, ua: ua?.slice(0, 200) });
        }
    } catch { /* no bloquear el flujo */ }
}

async function alertTelegram(event: string, ip: string) {
    try {
        const emoji = event === "login_ok" ? "✅" : event.endsWith("_fail") ? "⚠️" : "🔐";
        const label: Record<string, string> = {
            login_ok:   "Login correcto",
            login_fail: "Intento de login fallido",
            "2fa_ok":   "2FA verificado — sesión iniciada",
            "2fa_fail": "Código 2FA incorrecto",
            logout:     "Sesión cerrada",
        };
        const now = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
        await sendTelegram(`${emoji} <b>${label[event] ?? event}</b>\nIP: <code>${ip}</code>\n<i>${now}</i>`);
    } catch { /* si Telegram falla, no bloquear */ }
}


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
            void logEvent("login_fail", ip, req.headers["user-agent"] || "", email);
            return reply.code(401).send({ error: "Credenciales incorrectas" });
        }

        const valid = await verifyPassword(password);
        if (!valid) {
            void logEvent("login_fail", ip, req.headers["user-agent"] || "", email);
            return reply.code(401).send({ error: "Credenciales incorrectas" });
        }

        clearRateLimit(ip);
        const totpEnabled = getMongoStatus() === "connected" ? await isTotpEnabled() : false;

        if (!totpEnabled) {
            const token = generateJWT(email);
            void logEvent("login_ok", ip, req.headers["user-agent"] || "", email);
            void alertTelegram("login_ok", ip);
            return reply.send({ token, twoFactorRequired: false });
        }

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
        const ip = req.ip || "unknown";
        if (!valid) {
            void logEvent("2fa_fail", ip, req.headers["user-agent"] || "");
            void alertTelegram("2fa_fail", ip);
            return reply.code(401).send({ error: "Código 2FA incorrecto" });
        }

        const email = payload.sub.replace(":pending2fa", "");
        const token = generateJWT(email);
        void logEvent("2fa_ok", ip, req.headers["user-agent"] || "", email);
        void alertTelegram("2fa_ok", ip);
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

    // POST /auth/logout
    app.post("/auth/logout", async (req, reply) => {
        void logEvent("logout", req.ip || "unknown", req.headers["user-agent"] || "");
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

    // POST /auth/refresh — extend session: validates current JWT and returns a fresh 24h one
    app.post("/auth/refresh", async (req, reply) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "No autenticado" });
        const payload = verifyJWT(auth.slice(7));
        if (!payload || payload.sub.endsWith(":pending2fa") || payload.sub !== AUTHORIZED_EMAIL) {
            return reply.code(401).send({ error: "Token inválido o expirado — inicia sesión de nuevo" });
        }
        const token = generateJWT(payload.sub);
        return reply.send({ token });
    });
}
