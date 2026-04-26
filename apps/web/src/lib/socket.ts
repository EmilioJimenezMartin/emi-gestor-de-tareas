import { io, type Socket } from "socket.io-client";
import type { Item } from "@/store/items-slice";

type ServerToClientEvents = {
  "db:status": (payload: {
    status: "unknown" | "connected" | "disconnected" | "connecting" | "disconnecting";
  }) => void;
  "items:created": (payload: { item: Item }) => void;
  "tasks:enqueued": (payload: { name: string }) => void;
  "agenda:start": (payload: { name: string; id?: unknown }) => void;
  "agenda:success": (payload: { name: string; id?: unknown }) => void;
  "agenda:fail": (payload: { name: string; id?: unknown; error: string }) => void;
  "agenda:complete": (payload: { name: string; id?: unknown }) => void;
  "extractor:log": (payload: { jobId?: string; timestamp?: string | Date; level?: string; message: string }) => void;
  "extractor:done": (payload: { jobId?: string }) => void;
};

type ClientToServerEvents = Record<string, never>;

export type ApiSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createApiSocket(apiUrl: string): ApiSocket {
  return io(apiUrl, {
    transports: ["websocket"],
  });
}
