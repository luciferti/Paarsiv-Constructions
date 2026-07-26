import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { parseRange, dateFilter } from "../lib/dateRange";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

/**
 * GET /reports/agents — per-agent performance + global first-response time.
 * First response = gap between a conversation's first customer message and
 * the first outbound (AI or agent) that follows it.
 */
reportsRouter.get("/agents", async (req, res) => {
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

/** GET /reports/overview — headline metrics + per-campaign performance. */
reportsRouter.get("/overview", async (req, res) => {
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
