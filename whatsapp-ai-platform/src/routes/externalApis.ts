import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requirePermission } from "../middleware/auth";
import { audit } from "../lib/audit";
import { runRequest } from "../services/externalApis";

export const externalApisRouter = Router();
externalApisRouter.use(requireAuth, requirePermission("settings.manage"));

/** The stored secret never goes back to the browser — only whether one is set. */
function view(api: any) {
  const { authValue, ...rest } = api;
  return { ...rest, hasSecret: !!authValue };
}

externalApisRouter.get("/", async (req, res) => {
  const apis = await prisma.externalApi.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "asc" },
    include: { requests: { orderBy: { createdAt: "asc" } } },
  });
  res.json({ apis: apis.map(view) });
});

const apiSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseUrl: z.string().trim().url(),
  authType: z.enum(["none", "header", "bearer", "basic"]).optional(),
  authName: z.string().trim().max(60).nullable().optional(),
  authValue: z.string().trim().max(400).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  active: z.boolean().optional(),
});

externalApisRouter.post("/", async (req, res) => {
  const parsed = apiSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const api = await prisma.externalApi.create({
    data: { tenantId: req.auth!.tenantId, ...parsed.data, headers: parsed.data.headers ?? undefined },
  });
  audit(req, "external_api.create", { entity: "externalApi", entityId: api.id, meta: { baseUrl: api.baseUrl } });
  res.status(201).json({ api: view({ ...api, requests: [] }) });
});

externalApisRouter.patch("/:id", async (req, res) => {
  const parsed = apiSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const found = await prisma.externalApi.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!found) return res.status(404).json({ error: "not found" });

  const d = { ...parsed.data };
  // An empty secret means "leave the stored one alone", not "wipe it".
  if (!d.authValue) delete d.authValue;
  const api = await prisma.externalApi.update({
    where: { id: found.id },
    data: { ...d, headers: d.headers ?? undefined },
    include: { requests: true },
  });
  audit(req, "external_api.update", { entity: "externalApi", entityId: found.id });
  res.json({ api: view(api) });
});

externalApisRouter.delete("/:id", async (req, res) => {
  const found = await prisma.externalApi.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!found) return res.status(404).json({ error: "not found" });
  await prisma.externalApi.delete({ where: { id: found.id } });
  audit(req, "external_api.delete", { entity: "externalApi", entityId: found.id });
  res.status(204).end();
});

// ---- saved requests ----

const requestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  path: z.string().trim().max(500).optional(),
  bodyTemplate: z.string().max(8_000).nullable().optional(),
  saveTo: z.record(z.string(), z.string()).optional(),
});

externalApisRouter.post("/:id/requests", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const api = await prisma.externalApi.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!api) return res.status(404).json({ error: "not found" });
  const request = await prisma.externalApiRequest.create({
    data: { apiId: api.id, ...parsed.data, saveTo: parsed.data.saveTo ?? undefined },
  });
  audit(req, "external_api.request_create", { entity: "externalApiRequest", entityId: request.id });
  res.status(201).json({ request });
});

externalApisRouter.patch("/requests/:requestId", async (req, res) => {
  const parsed = requestSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const found = await prisma.externalApiRequest.findFirst({
    where: { id: req.params.requestId, api: { tenantId: req.auth!.tenantId } },
  });
  if (!found) return res.status(404).json({ error: "not found" });
  const request = await prisma.externalApiRequest.update({
    where: { id: found.id },
    data: { ...parsed.data, saveTo: parsed.data.saveTo ?? undefined },
  });
  res.json({ request });
});

externalApisRouter.delete("/requests/:requestId", async (req, res) => {
  const found = await prisma.externalApiRequest.findFirst({
    where: { id: req.params.requestId, api: { tenantId: req.auth!.tenantId } },
  });
  if (!found) return res.status(404).json({ error: "not found" });
  await prisma.externalApiRequest.delete({ where: { id: found.id } });
  res.status(204).end();
});

/**
 * POST /external-apis/requests/:requestId/run — the console's Send button.
 * `contactId` fills the {{tokens}} with a real person; `dryRun` skips writing
 * anything back so a first try can't touch data.
 */
externalApisRouter.post("/requests/:requestId/run", async (req, res) => {
  const found = await prisma.externalApiRequest.findFirst({
    where: { id: req.params.requestId, api: { tenantId: req.auth!.tenantId } },
    include: { api: true },
  });
  if (!found) return res.status(404).json({ error: "not found" });

  const contactId = typeof req.body?.contactId === "string" ? req.body.contactId : undefined;
  const contact = contactId
    ? await prisma.contact.findFirst({ where: { id: contactId, tenantId: req.auth!.tenantId } })
    : null;

  const result = await runRequest(found.api, found, { contact }, {
    ranBy: "console",
    dryRun: req.body?.dryRun === true,
  });
  audit(req, "external_api.run", {
    entity: "externalApiRequest", entityId: found.id,
    meta: { status: result.statusCode, ok: result.ok },
  });
  res.json({ result });
});

externalApisRouter.get("/requests/:requestId/logs", async (req, res) => {
  const found = await prisma.externalApiRequest.findFirst({
    where: { id: req.params.requestId, api: { tenantId: req.auth!.tenantId } },
  });
  if (!found) return res.status(404).json({ error: "not found" });
  const logs = await prisma.externalApiLog.findMany({
    where: { requestId: found.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true, status: true, statusCode: true, durationMs: true,
      error: true, requestUrl: true, ranBy: true, createdAt: true,
    },
  });
  res.json({ logs });
});
