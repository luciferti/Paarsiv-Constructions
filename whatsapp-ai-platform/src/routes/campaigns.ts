import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { segmentWhere, type SegmentRules } from "../lib/segment";
import { runCampaign } from "../services/campaigns";
import { audit } from "../lib/audit";
import { parseRange, dateFilter } from "../lib/dateRange";

export const campaignsRouter = Router();
campaignsRouter.use(requireAuth);

/** Estimate opted-in audience size for a segment (null = all contacts). */
async function audienceCount(tenantId: string, segmentId: string | null): Promise<number> {
  let where: any = { tenantId, optedIn: true };
  if (segmentId) {
    const seg = await prisma.segment.findFirst({ where: { id: segmentId, tenantId } });
    if (seg) {
      where = { AND: [segmentWhere(tenantId, seg.rules as unknown as SegmentRules), { optedIn: true }] };
    }
  }
  return prisma.contact.count({ where });
}

/** GET /campaigns — list with template/segment names. */
campaignsRouter.get("/", async (req, res) => {
  const [campaigns, templates, segments] = await Promise.all([
    prisma.campaign.findMany({
      where: { tenantId: req.auth!.tenantId, ...(dateFilter(parseRange(req)) ? { createdAt: dateFilter(parseRange(req)) } : {}) },
      orderBy: { createdAt: "desc" },
    }),
    prisma.template.findMany({ where: { tenantId: req.auth!.tenantId }, select: { id: true, name: true } }),
    prisma.segment.findMany({ where: { tenantId: req.auth!.tenantId }, select: { id: true, name: true } }),
  ]);
  const tName = new Map(templates.map((t) => [t.id, t.name]));
  const sName = new Map(segments.map((s) => [s.id, s.name]));
  res.json({
    campaigns: campaigns.map((c) => ({
      ...c,
      templateName: c.templateId ? tName.get(c.templateId) : null,
      segmentName: c.segmentId ? sName.get(c.segmentId) : "All contacts",
    })),
  });
});

/** GET /campaigns/:id — one campaign + its recipients. */
campaignsRouter.get("/:id", async (req, res) => {
  const c = await prisma.campaign.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
    include: { recipients: { orderBy: { sentAt: "desc" }, take: 200 }, template: true },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  res.json({ campaign: c });
});

const createSchema = z.object({
  name: z.string().min(1),
  templateId: z.string().min(1),
  segmentId: z.string().nullable().optional(),
  scheduledAt: z.string().datetime().optional(), // ISO → status SCHEDULED
});

/** POST /campaigns — create a draft or scheduled campaign (admin/RM). */
campaignsRouter.post("/", requireRole("ADMIN", "RM"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const tpl = await prisma.template.findFirst({
    where: { id: d.templateId, tenantId: req.auth!.tenantId },
  });
  if (!tpl) return res.status(400).json({ error: "invalid template" });

  const total = await audienceCount(req.auth!.tenantId, d.segmentId ?? null);
  const campaign = await prisma.campaign.create({
    data: {
      tenantId: req.auth!.tenantId,
      name: d.name,
      templateId: d.templateId,
      segmentId: d.segmentId ?? null,
      status: d.scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
      totalCount: total,
    },
  });
  res.status(201).json({ campaign });
});

/** POST /campaigns/:id/send — start sending (admin/RM). */
campaignsRouter.post("/:id/send", requireRole("ADMIN", "RM"), async (req, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!campaign) return res.status(404).json({ error: "not found" });
  if (campaign.status === "SENDING") return res.status(409).json({ error: "already sending" });

  const tenant = await prisma.tenant.findUnique({ where: { id: req.auth!.tenantId } });
  if (!tenant) return res.status(404).json({ error: "tenant missing" });

  // Respond immediately; send in the background.
  audit(req, "campaign.send", { entity: "campaign", entityId: campaign.id, meta: { name: campaign.name } });
  res.json({ ok: true, status: "SENDING" });
  runCampaign(tenant, campaign.id).catch((e) =>
    console.error("[campaign] run error:", e?.message || e)
  );
});

/** DELETE /campaigns/:id (admin/RM). */
campaignsRouter.delete("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
  const c = await prisma.campaign.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  await prisma.campaign.delete({ where: { id: c.id } });
  res.json({ ok: true });
});
