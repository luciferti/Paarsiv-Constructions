import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requirePermission } from "../middleware/auth";

export const templateFoldersRouter = Router();
templateFoldersRouter.use(requireAuth);

templateFoldersRouter.get("/", async (req, res) => {
  const folders = await prisma.templateFolder.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { name: "asc" },
  });
  res.json({ folders });
});

templateFoldersRouter.post("/", requirePermission("templates.manage"), async (req, res) => {
  const name = z.string().min(1).safeParse(req.body?.name);
  if (!name.success) return res.status(400).json({ error: "name required" });
  const exists = await prisma.templateFolder.findFirst({
    where: { tenantId: req.auth!.tenantId, name: name.data },
  });
  if (exists) return res.status(409).json({ error: "folder name taken" });
  const folder = await prisma.templateFolder.create({
    data: { tenantId: req.auth!.tenantId, name: name.data },
  });
  res.status(201).json({ folder });
});

templateFoldersRouter.delete("/:id", requirePermission("templates.manage"), async (req, res) => {
  const f = await prisma.templateFolder.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!f) return res.status(404).json({ error: "not found" });
  await prisma.templateFolder.delete({ where: { id: f.id } });
  res.json({ ok: true });
});
