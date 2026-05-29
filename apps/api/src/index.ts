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
import { registerFinanceRoutes } from "./routes/finance.js";
import { registerAIRoutes } from "./routes/ai.js";
import { registerCloudinaryRoutes } from "./routes/cloudinary.js";
import { registerCatalogRoutes } from "./routes/catalogs.js";
import { registerSavedPromptsRoutes } from "./routes/savedPrompts.js";
import { registerNicheRoutes } from "./routes/niches.js";
import { registerZipRoutes } from "./routes/zip.js";
import { registerRadarRoutes } from "./routes/radar.js";
import { registerGelatoRoutes } from "./routes/gelato.js";
import { registerEtsyRoutes } from "./routes/etsy.js";
import { registerUploadsRoutes } from "./routes/uploads.js";
import { registerDigitalProductRoutes } from "./routes/digitalProducts.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerPatternRoutes } from "./routes/patterns.js";
import { registerDatasetRoutes } from "./routes/datasets.js";
import { registerAutoPilotRoutes } from "./routes/autopilot.js";
import { startTelegramPolling } from "./lib/telegram-polling.js";
import { Settings } from "./models/settings.js";

const env = loadEnv(process.env);

const app = Fastify({ logger: true, bodyLimit: 52_428_800 }); // 50 MB para PDFs con imágenes

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
});

const io = registerSocket(app, env);

app.get("/health", async () => ({ ok: true, mongo: getMongoStatus() }));

const deps: { io: typeof io; agenda?: Agenda } = { io };

await registerItemRoutes(app, { io });
await registerTaskRoutes(app, deps);
await registerExtractorRoutes(app, deps);
await registerSettingsRoutes(app);
await registerFinanceRoutes(app, { io });
await registerAIRoutes(app);
await registerCloudinaryRoutes(app);
await registerCatalogRoutes(app, { io });
await registerSavedPromptsRoutes(app);
await registerNicheRoutes(app);
await registerZipRoutes(app);
await registerRadarRoutes(app, deps);
await registerGelatoRoutes(app);
await registerEtsyRoutes(app);
await registerUploadsRoutes(app);
await registerDigitalProductRoutes(app);
await registerIntegrationRoutes(app);
await registerPatternRoutes(app);
await registerDatasetRoutes(app);
await registerAutoPilotRoutes(app, deps);

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
      { $setOnInsert: { key: "DEFAULT_LLM_MODEL", value: "gemini-2.5-flash", is_secret: false } },
      { upsert: true, new: true }
    );
    // Cloudinary — cloud_name seeded; api_key and api_secret left empty for user to fill via UI
    await Settings.findOneAndUpdate(
      { key: "CLOUDINARY_CLOUD_NAME" },
      { $setOnInsert: { key: "CLOUDINARY_CLOUD_NAME", value: process.env.CLOUDINARY_CLOUD_NAME || "af6b2f473a2cd3539b6d7bef68fb37", is_secret: false } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "CLOUDINARY_API_KEY" },
      { $setOnInsert: { key: "CLOUDINARY_API_KEY", value: process.env.CLOUDINARY_API_KEY || "", is_secret: true } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "CLOUDINARY_API_SECRET" },
      { $setOnInsert: { key: "CLOUDINARY_API_SECRET", value: process.env.CLOUDINARY_API_SECRET || "", is_secret: true } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "IDEOGRAM_API_KEY" },
      { $setOnInsert: { key: "IDEOGRAM_API_KEY", value: process.env.IDEOGRAM_API_KEY || "", is_secret: true } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "FALAI_API_KEY" },
      { $setOnInsert: { key: "FALAI_API_KEY", value: process.env.FALAI_API_KEY || "", is_secret: true } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "SEGMIND_API_KEY" },
      { $setOnInsert: { key: "SEGMIND_API_KEY", value: process.env.SEGMIND_API_KEY || "", is_secret: true } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "GELATO_API_KEY" },
      { $setOnInsert: { key: "GELATO_API_KEY", value: process.env.GELATO_API_KEY || "", is_secret: true } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "GELATO_STORE_ID" },
      { $setOnInsert: { key: "GELATO_STORE_ID", value: process.env.GELATO_STORE_ID || "", is_secret: false } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "ETSY_API_KEY" },
      { $setOnInsert: { key: "ETSY_API_KEY", value: process.env.ETSY_API_KEY || "", is_secret: true } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "ETSY_API_SECRET" },
      { $setOnInsert: { key: "ETSY_API_SECRET", value: process.env.ETSY_API_SECRET || "", is_secret: true } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "ETSY_SHOP_ID" },
      { $setOnInsert: { key: "ETSY_SHOP_ID", value: process.env.ETSY_SHOP_ID || "", is_secret: false } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "ETSY_ACCESS_TOKEN" },
      { $setOnInsert: { key: "ETSY_ACCESS_TOKEN", value: "", is_secret: true } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "ETSY_REFRESH_TOKEN" },
      { $setOnInsert: { key: "ETSY_REFRESH_TOKEN", value: "", is_secret: true } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "PUBLIC_API_URL" },
      { $setOnInsert: { key: "PUBLIC_API_URL", value: "", is_secret: false } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "HUGGINGFACE_WRITE_TOKEN" },
      { $setOnInsert: { key: "HUGGINGFACE_WRITE_TOKEN", value: process.env.HUGGINGFACE_WRITE_TOKEN || "", is_secret: true } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "HUGGINGFACE_USERNAME" },
      { $setOnInsert: { key: "HUGGINGFACE_USERNAME", value: process.env.HUGGINGFACE_USERNAME || "", is_secret: false } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "KAGGLE_USERNAME" },
      { $setOnInsert: { key: "KAGGLE_USERNAME", value: process.env.KAGGLE_USERNAME || "", is_secret: false } },
      { upsert: true, new: true }
    );
    await Settings.findOneAndUpdate(
      { key: "KAGGLE_KEY" },
      { $setOnInsert: { key: "KAGGLE_KEY", value: process.env.KAGGLE_KEY || "", is_secret: true } },
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
    const agenda = initAgenda(env, io);
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

let pollingStarted = false;

const onMongoConnected = async () => {
  if (!seeded) {
    await seedSettings();
    seeded = true;
  }
  await startAgendaOnce();
  if (!pollingStarted) {
    startTelegramPolling(io, deps.agenda);
    pollingStarted = true;
  }
};

mongoose.connection.on("connected", () => {
  void onMongoConnected();
});

// Fire once at boot in case Mongo is already up.
void onMongoConnected();
