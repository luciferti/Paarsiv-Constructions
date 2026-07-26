import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { runJourney, type JourneyStep } from "../services/journeys";

export const journeysRouter = Router();
journeysRouter.use(requireAuth);

const stepSchema = z.object({
  type: z.enum(["message", "wait"]),
  text: z.string().optional(),
  templateId: z.string().optional(),
  hours: z.number().optional(),
});
const bodySchema = z.object({
  name: z.string().min(1),
  triggerType: z.enum(["keyword", "new_contact"]).optional(),
  triggerValue: z.string().optional(),
  steps: z.array(stepSchema).max(20),
});

/** GET /journeys — list. */
journeysRouter.get("/", async (req, res) => {
  const journeys = await prisma.journey.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ journeys });
});

/** POST /journeys — create (admin/RM). */
journeysRouter.post("/", requireRole("ADMIN", "RM"), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const exists = await prisma.journey.findFirst({
    where: { tenantId: req.auth!.tenantId, name: d.name },
  });
  if (exists) return res.status(409).json({ error: "journey name taken" });

  const journey = await prisma.journey.create({
    data: {
      tenantId: req.auth!.tenantId,
      name: d.name,
      triggerType: d.triggerType || "keyword",
      triggerValue: d.triggerValue || null,
      steps: d.steps as object[],
      status: "DRAFT",
    },
  });
  res.status(201).json({ journey });
});

/** PATCH /journeys/:id/status — activate/deactivate (admin/RM). */
journeysRouter.patch("/:id/status", requireRole("ADMIN", "RM"), async (req, res) => {
  const status = req.body?.status;
  if (status !== "ACTIVE" && status !== "DRAFT") {
    return res.status(400).json({ error: "status must be ACTIVE or DRAFT" });
  }
  const j = await prisma.journey.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!j) return res.status(404).json({ error: "not found" });
  const journey = await prisma.journey.update({ where: { id: j.id }, data: { status } });
  res.json({ journey });
});

/** POST /journeys/:id/test — run the journey now against a test phone. */
journeysRouter.post("/:id/test", requireRole("ADMIN", "RM"), async (req, res) => {
  const phone = String(req.body?.phone || "").replace(/[^\d]/g, "");
  if (!phone) return res.status(400).json({ error: "phone required" });

  const j = await prisma.journey.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!j) return res.status(404).json({ error: "not found" });
  const tenant = await prisma.tenant.findUnique({ where: { id: req.auth!.tenantId } });
  if (!tenant) return res.status(404).json({ error: "tenant missing" });

  const steps = (j.steps as unknown as JourneyStep[]) || [];
  await runJourney(tenant, steps, { phone, name: "Test" }, { ignoreWaits: true });
  res.json({ ok: true, ran: steps.filter((s) => s.type === "message").length });
});

/** DELETE /journeys/:id (admin/RM). */
journeysRouter.delete("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
  const j = await prisma.journey.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!j) return res.status(404).json({ error: "not found" });
  await prisma.journey.delete({ where: { id: j.id } });
  res.json({ ok: true });
});
