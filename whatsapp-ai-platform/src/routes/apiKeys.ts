import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requirePermission } from "../middleware/auth";
import { audit } from "../lib/audit";
import { ALL_PERMISSIONS, permissionCatalog } from "../lib/permissions";

export const apiKeysRouter = Router();
apiKeysRouter.use(requireAuth, requirePermission("settings.manage"));

const sha256 = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** GET /api-keys — list (never returns the key itself). */
apiKeysRouter.get("/", async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, revokedAt: true, createdAt: true },
  });
  res.json({ keys });
});

/**
 * GET /api-keys/scopes — the catalog a key can be limited to, so the UI
 * doesn't have to keep its own copy of the permission list.
 */
apiKeysRouter.get("/scopes", async (_req, res) => {
  res.json({ groups: permissionCatalog() });
});

/** POST /api-keys — create; full key is returned ONCE. */
const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Limit the key to these permissions; omit for full tenant access. */
  scopes: z.array(z.string()).max(40).optional(),
});

apiKeysRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const scopes = [...new Set(parsed.data.scopes ?? [])];
  const unknown = scopes.filter((s) => !ALL_PERMISSIONS.includes(s));
  if (unknown.length) {
    return res.status(400).json({ error: `unknown scope: ${unknown.join(", ")}` });
  }

  const raw = `wak_${crypto.randomBytes(24).toString("hex")}`;
  const key = await prisma.apiKey.create({
    data: {
      tenantId: req.auth!.tenantId,
      name: parsed.data.name,
      prefix: raw.slice(0, 12),
      keyHash: sha256(raw),
      scopes,
    },
  });
  audit(req, "apikey.create", {
    entity: "apiKey", entityId: key.id,
    meta: { name: key.name, scopes: scopes.length ? scopes : "full access" },
  });
  res.status(201).json({
    key: { id: key.id, name: key.name, prefix: key.prefix, scopes: key.scopes, createdAt: key.createdAt },
    secret: raw, // shown once
  });
});

/** DELETE /api-keys/:id — revoke. */
apiKeysRouter.delete("/:id", async (req, res) => {
  const k = await prisma.apiKey.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!k) return res.status(404).json({ error: "not found" });
  await prisma.apiKey.update({ where: { id: k.id }, data: { revokedAt: new Date() } });
  audit(req, "apikey.revoke", { entity: "apiKey", entityId: k.id });
  res.json({ ok: true });
});
