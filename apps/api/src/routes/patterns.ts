import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { Pattern } from "../models/pattern.js";
import { PatternGenJob } from "../models/pattern-gen-job.js";
import { getCloudinaryConfig, initCloudinary } from "./cloudinary.js";
import { PATTERN_GEN_JOB_NAME } from "../jobs/pattern-generation.js";
import { getAgenda } from "../lib/agenda.js";

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
            const pattern = await Pattern.findByIdAndUpdate(request.params.id, update, { returnDocument: 'after' }).lean();
            if (!pattern) return reply.status(404).send({ error: "Patrón no encontrado" });
            return reply.send({ pattern });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // POST /patterns/generate-job — start background pattern generation
    app.post("/patterns/generate-job", async (request: any, reply) => {
        try {
            const { prompt, negativePrompt, modelId, provider, seed, width, height, styleId, styleLabel, paletteId, paletteLabel } = request.body ?? {};
            if (!prompt) return reply.status(400).send({ error: "prompt es requerido" });

            let agenda: ReturnType<typeof getAgenda>;
            try { agenda = getAgenda(); } catch {
                return reply.status(503).send({ error: "Scheduler no disponible todavía" });
            }

            const jobId = randomUUID();
            await PatternGenJob.create({
                jobId,
                prompt,
                negativePrompt: negativePrompt ?? "",
                modelId: modelId ?? "flux",
                provider: provider ?? "Pollinations",
                seed: seed ?? Math.floor(Math.random() * 999999),
                width: width ?? 1024,
                height: height ?? 1024,
                styleId, styleLabel, paletteId, paletteLabel,
                status: "running",
                logs: [],
            });

            // Auto-prune: keep last 10 pattern gen jobs
            const oldJobs = await PatternGenJob.find({}).sort({ createdAt: -1 }).skip(10).select("_id").lean();
            if (oldJobs.length > 0) await PatternGenJob.deleteMany({ _id: { $in: oldJobs.map(r => r._id) } }).catch(() => {});

            await agenda.now(PATTERN_GEN_JOB_NAME, { jobId });
            return reply.status(202).send({ jobId });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error creando job" });
        }
    });

    // GET /patterns/gen-jobs/latest — get the most recent pattern generation job
    app.get("/patterns/gen-jobs/latest", async (_request: any, reply) => {
        try {
            const job = await PatternGenJob.findOne().sort({ createdAt: -1 }).lean();
            return reply.send({ job: job ?? null });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });
}
