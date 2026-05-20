import { FastifyInstance } from "fastify";
import { writeFile, readFile, unlink } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Settings } from "../models/settings.js";

const UPLOAD_DIR = path.join(process.cwd(), "tmp", "uploads");
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

async function getPublicBaseUrl(): Promise<string | null> {
    try {
        const row = await Settings.findOne({ key: "PUBLIC_API_URL" }).lean();
        const val = (row?.value as string | undefined)?.trim();
        return val || null;
    } catch { return null; }
}

export async function registerUploadsRoutes(app: FastifyInstance) {
    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

    // POST /uploads/pdf — receive base64 PDF, store temporarily, return public URL
    app.post("/uploads/pdf", async (request: any, reply) => {
        const publicBase = await getPublicBaseUrl();
        if (!publicBase) {
            return reply.status(503).send({
                error: "PUBLIC_API_URL no configurada. Ve a Ajustes y añade tu URL pública (ngrok o servidor).",
            });
        }

        const { base64, fileName } = request.body || {};
        if (!base64 || typeof base64 !== "string") {
            return reply.status(400).send({ error: "base64 es requerido" });
        }

        const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
        const id = randomUUID();
        const filename = `${id}.pdf`;
        await writeFile(path.join(UPLOAD_DIR, filename), buffer);

        // Auto-delete after TTL
        setTimeout(async () => {
            try { await unlink(path.join(UPLOAD_DIR, filename)); } catch { /* already gone */ }
        }, TTL_MS);

        const url = `${publicBase.replace(/\/$/, "")}/uploads/${filename}`;
        return reply.status(201).send({ url, id, expiresInMinutes: TTL_MS / 60_000 });
    });

    // GET /uploads/:filename — serve the PDF
    app.get("/uploads/:filename", async (request: any, reply) => {
        const raw = request.params.filename as string;
        // Prevent path traversal
        if (!raw || raw.includes("/") || raw.includes("..") || !raw.endsWith(".pdf")) {
            return reply.status(400).send({ error: "Nombre de archivo inválido" });
        }
        const filePath = path.join(UPLOAD_DIR, raw);
        if (!existsSync(filePath)) return reply.status(404).send({ error: "Archivo no encontrado o expirado" });

        const buffer = await readFile(filePath);
        reply.header("Content-Type", "application/pdf");
        reply.header("Content-Disposition", `inline; filename="${raw}"`);
        reply.header("Content-Length", buffer.length);
        return reply.send(buffer);
    });
}
