import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

/** GET /reports/overview — headline metrics + per-campaign performance. */
reportsRouter.get("/overview", async (req, res) => {
  const tenantId = req.auth!.tenantId;

  const [contacts, optedIn, conversations, campaigns, aiReplies, agentReplies] =
    await Promise.all([
      prisma.contact.count({ where: { tenantId } }),
      prisma.contact.count({ where: { tenantId, optedIn: true } }),
      prisma.conversation.count({ where: { tenantId } }),
      prisma.campaign.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.message.count({ where: { tenantId, sentBy: "AI" } }),
      prisma.message.count({ where: { tenantId, sentBy: "AGENT" } }),
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
