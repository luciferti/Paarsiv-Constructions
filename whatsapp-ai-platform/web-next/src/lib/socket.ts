import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/** Connect once and join the tenant room for realtime inbox updates. */
export function connectSocket(tenantId: string): Socket {
  if (socket) {
    socket.emit("join", tenantId);
    return socket;
  }
  // Connect directly to the backend — Next.js rewrites can't proxy WebSocket upgrades.
  socket = io("http://localhost:4000", { transports: ["websocket", "polling"] });
  socket.on("connect", () => socket?.emit("join", tenantId));
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
