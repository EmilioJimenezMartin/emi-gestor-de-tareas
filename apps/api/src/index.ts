import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { loadEnv } from "./lib/env.js";
import { connectMongo } from "./lib/mongo.js";
import { initAgenda, startAgenda } from "./lib/agenda.js";
import { registerSocket } from "./lib/socket.js";
import { registerItemRoutes } from "./routes/items.js";
import { registerTaskRoutes } from "./routes/tasks.js";

const env = loadEnv(process.env);

await connectMongo(env.MONGODB_URI);

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  methods: ["GET", "POST", "OPTIONS"],
});

const io = registerSocket(app, env);

app.get("/health", async () => ({ ok: true }));

const agenda = initAgenda(env);
await startAgenda();

agenda.on("start", (job) => {
  io.emit("agenda:start", { name: job.attrs.name, id: job.attrs._id });
});
agenda.on("success", (job) => {
  io.emit("agenda:success", { name: job.attrs.name, id: job.attrs._id });
});
agenda.on("fail", (err, job) => {
  io.emit("agenda:fail", {
    name: job.attrs.name,
    id: job.attrs._id,
    error: err instanceof Error ? err.message : String(err),
  });
});
agenda.on("complete", (job) => {
  io.emit("agenda:complete", { name: job.attrs.name, id: job.attrs._id });
});

await registerItemRoutes(app, { io });
await registerTaskRoutes(app, { agenda, io });

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
