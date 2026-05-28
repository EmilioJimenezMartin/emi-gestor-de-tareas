import type { Agenda, Job } from "agenda";
import axios from "axios";
import { PatternGenJob } from "../models/pattern-gen-job.js";
import { Settings } from "../models/settings.js";

export const PATTERN_GEN_JOB_NAME = "generate-pattern";

function pushLog(jobDoc: InstanceType<typeof PatternGenJob>, io: any, level: "info" | "success" | "error" | "warning", message: string) {
    const entry = { timestamp: new Date(), level, message };
    jobDoc.logs.push(entry);
    io?.emit("pattern:log", { jobId: jobDoc.jobId, ...entry });
}

export function definePatternGenJob(agenda: Agenda, io: any) {
    agenda.define(PATTERN_GEN_JOB_NAME, async (job: Job) => {
        const { jobId } = (job.attrs.data ?? {}) as { jobId: string };
        const jobDoc = await PatternGenJob.findOne({ jobId });
        if (!jobDoc) { console.error(`[pattern-job] jobId=${jobId} not found`); return; }

        try {
            const { prompt, negativePrompt, modelId, provider, seed, width, height } = jobDoc;
            const tag = `[pattern-job][${jobId}]`;

            pushLog(jobDoc, io, "info", `[AI] Generando patrón con ${provider} · modelo: ${modelId}…`);
            await jobDoc.save();

            let imageBuffer: Buffer;

            if (provider === "Pollinations") {
                const modelParam = modelId?.trim() || "flux";
                const negParam = negativePrompt?.trim() ? `&negative=${encodeURIComponent(negativePrompt.trim())}` : "";
                const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${encodeURIComponent(modelParam)}&nologo=true&enhance=false${negParam}`;
                console.log(`${tag} Calling Pollinations model=${modelParam}`);
                const response = await axios.get(url, { responseType: "arraybuffer", timeout: 120000, validateStatus: s => s < 500 });
                if (response.status !== 200) throw new Error(`Pollinations HTTP ${response.status}`);
                const ct = (response.headers["content-type"] ?? "") as string;
                if (!ct.startsWith("image/")) throw new Error(`Pollinations devolvió ${ct}`);
                imageBuffer = Buffer.from(response.data);
                console.log(`${tag} Pollinations OK — ${imageBuffer.length} bytes`);
            } else {
                const port = process.env.PORT || 3001;
                console.log(`${tag} Calling proxy: provider=${provider} model=${modelId}`);
                const response = await axios.post(
                    `http://localhost:${port}/ai/generate-image`,
                    {
                        prompt,
                        modelId,
                        provider,
                        width,
                        height,
                        advancedParams: {
                            ...(negativePrompt?.trim() ? { negativePrompt: negativePrompt.trim() } : {}),
                            seed,
                        },
                    },
                    { responseType: "arraybuffer", timeout: 120000 }
                );
                if (response.status !== 200) throw new Error(`Proxy HTTP ${response.status}`);
                const ct = (response.headers["content-type"] ?? "") as string;
                if (!ct.startsWith("image/")) {
                    const preview = Buffer.from(response.data).toString("utf8").slice(0, 300);
                    throw new Error(`Proxy devolvió ${ct}: ${preview}`);
                }
                imageBuffer = Buffer.from(response.data);
                console.log(`${tag} Proxy OK — ${imageBuffer.length} bytes`);
            }

            pushLog(jobDoc, io, "success", `[AI] ✓ Imagen generada (${Math.round(imageBuffer.length / 1024)} KB) · guardando borrador…`);

            const dataUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;

            // Save draft to Settings so it survives navigation (includes style/palette for correct association)
            await Settings.findOneAndUpdate(
                { key: "SEAMLESS_PATTERN_DRAFT" },
                { key: "SEAMLESS_PATTERN_DRAFT", value: JSON.stringify({
                    dataUrl, promptUsed: prompt, seed,
                    styleId: jobDoc.styleId ?? "",
                    styleLabel: jobDoc.styleLabel ?? "",
                    paletteId: jobDoc.paletteId ?? "",
                    paletteLabel: jobDoc.paletteLabel ?? "",
                }) },
                { upsert: true }
            );

            jobDoc.status = "completed";
            jobDoc.resultDataUrl = dataUrl;
            await jobDoc.save();

            pushLog(jobDoc, io, "success", `[DONE] ✓ Patrón listo`);
            await jobDoc.save();

            io?.emit("pattern:complete", { jobId, prompt, seed });
        } catch (err: any) {
            const msg = `[ERROR] ${err?.message ?? "Error desconocido"}`;
            pushLog(jobDoc, io, "error", msg);
            jobDoc.status = "failed";
            jobDoc.error = msg;
            await jobDoc.save();
            io?.emit("pattern:error", { jobId, message: msg });
        } finally {
            io?.emit("pattern:done", { jobId });
        }
    });
}
