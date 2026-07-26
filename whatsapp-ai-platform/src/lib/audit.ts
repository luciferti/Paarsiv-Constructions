import type { Request } from "express";
import { prisma } from "./prisma";

/**
 * Fire-and-forget audit trail. Never throws, never blocks the request path.
 * action examples: "auth.login", "settings.update", "campaign.send".
 */
export function audit(
  req: Request,
  action: string,
  opts: { entity?: string; entityId?: string; meta?: Record<string, unknown> } = {}
) {
  const tenantId = req.auth?.tenantId;
  if (!tenantId) return;
  prisma.auditLog
    .create({
      data: {
        tenantId,
        userId: req.auth?.uid,
        username: req.auth?.username,
        action,
        entity: opts.entity,
        entityId: opts.entityId,
        meta: (opts.meta as object) ?? undefined,
        ip: req.ip,
      },
    })
    .catch((e) => console.error("[audit] write failed:", e?.message || e));
}

/** Variant for routes that authenticate outside req.auth (e.g. login). */
export function auditRaw(
  tenantId: string,
  action: string,
  opts: { userId?: string; username?: string; ip?: string; meta?: Record<string, unknown> } = {}
) {
  prisma.auditLog
    .create({
      data: {
        tenantId,
        userId: opts.userId,
        username: opts.username,
        action,
        meta: (opts.meta as object) ?? undefined,
        ip: opts.ip,
      },
    })
    .catch((e) => console.error("[audit] write failed:", e?.message || e));
}
