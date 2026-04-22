import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { loadEnv } from "./lib/env.js";
import { connectMongo } from "./lib/mongo.js";
import { registerItemRoutes } from "./routes/items.js";

const env = loadEnv(process.env);

await connectMongo(env.MONGODB_URI);

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  methods: ["GET", "POST", "OPTIONS"],
});

app.get("/health", async () => ({ ok: true }));

await registerItemRoutes(app);

app.setErrorHandler((error, _req, reply) => {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: "Bad Request",
      issues: error.issues,
    });
    return;
  }
  reply.send(error);
});

await app.listen({ host: "0.0.0.0", port: env.PORT });

