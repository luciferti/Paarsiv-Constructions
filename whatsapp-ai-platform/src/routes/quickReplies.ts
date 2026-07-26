import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const quickRepliesRouter = Router();
quickRepliesRouter.use(requireAuth);

/** GET /quick-replies — canned responses for the tenant (all roles). */
quickRepliesRouter.get("/", async (req, res) => {
  const replies = await prisma.quickReply.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { title: "asc" },
  });
  res.json({ replies });
});

const schema = z.object({ title: z.string().min(1), body: z.string().min(1) });

/** POST /quick-replies — create (admin/RM). */
quickRepliesRouter.post("/", requireRole("ADMIN", "RM"), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "title and body required" });
  const exists = await prisma.quickReply.findFirst({
    where: { tenantId: req.auth!.tenantId, title: parsed.data.title },
  });
  if (exists) return res.status(409).json({ error: "title taken" });
  const reply = await prisma.quickReply.create({
    data: { tenantId: req.auth!.tenantId, ...parsed.data },
  });
  res.status(201).json({ reply });
});

/** DELETE /quick-replies/:id (admin/RM). */
quickRepliesRouter.delete("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
  const r = await prisma.quickReply.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!r) return res.status(404).json({ error: "not found" });
  await prisma.quickReply.delete({ where: { id: r.id } });
  res.json({ ok: true });
});
