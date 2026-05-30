import { FastifyInstance } from "fastify";
import { getMongoStatus } from "../lib/mongo.js";
import { Settings } from "../models/settings.js";

const FOLDER = "emi-kdp-assets";

export async function getCloudinaryConfig(): Promise<{ cloudName: string; apiKey: string; apiSecret: string } | null> {
    let cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
    let apiKey = process.env.CLOUDINARY_API_KEY || "";
    let apiSecret = process.env.CLOUDINARY_API_SECRET || "";

    if (getMongoStatus() === "connected") {
        try {
            const rows = await Settings.find({
                key: { $in: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] }
            });
            const map = new Map(rows.map((r) => [r.key, r.value]));
            if (map.get("CLOUDINARY_CLOUD_NAME")) cloudName = map.get("CLOUDINARY_CLOUD_NAME")!;
            if (map.get("CLOUDINARY_API_KEY")) apiKey = map.get("CLOUDINARY_API_KEY")!;
            if (map.get("CLOUDINARY_API_SECRET")) apiSecret = map.get("CLOUDINARY_API_SECRET")!;
        } catch {
            // fallback to env
        }
    }

    if (!cloudName || !apiKey || !apiSecret) return null;
    return { cloudName, apiKey, apiSecret };
}

export async function initCloudinary(config: { cloudName: string; apiKey: string; apiSecret: string }) {
    const { v2: cld } = await import("cloudinary");
    cld.config({
        cloud_name: config.cloudName,
        api_key: config.apiKey,
        api_secret: config.apiSecret,
        secure: true,
    });
    return cld;
}

