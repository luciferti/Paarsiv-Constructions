import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { segmentWhere, type SegmentRules } from "../lib/segment";
import { audit } from "../lib/audit";
import { findDuplicates, mergeContacts, mergeRulesOf, pickSurvivor } from "../services/merge";
import { parseRange, dateFilter } from "../lib/dateRange";
import { pageMeta, parsePaging } from "../lib/pagination";

export const contactsRouter = Router();
contactsRouter.use(requireAuth);

/** GET /contacts — list with optional search + segment filter. */
contactsRouter.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const segmentId = typeof req.query.segmentId === "string" ? req.query.segmentId : "";

  const created = dateFilter(parseRange(req));
  let where = { tenantId: req.auth!.tenantId, ...(created ? { createdAt: created } : {}) } as any;
  if (segmentId) {
    const seg = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId: req.auth!.tenantId },
    });
    if (seg) {
      // Keep the date filter alongside the segment rules.
      const segWhere = segmentWhere(req.auth!.tenantId, seg.rules as unknown as SegmentRules);
      where = created ? { AND: [segWhere, { createdAt: created }] } : segWhere;
    }
  }
  if (search) {
    where = {
      AND: [
        where,
        {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
          ],
        },
      ],
    };
  }

  const paging = parsePaging(req, 25);
  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({ where, orderBy: { createdAt: "desc" }, skip: paging.skip, take: paging.take }),
    prisma.contact.count({ where }),
  ]);
  res.json({ contacts, ...pageMeta(total, paging) });
});

const contactSchema = z.object({
  phone: z.string().min(6),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  city: z.string().optional(),
  tags: z.array(z.string()).optional(),
  optedIn: z.boolean().optional(),
  attributes: z.record(z.string(), z.any()).optional(), // custom field values
});

/** POST /contacts — create/upsert one contact (admin/RM). */
contactsRouter.post("/", requireRole("ADMIN", "RM"), async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const phone = d.phone.replace(/[^\d]/g, "");

  const contact = await prisma.contact.upsert({
    where: { tenantId_phone: { tenantId: req.auth!.tenantId, phone } },
    update: {
      name: d.name,
      email: d.email || null,
      city: d.city,
      tags: d.tags ?? undefined,
      optedIn: d.optedIn,
      attributes: d.attributes ?? undefined,
    },
    create: {
      tenantId: req.auth!.tenantId,
      phone,
      name: d.name,
      email: d.email || null,
      city: d.city,
      tags: d.tags ?? [],
      optedIn: d.optedIn ?? true,
      attributes: d.attributes ?? undefined,
      source: "manual",
    },
  });
  res.status(201).json({ contact });
});

const importSchema = z.object({
  contacts: z
    .array(
      z.object({
        phone: z.string().min(6),
        name: z.string().optional(),
        email: z.string().optional(),
        city: z.string().optional(),
        tags: z.array(z.string()).optional(),
        attributes: z.record(z.string(), z.any()).optional(),
      })
    )
    .min(1)
    .max(5000),
});

/** POST /contacts/import — bulk upsert (admin/RM). */
contactsRouter.post("/import", requireRole("ADMIN", "RM"), async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let created = 0;
  for (const raw of parsed.data.contacts) {
    const phone = raw.phone.replace(/[^\d]/g, "");
    if (!phone) continue;
    await prisma.contact.upsert({
      where: { tenantId_phone: { tenantId: req.auth!.tenantId, phone } },
      update: {
        name: raw.name || undefined,
        email: raw.email || undefined,
        city: raw.city || undefined,
        tags: raw.tags ?? undefined,
        attributes: raw.attributes ?? undefined,
      },
      create: {
        tenantId: req.auth!.tenantId,
        phone,
        name: raw.name,
        email: raw.email,
        city: raw.city,
        tags: raw.tags ?? [],
        attributes: raw.attributes ?? undefined,
        source: "import",
      },
    });
    created++;
  }
  audit(req, "contacts.import", { meta: { count: created } });
  res.json({ imported: created });
});

const patchSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  externalId: z.string().optional(),
  status: z.enum(["active", "blocked", "archived"]).optional(),
  ownerId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  optedIn: z.boolean().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

/** PATCH /contacts/:id — update profile fields (admin/RM). */
contactsRouter.patch("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const c = await prisma.contact.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  const contact = await prisma.contact.update({ where: { id: c.id }, data: parsed.data });
  audit(req, "contact.update", { entity: "contact", entityId: c.id, meta: { fields: Object.keys(parsed.data) } });
  res.json({ contact });
});

/**
 * GET /contacts/:id/360 — the customer-360 aggregate: profile, conversation,
 * real messaging KPIs, campaign history, merged timeline and a health score.
 */
contactsRouter.get("/:id/360", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const contact = await prisma.contact.findFirst({ where: { id: req.params.id, tenantId } });
  if (!contact) return res.status(404).json({ error: "not found" });

  const conversation = await prisma.conversation.findUnique({
    where: { tenantId_phone: { tenantId, phone: contact.phone } },
    include: { assignedUser: { select: { id: true, displayName: true } } },
  });

  // ---- messaging KPIs (real, from this contact's thread) ----
  const msgs = conversation
    ? await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { timestamp: "asc" },
      })
    : [];
  const inbound = msgs.filter((m) => m.direction === "INBOUND");
  const outbound = msgs.filter((m) => m.direction === "OUTBOUND");
  const delivered = outbound.filter((m) => ["DELIVERED", "READ"].includes(m.status)).length;
  const readCount = outbound.filter((m) => m.status === "READ").length;
  const failed = outbound.filter((m) => m.status === "FAILED").length;
  const media = msgs.filter((m) => m.type !== "text").length;
  const aiReplies = outbound.filter((m) => m.sentBy === "AI").length;
  const agentReplies = outbound.filter((m) => m.sentBy === "AGENT").length;

  let avgResponseSec: number | null = null;
  {
    // avg gap: each inbound → next outbound
    let total = 0, n = 0;
    for (const im of inbound) {
      const next = outbound.find((o) => o.timestamp >= im.timestamp);
      if (next) { total += next.timestamp.getTime() - im.timestamp.getTime(); n++; }
    }
    if (n > 0) avgResponseSec = Math.round(total / n / 1000);
  }

  const kpis = {
    totalMessages: msgs.length,
    incoming: inbound.length,
    outgoing: outbound.length,
    delivered,
    read: readCount,
    failed,
    mediaSent: media,
    aiReplies,
    agentReplies,
    deliveryRate: outbound.length ? Math.round((delivered / outbound.length) * 100) : 0,
    readRate: outbound.length ? Math.round((readCount / outbound.length) * 100) : 0,
    replyRate: outbound.length ? Math.round(Math.min(1, inbound.length / outbound.length) * 100) : 0,
    avgResponseSec,
    firstContactAt: msgs[0]?.timestamp ?? null,
    lastContactAt: msgs[msgs.length - 1]?.timestamp ?? null,
  };

  // ---- campaign history ----
  const recipients = await prisma.campaignRecipient.findMany({
    where: { phone: contact.phone, campaign: { tenantId } },
    include: { campaign: { include: { template: { select: { name: true } } } } },
    orderBy: { sentAt: "desc" },
    take: 25,
  });
  const campaignHistory = recipients.map((r) => ({
    id: r.id,
    campaignName: r.campaign.name,
    templateName: r.campaign.template?.name ?? null,
    status: r.status,
    sentAt: r.sentAt,
    error: r.error,
  }));

  // ---- notes ----
  const notes = conversation
    ? await prisma.note.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  // ---- merged timeline (messages + notes + campaigns), newest first ----
  type TimelineEvent = { type: string; at: Date; title: string; detail?: string };
  const events: TimelineEvent[] = [];
  for (const m of msgs.slice(-25)) {
    events.push({
      type: m.direction === "INBOUND" ? "message_in" : m.sentBy === "AI" ? "message_ai" : "message_agent",
      at: m.timestamp,
      title: m.direction === "INBOUND" ? "Customer message" : m.sentBy === "AI" ? "AI reply" : "Agent reply",
      detail: m.body.slice(0, 120),
    });
  }
  for (const n of notes) {
    events.push({ type: "note", at: n.createdAt, title: `Note by ${n.authorName || "agent"}`, detail: n.body.slice(0, 120) });
  }
  for (const r of recipients) {
    if (r.sentAt) events.push({ type: "campaign", at: r.sentAt, title: `Campaign: ${r.campaign.name}`, detail: `${r.status.toLowerCase()}${r.campaign.template?.name ? ` · ${r.campaign.template.name}` : ""}` });
  }
  events.sort((a, b) => b.at.getTime() - a.at.getTime());

  // ---- health score (0-100, from real signals) ----
  const inactiveDays = kpis.lastContactAt
    ? Math.floor((Date.now() - new Date(kpis.lastContactAt).getTime()) / 86_400_000)
    : 999;
  const campaignReads = recipients.filter((r) => r.status === "READ").length;
  const campaignEngagement = recipients.length ? campaignReads / recipients.length : 0;
  let health = 30;
  health += (kpis.readRate / 100) * 20;
  health += (kpis.replyRate / 100) * 25;
  health += campaignEngagement * 15;
  health += inactiveDays <= 2 ? 10 : inactiveDays <= 7 ? 5 : inactiveDays <= 30 ? 0 : -15;
  if (contact.status === "blocked") health = Math.min(health, 10);
  const healthScore = Math.max(0, Math.min(100, Math.round(health)));

  const fields = await prisma.contactField.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
  const owner = contact.ownerId
    ? await prisma.user.findFirst({ where: { id: contact.ownerId, tenantId }, select: { id: true, displayName: true } })
    : null;

  res.json({
    contact,
    owner,
    conversation: conversation
      ? { id: conversation.id, mode: conversation.mode, labels: conversation.labels, assignedUser: conversation.assignedUser, unreadCount: conversation.unreadCount }
      : null,
    kpis,
    campaignHistory,
    notes,
    timeline: events.slice(0, 40),
    healthScore,
    inactiveDays: inactiveDays === 999 ? null : inactiveDays,
    fields,
  });
});

