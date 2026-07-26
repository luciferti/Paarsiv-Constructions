import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/** Connect (once) and join the tenant room for realtime inbox updates. */
export function connectSocket(tenantId: string): Socket {
  if (socket) {
    socket.emit("join", tenantId);
    return socket;
  }
  socket = io({ transports: ["websocket", "polling"] });
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
