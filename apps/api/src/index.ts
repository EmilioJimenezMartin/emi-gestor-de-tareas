import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import mongoose from "mongoose";
import { ZodError } from "zod";
import type { Agenda } from "agenda";
import { loadEnv } from "./lib/env.js";
import { getMongoStatus, startMongo } from "./lib/mongo.js";
import { initAgenda, startAgenda } from "./lib/agenda.js";
import { scheduleWatchdog, scheduleRadarRules, scheduleAlerts, scheduleWeeklyDigest } from "./jobs/index.js";
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
import { registerKdpSalesRoutes } from "./routes/kdp-sales.js";
import { registerPipelineRoutes } from "./routes/pipeline.js";
import { registerBookDraftRoutes } from "./routes/book-drafts.js";
import { registerRejectedImageRoutes } from "./routes/rejected-images.js";
import { startTelegramPolling } from "./lib/telegram-polling.js";
import { Settings } from "./models/settings.js";
import { initLogStreamer, getLogBuffer } from "./lib/log-streamer.js";
import { getPollinationsStatus, setPollinationsToken } from "./lib/pollinations-circuit.js";

const env = loadEnv(process.env);

const app = Fastify({ logger: true, bodyLimit: 52_428_800 }); // 50 MB para PDFs con imágenes

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
});

const io = registerSocket(app, env);
initLogStreamer(io);

