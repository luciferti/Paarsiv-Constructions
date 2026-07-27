import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { requireAuth, requirePermission } from "../middleware/auth";
import { audit } from "../lib/audit";
import { CONNECTOR_TYPES, newSecret, processEvent } from "../services/connectors";
import { EVENTS, EVENT_KEYS, newSecret as newHookSecret, sendTest } from "../services/eventHooks";

/**
 * The public half: the URL external systems post to. Mounted WITHOUT auth —
 * the secret in the path is the credential.
 */
export const hooksRouter = Router();

hooksRouter.post("/:secret", async (req, res) => {
  const connector = await prisma.connector.findUnique({
    where: { secret: req.params.secret },
  });
  // Same response either way — a probing caller learns nothing.
  if (!connector || !connector.active) return res.status(404).json({ error: "not found" });

  const tenant = await prisma.tenant.findUnique({ where: { id: connector.tenantId } });
  if (!tenant) return res.status(404).json({ error: "not found" });

  // Ack fast; CRMs retry on slow responses and that would double-process.
  res.json({ ok: true });
  processEvent(tenant, connector, req.body).catch((e) =>
    console.error(`[connector:${connector.type}] processing error:`, e?.message || e)
  );
});

/** The management half, in Settings. */
export const connectorsRouter = Router();
connectorsRouter.use(requireAuth);

function hookUrl(secret: string): string {
  return `${env.publicUrl.replace(/\/$/, "")}/api/hooks/${secret}`;
}

function view(c: { secret: string } & Record<string, unknown>) {
  return { ...c, url: hookUrl(c.secret) };
}

connectorsRouter.get("/", requirePermission("settings.manage"), async (req, res) => {
  const connectors = await prisma.connector.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "asc" },
  });
  res.json({ connectors: connectors.map(view) });
});

const createSchema = z.object({
  type: z.enum(CONNECTOR_TYPES),
  name: z.string().trim().min(1).max(80),
  config: z
    .object({
      tag: z.string().trim().max(40).optional(),
      optInDefault: z.boolean().optional(),
    })
    .optional(),
});

connectorsRouter.post("/", requirePermission("settings.manage"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const connector = await prisma.connector.create({
    data: {
      tenantId: req.auth!.tenantId,
      type: parsed.data.type,
      name: parsed.data.name,
      secret: newSecret(),
      config: parsed.data.config ?? undefined,
    },
  });
  audit(req, "connector.create", { entity: "connector", entityId: connector.id, meta: { type: connector.type } });
  res.status(201).json({ connector: view(connector) });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  active: z.boolean().optional(),
  config: z
    .object({
      tag: z.string().trim().max(40).optional(),
      optInDefault: z.boolean().optional(),
    })
    .optional(),
});

connectorsRouter.patch("/:id", requirePermission("settings.manage"), async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const c = await prisma.connector.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  const connector = await prisma.connector.update({
    where: { id: c.id },
    data: parsed.data,
  });
  audit(req, "connector.update", { entity: "connector", entityId: c.id });
  res.json({ connector: view(connector) });
});

/** New secret = new URL; the old one stops working immediately. */
connectorsRouter.post("/:id/rotate", requirePermission("settings.manage"), async (req, res) => {
  const c = await prisma.connector.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  const connector = await prisma.connector.update({
    where: { id: c.id },
    data: { secret: newSecret() },
  });
  audit(req, "connector.rotate_secret", { entity: "connector", entityId: c.id });
  res.json({ connector: view(connector) });
});

connectorsRouter.get("/:id/events", requirePermission("settings.manage"), async (req, res) => {
  const c = await prisma.connector.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  const events = await prisma.connectorEvent.findMany({
    where: { connectorId: c.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, status: true, summary: true, error: true, createdAt: true },
  });
  res.json({ events });
});

connectorsRouter.delete("/:id", requirePermission("settings.manage"), async (req, res) => {
  const c = await prisma.connector.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  await prisma.connector.delete({ where: { id: c.id } });
  audit(req, "connector.delete", { entity: "connector", entityId: c.id, meta: { type: c.type } });
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Outbound event hooks — the other direction: we call the customer's system.
// ---------------------------------------------------------------------------

export const eventHooksRouter = Router();
eventHooksRouter.use(requireAuth, requirePermission("settings.manage"));

eventHooksRouter.get("/", async (req, res) => {
  const hooks = await prisma.eventHook.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "asc" },
  });
  res.json({ hooks, catalog: EVENTS });
});

const hookSchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().url(),
  events: z.array(z.string()).max(20).optional(),
});

eventHooksRouter.post("/", async (req, res) => {
  const parsed = hookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const events = [...new Set(parsed.data.events ?? [])];
  const unknown = events.filter((e) => !EVENT_KEYS.includes(e));
  if (unknown.length) return res.status(400).json({ error: `unknown event: ${unknown.join(", ")}` });

  const hook = await prisma.eventHook.create({
    data: {
      tenantId: req.auth!.tenantId,
      name: parsed.data.name,
      url: parsed.data.url,
      secret: newHookSecret(),
      events,
    },
  });
  audit(req, "eventhook.create", { entity: "eventHook", entityId: hook.id, meta: { url: hook.url } });
  res.status(201).json({ hook });
});

const hookPatchSchema = hookSchema.partial().extend({ active: z.boolean().optional() });

eventHooksRouter.patch("/:id", async (req, res) => {
  const parsed = hookPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const h = await prisma.eventHook.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!h) return res.status(404).json({ error: "not found" });

  if (parsed.data.events) {
    const unknown = parsed.data.events.filter((e) => !EVENT_KEYS.includes(e));
    if (unknown.length) return res.status(400).json({ error: `unknown event: ${unknown.join(", ")}` });
  }
  const hook = await prisma.eventHook.update({
    where: { id: h.id },
    // Switching it back on clears the failure streak that paused it.
    data: { ...parsed.data, ...(parsed.data.active === true ? { failStreak: 0, lastError: null } : {}) },
  });
  audit(req, "eventhook.update", { entity: "eventHook", entityId: h.id });
  res.json({ hook });
});

/** Fire a real delivery so setup can be proven before an event depends on it. */
eventHooksRouter.post("/:id/test", async (req, res) => {
  const h = await prisma.eventHook.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!h) return res.status(404).json({ error: "not found" });
  await sendTest(h.id);
  const hook = await prisma.eventHook.findUnique({ where: { id: h.id } });
  const last = await prisma.eventDelivery.findFirst({
    where: { hookId: h.id },
    orderBy: { createdAt: "desc" },
    select: { status: true, statusCode: true, error: true, attempts: true },
  });
  res.json({ hook, result: last });
});

eventHooksRouter.get("/:id/deliveries", async (req, res) => {
  const h = await prisma.eventHook.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!h) return res.status(404).json({ error: "not found" });
  const deliveries = await prisma.eventDelivery.findMany({
    where: { hookId: h.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, event: true, status: true, statusCode: true, attempts: true, error: true, createdAt: true },
  });
  res.json({ deliveries });
});

eventHooksRouter.delete("/:id", async (req, res) => {
  const h = await prisma.eventHook.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!h) return res.status(404).json({ error: "not found" });
  await prisma.eventHook.delete({ where: { id: h.id } });
  audit(req, "eventhook.delete", { entity: "eventHook", entityId: h.id });
  res.status(204).end();
});
