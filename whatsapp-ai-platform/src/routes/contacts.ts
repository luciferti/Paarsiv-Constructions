import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requirePermission } from "../middleware/auth";
import { can } from "../lib/permissions";
import { segmentWhere, type SegmentRules } from "../lib/segment";
import { audit } from "../lib/audit";
import { findDuplicates, mergeContacts, mergeRulesOf, pickSurvivor } from "../services/merge";
import { parseRange, dateFilter } from "../lib/dateRange";
import { pageMeta, parsePaging } from "../lib/pagination";
import { emitEvent } from "../services/eventHooks";

export const contactsRouter = Router();
contactsRouter.use(requireAuth);

/**
 * The list filter — search box, segment and date range — as a Prisma where.
 * Bulk actions and CSV export reuse it so "select everything matching" means
 * exactly what the user is looking at.
 */
async function listWhere(
  tenantId: string,
  q: { search?: string; segmentId?: string; from?: string; to?: string }
): Promise<any> {
  const search = (q.search || "").trim();
  const created = dateFilter(parseRange({ query: q } as any));
  let where: any = { tenantId, ...(created ? { createdAt: created } : {}) };

  if (q.segmentId) {
    const seg = await prisma.segment.findFirst({ where: { id: q.segmentId, tenantId } });
    if (seg) {
      // Keep the date filter alongside the segment rules.
      const segWhere = segmentWhere(tenantId, seg.rules as unknown as SegmentRules);
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
  return where;
}

function queryFilter(req: any) {
  return {
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    segmentId: typeof req.query.segmentId === "string" ? req.query.segmentId : undefined,
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
  };
}

/** GET /contacts — list with optional search + segment filter. */
contactsRouter.get("/", requirePermission("contacts.view"), async (req, res) => {
  const where = await listWhere(req.auth!.tenantId, queryFilter(req));
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
contactsRouter.post("/", requirePermission("contacts.edit"), async (req, res) => {
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

const importRowSchema = z.object({
  // Deliberately lenient: a bad number is reported as a skipped row rather
  // than failing the whole file.
  phone: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  country: z.string().optional(),
  externalId: z.string().optional(),
  optedIn: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

const importSchema = z.object({
  contacts: z.array(importRowSchema).min(1).max(5000),
  /** Validate and report without writing anything — powers the preview step. */
  dryRun: z.boolean().optional(),
  /** How to treat a phone number that already exists. */
  onDuplicate: z.enum(["update", "skip"]).optional(),
  /** Applied to every imported row on top of its own tags. */
  extraTags: z.array(z.string()).optional(),
});

/**
 * POST /contacts/import — bulk upsert, with a dry run so the wizard can show
 * what will happen before anything is written. Rows are reported per index so
 * the UI can point at the offending line of the file.
 */
contactsRouter.post("/import", requirePermission("contacts.import"), async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { contacts, dryRun, onDuplicate = "update", extraTags = [] } = parsed.data;
  const tenantId = req.auth!.tenantId;

  const skipped: { row: number; phone?: string; reason: string }[] = [];
  const cleaned: { row: number; phone: string; data: z.infer<typeof importRowSchema> }[] = [];
  const seen = new Map<string, number>();

  contacts.forEach((raw, i) => {
    const phone = (raw.phone || "").replace(/[^\d]/g, "");
    if (phone.length < 8) return void skipped.push({ row: i + 1, phone: raw.phone, reason: "Phone number is too short" });
    const dupRow = seen.get(phone);
    if (dupRow) return void skipped.push({ row: i + 1, phone, reason: `Same number as row ${dupRow} in this file` });
    seen.set(phone, i + 1);
    cleaned.push({ row: i + 1, phone, data: raw });
  });

  const existing = new Set(
    (await prisma.contact.findMany({
      where: { tenantId, phone: { in: cleaned.map((c) => c.phone) } },
      select: { phone: true },
    })).map((c) => c.phone)
  );

  let created = 0, updated = 0;
  for (const { row, phone, data } of cleaned) {
    const isNew = !existing.has(phone);
    if (!isNew && onDuplicate === "skip") {
      skipped.push({ row, phone, reason: "Already in the workspace" });
      continue;
    }
    const tags = [...new Set([...(data.tags ?? []), ...extraTags])];
    if (!dryRun) {
      const fields = {
        name: data.name || undefined,
        email: data.email || undefined,
        city: data.city || undefined,
        company: data.company || undefined,
        jobTitle: data.jobTitle || undefined,
        country: data.country || undefined,
        externalId: data.externalId || undefined,
        optedIn: data.optedIn,
        attributes: data.attributes ?? undefined,
      };
      await prisma.contact.upsert({
        where: { tenantId_phone: { tenantId, phone } },
        update: { ...fields, ...(tags.length ? { tags } : {}) },
        create: { tenantId, phone, ...fields, tags, source: "import" },
      });
    }
    if (isNew) created++; else updated++;
  }

  if (!dryRun) audit(req, "contacts.import", { meta: { created, updated, skipped: skipped.length } });
  res.json({ imported: created + updated, created, updated, skipped, dryRun: !!dryRun });
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
contactsRouter.patch("/:id", requirePermission("contacts.edit"), async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const c = await prisma.contact.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });

  // Changing consent by hand leaves the same trail a customer keyword would.
  const data: any = { ...parsed.data };
  if (parsed.data.optedIn !== undefined && parsed.data.optedIn !== c.optedIn) {
    data.consentSource = "agent";
    if (parsed.data.optedIn) data.optedInAt = new Date();
    else data.optedOutAt = new Date();
    audit(req, parsed.data.optedIn ? "contact.opt_in" : "contact.opt_out", {
      entity: "contact", entityId: c.id, meta: { phone: c.phone, via: "agent" },
    });
    emitEvent(
      req.auth!.tenantId,
      parsed.data.optedIn ? "contact.opted_in" : "contact.opted_out",
      { phone: c.phone, via: "agent" }
    );
  }

  const contact = await prisma.contact.update({ where: { id: c.id }, data });
  audit(req, "contact.update", { entity: "contact", entityId: c.id, meta: { fields: Object.keys(parsed.data) } });
  res.json({ contact });
});

/**
 * GET /contacts/:id/360 — the customer-360 aggregate: profile, conversation,
 * real messaging KPIs, campaign history, merged timeline and a health score.
 */
contactsRouter.get("/:id/360", requirePermission("contacts.view"), async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const contact = await prisma.contact.findFirst({ where: { id: req.params.id, tenantId } });
  if (!contact) return res.status(404).json({ error: "not found" });

  // With several numbers a contact can have a thread on each — show the one
  // they last used.
  const conversation = await prisma.conversation.findFirst({
    where: { tenantId, phone: contact.phone },
    orderBy: { lastMessageAt: "desc" },
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

const bulkSchema = z.object({
  // Either an explicit tick-list, or "everything the current filter matches".
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
  filter: z.object({
    search: z.string().optional(),
    segmentId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
  action: z.enum(["addTag", "removeTag", "optIn", "optOut", "status", "delete"]),
  tag: z.string().optional(),
  status: z.enum(["active", "blocked", "archived"]).optional(),
});

/** Resolve a bulk selection to concrete contact ids inside this tenant. */
async function selectionIds(tenantId: string, body: z.infer<typeof bulkSchema>): Promise<string[]> {
  if (body.all) {
    const where = await listWhere(tenantId, body.filter || {});
    const rows = await prisma.contact.findMany({ where, select: { id: true } });
    return rows.map((r) => r.id);
  }
  if (!body.ids?.length) return [];
  const rows = await prisma.contact.findMany({
    where: { tenantId, id: { in: body.ids } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * POST /contacts/bulk — act on many contacts at once. Tagging reads each row
 * because tags are an array column, so it runs in a transaction per chunk
 * rather than one giant updateMany.
 */
contactsRouter.post("/bulk", requirePermission("contacts.edit"), async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const body = parsed.data;
  const tenantId = req.auth!.tenantId;

  if ((body.action === "addTag" || body.action === "removeTag") && !body.tag?.trim()) {
    return res.status(400).json({ error: "tag is required for this action" });
  }
  if (body.action === "status" && !body.status) {
    return res.status(400).json({ error: "status is required for this action" });
  }
  if (body.action === "delete" && !can(req.auth!, "contacts.delete")) {
    return res.status(403).json({ error: "contacts.delete permission required" });
  }

  const ids = await selectionIds(tenantId, body);
  if (!ids.length) return res.json({ affected: 0 });

  let affected = 0;
  switch (body.action) {
    case "delete":
      affected = (await prisma.contact.deleteMany({ where: { tenantId, id: { in: ids } } })).count;
      break;
    case "optIn":
    case "optOut": {
      const optedIn = body.action === "optIn";
      affected = (await prisma.contact.updateMany({
        where: { tenantId, id: { in: ids } },
        data: {
          optedIn,
          consentSource: "agent",
          ...(optedIn ? { optedInAt: new Date() } : { optedOutAt: new Date() }),
        },
      })).count;
      break;
    }
    case "status":
      affected = (await prisma.contact.updateMany({
        where: { tenantId, id: { in: ids } },
        data: { status: body.status },
      })).count;
      break;
    default: {
      const tag = body.tag!.trim();
      const rows = await prisma.contact.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, tags: true },
      });
      const updates = rows
        .map((r) => {
          const next =
            body.action === "addTag"
              ? r.tags.includes(tag) ? null : [...r.tags, tag]
              : r.tags.includes(tag) ? r.tags.filter((t) => t !== tag) : null;
          return next ? prisma.contact.update({ where: { id: r.id }, data: { tags: next } }) : null;
        })
        .filter(Boolean) as any[];
      for (let i = 0; i < updates.length; i += 200) {
        await prisma.$transaction(updates.slice(i, i + 200));
      }
      affected = updates.length;
    }
  }

  audit(req, `contacts.bulk.${body.action}`, { meta: { affected, tag: body.tag, status: body.status } });
  res.json({ affected });
});

const CSV_COLUMNS = [
  ["phone", "Phone"], ["name", "Name"], ["email", "Email"], ["company", "Company"],
  ["jobTitle", "Job title"], ["city", "City"], ["country", "Country"],
  ["timezone", "Timezone"], ["language", "Language"], ["externalId", "External ID"],
  ["status", "Status"], ["optedIn", "Opted in"], ["source", "Source"], ["createdAt", "Created"],
] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /contacts/export — the current filter as CSV, custom fields included.
 * Excel reads the leading BOM as UTF-8, which keeps non-Latin names intact.
 */
contactsRouter.get("/export", requirePermission("contacts.export"), async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const where = await listWhere(tenantId, queryFilter(req));
  const [rows, fields] = await Promise.all([
    prisma.contact.findMany({ where, orderBy: { createdAt: "desc" }, take: 50_000 }),
    prisma.contactField.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } }),
  ]);

  const header = [...CSV_COLUMNS.map(([, l]) => l), ...fields.map((f) => f.label), "Tags"];
  const lines = [header.map(csvCell).join(",")];
  for (const c of rows) {
    const attrs = (c.attributes as Record<string, unknown> | null) || {};
    lines.push([
      ...CSV_COLUMNS.map(([k]) => csvCell((c as any)[k])),
      ...fields.map((f) => csvCell(attrs[f.key])),
      csvCell((c.tags || []).join(" | ")),
    ].join(","));
  }

  audit(req, "contacts.export", { meta: { count: rows.length } });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("﻿" + lines.join("\n"));
});

/** GET /contacts/duplicates — duplicate groups per the tenant's merge rules. */
contactsRouter.get("/duplicates", requirePermission("contacts.import"), async (req, res) => {
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
contactsRouter.post("/merge", requirePermission("contacts.import"), async (req, res) => {
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
contactsRouter.delete("/:id", requirePermission("contacts.delete"), async (req, res) => {
  const c = await prisma.contact.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!c) return res.status(404).json({ error: "not found" });
  await prisma.contact.delete({ where: { id: c.id } });
  res.json({ ok: true });
});
