import type { FastifyInstance } from "fastify";
import { Pattern } from "../models/pattern.js";
import { getCloudinaryConfig, initCloudinary } from "./cloudinary.js";

export async function registerPatternRoutes(app: FastifyInstance) {

    // GET /patterns — list (optional ?style= filter)
    app.get("/patterns", async (request: any, reply) => {
        try {
            const { style } = request.query ?? {};
            const filter = style ? { style } : {};
            const patterns = await Pattern.find(filter).sort({ createdAt: -1 }).lean();
            return reply.send({ patterns });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error listing patterns" });
        }
    });

    // POST /patterns — save a pattern (Cloudinary upload + metadata)
    // Body: { dataUrl: string, prompt, style, styleLabel, palette, paletteLabel, modelName, seed }
    app.post("/patterns", async (request: any, reply) => {
        try {
            const { dataUrl, prompt, style, styleLabel, palette, paletteLabel, modelName, seed } = request.body ?? {};
            if (!dataUrl) return reply.status(400).send({ error: "dataUrl es requerido" });

            const config = await getCloudinaryConfig();
            if (!config) return reply.status(503).send({ error: "Cloudinary no configurado. Configura las credenciales en Ajustes." });

            const cld = await initCloudinary(config);
            const result = await cld.uploader.upload(dataUrl, {
                folder: "seamless-patterns",
                resource_type: "image",
            });

            const pattern = await Pattern.create({
                publicId:    result.public_id,
                url:         result.secure_url,
                prompt:      prompt ?? "",
                style:       style ?? "custom",
                styleLabel:  styleLabel ?? style ?? "",
                palette:     palette ?? "",
                paletteLabel: paletteLabel ?? palette ?? "",
                modelName:   modelName ?? "",
                seed:        seed ?? 0,
                width:       result.width,
                height:      result.height,
                bytes:       result.bytes,
            });

            return reply.status(201).send({ pattern });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error guardando patrón" });
        }
    });

    // GET /patterns/:id
    app.get("/patterns/:id", async (request: any, reply) => {
        try {
            const pattern = await Pattern.findById(request.params.id).lean();
            if (!pattern) return reply.status(404).send({ error: "Patrón no encontrado" });
            return reply.send({ pattern });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // DELETE /patterns/:id — delete from DB + Cloudinary
    app.delete("/patterns/:id", async (request: any, reply) => {
        try {
            const pattern = await Pattern.findByIdAndDelete(request.params.id).lean();
            if (!pattern) return reply.status(404).send({ error: "Patrón no encontrado" });

            const config = await getCloudinaryConfig();
            if (config && pattern.publicId) {
                try {
                    const cld = await initCloudinary(config);
                    await cld.uploader.destroy(pattern.publicId);
                } catch { /* non-fatal */ }
            }

            return reply.send({ success: true });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // PATCH /patterns/:id — update labels/prompt
    app.patch("/patterns/:id", async (request: any, reply) => {
        try {
            const allowed = ["prompt", "style", "styleLabel", "palette", "paletteLabel", "modelName"];
            const update: Record<string, any> = {};
            for (const k of allowed) {
                if ((request.body ?? {})[k] !== undefined) update[k] = request.body[k];
            }
            const pattern = await Pattern.findByIdAndUpdate(request.params.id, update, { new: true }).lean();
            if (!pattern) return reply.status(404).send({ error: "Patrón no encontrado" });
            return reply.send({ pattern });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });
}
