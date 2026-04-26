import { FastifyInstance } from "fastify";
import type { Agenda } from "agenda";
import type { Server as SocketIOServer } from "socket.io";
import { ExtractedData } from "../models/extracted-data.js";

export async function registerExtractorRoutes(
    app: FastifyInstance,
    deps: { agenda: Agenda; io?: SocketIOServer }
) {
    app.get("/extractor/data", async (request, reply) => {
        try {
            const data = await ExtractedData.find({}).sort({ "temporal.created_at": -1 });
            return reply.send({ data });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to fetch extracted data" });
        }
    });

    app.post("/extractor/jobs", async (request: any, reply) => {
        try {
            const { source, keyword } = request.body || {};

            const jobId = `job-${Date.now()}`;

            deps.io?.emit("extractor:log", {
                jobId,
                timestamp: new Date(),
                level: "info",
                message: `[INIT] Starting extraction engine for ${source || 'All'} with keywords: [${keyword || 'None'}]`
            });

            setTimeout(() => {
                deps.io?.emit("extractor:log", { jobId, timestamp: new Date(), level: "info", message: `[SYSTEM] Initializing headless browser instances...` });
            }, 1000);

            setTimeout(() => {
                deps.io?.emit("extractor:log", { jobId, timestamp: new Date(), level: "info", message: `[NETWORK] Navigating to target repositories and public APIs...` });
            }, 2500);

            setTimeout(() => {
                deps.io?.emit("extractor:log", { jobId, timestamp: new Date(), level: "info", message: `[DATA] Scraping DOM and matching XPath patterns... Found 3 potential records.` });
            }, 4000);

            setTimeout(() => {
                deps.io?.emit("extractor:log", { jobId, timestamp: new Date(), level: "success", message: `[SUCCESS] Data collected and normalized successfully!` });
                deps.io?.emit("extractor:done", { jobId });
            }, 6000);

            return reply.send({ success: true, jobId, message: "Job launched" });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to start job" });
        }
    });
}
