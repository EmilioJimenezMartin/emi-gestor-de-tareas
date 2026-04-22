import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { ItemModel } from "../models/item.js";

const createItemBodySchema = z.object({
  name: z.string().min(1),
  payload: z.unknown().optional(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  before: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined))
    .refine((d) => d === undefined || !Number.isNaN(d.getTime()), {
      message: "before must be a valid date",
    }),
  name: z.string().min(1).optional(),
});

export async function registerItemRoutes(app: FastifyInstance) {
  app.get("/items", async (req) => {
    const { limit, before, name } = listQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = {};
    if (before) filter.createdAt = { $lt: before };
    if (name) filter.name = name;

    const items = await ItemModel.find(filter, { __v: 0 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return { items };
  });

  app.post("/items", async (req, reply) => {
    const body = createItemBodySchema.parse(req.body);
    const created = await ItemModel.create(body);
    reply.code(201);
    return { item: created.toObject({ versionKey: false }) };
  });
}