export async function registerCloudinaryRoutes(app: FastifyInstance) {
    // GET /cloudinary/images — list all images in the assets folder
    app.get("/cloudinary/images", async (_req, reply) => {
        try {
            const config = await getCloudinaryConfig();
            if (!config) {
                return reply.status(503).send({ error: "Cloudinary no configurado. Añade las credenciales en Ajustes." });
            }

            const cld = await initCloudinary(config);
            const result = await cld.api.resources({
                type: "upload",
                prefix: `${FOLDER}/`,
                max_results: 200,
                direction: "desc",
                context: true,
            });

            const images = (result.resources as any[]).map((r) => ({
                publicId: r.public_id,
                url: r.secure_url,
                width: r.width,
                height: r.height,
                createdAt: r.created_at,
                format: r.format,
                bytes: r.bytes,
                nicheId: (r.context?.custom?.nicheId as string | undefined) ?? null,
            }));

            return reply.send({ images });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Error listando imágenes", message: error.message });
        }
    });

    // POST /cloudinary/upload — upload an image (base64 dataUrl)
    app.post("/cloudinary/upload", async (request: any, reply) => {
        try {
            const config = await getCloudinaryConfig();
            if (!config) {
                return reply.status(503).send({ error: "Cloudinary no configurado." });
            }

            const { dataUrl } = request.body || {};
            if (!dataUrl || typeof dataUrl !== "string") {
                return reply.status(400).send({ error: "dataUrl es requerido" });
            }

            const cld = await initCloudinary(config);
            const result = await cld.uploader.upload(dataUrl, {
                folder: FOLDER,
                resource_type: "image",
            });

            return reply.status(201).send({
                success: true,
                image: {
                    publicId: result.public_id,
                    url: result.secure_url,
                    width: result.width,
                    height: result.height,
                    format: result.format,
                    bytes: result.bytes,
                    createdAt: result.created_at,
                },
            });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Error subiendo imagen", message: error.message });
        }
    });

    // POST /cloudinary/upload-pdf — upload a PDF file (base64 string) via upload_stream
    app.post("/cloudinary/upload-pdf", async (request: any, reply) => {
        try {
            const config = await getCloudinaryConfig();
            if (!config) return reply.status(503).send({ error: "Cloudinary no configurado." });

            const { base64, fileName } = request.body || {};
            if (!base64 || typeof base64 !== "string") {
                return reply.status(400).send({ error: "base64 es requerido" });
            }

            const cld = await initCloudinary(config);
            const publicId = (fileName ?? `book-${Date.now()}`).replace(/\.pdf$/i, "");

            // Use upload_stream to avoid data URI size limits in the SDK
            const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");

            const result = await new Promise<any>((resolve, reject) => {
                const stream = cld.uploader.upload_stream(
                    { folder: "kdp-books", resource_type: "raw", public_id: publicId },
                    (error: any, result: any) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                stream.end(buffer);
            });

            return reply.status(201).send({ url: result.secure_url, publicId: result.public_id });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: error.message ?? "Error subiendo PDF" });
        }
    });

    // POST /cloudinary/upload-url — upload from a public URL with optional nicheId metadata
    app.post("/cloudinary/upload-url", async (request: any, reply) => {
        try {
            const config = await getCloudinaryConfig();
            if (!config) return reply.status(503).send({ error: "Cloudinary no configurado." });
            const { url, nicheId } = request.body || {};
            if (!url || typeof url !== "string") return reply.status(400).send({ error: "url es requerido" });
            const cld = await initCloudinary(config);
            const result = await cld.uploader.upload(url, {
                folder: FOLDER,
                resource_type: "image",
                ...(nicheId ? { context: `nicheId=${nicheId}`, tags: [`nicho:${nicheId}`, "sample"] } : { tags: ["sample"] }),
            });
            return reply.status(201).send({
                image: {
                    publicId: result.public_id,
                    url: result.secure_url,
                    width: result.width,
                    height: result.height,
                    format: result.format,
                    bytes: result.bytes,
                    createdAt: result.created_at,
                    nicheId: nicheId ?? null,
                },
            });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Error subiendo imagen desde URL", message: error.message });
        }
    });

    // PATCH /cloudinary/niche — link or unlink a nicheId on an existing image via context
    app.patch("/cloudinary/niche", async (request: any, reply) => {
        try {
            const config = await getCloudinaryConfig();
            if (!config) return reply.status(503).send({ error: "Cloudinary no configurado." });
            const { publicId, nicheId } = request.body || {};
            if (!publicId || typeof publicId !== "string") return reply.status(400).send({ error: "publicId es requerido" });
            const cld = await initCloudinary(config);
            if (nicheId) {
                await cld.uploader.add_context(`nicheId=${nicheId}`, [publicId]);
            } else {
                await cld.uploader.remove_all_context([publicId]);
            }
            return reply.send({ ok: true, publicId, nicheId: nicheId ?? null });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Error actualizando metadata", message: error.message });
        }
    });

    // GET /cloudinary/usage — return storage quota info
    app.get("/cloudinary/usage", async (_req, reply) => {
        try {
            const config = await getCloudinaryConfig();
            if (!config) return reply.status(503).send({ error: "Cloudinary no configurado." });
            const cld = await initCloudinary(config);
            const result = await cld.api.usage();
            return reply.send({
                usedBytes: result.storage?.usage ?? 0,
                limitBytes: result.storage?.limit ?? 0,
                usedPct: result.storage?.limit
                    ? Math.round((result.storage.usage / result.storage.limit) * 100)
                    : null,
                credits: { used: result.credits?.usage ?? 0, limit: result.credits?.limit ?? 0 },
                transformations: { used: result.transformations?.usage ?? 0, limit: result.transformations?.limit ?? 0 },
            });
        } catch (error: any) {
            return reply.status(500).send({ error: "Error obteniendo uso de Cloudinary", message: error.message });
        }
    });

    // POST /cloudinary/delete — delete by publicId (POST avoids URL encoding issues with slashes)
    app.post("/cloudinary/delete", async (request: any, reply) => {
        try {
            const config = await getCloudinaryConfig();
            if (!config) {
                return reply.status(503).send({ error: "Cloudinary no configurado." });
            }

            const { publicId } = request.body || {};
            if (!publicId || typeof publicId !== "string") {
                return reply.status(400).send({ error: "publicId es requerido" });
            }

            const cld = await initCloudinary(config);
            const result = await cld.uploader.destroy(publicId);

            return reply.send({ success: true, result: result.result });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Error eliminando imagen", message: error.message });
        }
    });
}
