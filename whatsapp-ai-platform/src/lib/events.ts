import { EventEmitter } from "events";

/**
 * Tiny in-process event bus so services can emit realtime updates without
 * importing the socket.io server directly (avoids circular deps).
 * server.ts subscribes and forwards to the tenant's socket room.
 */
export const bus = new EventEmitter();

export type RealtimeEvent =
  | { tenantId: string; type: "message"; conversationId: string; message: any }
  | { tenantId: string; type: "conversation"; conversation: any };

export function emitRealtime(ev: RealtimeEvent) {
  bus.emit("realtime", ev);
}