/** GET /contacts/duplicates — duplicate groups per the tenant's merge rules. */
contactsRouter.get("/duplicates", requireRole("ADMIN", "RM"), async (req, res) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.auth!.tenantId } });
  if (!tenant) return res.status(404).json({ error: "tenant missing" });
  const rules = mergeRulesOf(tenant.mergeRules);
  const groups = await findDuplicates(req.auth!.tenantId, rules);
  // Suggest a survivor per group so the UI can preselect it.
  const withSuggestion = await Promise.all(
    groups.map(async (g) => ({
      ...g,
      suggestedPrimaryId: (await pickSurvivor(req.auth!.tenantId, g.contacts, rules.survivor)).id,
    }))
  );
  res.json({ rules, groups: withSuggestion });
});

/** POST /contacts/merge — merge duplicates into a chosen primary (admin/RM). */
const mergeSchema = z.object({
  primaryId: z.string().min(1),
  duplicateIds: z.array(z.string().min(1)).min(1).max(20),
});
contactsRouter.post("/merge", requireRole("ADMIN", "RM"), async (req, res) => {
  const parsed = mergeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = await mergeContacts(req.auth!.tenantId, parsed.data.primaryId, parsed.data.duplicateIds);
    audit(req, "contact.merge", {
      entity: "contact",
      entityId: parsed.data.primaryId,
      meta: { absorbed: result.absorbed },
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "merge failed" });
  }
});

/** DELETE /contacts/:id (admin/RM). */
contactsRouter.delete("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
  const c = await prisma.contact.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  await prisma.contact.delete({ where: { id: c.id } });
  res.json({ ok: true });
});
