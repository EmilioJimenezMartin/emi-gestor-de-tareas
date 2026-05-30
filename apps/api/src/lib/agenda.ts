import { Agenda } from "agenda";
import { MongoBackend } from "@agendajs/mongo-backend";
import mongoose from "mongoose";
import type { Env } from "./env.js";
import { defineJobs } from "../jobs/index.js";

let agendaInstance: Agenda | null = null;

export function initAgenda(env: Env, io?: any): Agenda {
  if (agendaInstance) return agendaInstance;

  const backend = new MongoBackend({
    address: env.MONGODB_URI,
    collection: "agendaJobs",
  });

  const agenda = new Agenda({
    backend,
    processEvery: "10 seconds",
  });

  defineJobs(agenda, io);

  agenda.on("error", (err) => {
    console.error("[agenda] error", err);
  });

  agendaInstance = agenda;
  return agenda;
}

export function getAgenda(): Agenda {
  if (!agendaInstance) {
    throw new Error("Agenda not initialized. Call initAgenda(env) first.");
  }
  return agendaInstance;
}

export async function startAgenda(): Promise<Agenda> {
  const agenda = getAgenda();
  await agenda.start();

  // Clear any stale autopilot-run locks left by a previous server crash.
  // Without this, a crash mid-libro-generation blocks /run for up to 2 hours.
  try {
    const coll = mongoose.connection.collection("agendaJobs");
    const r = await coll.updateMany(
      { name: "autopilot-run", lockedAt: { $exists: true, $ne: null } },
      { $unset: { lockedAt: "" } }
    );
    if (r.modifiedCount > 0) {
      console.log(`[agenda] Cleared ${r.modifiedCount} stale autopilot-run lock(s) from previous crash`);
    }
  } catch (e) {
    console.warn("[agenda] Could not clear stale locks:", e);
  }

  return agenda;
}