app.get("/health", async () => ({ ok: true, mongo: getMongoStatus() }));
app.get("/system/logs", async () => ({ logs: getLogBuffer() }));
app.get("/system/status", async () => ({
    mongo: getMongoStatus(),
    pollinations: getPollinationsStatus(),
}));

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
await registerKdpSalesRoutes(app);
await registerBookDraftRoutes(app);
await registerRejectedImageRoutes(app, { io });
await registerPipelineRoutes(app, deps);

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
        { upsert: true, returnDocument: 'after' }
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
        { upsert: true, returnDocument: 'after' }
      );
    }
    await Settings.findOneAndUpdate(
      { key: "DEFAULT_LLM_PROVIDER" },
      { $setOnInsert: { key: "DEFAULT_LLM_PROVIDER", value: "google", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "DEFAULT_LLM_MODEL" },
      { $setOnInsert: { key: "DEFAULT_LLM_MODEL", value: "gemini-2.5-flash", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    // Cloudinary — cloud_name seeded; api_key and api_secret left empty for user to fill via UI
    await Settings.findOneAndUpdate(
      { key: "CLOUDINARY_CLOUD_NAME" },
      { $setOnInsert: { key: "CLOUDINARY_CLOUD_NAME", value: process.env.CLOUDINARY_CLOUD_NAME || "af6b2f473a2cd3539b6d7bef68fb37", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "CLOUDINARY_API_KEY" },
      { $setOnInsert: { key: "CLOUDINARY_API_KEY", value: process.env.CLOUDINARY_API_KEY || "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "CLOUDINARY_API_SECRET" },
      { $setOnInsert: { key: "CLOUDINARY_API_SECRET", value: process.env.CLOUDINARY_API_SECRET || "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "IDEOGRAM_API_KEY" },
      { $setOnInsert: { key: "IDEOGRAM_API_KEY", value: process.env.IDEOGRAM_API_KEY || "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "FALAI_API_KEY" },
      { $setOnInsert: { key: "FALAI_API_KEY", value: process.env.FALAI_API_KEY || "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "SEGMIND_API_KEY" },
      { $setOnInsert: { key: "SEGMIND_API_KEY", value: process.env.SEGMIND_API_KEY || "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "GELATO_API_KEY" },
      { $setOnInsert: { key: "GELATO_API_KEY", value: process.env.GELATO_API_KEY || "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "GELATO_STORE_ID" },
      { $setOnInsert: { key: "GELATO_STORE_ID", value: process.env.GELATO_STORE_ID || "", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "ETSY_API_KEY" },
      { $setOnInsert: { key: "ETSY_API_KEY", value: process.env.ETSY_API_KEY || "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "ETSY_API_SECRET" },
      { $setOnInsert: { key: "ETSY_API_SECRET", value: process.env.ETSY_API_SECRET || "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "ETSY_SHOP_ID" },
      { $setOnInsert: { key: "ETSY_SHOP_ID", value: process.env.ETSY_SHOP_ID || "", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "ETSY_ACCESS_TOKEN" },
      { $setOnInsert: { key: "ETSY_ACCESS_TOKEN", value: "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "ETSY_REFRESH_TOKEN" },
      { $setOnInsert: { key: "ETSY_REFRESH_TOKEN", value: "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "PUBLIC_API_URL" },
      { $setOnInsert: { key: "PUBLIC_API_URL", value: "", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "HUGGINGFACE_WRITE_TOKEN" },
      { $setOnInsert: { key: "HUGGINGFACE_WRITE_TOKEN", value: process.env.HUGGINGFACE_WRITE_TOKEN || "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "HUGGINGFACE_USERNAME" },
      { $setOnInsert: { key: "HUGGINGFACE_USERNAME", value: process.env.HUGGINGFACE_USERNAME || "", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "KAGGLE_USERNAME" },
      { $setOnInsert: { key: "KAGGLE_USERNAME", value: process.env.KAGGLE_USERNAME || "", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "KAGGLE_KEY" },
      { $setOnInsert: { key: "KAGGLE_KEY", value: process.env.KAGGLE_KEY || "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "QUALITY_CHECK_ENABLED" },
      { $setOnInsert: { key: "QUALITY_CHECK_ENABLED", value: "1", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "IMAGE_QUALITY_FILTER_ENABLED" },
      { $setOnInsert: { key: "IMAGE_QUALITY_FILTER_ENABLED", value: "0", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "IMAGE_QUALITY_MIN_WHITE_RATIO" },
      { $setOnInsert: { key: "IMAGE_QUALITY_MIN_WHITE_RATIO", value: "0.45", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "GUMROAD_ENABLED" },
      { $setOnInsert: { key: "GUMROAD_ENABLED", value: "0", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "GUMROAD_ACCESS_TOKEN" },
      { $setOnInsert: { key: "GUMROAD_ACCESS_TOKEN", value: "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "GUMROAD_DEFAULT_PRICE" },
      { $setOnInsert: { key: "GUMROAD_DEFAULT_PRICE", value: "4.99", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "QUALITY_VAULT_TELEGRAM_NOTIFY" },
      { $setOnInsert: { key: "QUALITY_VAULT_TELEGRAM_NOTIFY", value: "0", is_secret: false } },
      { upsert: true, returnDocument: 'after' }
    );
    await Settings.findOneAndUpdate(
      { key: "POLLINATIONS_TOKEN" },
      { $setOnInsert: { key: "POLLINATIONS_TOKEN", value: process.env.POLLINATIONS_TOKEN || "", is_secret: true } },
      { upsert: true, returnDocument: 'after' }
    );
    // Migrate pipeline flags for niches that predate the flags
    try {
        const { Niche: NicheModel } = await import("./models/niche.js");
        const { Catalog: CatalogModel } = await import("./models/catalog.js");
        await NicheModel.updateMany({ bookPdfUrl: { $exists: true, $ne: "" }, pipelineHasPdf: { $ne: true } }, { $set: { pipelineHasPdf: true } });
        await NicheModel.updateMany({ "listings.0": { $exists: true }, pipelineHasListings: { $ne: true } }, { $set: { pipelineHasListings: true } });
        await NicheModel.updateMany({ coverUrl: { $exists: true, $ne: "" }, pipelineHasCover: { $ne: true } }, { $set: { pipelineHasCover: true } });
        const nicheIdsWithCatalogs = await CatalogModel.distinct("nicheIds");
        if (nicheIdsWithCatalogs.length > 0) {
            await NicheModel.updateMany({ _id: { $in: nicheIdsWithCatalogs }, pipelineHasCatalogs: { $ne: true } }, { $set: { pipelineHasCatalogs: true } });
        }
    } catch (migErr: any) {
        app.log.warn(`Pipeline flags migration failed: ${migErr?.message}`);
    }
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
    scheduleWatchdog(agenda).catch(e => app.log.error(e, "Failed to schedule catalog watchdog"));
    scheduleRadarRules(agenda).catch(e => app.log.error(e, "Failed to schedule radar rules"));
    scheduleAlerts(agenda).catch(e => app.log.error(e, "Failed to schedule pipeline alerts"));
    scheduleWeeklyDigest(agenda).catch(e => app.log.error(e, "Failed to schedule weekly digest"));
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
  // Load Pollinations token from DB into the circuit breaker cache
  try {
    const tokenSetting = await Settings.findOne({ key: "POLLINATIONS_TOKEN" });
    if (tokenSetting?.value) setPollinationsToken(String(tokenSetting.value));
  } catch { /* ignore if DB not ready yet */ }
  await startAgendaOnce();
  // Always call so agenda is injected even on reconnects / late agenda start
  startTelegramPolling(io, deps.agenda);
  pollingStarted = true;
};

mongoose.connection.on("connected", () => {
  void onMongoConnected();
});

// Fire once at boot in case Mongo is already up.
void onMongoConnected();
