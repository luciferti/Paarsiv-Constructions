import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { runJourney, type JourneyStep } from "../services/journeys";
import { graphToSteps, triggerOf, type GraphEdge, type GraphNode } from "../lib/journeyGraph";

export const journeysRouter = Router();
journeysRouter.use(requireAuth);

const stepSchema = z.object({
  type: z.enum(["message", "wait", "handoff", "tag"]),
  text: z.string().optional(),
  templateId: z.string().optional(),
  hours: z.number().optional(),
  tag: z.string().optional(),
});
const nodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  data: z.record(z.string(), z.any()).optional(),
});
const edgeSchema = z.object({
  id: z.string().optional(),
  source: z.string(),
  target: z.string(),
});
const bodySchema = z.object({
  name: z.string().min(1),
  triggerType: z.enum(["keyword", "new_contact"]).optional(),
  triggerValue: z.string().optional(),
  steps: z.array(stepSchema).max(30).optional(),
  nodes: z.array(nodeSchema).max(50).optional(),
  edges: z.array(edgeSchema).max(80).optional(),
});

/** Graph is the source of truth when present; steps are derived for the runner. */
function resolveGraph(d: z.infer<typeof bodySchema>) {
  const nodes = (d.nodes || []) as GraphNode[];
  const edges = (d.edges || []) as GraphEdge[];
  if (nodes.length > 0) {
    const trigger = triggerOf(nodes);
    return {
      nodes: nodes as object[],
      edges: edges as object[],
      steps: graphToSteps(nodes, edges) as object[],
      triggerType: trigger.triggerType,
      triggerValue: trigger.triggerValue,
    };
  }
  return {
    nodes: [] as object[],
    edges: [] as object[],
    steps: (d.steps || []) as object[],
    triggerType: d.triggerType || "keyword",
    triggerValue: d.triggerValue || null,
  };
}

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
    data: { tenantId: req.auth!.tenantId, name: d.name, status: "DRAFT", ...resolveGraph(d) },
  });
  res.status(201).json({ journey });
});

/** PATCH /journeys/:id — update name + graph (admin/RM). */
journeysRouter.patch("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const j = await prisma.journey.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!j) return res.status(404).json({ error: "not found" });
  const journey = await prisma.journey.update({
    where: { id: j.id },
    data: { name: parsed.data.name, ...resolveGraph(parsed.data) },
  });
  res.json({ journey });
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
