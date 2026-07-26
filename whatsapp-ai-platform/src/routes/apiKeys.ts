import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { audit } from "../lib/audit";

export const apiKeysRouter = Router();
apiKeysRouter.use(requireAuth, requireRole("ADMIN"));

const sha256 = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** GET /api-keys — list (never returns the key itself). */
apiKeysRouter.get("/", async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
  });
  res.json({ keys });
});

/** POST /api-keys — create; full key is returned ONCE. */
apiKeysRouter.post("/", async (req, res) => {
  const name = z.string().min(1).safeParse(req.body?.name);
  if (!name.success) return res.status(400).json({ error: "name required" });

  const raw = `wak_${crypto.randomBytes(24).toString("hex")}`;
  const key = await prisma.apiKey.create({
    data: {
      tenantId: req.auth!.tenantId,
      name: name.data,
      prefix: raw.slice(0, 12),
      keyHash: sha256(raw),
    },
  });
  audit(req, "apikey.create", { entity: "apiKey", entityId: key.id, meta: { name: name.data } });
  res.status(201).json({
    key: { id: key.id, name: key.name, prefix: key.prefix, createdAt: key.createdAt },
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
