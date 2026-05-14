import type { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import type { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import { FinanceMovementModel } from "../models/finance-movement.js";

const createBodySchema = z.object({
  kind: z.enum(["ingreso", "gasto"]),
  cadence: z.enum(["anual", "mensual", "puntual"]),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  amount: z.number().finite().positive(),
  date: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  taskIds: z.array(z.string()).optional(),
});

const updateBodySchema = createBodySchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: "Body must include at least one field",
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(200),
  taskId: z.string().optional(),
});

export async function registerFinanceRoutes(
  app: FastifyInstance,
  deps?: { io?: SocketIOServer }
) {
  const ensureMongo = (reply: any) => {
    if (mongoose.connection.readyState !== 1) {
      reply.status(503).send({ error: "MongoDB not connected" });
      return false;
    }
    return true;
  };

  app.get("/finance/movements", async (req, reply) => {
    if (!ensureMongo(reply)) return;
    const { limit, taskId } = listQuerySchema.parse(req.query);
    const filter: any = {};
    if (taskId) filter.taskIds = taskId;

    const movements = await FinanceMovementModel.find(filter, { __v: 0 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return reply.send({ movements });
  });

  app.post("/finance/movements", async (req, reply) => {
    if (!ensureMongo(reply)) return;
    const body = createBodySchema.parse(req.body);
    const created = await FinanceMovementModel.create(body);
    const movement = created.toObject({ versionKey: false });
    deps?.io?.emit("finance:movement_created", { movement });
    reply.code(201);
    return reply.send({ movement });
  });

  app.patch("/finance/movements/:id", async (req: any, reply) => {
    if (!ensureMongo(reply)) return;
    const id = String(req.params?.id ?? "");
    if (!id) return reply.status(400).send({ error: "Missing id" });

    const body = updateBodySchema.parse(req.body);
    const updated = await FinanceMovementModel.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updated) return reply.status(404).send({ error: "Movement not found" });

    const movement = updated.toObject({ versionKey: false });
    deps?.io?.emit("finance:movement_updated", { movement });
    return reply.send({ movement });
  });

  app.delete("/finance/movements/:id", async (req: any, reply) => {
    if (!ensureMongo(reply)) return;
    const id = String(req.params?.id ?? "");
    if (!id) return reply.status(400).send({ error: "Missing id" });

    const deleted = await FinanceMovementModel.findByIdAndDelete(id);
    if (!deleted) return reply.status(404).send({ error: "Movement not found" });

    deps?.io?.emit("finance:movement_deleted", { id });
    return reply.send({ success: true });
  });
}

