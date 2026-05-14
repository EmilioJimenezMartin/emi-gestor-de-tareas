import { FastifyInstance } from "fastify";
import { Settings } from "../models/settings.js";
import mongoose from "mongoose";

export async function registerSettingsRoutes(app: FastifyInstance) {
    app.get("/settings", async (request, reply) => {
        if (mongoose.connection.readyState !== 1) {
            return reply.status(503).send({ error: "MongoDB not connected" });
        }
        try {
            const settings = await Settings.find({});
            return reply.send({ settings });
        } catch (error) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to fetch settings" });
        }
    });

    app.patch("/settings", async (request: any, reply) => {
        if (mongoose.connection.readyState !== 1) {
            return reply.status(503).send({ error: "MongoDB not connected" });
        }
        try {
            const updates = request.body;

            if (!Array.isArray(updates)) {
                return reply.status(400).send({ error: "Body must be an array of { key, value } updates" });
            }

            for (const update of updates) {
                if (update.key) {
                    await Settings.findOneAndUpdate(
                        { key: update.key },
                        { key: update.key, value: update.value },
                        { upsert: true, new: true }
                    );
                }
            }

            return reply.send({ success: true });
        } catch (error) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to update settings" });
        }
    });
}
