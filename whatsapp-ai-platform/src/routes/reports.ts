import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requirePermission } from "../middleware/auth";
import { healthReport } from "../services/health";
import { parseRange, dateFilter } from "../lib/dateRange";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

/**
 * GET /reports/agents — per-agent performance + global first-response time.
 * First response = gap between a conversation's first customer message and
 * the first outbound (AI or agent) that follows it.
 */
/**
 * GET /reports/health — is anything wrong? One answer for the whole
 * workspace, with the page that fixes each problem.
 */
reportsRouter.get("/health", requirePermission("reports.view"), async (req, res) => {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: req.auth!.tenantId } });
  res.json({ health: await healthReport(tenant) });
});

reportsRouter.get("/agents", requirePermission("reports.agents"), async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const range = dateFilter(parseRange(req));

  const users = await prisma.user.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, displayName: true, role: true, team: true, presence: true },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
  });

  const [replyCounts, assignedCounts] = await Promise.all([
    prisma.message.groupBy({
      by: ["senderId"],
      where: { tenantId, sentBy: "AGENT", senderId: { not: null }, ...(range ? { timestamp: range } : {}) },
      _count: { _all: true },
      _max: { timestamp: true },
    }),
    prisma.conversation.groupBy({
      by: ["assignedUserId"],
      where: { tenantId, assignedUserId: { not: null }, ...(range ? { lastMessageAt: range } : {}) },
      _count: { _all: true },
    }),
  ]);
  const replies = new Map(replyCounts.map((r) => [r.senderId, r]));
  const assigned = new Map(assignedCounts.map((a) => [a.assignedUserId, a._count._all]));

  // Global average first-response time across conversations.
  const convs = await prisma.conversation.findMany({
    where: { tenantId, ...(range ? { lastMessageAt: range } : {}) },
    select: { id: true },
    take: 200,
  });
  let totalMs = 0;
  let counted = 0;
  for (const c of convs) {
    const firstIn = await prisma.message.findFirst({
      where: { conversationId: c.id, direction: "INBOUND" },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    });
    if (!firstIn) continue;
    const firstOut = await prisma.message.findFirst({
      where: { conversationId: c.id, direction: "OUTBOUND", timestamp: { gte: firstIn.timestamp } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    });
    if (!firstOut) continue;
    totalMs += firstOut.timestamp.getTime() - firstIn.timestamp.getTime();
    counted++;
  }
  const avgFirstResponseSec = counted > 0 ? Math.round(totalMs / counted / 1000) : null;

  res.json({
    avgFirstResponseSec,
    conversationsMeasured: counted,
    agents: users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      role: u.role,
      team: u.team,
      presence: u.presence,
      replies: replies.get(u.id)?._count._all ?? 0,
      lastActive: replies.get(u.id)?._max.timestamp ?? null,
      assignedConversations: assigned.get(u.id) ?? 0,
    })),
  });
});

/**
 * GET /reports/timeseries — daily buckets for charts: inbound/outbound
 * messages split by sender, new conversations and new contacts.
 */
reportsRouter.get("/timeseries", requirePermission("reports.view"), async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const range = parseRange(req);
  const to = range.to ?? new Date();
  const from = range.from ?? new Date(to.getTime() - 29 * 86_400_000);

  const dayKey = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [messages, conversations, contacts] = await Promise.all([
    prisma.message.findMany({
      where: { tenantId, timestamp: { gte: from, lte: to } },
      select: { timestamp: true, direction: true, sentBy: true },
      take: 20000,
    }),
    prisma.conversation.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
      take: 20000,
    }),
    prisma.contact.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
      take: 20000,
    }),
  ]);

  // Pre-seed every day in the window so charts have no gaps.
  const buckets = new Map<string, { date: string; incoming: number; ai: number; agent: number; conversations: number; contacts: number }>();
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d);
    buckets.set(k, { date: k, incoming: 0, ai: 0, agent: 0, conversations: 0, contacts: 0 });
  }
  const bump = (k: string, field: "incoming" | "ai" | "agent" | "conversations" | "contacts") => {
    const b = buckets.get(k);
    if (b) b[field] += 1;
  };
  for (const m of messages) {
    const k = dayKey(m.timestamp);
    if (m.direction === "INBOUND") bump(k, "incoming");
    else bump(k, m.sentBy === "AGENT" ? "agent" : "ai");
  }
  for (const c of conversations) bump(dayKey(c.createdAt), "conversations");
  for (const c of contacts) bump(dayKey(c.createdAt), "contacts");

  res.json({ series: Array.from(buckets.values()) });
});

/** GET /reports/breakdown — audience distribution for donut/bar charts. */
reportsRouter.get("/breakdown", requirePermission("reports.view"), async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const range = dateFilter(parseRange(req));

  const contacts = await prisma.contact.findMany({
    where: { tenantId, ...(range ? { createdAt: range } : {}) },
    select: { city: true, tags: true, source: true, optedIn: true },
    take: 5000,
  });

  const tally = (pick: (c: (typeof contacts)[number]) => string[]) => {
    const map = new Map<string, number>();
    for (const c of contacts) for (const v of pick(c)) map.set(v, (map.get(v) || 0) + 1);
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };

  res.json({
    cities: tally((c) => (c.city ? [c.city] : ["Unknown"])),
    tags: tally((c) => (c.tags.length ? c.tags : [])),
    sources: tally((c) => [c.source || "manual"]),
    optIn: [
      { name: "Opted in", value: contacts.filter((c) => c.optedIn).length },
      { name: "Opted out", value: contacts.filter((c) => !c.optedIn).length },
    ],
    total: contacts.length,
  });
});

/** GET /reports/overview — headline metrics + per-campaign performance. */
reportsRouter.get("/overview", requirePermission("reports.view"), async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const range = dateFilter(parseRange(req));
  const msgWhere = range ? { timestamp: range } : {};
  const convWhere = range ? { lastMessageAt: range } : {};

  const [contacts, optedIn, conversations, campaigns, aiReplies, agentReplies] =
    await Promise.all([
      prisma.contact.count({ where: { tenantId, ...(range ? { createdAt: range } : {}) } }),
      prisma.contact.count({ where: { tenantId, optedIn: true, ...(range ? { createdAt: range } : {}) } }),
      prisma.conversation.count({ where: { tenantId, ...convWhere } }),
      prisma.campaign.findMany({
        where: { tenantId, ...(range ? { createdAt: range } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.message.count({ where: { tenantId, sentBy: "AI", ...msgWhere } }),
      prisma.message.count({ where: { tenantId, sentBy: "AGENT", ...msgWhere } }),
    ]);

  const totals = campaigns.reduce(
    (acc, c) => {
      acc.sent += c.sentCount;
      acc.delivered += c.deliveredCount;
      acc.read += c.readCount;
      acc.failed += c.failedCount;
      return acc;
    },
    { sent: 0, delivered: 0, read: 0, failed: 0 }
  );

  const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

  res.json({
    audience: { contacts, optedIn },
    inbox: { conversations, aiReplies, agentReplies },
    campaigns: {
      count: campaigns.length,
      totals,
      deliveryRate: rate(totals.delivered, totals.sent),
      readRate: rate(totals.read, totals.sent),
      list: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        totalCount: c.totalCount,
        sentCount: c.sentCount,
        deliveredCount: c.deliveredCount,
        readCount: c.readCount,
        failedCount: c.failedCount,
        readRate: rate(c.readCount, c.sentCount),
        createdAt: c.createdAt,
      })),
    },
  });
});
