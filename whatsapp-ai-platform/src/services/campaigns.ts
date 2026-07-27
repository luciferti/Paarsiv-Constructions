import { prisma } from "../lib/prisma";
import { segmentWhere, type SegmentRules } from "../lib/segment";
import { fillTokens } from "../lib/tokens";
import { sendWhatsAppText } from "./whatsapp";
import { emitRealtime } from "../lib/events";
import { resolveSender, senderCredentials } from "./numbers";
import { emitEvent } from "./eventHooks";
import { runScriptsFor } from "./scripts";
import type { Tenant } from "@prisma/client";

/** Resolve a campaign's audience: opted-in contacts in its segment (or all). */
async function resolveAudience(tenantId: string, segmentId: string | null) {
  let where: any = { tenantId, optedIn: true };
  if (segmentId) {
    const seg = await prisma.segment.findFirst({ where: { id: segmentId, tenantId } });
    if (seg) {
      where = {
        AND: [
          segmentWhere(tenantId, seg.rules as unknown as SegmentRules),
          { optedIn: true },
        ],
      };
    }
  }
  return prisma.contact.findMany({ where });
}

/**
 * Send a campaign: expand the segment, personalize the template per contact,
 * send each message, and record per-recipient status for reporting.
 * Runs in the background (fire-and-forget) after the API responds.
 */
export async function runCampaign(tenant: Tenant, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId: tenant.id },
    include: { template: true },
  });
  if (!campaign || !campaign.template) return;

  const audience = await resolveAudience(tenant.id, campaign.segmentId);

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "SENDING",
      totalCount: audience.length,
      startedAt: new Date(),
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
    },
  });

  let sent = 0,
    delivered = 0,
    read = 0,
    failed = 0;

  // Campaigns go out from the number chosen when the campaign was built.
  const sender = await resolveSender(tenant.id, campaign.phoneNumberId);

  // With a real number connected, delivered/read arrive on Meta's status
  // webhooks — inventing them there would report numbers that never happened.
  const live = !!(sender?.phoneNumberId || tenant.phoneNumberId) && !!tenant.whatsappToken;

  for (const contact of audience) {
    const text = fillTokens(campaign.template.body, contact);
    const result = await sendWhatsAppText(senderCredentials(tenant, sender), contact.phone, text);

    let status: string;
    if (!result.ok) {
      status = "FAILED";
      failed++;
    } else {
      sent++;
      status = "SENT";
      if (!live) {
        // Demo workspace: a plausible funnel so reporting has something to show.
        const roll = Math.random();
        if (roll < 0.85) {
          delivered++;
          if (roll < 0.55) {
            read++;
            status = "READ";
          } else status = "DELIVERED";
        }
      }
    }

    await prisma.campaignRecipient.create({
      data: {
        campaignId: campaign.id,
        contactId: contact.id,
        phone: contact.phone,
        name: contact.name,
        status,
        waMessageId: result.waMessageId || null,
        error: result.ok ? null : result.error,
        sentAt: result.ok ? new Date() : null,
      },
    });
  }

  const finished = await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: failed === audience.length && audience.length > 0 ? "FAILED" : "SENT",
      sentCount: sent,
      deliveredCount: delivered,
      readCount: read,
      failedCount: failed,
      finishedAt: new Date(),
    },
  });

  emitRealtime({ tenantId: tenant.id, type: "conversation", conversation: { campaign: finished } as any });

  const done = {
    campaignId: finished.id,
    name: finished.name,
    status: finished.status,
    audience: audience.length,
    sent, delivered, read, failed,
    phoneNumberId: sender?.phoneNumberId ?? "",
  };
  emitEvent(tenant.id, "campaign.finished", done);
  runScriptsFor(tenant.id, "campaign.finished", done);
}
