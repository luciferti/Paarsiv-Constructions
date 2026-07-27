import { prisma } from "../lib/prisma";
import { segmentWhere, type SegmentRules } from "../lib/segment";
import { fillTokens } from "../lib/tokens";
import { sendWhatsAppText } from "./whatsapp";
import { emitRealtime } from "../lib/events";
import { resolveSender, senderCredentials } from "./numbers";
import { emitEvent } from "./eventHooks";
import { runScriptsFor } from "./scripts";
import { Throttle, orgThrottle, pool } from "../lib/throttle";
import { recountCampaign } from "./deliveryStatus";
import type { Campaign, Contact, Tenant } from "@prisma/client";

/**
 * Campaign sending, built for lists that don't fit in memory.
 *
 * The audience is walked in pages by id rather than loaded at once, each page
 * goes through a small worker pool under a token bucket, and progress is
 * written to the campaign row after every page. That last part is what makes a
 * restart resume instead of starting over — and the unique index on
 * (campaignId, contactId) means resuming can never message anyone twice.
 */

const PAGE_SIZE = 500;
const CONCURRENCY = 16;
/**
 * Results are written in chunks rather than once per page, so progress moves
 * on a slow send too: at 10 a second a 500-page would otherwise show nothing
 * for the best part of a minute. It also shrinks the window a crash can lose.
 */
const FLUSH_EVERY = 50;

/** Contacts that should receive a campaign: opted in, and in its segment. */
async function audienceWhere(tenantId: string, segmentId: string | null): Promise<any> {
  if (!segmentId) return { tenantId, optedIn: true };
  const seg = await prisma.segment.findFirst({ where: { id: segmentId, tenantId } });
  if (!seg) return { tenantId, optedIn: true };
  return {
    AND: [segmentWhere(tenantId, seg.rules as unknown as SegmentRules), { optedIn: true }],
  };
}

/** How many people a campaign would reach — counted in the database. */
export async function audienceSize(tenantId: string, segmentId: string | null): Promise<number> {
  return prisma.contact.count({ where: await audienceWhere(tenantId, segmentId) });
}

/** Statuses that mean "stop what you're doing". */
async function shouldStop(campaignId: string): Promise<"PAUSED" | "CANCELLED" | null> {
  const c = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });
  if (c?.status === "PAUSED") return "PAUSED";
  if (c?.status === "CANCELLED") return "CANCELLED";
  return null;
}

interface SendOutcome {
  contactId: string;
  phone: string;
  name: string | null;
  status: string;
  waMessageId: string | null;
  error: string | null;
}

/**
 * Send one campaign. Safe to call again on a campaign that was interrupted —
 * it picks up from its cursor and skips anyone already recorded.
 */
export async function runCampaign(tenant: Tenant, campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId: tenant.id },
    include: { template: true },
  });
  if (!campaign || !campaign.template) return;
  if (campaign.status === "CANCELLED") return;

  const where = await audienceWhere(tenant.id, campaign.segmentId);
  const total = await prisma.contact.count({ where });
  const sender = await resolveSender(tenant.id, campaign.phoneNumberId);
  const creds = senderCredentials(tenant, sender);

  // Only invent a delivery funnel when there's no real number — with one
  // connected, delivered/read arrive on Meta's status webhooks.
  const live = !!creds.phoneNumberId && !!creds.whatsappToken;

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "SENDING",
      totalCount: total,
      error: null,
      ...(campaign.startedAt ? {} : { startedAt: new Date() }),
    },
  });

  // Two gates: this campaign's own pace, and the workspace ceiling that every
  // other campaign, journey and script is also drawing from.
  const campaignRate = Math.max(1, campaign.rateLimit || 20);
  const throttle = new Throttle(campaignRate);
  const org = orgThrottle(tenant.id, tenant.sendRateLimit);
  let cursor = campaign.cursor || null;
  let stopped: "PAUSED" | "CANCELLED" | null = null;

  for (;;) {
    stopped = await shouldStop(campaign.id);
    if (stopped) break;

    const page: Contact[] = await prisma.contact.findMany({
      where,
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;

    // Anyone already recorded for this campaign is skipped, so resuming after
    // a crash mid-page doesn't message them a second time.
    const already = new Set(
      (await prisma.campaignRecipient.findMany({
        where: { campaignId: campaign.id, contactId: { in: page.map((c) => c.id) } },
        select: { contactId: true },
      })).map((r) => r.contactId)
    );
    const todo = page.filter((c) => !already.has(c.id));

    let pending: SendOutcome[] = [];
    const flush = async () => {
      if (!pending.length) return;
      const batch = pending;
      pending = [];
      // Used by segments like "hasn't been in a campaign for 90 days".
      await prisma.contact.updateMany({
        where: { id: { in: batch.map((o) => o.contactId) } },
        data: { lastCampaignAt: new Date() },
      });
      await prisma.campaignRecipient.createMany({
        data: batch.map((o) => ({
          campaignId: campaign.id,
          contactId: o.contactId,
          phone: o.phone,
          name: o.name,
          status: o.status,
          waMessageId: o.waMessageId,
          error: o.error,
          sentAt: o.error ? null : new Date(),
        })),
        skipDuplicates: true,
      });
      await recountCampaign(campaign.id);
      const snapshot = await prisma.campaign.findUnique({ where: { id: campaign.id } });
      if (snapshot) {
        emitRealtime({ tenantId: tenant.id, type: "campaign", campaign: snapshot } as any);
      }
    };

    await pool(todo, CONCURRENCY, async (contact) => {
      // Two gates: the workspace ceiling everything shares, then this
      // campaign's own pace.
      await org.take();
      await throttle.take();
      const text = fillTokens(campaign.template!.body, contact);
      const result = await sendWhatsAppText(creds, contact.phone, text);

      let status = result.ok ? "SENT" : "FAILED";
      if (result.ok && !live) {
        const roll = Math.random();
        if (roll < 0.85) status = roll < 0.55 ? "READ" : "DELIVERED";
      }
      pending.push({
        contactId: contact.id,
        phone: contact.phone,
        name: contact.name,
        status,
        waMessageId: result.waMessageId || null,
        error: result.ok ? null : result.error || null,
      });
      if (pending.length >= FLUSH_EVERY) await flush();
    });
    await flush();

    cursor = page[page.length - 1].id;
    // The resume point, written once the page is fully accounted for.
    await prisma.campaign.update({ where: { id: campaign.id }, data: { cursor } });
  }

  await recountCampaign(campaign.id);

  if (stopped === "PAUSED") {
    // Leave the cursor where it is; resuming continues from here.
    return;
  }

  const counts = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
  const finished = await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status:
        stopped === "CANCELLED" ? "CANCELLED"
        : counts.failedCount > 0 && counts.sentCount === 0 ? "FAILED"
        : "SENT",
      finishedAt: new Date(),
      cursor: null,
    },
  });

  emitRealtime({ tenantId: tenant.id, type: "campaign", campaign: finished } as any);

  const done = {
    campaignId: finished.id,
    name: finished.name,
    status: finished.status,
    audience: total,
    sent: finished.sentCount,
    delivered: finished.deliveredCount,
    read: finished.readCount,
    failed: finished.failedCount,
    phoneNumberId: sender?.phoneNumberId ?? "",
  };
  emitEvent(tenant.id, "campaign.finished", done);
  runScriptsFor(tenant.id, "campaign.finished", done);
}

