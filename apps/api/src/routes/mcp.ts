import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "../mcp/server.js";

// Clave propia del MCP, distinta del JWT de usuario y de SERVER_API_KEY: así se
// puede rotar o revocar el acceso de Claude sin tocar el login de la web.
// Sin MCP_API_KEY definida el endpoint queda apagado.
const MCP_API_KEY = process.env.MCP_API_KEY || "";

function authorized(req: FastifyRequest): boolean {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return false;
    const given = Buffer.from(auth.slice(7));
    const expected = Buffer.from(MCP_API_KEY);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function registerMcpRoutes(app: FastifyInstance) {
    // Streamable HTTP en modo stateless: servidor y transporte nuevos por petición,
    // sin sesiones en memoria, para que funcione igual detrás de varios procesos.
    app.post("/mcp", async (req: FastifyRequest, reply: FastifyReply) => {
        if (!MCP_API_KEY) return reply.code(503).send({ error: "MCP desactivado: define MCP_API_KEY" });
        if (!authorized(req)) return reply.code(401).header("WWW-Authenticate", "Bearer").send({ error: "Clave MCP inválida" });

        const server = buildMcpServer(app);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        reply.raw.on("close", () => {
            void transport.close();
            void server.close();
        });
        reply.hijack();
        await server.connect(transport);
        await transport.handleRequest(req.raw, reply.raw, req.body);
    });

    const methodNotAllowed = async (_req: FastifyRequest, reply: FastifyReply) =>
        reply.code(405).header("Allow", "POST").send({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
    app.get("/mcp", methodNotAllowed);
    app.delete("/mcp", methodNotAllowed);
}
