import { io, type Socket } from "socket.io-client";
import type { Item } from "@/store/items-slice";
import type { FinanceMovement } from "@/store/finance-slice";

type ServerToClientEvents = {
  "db:status": (payload: {
    status: "unknown" | "connected" | "disconnected" | "connecting" | "disconnecting";
  }) => void;
  "finance:movement_created": (payload: { movement: FinanceMovement }) => void;
  "finance:movement_updated": (payload: { movement: FinanceMovement }) => void;
  "finance:movement_deleted": (payload: { id: string }) => void;
  "items:created": (payload: { item: Item }) => void;
  "tasks:enqueued": (payload: { name: string }) => void;
  "agenda:start": (payload: { name: string; id?: unknown }) => void;
  "agenda:success": (payload: { name: string; id?: unknown }) => void;
  "agenda:fail": (payload: { name: string; id?: unknown; error: string }) => void;
  "agenda:complete": (payload: { name: string; id?: unknown }) => void;
  "extractor:log": (payload: { jobId?: string; timestamp?: string | Date; level?: string; message: string }) => void;
  "extractor:done": (payload: { jobId?: string }) => void;
  "extractor:result": (payload: { jobId?: string; item: Record<string, any> }) => void;
  "catalog:progress": (payload: { catalogId: string; status: string; current: number; total: number; image?: { publicId: string; url: string; width: number; height: number; bytes: number; createdAt: string } }) => void;
  "catalog:completed": (payload: { catalogId: string }) => void;
  "catalog:error": (payload: { catalogId: string; error: string; current: number; total: number }) => void;
  "catalog:queue-activated": (payload: { catalogId: string; status: string; name: string }) => void;
};

type ClientToServerEvents = Record<string, never>;

export type ApiSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createApiSocket(apiUrl: string): ApiSocket {
  return io(apiUrl, {
    transports: ["websocket"],
  });
}
