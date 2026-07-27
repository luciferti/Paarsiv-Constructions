import { prisma } from "../lib/prisma";
import { emitRealtime } from "../lib/events";
import { MsgStatus } from "@prisma/client";

/**
 * Delivery receipts from Meta. Every outbound message gets sent → delivered →
 * read, and campaigns roll their recipients' statuses up into counters.
 */

const RANK: Record<string, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 };

/** Meta can deliver receipts out of order; never walk a status backwards. */
function isProgress(from: string | null | undefined, to: string): boolean {
  if (to === "FAILED") return true;
  return (RANK[to] ?? 0) > (RANK[(from || "QUEUED").toUpperCase()] ?? 0);
}

export interface StatusEvent {
  id: string;               // wamid of the outbound message
  status: string;           // sent | delivered | read | failed
  errors?: { code?: number; title?: string; message?: string }[];
}

export async function handleStatuses(tenantId: string, statuses: StatusEvent[]) {
  for (const s of statuses) {
    if (!s?.id || !s?.status) continue;
    const next = s.status.toUpperCase();
    // Meta occasionally sends statuses we don't model (e.g. "deleted").
    if (!(next in MsgStatus)) continue;
    const error = s.errors?.[0]
      ? `${s.errors[0].title || s.errors[0].code || "error"}: ${s.errors[0].message || ""}`.trim()
      : null;

    // --- the inbox message ---
    const message = await prisma.message.findUnique({ where: { waMessageId: s.id } });
    if (message && isProgress(message.status, next)) {
      const updated = await prisma.message.update({
        where: { id: message.id },
        data: { status: next as MsgStatus },
      });
      emitRealtime({
        tenantId,
        type: "message",
        conversationId: updated.conversationId,
        message: updated,
      });
    }

    // --- the campaign recipient ---
    const recipient = await prisma.campaignRecipient.findFirst({ where: { waMessageId: s.id } });
    if (recipient && isProgress(recipient.status, next)) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: next, ...(error ? { error } : {}) },
      });
      await recountCampaign(recipient.campaignId);
      // Roll the contact's own engagement forward so segments can filter on
      // it without counting rows every time they're evaluated.
      if (recipient.contactId && (next === "DELIVERED" || next === "READ")) {
        await prisma.contact.update({
          where: { id: recipient.contactId },
          data: {
            ...(next === "DELIVERED" ? { deliveredCount: { increment: 1 }, lastDeliveredAt: new Date() } : {}),
            ...(next === "READ" ? { readCount: { increment: 1 } } : {}),
          },
        }).catch(() => {});
      }
    }
  }
}

/**
 * Recompute a campaign's counters from its recipients. Cheaper than trying to
 * keep running totals correct when receipts arrive out of order.
 */
export async function recountCampaign(campaignId: string) {
  const rows = await prisma.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const count = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;

  const failed = count("FAILED");
  const read = count("READ");
  const delivered = read + count("DELIVERED");
  const sent = delivered + count("SENT");

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { sentCount: sent, deliveredCount: delivered, readCount: read, failedCount: failed },
  });
}
