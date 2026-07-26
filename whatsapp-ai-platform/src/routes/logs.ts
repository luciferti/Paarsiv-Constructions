import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const logsRouter = Router();
logsRouter.use(requireAuth, requireRole("ADMIN"));

/** GET /logs/audit — recent audit trail (paginated). */
logsRouter.get("/audit", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const take = 50;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { tenantId: req.auth!.tenantId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    prisma.auditLog.count({ where: { tenantId: req.auth!.tenantId } }),
  ]);
  res.json({ logs, total, page, pages: Math.ceil(total / take) });
});

/** GET /logs/webhooks — recent inbound webhook events. */
logsRouter.get("/webhooks", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const take = 50;
  const [logs, total] = await Promise.all([
    prisma.webhookLog.findMany({
      where: { OR: [{ tenantId: req.auth!.tenantId }, { tenantId: null }] },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    prisma.webhookLog.count({
      where: { OR: [{ tenantId: req.auth!.tenantId }, { tenantId: null }] },
    }),
  ]);
  res.json({ logs, total, page, pages: Math.ceil(total / take) });
});
