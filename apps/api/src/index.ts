import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import mongoose from "mongoose";
import { ZodError } from "zod";
import type { Agenda } from "agenda";
import { loadEnv } from "./lib/env.js";
import { getMongoStatus, startMongo } from "./lib/mongo.js";
import { initAgenda, startAgenda } from "./lib/agenda.js";
import { registerSocket } from "./lib/socket.js";
import { registerItemRoutes } from "./routes/items.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerExtractorRoutes } from "./routes/extractor.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { Settings } from "./models/settings.js";

const env = loadEnv(process.env);

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
});

const io = registerSocket(app, env);

app.get("/health", async () => ({ ok: true, mongo: getMongoStatus() }));

const deps: { io: typeof io; agenda?: Agenda } = { io };

await registerItemRoutes(app, { io });
await registerTaskRoutes(app, deps);
await registerExtractorRoutes(app, deps);
await registerSettingsRoutes(app);

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

// Start Mongo in background (API stays up even if DB is down)
startMongo(env.MONGODB_URI, { timeoutMs: 5000, retryDelayMs: 3000 });

const seedSettings = async () => {
  const status = getMongoStatus();
  if (status !== "connected") return;

  try {
    if (process.env.HUGGINGFACE_API_KEY) {
      await Settings.findOneAndUpdate(
        { key: "HUGGINGFACE_API_KEY" },
        {
          $setOnInsert: {
            key: "HUGGINGFACE_API_KEY",
            value: process.env.HUGGINGFACE_API_KEY,
            is_secret: true,
          },
        },
        { upsert: true, new: true }
      );
    }
    if (process.env.GOOGLE_API_KEY) {
      await Settings.findOneAndUpdate(
        { key: "GOOGLE_API_KEY" },
        {
          $setOnInsert: {
            key: "GOOGLE_API_KEY",
            value: process.env.GOOGLE_API_KEY,
            is_secret: true,
          },
        },
        { upsert: true, new: true }
      );
    }
    await Settings.findOneAndUpdate(
      { key: "DEFAULT_LLM_PROVIDER" },
      { $setOnInsert: { key: "DEFAULT_LLM_PROVIDER", value: "google", is_secret: false } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "DEFAULT_LLM_MODEL" },
      { $setOnInsert: { key: "DEFAULT_LLM_MODEL", value: "gemini-1.5-pro", is_secret: false } },
      { upsert: true, new: true }
    );
    app.log.info("System config keys seeded into DB (setOnInsert).");
  } catch (e) {
    app.log.error(e, "Failed to seed config into DB");
  }
};

let seeded = false;
let agendaStarted = false;

const startAgendaOnce = async () => {
  if (agendaStarted) return;
  const status = getMongoStatus();
  if (status !== "connected") return;

  try {
    const agenda = initAgenda(env);
    await startAgenda();
    deps.agenda = agenda;

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

    agendaStarted = true;
    app.log.info("Agenda started.");
  } catch (e) {
    app.log.error(e, "Agenda failed to start");
  }
};

const onMongoConnected = async () => {
  if (!seeded) {
    await seedSettings();
    seeded = true;
  }
  await startAgendaOnce();
};

mongoose.connection.on("connected", () => {
  void onMongoConnected();
});

// Fire once at boot in case Mongo is already up.
void onMongoConnected();
