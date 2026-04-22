import type { Env } from "./env.js";
import type { FastifyInstance } from "fastify";
import { Server as SocketIOServer, type ServerOptions } from "socket.io";

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

  io.on("connection", (socket) => {
    app.log.info({ socketId: socket.id }, "socket connected");
    socket.on("disconnect", (reason) => {
      app.log.info({ socketId: socket.id, reason }, "socket disconnected");
    });
  });

  app.addHook("onClose", async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });

  return io;
}

