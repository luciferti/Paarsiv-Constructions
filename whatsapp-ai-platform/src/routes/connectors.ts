import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { requireAuth, requirePermission } from "../middleware/auth";
import { audit } from "../lib/audit";
import { CONNECTOR_TYPES, newSecret, processEvent } from "../services/connectors";

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
