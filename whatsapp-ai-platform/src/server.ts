import "dotenv/config";
import "express-async-errors"; // routes errors from async handlers to the error middleware
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./lib/openapi";
import http from "http";
import { Server as SocketServer } from "socket.io";
import { prisma } from "./lib/prisma";
import { bus, type RealtimeEvent } from "./lib/events";
import { handleInbound, type InboundMessage } from "./services/inbound";

import { authRouter } from "./routes/auth";
import { webhookRouter } from "./routes/webhook";
import { conversationsRouter } from "./routes/conversations";
import { settingsRouter } from "./routes/settings";
import { usersRouter } from "./routes/users";
import { apiKeysRouter } from "./routes/apiKeys";
import { aiAssistRouter } from "./routes/aiAssist";
import { logsRouter } from "./routes/logs";
import { contactsRouter } from "./routes/contacts";
import { contactFieldsRouter } from "./routes/contactFields";
import { segmentsRouter } from "./routes/segments";
import { segmentFoldersRouter } from "./routes/segmentFolders";
import { templatesRouter } from "./routes/templates";
import { templateFoldersRouter } from "./routes/templateFolders";
import { assetsRouter, UPLOAD_DIR } from "./routes/assets";
import { assetFoldersRouter } from "./routes/assetFolders";
import { campaignsRouter } from "./routes/campaigns";
import { journeysRouter } from "./routes/journeys";
import { reportsRouter } from "./routes/reports";

const PORT = Number(process.env.PORT || 4000);
// Comma-separated list of allowed origins (classic + next frontends).
const WEB_ORIGIN: string | string[] = (process.env.WEB_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const IS_DEV = (process.env.NODE_ENV || "development") === "development";

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })); // security headers; allow media embeds
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// ---- Rate limiting ----
app.use("/api/auth/login", rateLimit({ windowMs: 5 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));

const server = http.createServer(app);
export const io = new SocketServer(server, { cors: { origin: WEB_ORIGIN } });

// Live inbox: clients join a room per tenant to receive message events.
io.on("connection", (socket) => {
  socket.on("join", (tenantId: string) => {
    if (tenantId) socket.join(`tenant:${tenantId}`);
  });
});

// Forward internal realtime events to the right tenant room.
bus.on("realtime", (ev: RealtimeEvent) => {
  io.to(`tenant:${ev.tenantId}`).emit(ev.type, ev);
});

// ---- Health ----
app.get("/api/health", async (_req, res) => {
  let db = "unknown";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
  } catch {
    db = "down";
  }
  res.json({ ok: true, service: "whatsapp-ai-platform", db, time: new Date().toISOString() });
});

// ---- Routes ----
app.use("/api/auth", authRouter);
app.use("/api/webhook", webhookRouter); // Meta WhatsApp callback (per tenant)
app.use("/api/conversations", conversationsRouter); // inbox: list, thread, send, assign, mode
app.use("/api/settings", settingsRouter); // AI Control Panel (engine, keys, knowledge config)
app.use("/api/users", usersRouter); // agents roster / presence / create
app.use("/api/contacts", contactsRouter); // audience: list, create, import, delete
app.use("/api/contact-fields", contactFieldsRouter); // custom field definitions
app.use("/api/segments", segmentsRouter); // saved audience filters + live preview
app.use("/api/segment-folders", segmentFoldersRouter); // organize segments
app.use("/api/templates", templatesRouter); // message templates
app.use("/api/template-folders", templateFoldersRouter); // organize templates
app.use("/api/assets", assetsRouter); // media library (file upload)
app.use("/api/asset-folders", assetFoldersRouter); // organize media
app.use("/api/campaigns", campaignsRouter); // bulk broadcasts + send
app.use("/api/journeys", journeysRouter); // automation flows
app.use("/api/reports", reportsRouter); // analytics
app.use("/api/api-keys", apiKeysRouter); // programmatic access (admin)
app.use("/api/logs", logsRouter); // audit + webhook logs (admin)
app.use("/api/ai", aiAssistRouter); // copilot: summary/sentiment/suggestions
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec as object)); // API docs
app.use("/uploads", express.static(UPLOAD_DIR)); // serve uploaded media

// ---- Dev-only: simulate an inbound WhatsApp message (no Meta needed) ----
if (IS_DEV) {
  app.post("/api/dev/simulate-inbound", async (req, res) => {
    const { tenantSlug, phone, text, customerName } = req.body || {};
    if (!tenantSlug || !phone || !text) {
      return res.status(400).json({ error: "tenantSlug, phone, text required" });
    }
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return res.status(404).json({ error: "tenant not found" });
    const msg: InboundMessage = {
      phone: String(phone),
      text: String(text),
      customerName,
      waMessageId: `sim-in-${Date.now()}`,
    };
    await handleInbound(tenant, msg);
    res.json({ ok: true });
  });
}

app.get("/", (_req, res) => res.json({ name: "WhatsApp AI Platform API", status: "ready" }));

// ---- Central error handler: never crash the process on a request error ----
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err?.message || err);
  if (res.headersSent) return;
  res.status(500).json({ error: "internal error" });
});

// Last-resort guards so an unexpected rejection can't take the server down.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

import { startScheduler } from "./services/scheduler";

server.listen(PORT, () => {
  console.log(`[wa-platform] API + Socket.IO listening on :${PORT}`);
  startScheduler();
});