/**
 * Pick up campaigns that were mid-flight when the process stopped. Called on
 * boot — without it, a deploy during a big send would strand it forever.
 */
export async function resumeInterruptedCampaigns(): Promise<void> {
  const stuck = await prisma.campaign.findMany({
    where: { status: "SENDING" },
    select: { id: true, tenantId: true, name: true },
  });
  for (const c of stuck) {
    const tenant = await prisma.tenant.findUnique({ where: { id: c.tenantId } });
    if (!tenant) continue;
    console.log(`[campaigns] resuming "${c.name}" after restart`);
    runCampaign(tenant, c.id).catch((e) =>
      console.error(`[campaigns] resume failed for ${c.id}:`, e?.message || e)
    );
  }
}

/**
 * What a big send is up against before it starts: Meta caps how many distinct
 * people a number may message in 24 hours, by tier.
 */
export function tierCeiling(messagingLimit?: string | null): number | null {
  switch ((messagingLimit || "").toUpperCase()) {
    case "TIER_50": return 50;
    case "TIER_250": return 250;
    case "TIER_1K": return 1_000;
    case "TIER_10K": return 10_000;
    case "TIER_100K": return 100_000;
    default: return null; // unlimited, or not yet known
  }
}

export interface Preflight {
  audience: number;
  rateLimit: number;
  estimatedMinutes: number;
  dailyCeiling: number | null;
  overDailyLimit: boolean;
  warnings: string[];
}

/** Told to the user before they press send, not discovered halfway through. */
export async function preflight(tenant: Tenant, campaign: Campaign): Promise<Preflight> {
  const audience = await audienceSize(tenant.id, campaign.segmentId);
  const sender = await resolveSender(tenant.id, campaign.phoneNumberId);
  const rate = Math.max(1, campaign.rateLimit || 20);
  const dailyCeiling = tierCeiling(sender?.messagingLimit);
  const warnings: string[] = [];

  if (audience === 0) warnings.push("Nobody matches this audience right now.");
  if (dailyCeiling && audience > dailyCeiling) {
    warnings.push(
      `This number can message ${dailyCeiling.toLocaleString()} people in 24 hours, and ` +
      `${audience.toLocaleString()} are in the audience. Meta will reject the rest until the tier goes up.`
    );
  }
  const minutes = Math.ceil(audience / rate / 60);
  if (minutes > 60) {
    warnings.push(
      `At ${rate} messages a second this takes about ${Math.round(minutes / 60)} hours. ` +
      `You can pause and resume it at any point.`
    );
  }
  if (!sender?.phoneNumberId || !tenant.whatsappToken) {
    warnings.push("No WhatsApp number is connected, so this send will be simulated.");
  }

  return {
    audience,
    rateLimit: rate,
    estimatedMinutes: minutes,
    dailyCeiling,
    overDailyLimit: !!dailyCeiling && audience > dailyCeiling,
    warnings,
  };
}
