import { prisma } from "../lib/prisma";

/**
 * Which message actually works.
 *
 * Campaign reporting says how one send went. This says how a *template*
 * performs across every send it has been used in — including the number
 * almost nobody measures: how many people opted out shortly after getting it.
 *
 * Replies and opt-outs are attributed by time: someone who wrote back, or
 * left, within a window of receiving it. That is an association, not proof —
 * they might have replied about something else — so the UI says so rather
 * than dressing it up as causation.
 */

const REPLY_WINDOW_HOURS = 72;
const OPTOUT_WINDOW_HOURS = 48;

export interface TemplateStat {
  templateId: string;
  name: string;
  category: string;
  metaStatus: string | null;
  campaigns: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
  replies: number;
  replyRate: number;
  optOuts: number;
  optOutRate: number;
  lastUsedAt: Date | null;
}

export interface TemplateReport {
  templates: TemplateStat[];
  windowHours: { reply: number; optOut: number };
  best: { readRate?: TemplateStat; replyRate?: TemplateStat } | null;
  worst: { optOutRate?: TemplateStat } | null;
}

export async function templateReport(
  tenantId: string,
  range?: { from?: Date; to?: Date }
): Promise<TemplateReport> {
  const campaignWhere: any = { tenantId, templateId: { not: null } };
  if (range?.from || range?.to) {
    campaignWhere.createdAt = {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    };
  }

  const campaigns = await prisma.campaign.findMany({
    where: campaignWhere,
    select: {
      id: true,
      templateId: true,
      template: { select: { id: true, name: true, category: true, metaStatus: true } },
    },
  });
  if (campaigns.length === 0) {
    return { templates: [], windowHours: { reply: REPLY_WINDOW_HOURS, optOut: OPTOUT_WINDOW_HOURS }, best: null, worst: null };
  }

  const byTemplate = new Map<string, { name: string; category: string; metaStatus: string | null; campaignIds: string[] }>();
  for (const c of campaigns) {
    if (!c.template) continue;
    const entry = byTemplate.get(c.template.id) || {
      name: c.template.name,
      category: c.template.category,
      metaStatus: c.template.metaStatus,
      campaignIds: [],
    };
    entry.campaignIds.push(c.id);
    byTemplate.set(c.template.id, entry);
  }

  const stats: TemplateStat[] = [];

  for (const [templateId, info] of byTemplate) {
    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: { in: info.campaignIds } },
      select: { contactId: true, status: true, sentAt: true },
    });
    if (recipients.length === 0) continue;

    const read = recipients.filter((r) => r.status === "READ").length;
    const delivered = read + recipients.filter((r) => r.status === "DELIVERED").length;
    const failed = recipients.filter((r) => r.status === "FAILED").length;
    const sent = recipients.length - failed;

    // Everyone who actually received it, with when.
    const reached = recipients.filter((r) => r.contactId && r.sentAt && r.status !== "FAILED");
    const contactIds = [...new Set(reached.map((r) => r.contactId!))];

    let replies = 0;
    let optOuts = 0;
    let lastUsedAt: Date | null = null;
    for (const r of reached) {
      if (r.sentAt && (!lastUsedAt || r.sentAt > lastUsedAt)) lastUsedAt = r.sentAt;
    }

    if (contactIds.length) {
      const contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, lastInboundAt: true, optedOutAt: true },
      });
      const byId = new Map(contacts.map((c) => [c.id, c]));

      for (const r of reached) {
        const c = byId.get(r.contactId!);
        if (!c || !r.sentAt) continue;
        const sentMs = r.sentAt.getTime();
        if (c.lastInboundAt) {
          const gap = c.lastInboundAt.getTime() - sentMs;
          if (gap >= 0 && gap <= REPLY_WINDOW_HOURS * 3_600_000) replies++;
        }
        if (c.optedOutAt) {
          const gap = c.optedOutAt.getTime() - sentMs;
          if (gap >= 0 && gap <= OPTOUT_WINDOW_HOURS * 3_600_000) optOuts++;
        }
      }
    }

    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
    stats.push({
      templateId,
      name: info.name,
      category: info.category,
      metaStatus: info.metaStatus,
      campaigns: info.campaignIds.length,
      sent,
      delivered,
      read,
      failed,
      deliveryRate: pct(delivered, sent),
      readRate: pct(read, delivered),
      replies,
      replyRate: pct(replies, delivered),
      optOuts,
      optOutRate: pct(optOuts, delivered),
      lastUsedAt,
    });
  }

  stats.sort((a, b) => b.sent - a.sent);

  // Only call something best or worst when there's enough behind it to mean
  // anything — one send to three people proves nothing.
  const meaningful = stats.filter((s) => s.delivered >= 20);
  const bestBy = (key: "readRate" | "replyRate") =>
    meaningful.length ? [...meaningful].sort((a, b) => b[key] - a[key])[0] : undefined;
  const worstOptOut = meaningful.length
    ? [...meaningful].sort((a, b) => b.optOutRate - a.optOutRate)[0]
    : undefined;

  return {
    templates: stats,
    windowHours: { reply: REPLY_WINDOW_HOURS, optOut: OPTOUT_WINDOW_HOURS },
    best: meaningful.length ? { readRate: bestBy("readRate"), replyRate: bestBy("replyRate") } : null,
    worst: worstOptOut && worstOptOut.optOutRate > 0 ? { optOutRate: worstOptOut } : null,
  };
}
