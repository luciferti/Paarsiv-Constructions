import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { requireAuth, requirePermission } from "../middleware/auth";
import { audit } from "../lib/audit";
import { TRIGGERS, TRIGGER_KEYS, newSecret, runScript } from "../services/scripts";

/**
 * The public half: a URL that runs a script. Mounted without auth — the
 * secret in the path is the credential, same as connectors.
 */
export const scriptHooksRouter = Router();

scriptHooksRouter.all("/:secret", async (req, res) => {
  const script = await prisma.script.findUnique({ where: { secret: req.params.secret } });
  if (!script || !script.enabled || script.trigger !== "http") {
    return res.status(404).json({ error: "not found" });
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: script.tenantId } });
  if (!tenant) return res.status(404).json({ error: "not found" });

  // Unlike a connector, the caller usually wants the answer, so this waits.
  const result = await runScript(
    tenant,
    script,
    { method: req.method, query: req.query, body: req.body ?? {} },
    { trigger: "http" }
  );
  res.status(result.status === "ok" ? 200 : 500).json({
    ok: result.status === "ok",
    result: result.result ?? null,
    ...(result.error ? { error: result.error } : {}),
  });
});

/** The management half. */
export const scriptsRouter = Router();
scriptsRouter.use(requireAuth, requirePermission("settings.manage"));

function view(s: any) {
  return {
    ...s,
    url: s.trigger === "http" ? `${env.publicUrl.replace(/\/$/, "")}/api/run/${s.secret}` : null,
  };
}

scriptsRouter.get("/", async (req, res) => {
  const scripts = await prisma.script.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "asc" },
  });
  res.json({ scripts: scripts.map(view), triggers: TRIGGERS });
});

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).nullable().optional(),
  code: z.string().max(100_000).optional(),
  trigger: z.string().refine((t) => TRIGGER_KEYS.includes(t), "unknown trigger").optional(),
  enabled: z.boolean().optional(),
});

const STARTER = `// Runs when the trigger fires. \`input\` is what set it off.
// Available: http, whatsapp, contacts, log

const phone = input.phone;
log("looking up", phone);

const res = await http.get("https://postman-echo.com/get?phone=" + phone);
if (!res.ok) return { skipped: "lookup failed", status: res.status };

await contacts.update(phone, { attributes: { checked_at: new Date().toISOString() } });
await whatsapp.send(phone, "Thanks! We've got your details.");

return { done: true };
`;

scriptsRouter.post("/", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const exists = await prisma.script.findFirst({
    where: { tenantId: req.auth!.tenantId, name: parsed.data.name },
  });
  if (exists) return res.status(409).json({ error: "A script with that name already exists." });

  const script = await prisma.script.create({
    data: {
      tenantId: req.auth!.tenantId,
      ...parsed.data,
      code: parsed.data.code ?? STARTER,
      secret: newSecret(),
    },
  });
  audit(req, "script.create", { entity: "script", entityId: script.id, meta: { name: script.name } });
  res.status(201).json({ script: view(script) });
});

scriptsRouter.patch("/:id", async (req, res) => {
  const parsed = bodySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const found = await prisma.script.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!found) return res.status(404).json({ error: "not found" });

  const script = await prisma.script.update({ where: { id: found.id }, data: parsed.data });
  audit(req, "script.update", { entity: "script", entityId: found.id, meta: { enabled: script.enabled } });
  res.json({ script: view(script) });
});

/**
 * POST /scripts/:id/run — the editor's Run button. Sends whatever is on
 * screen rather than what was last saved, so trying something doesn't need a save first.
 */
scriptsRouter.post("/:id/run", async (req, res) => {
  const found = await prisma.script.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!found) return res.status(404).json({ error: "not found" });

  const draft = typeof req.body?.code === "string" ? req.body.code : found.code;
  const input = (req.body?.input && typeof req.body.input === "object") ? req.body.input : {};
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: found.tenantId } });

  const result = await runScript(tenant, { ...found, code: draft }, input, { trigger: "console" });
  audit(req, "script.run", { entity: "script", entityId: found.id, meta: { status: result.status } });
  res.json({ result });
});

scriptsRouter.get("/:id/runs", async (req, res) => {
  const found = await prisma.script.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!found) return res.status(404).json({ error: "not found" });
  const runs = await prisma.scriptRun.findMany({
    where: { scriptId: found.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  res.json({ runs });
});

scriptsRouter.delete("/:id", async (req, res) => {
  const found = await prisma.script.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!found) return res.status(404).json({ error: "not found" });
  await prisma.script.delete({ where: { id: found.id } });
  audit(req, "script.delete", { entity: "script", entityId: found.id, meta: { name: found.name } });
  res.status(204).end();
});
