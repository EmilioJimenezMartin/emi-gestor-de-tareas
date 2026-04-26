import mongoose from "mongoose";

let started = false;
let connectInFlight: Promise<unknown> | null = null;

export function getMongoStatus() {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return (states[mongoose.connection.readyState] || "unknown") as
    | "unknown"
    | "connected"
    | "disconnected"
    | "connecting"
    | "disconnecting";
}

export async function connectMongo(mongoUri: string, opts?: { timeoutMs?: number }) {
  if (mongoose.connection.readyState === 1) return;
  if (connectInFlight) return connectInFlight;

  connectInFlight = mongoose
    .connect(mongoUri, { serverSelectionTimeoutMS: opts?.timeoutMs ?? 5000 })
    .finally(() => {
      connectInFlight = null;
    });

  return connectInFlight;
}

export function startMongo(mongoUri: string, opts?: { timeoutMs?: number; retryDelayMs?: number }) {
  if (started) return;
  started = true;

  const retryDelayMs = opts?.retryDelayMs ?? 3000;

  const loop = async () => {
    try {
      await connectMongo(mongoUri, { timeoutMs: opts?.timeoutMs });
    } catch (err) {
      console.error("[mongo] connect failed", err);
      setTimeout(() => void loop(), retryDelayMs);
    }
  };

  void loop();
}
