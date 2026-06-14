import { FastifyInstance } from "fastify";
import { Settings } from "../models/settings.js";
import { getMongoStatus } from "../lib/mongo.js";
import * as lulu from "../lib/lulu-client.js";

export async function registerLuluRoutes(app: FastifyInstance) {

    // GET /lulu/ping — test connection + list available packages
    app.get("/lulu/ping", async (_req, reply) => {
        try {
            await lulu.pingLulu();
            return reply.send({ ok: true, packages: lulu.POD_PACKAGES });
        } catch (e: any) {
            return reply.status(400).send({ ok: false, error: e.message });
        }
    });

    // POST /lulu/settings — save client key + secret
    app.post("/lulu/settings", async (request: any, reply) => {
        try {
            const { clientKey, clientSecret } = request.body ?? {};
            if (!clientKey || !clientSecret) return reply.status(400).send({ error: "clientKey y clientSecret requeridos" });
            await Promise.all([
                Settings.findOneAndUpdate({ key: "LULU_CLIENT_KEY" }, { $set: { key: "LULU_CLIENT_KEY", value: clientKey, is_secret: true } }, { upsert: true }),
                Settings.findOneAndUpdate({ key: "LULU_CLIENT_SECRET" }, { $set: { key: "LULU_CLIENT_SECRET", value: clientSecret, is_secret: true } }, { upsert: true }),
            ]);
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /lulu/cost-calculation
    app.post("/lulu/cost-calculation", async (request: any, reply) => {
        try {
            const { pod_package_id, page_count, quantity = 1, shipping_country = "ES", shipping_option } = request.body ?? {};
            if (!pod_package_id || !page_count) return reply.status(400).send({ error: "pod_package_id y page_count requeridos" });
            const data = await lulu.calculateCost({ pod_package_id, page_count: Number(page_count), quantity: Number(quantity), shipping_country, shipping_option });
            return reply.send(data);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /lulu/print-jobs — create a print job
    app.post("/lulu/print-jobs", async (request: any, reply) => {
        try {
            const body = request.body ?? {};
            const required = ["title", "interior_url", "cover_url", "pod_package_id", "page_count", "contact_email", "shipping_address"];
            for (const f of required) {
                if (!body[f]) return reply.status(400).send({ error: `Campo requerido: ${f}` });
            }
            const data = await lulu.createPrintJob(body);
            return reply.send(data);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // GET /lulu/print-jobs — list print jobs
    app.get("/lulu/print-jobs", async (request: any, reply) => {
        try {
            const { offset, limit } = request.query ?? {};
            const data = await lulu.listPrintJobs({ offset: offset ? Number(offset) : undefined, limit: limit ? Number(limit) : undefined });
            return reply.send(data);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // GET /lulu/print-jobs/:id — get single print job
    app.get("/lulu/print-jobs/:id", async (request: any, reply) => {
        try {
            const data = await lulu.getPrintJob(request.params.id);
            return reply.send(data);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // GET /lulu/print-jobs/:id/costs — get costs for a job
    app.get("/lulu/print-jobs/:id/costs", async (request: any, reply) => {
        try {
            const data = await lulu.getPrintJobCosts(request.params.id);
            return reply.send(data);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
