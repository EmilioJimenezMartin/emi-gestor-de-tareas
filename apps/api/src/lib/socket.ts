import type { Env } from "./env.js";
import type { FastifyInstance } from "fastify";
import { Server as SocketIOServer, type ServerOptions } from "socket.io";
import mongoose from "mongoose";

export type SocketServer = SocketIOServer;

export function registerSocket(app: FastifyInstance, env: Env): SocketIOServer {
  const origin = env.CORS_ORIGIN;
  const options: Partial<ServerOptions> = {
    cors: {
      origin,
      methods: ["GET", "POST", "OPTIONS"],
    },
  };

  const io = new SocketIOServer(app.server, options);

  const emitDbStatus = () => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    const status = states[mongoose.connection.readyState] || "unknown";
    io.emit("db:status", { status });
  };

  mongoose.connection.on("connected", emitDbStatus);
  mongoose.connection.on("disconnected", emitDbStatus);
  mongoose.connection.on("reconnected", emitDbStatus);
  mongoose.connection.on("error", emitDbStatus);

  io.on("connection", (socket: import("socket.io").Socket) => {
    app.log.info({ socketId: socket.id }, "socket connected");

    // Emit initial DB state to the newly connected client
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    socket.emit("db:status", { status: states[mongoose.connection.readyState] || "unknown" });

    socket.on("disconnect", (reason: string) => {
      app.log.info({ socketId: socket.id, reason }, "socket disconnected");
    });
  });

  app.addHook("onClose", async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });

  return io;
}

