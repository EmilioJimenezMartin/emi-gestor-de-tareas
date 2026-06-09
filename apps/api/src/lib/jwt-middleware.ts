import type { FastifyInstance } from "fastify";
import { verifyJWT, AUTHORIZED_EMAIL } from "./auth.js";

// Routes that don't require a valid JWT
const PUBLIC_PREFIXES = [
    "/auth/",
    "/health",
    "/system/status",
    "/system/logs",
];

// Internal server-to-server API key (used by Next.js Server Actions)
const SERVER_API_KEY = process.env.SERVER_API_KEY || "";

export function registerJwtMiddleware(app: FastifyInstance) {
    app.addHook("onRequest", async (req, reply) => {
        const path = req.url.split("?")[0];

        // Allow public routes
        if (PUBLIC_PREFIXES.some(p => path.startsWith(p))) return;

        // Allow socket.io internal paths
        if (path.startsWith("/socket.io")) return;

        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) {
            return reply.code(401).send({ error: "Autenticación requerida" });
        }

        const token = auth.slice(7);

        // Accept internal server key (Next.js Server Actions / SSR)
        if (SERVER_API_KEY && token === SERVER_API_KEY) return;

        // Accept valid user JWT
        const payload = verifyJWT(token);
        if (!payload || payload.sub !== AUTHORIZED_EMAIL) {
            return reply.code(401).send({ error: "Token inválido o expirado" });
        }
    });
}
