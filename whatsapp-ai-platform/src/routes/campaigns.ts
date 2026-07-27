import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requirePermission } from "../middleware/auth";
import { segmentWhere, type SegmentRules } from "../lib/segment";
import { preflight, runCampaign } from "../services/campaigns";
import { audit } from "../lib/audit";
import { parseRange, dateFilter } from "../lib/dateRange";
import { pageMeta, parsePaging } from "../lib/pagination";
import { resolveSender } from "../services/numbers";

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
campaignsRouter.get("/", requirePermission("campaigns.view"), async (req, res) => {
  const paging = parsePaging(req, 25);
  const range = dateFilter(parseRange(req));
  const where = { tenantId: req.auth!.tenantId, ...(range ? { createdAt: range } : {}) };
  const [campaigns, total, templates, segments] = await Promise.all([
    prisma.campaign.findMany({ where, orderBy: { createdAt: "desc" }, skip: paging.skip, take: paging.take }),
    prisma.campaign.count({ where }),
    prisma.template.findMany({ where: { tenantId: req.auth!.tenantId }, select: { id: true, name: true } }),
    prisma.segment.findMany({ where: { tenantId: req.auth!.tenantId }, select: { id: true, name: true } }),
  ]);
  const tName = new Map(templates.map((t) => [t.id, t.name]));
  const sName = new Map(segments.map((s) => [s.id, s.name]));
  const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
  res.json({
    campaigns: campaigns.map((c) => ({
      ...c,
      templateName: c.templateId ? tName.get(c.templateId) : null,
      segmentName: c.segmentId ? sName.get(c.segmentId) : "All contacts",
      readRate: rate(c.readCount, c.sentCount),
    })),
    ...pageMeta(total, paging),
  });
});

/** GET /campaigns/:id — one campaign + its recipients. */
campaignsRouter.get("/:id", requirePermission("campaigns.view"), async (req, res) => {
  const paging = parsePaging(req, 50);
  const c = await prisma.campaign.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
    include: {
      recipients: { orderBy: { sentAt: "desc" }, skip: paging.skip, take: paging.take },
      template: true,
    },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  const recipientTotal = await prisma.campaignRecipient.count({ where: { campaignId: c.id } });
  res.json({ campaign: c, recipients: pageMeta(recipientTotal, paging) });
});

const createSchema = z.object({
  name: z.string().min(1),
  templateId: z.string().min(1),
  segmentId: z.string().nullable().optional(),
  /** Which of our numbers it goes out from; blank uses the default. */
  phoneNumberId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(), // ISO → status SCHEDULED
});

/** POST /campaigns — create a draft or scheduled campaign (admin/RM). */
campaignsRouter.post("/", requirePermission("campaigns.create"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const tpl = await prisma.template.findFirst({
    where: { id: d.templateId, tenantId: req.auth!.tenantId },
  });
  if (!tpl) return res.status(400).json({ error: "invalid template" });

  // A campaign must leave from a number this workspace actually owns.
  const sender = await resolveSender(req.auth!.tenantId, d.phoneNumberId);
  if (d.phoneNumberId && sender?.phoneNumberId !== d.phoneNumberId) {
    return res.status(400).json({ error: "That sending number isn't available." });
  }

  const total = await audienceCount(req.auth!.tenantId, d.segmentId ?? null);
  const campaign = await prisma.campaign.create({
    data: {
      tenantId: req.auth!.tenantId,
      name: d.name,
      templateId: d.templateId,
      segmentId: d.segmentId ?? null,
      phoneNumberId: sender?.phoneNumberId ?? "",
      status: d.scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
      totalCount: total,
    },
  });
  res.status(201).json({ campaign });
});

/**
 * GET /campaigns/:id/preflight — what this send is about to do, before it
 * does it: audience size, how long it will take, and whether it exceeds the
 * number's 24-hour ceiling.
 */
campaignsRouter.get("/:id/preflight", requirePermission("campaigns.view"), async (req, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!campaign) return res.status(404).json({ error: "not found" });
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: req.auth!.tenantId } });
  res.json({ preflight: await preflight(tenant, campaign) });
});

const rateSchema = z.object({ rateLimit: z.number().int().min(1).max(1000) });

/** PATCH /campaigns/:id/rate — how fast to send; takes effect on the next run. */
campaignsRouter.patch("/:id/rate", requirePermission("campaigns.send"), async (req, res) => {
  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const c = await prisma.campaign.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  const campaign = await prisma.campaign.update({
    where: { id: c.id },
    data: { rateLimit: parsed.data.rateLimit },
  });
  res.json({ campaign });
});

/**
 * POST /campaigns/:id/pause — stop after the page in flight. The cursor stays,
 * so resuming carries on rather than starting again.
 */
campaignsRouter.post("/:id/pause", requirePermission("campaigns.send"), async (req, res) => {
  const c = await prisma.campaign.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  if (c.status !== "SENDING") return res.status(409).json({ error: `campaign is ${c.status}` });
  const campaign = await prisma.campaign.update({ where: { id: c.id }, data: { status: "PAUSED" } });
  audit(req, "campaign.pause", { entity: "campaign", entityId: c.id });
  res.json({ campaign });
});

/** POST /campaigns/:id/resume — carry on from the cursor. */
campaignsRouter.post("/:id/resume", requirePermission("campaigns.send"), async (req, res) => {
  const c = await prisma.campaign.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  if (c.status !== "PAUSED") return res.status(409).json({ error: `campaign is ${c.status}` });
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: req.auth!.tenantId } });
  audit(req, "campaign.resume", { entity: "campaign", entityId: c.id });
  res.json({ ok: true, status: "SENDING" });
  runCampaign(tenant, c.id).catch((e) => console.error("[campaign] resume error:", e?.message || e));
});

/** POST /campaigns/:id/cancel — stop for good; what already went stays sent. */
campaignsRouter.post("/:id/cancel", requirePermission("campaigns.send"), async (req, res) => {
  const c = await prisma.campaign.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  if (!["SENDING", "PAUSED", "SCHEDULED", "QUEUED"].includes(c.status)) {
    return res.status(409).json({ error: `campaign is ${c.status}` });
  }
  const campaign = await prisma.campaign.update({
    where: { id: c.id },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  audit(req, "campaign.cancel", { entity: "campaign", entityId: c.id });
  res.json({ campaign });
});

/** POST /campaigns/:id/send — start sending (admin/RM). */
campaignsRouter.post("/:id/send", requirePermission("campaigns.send"), async (req, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!campaign) return res.status(404).json({ error: "not found" });
  if (campaign.status === "SENDING") return res.status(409).json({ error: "already sending" });
  if (campaign.status === "SENT") return res.status(409).json({ error: "already sent" });

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
campaignsRouter.delete("/:id", requirePermission("campaigns.create"), async (req, res) => {
  const c = await prisma.campaign.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  await prisma.campaign.delete({ where: { id: c.id } });
  res.json({ ok: true });
});
