import { Agenda } from "agenda";
import { MongoBackend } from "@agendajs/mongo-backend";
import type { Env } from "./env.js";
import { defineJobs } from "../jobs/index.js";

let agendaInstance: Agenda | null = null;

export function initAgenda(env: Env): Agenda {
  if (agendaInstance) return agendaInstance;

  const backend = new MongoBackend({
    address: env.MONGODB_URI,
    collection: "agendaJobs",
  });

  const agenda = new Agenda({
    backend,
    processEvery: "10 seconds",
  });

  defineJobs(agenda);

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
  return agenda;
}

