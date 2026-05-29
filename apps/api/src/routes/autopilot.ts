import { FastifyInstance } from "fastify";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { getMongoStatus } from "../lib/mongo.js";
import { sendTelegram } from "../lib/telegram.js";

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerAutoPilotRoutes(app: FastifyInstance, deps: { agenda?: any }) {
    // ── Run autopilot now ────────────────────────────────────────────────────
    app.post("/autopilot/run", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            if (!deps.agenda) return reply.status(503).send({ error: "Agenda no disponible" });
            await deps.agenda.now("autopilot-run", {});
            await sendTelegram("🚀 <b>Auto-Pilot</b>\nEjecución manual iniciada");
            return reply.send({ ok: true, message: "Auto-Pilot lanzado" });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Schedule autopilot cron ──────────────────────────────────────────────
    app.post("/autopilot/schedule", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { cron } = request.body as { cron: string };
            if (!cron?.trim()) return reply.status(400).send({ error: "cron required" });
            if (!deps.agenda) return reply.status(503).send({ error: "Agenda no disponible" });
            // Cancel existing and reschedule
            await deps.agenda.cancel({ name: "autopilot-run" });
            await deps.agenda.every(cron, "autopilot-run");
            await Settings.findOneAndUpdate({ key: "AUTOPILOT_CRON" }, { key: "AUTOPILOT_CRON", value: cron }, { upsert: true });
            return reply.send({ ok: true, cron });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Cancel scheduled autopilot ───────────────────────────────────────────
    app.delete("/autopilot/schedule", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            if (!deps.agenda) return reply.status(503).send({ error: "Agenda no disponible" });
            await deps.agenda.cancel({ name: "autopilot-run" });
            await Settings.findOneAndUpdate({ key: "AUTOPILOT_CRON" }, { key: "AUTOPILOT_CRON", value: "" }, { upsert: true });
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Toggle autoPilot on a niche ──────────────────────────────────────────
    app.patch("/autopilot/niche/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const { enabled } = request.body as { enabled: boolean };
            const niche = await Niche.findByIdAndUpdate(id, { $set: { autoPilotEnabled: enabled } }, { new: true }).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            return reply.send({ ok: true, autoPilotEnabled: enabled });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ── Test Telegram ─────────────────────────────────────────────────────────
    app.post("/autopilot/test-telegram", async (_req, reply) => {
        try {
            await sendTelegram("✅ <b>Emi Gestor</b>\nConexión con Telegram funcionando correctamente 🚀");
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
