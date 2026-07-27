import { prisma } from "../lib/prisma";
import { tierCeiling } from "./campaigns";
import type { Tenant } from "@prisma/client";

/**
 * One place that answers "is anything wrong?".
 *
 * Each moving part reports for itself — the WhatsApp connection, campaigns in
 * flight, connectors, event hooks, scripts, consent. Everything here is read
 * from real state; nothing is a guess, and every problem carries the page that
 * fixes it, because a warning nobody can act on is just noise.
 */

export type Level = "ok" | "warn" | "error";

export interface Check {
  key: string;
  area: string;
  level: Level;
  title: string;
  detail: string;
  action?: { label: string; href: string };
}

const day = 86_400_000;

/** WhatsApp itself: connected, receiving, and in good standing with Meta. */
async function whatsappChecks(tenant: Tenant): Promise<Check[]> {
  const out: Check[] = [];
  const connected = !!(tenant.whatsappToken && tenant.wabaId && tenant.phoneNumberId);

  if (!connected) {
    out.push({
      key: "wa.connected",
      area: "WhatsApp",
      level: "warn",
      title: "No WhatsApp number connected",
      detail: "Everything works, but messages are simulated rather than sent.",
      action: { label: "Connect", href: "/settings/whatsapp" },
    });
    return out;
  }

  out.push({
    key: "wa.connected",
    area: "WhatsApp",
    level: "ok",
    title: "WhatsApp connected",
    detail: `${tenant.displayPhoneNumber || "Number"}${tenant.wabaName ? ` · ${tenant.wabaName}` : ""}`,
  });

  if (!tenant.webhookSubscribed) {
    out.push({
      key: "wa.webhook",
      area: "WhatsApp",
      level: "error",
      title: "Not subscribed to Meta's webhooks",
      detail: "Nothing customers send will reach the inbox, and delivery receipts won't arrive.",
      action: { label: "Repair", href: "/settings/whatsapp" },
    });
  }

  if (tenant.connectionError) {
    out.push({
      key: "wa.error",
      area: "WhatsApp",
      level: "warn",
      title: "Last connection check failed",
      detail: tenant.connectionError,
      action: { label: "Re-check", href: "/settings/whatsapp" },
    });
  }

  // Number quality is the thing that quietly throttles a workspace.
  const numbers = await prisma.phoneNumber.findMany({
    where: { tenantId: tenant.id, active: true },
  });
  for (const n of numbers) {
    const label = n.label || n.displayPhoneNumber;
    if (n.qualityRating === "RED") {
      out.push({
        key: `wa.quality.${n.phoneNumberId}`,
        area: "WhatsApp",
        level: "error",
        title: `${label} has a red quality rating`,
        detail: "Meta lowers the daily limit and may block sending. Stop broadcasting from it and look at what recipients are reporting.",
        action: { label: "See numbers", href: "/settings/whatsapp" },
      });
    } else if (n.qualityRating === "YELLOW") {
      out.push({
        key: `wa.quality.${n.phoneNumberId}`,
        area: "WhatsApp",
        level: "warn",
        title: `${label} quality has slipped to yellow`,
        detail: "Usually too many blocks or reports. Ease off promotional sends from this number for a few days.",
        action: { label: "See numbers", href: "/settings/whatsapp" },
      });
    }
    const ceiling = tierCeiling(n.messagingLimit);
    if (ceiling && ceiling <= 1000) {
      out.push({
        key: `wa.tier.${n.phoneNumberId}`,
        area: "WhatsApp",
        level: "warn",
        title: `${label} can only message ${ceiling.toLocaleString()} people a day`,
        detail: "Meta raises this as you send consistently to people who engage. Large campaigns will be cut short until it does.",
      });
    }
  }
  return out;
}

/** Campaigns that need a human: stuck, paused, or failing outright. */
async function campaignChecks(tenantId: string): Promise<Check[]> {
  const out: Check[] = [];
  const [sending, paused, failed] = await Promise.all([
    prisma.campaign.findMany({
      where: { tenantId, status: "SENDING" },
      select: { id: true, name: true, sentCount: true, totalCount: true, startedAt: true },
    }),
    prisma.campaign.findMany({
      where: { tenantId, status: "PAUSED" },
      select: { id: true, name: true, sentCount: true, totalCount: true },
    }),
    prisma.campaign.count({
      where: { tenantId, status: "FAILED", createdAt: { gte: new Date(Date.now() - 7 * day) } },
    }),
  ]);

  for (const c of sending) {
    // Started long ago and barely moved usually means it's waiting on
    // something — a throttle set too low, or a dead connection.
    const hours = c.startedAt ? (Date.now() - c.startedAt.getTime()) / 3_600_000 : 0;
    const done = c.totalCount ? c.sentCount / c.totalCount : 0;
    if (hours > 6 && done < 0.5) {
      out.push({
        key: `campaign.slow.${c.id}`,
        area: "Campaigns",
        level: "warn",
        title: `"${c.name}" has been sending for ${Math.round(hours)} hours`,
        detail: `${c.sentCount.toLocaleString()} of ${c.totalCount.toLocaleString()} so far. Check the rate, and whether the number is still healthy.`,
        action: { label: "Open", href: `/campaigns/${c.id}` },
      });
    }
  }
  for (const c of paused) {
    out.push({
      key: `campaign.paused.${c.id}`,
      area: "Campaigns",
      level: "warn",
      title: `"${c.name}" is paused`,
      detail: `${c.sentCount.toLocaleString()} of ${c.totalCount.toLocaleString()} sent. It will not continue until someone resumes it.`,
      action: { label: "Open", href: `/campaigns/${c.id}` },
    });
  }
  if (failed > 0) {
    out.push({
      key: "campaign.failed",
      area: "Campaigns",
      level: "error",
      title: `${failed} campaign${failed === 1 ? "" : "s"} failed this week`,
      detail: "Every message was rejected. Usually the template isn't approved, or the number can't send.",
      action: { label: "See campaigns", href: "/campaigns" },
    });
  }
  if (out.length === 0) {
    out.push({
      key: "campaign.ok",
      area: "Campaigns",
      level: "ok",
      title: "No campaigns need attention",
      detail: "Nothing stuck, paused or failing.",
    });
  }
  return out;
}

/** The integration plumbing: connectors in, event hooks out, scripts. */
async function integrationChecks(tenantId: string): Promise<Check[]> {
  const out: Check[] = [];

  const connectors = await prisma.connector.findMany({ where: { tenantId } });
  for (const c of connectors) {
    if (!c.active) continue;
    if (c.lastError) {
      out.push({
        key: `connector.error.${c.id}`,
        area: "Connectors",
        level: "warn",
        title: `${c.name} rejected its last event`,
        detail: c.lastError,
        action: { label: "See activity", href: "/settings/connectors" },
      });
    } else if (c.eventsReceived > 0 && c.lastEventAt && Date.now() - c.lastEventAt.getTime() > 7 * day) {
      out.push({
        key: `connector.silent.${c.id}`,
        area: "Connectors",
        level: "warn",
        title: `${c.name} has been quiet for a week`,
        detail: "It used to send events and has stopped. Check the webhook is still configured on their side.",
        action: { label: "Open", href: "/settings/connectors" },
      });
    }
  }

  const hooks = await prisma.eventHook.findMany({ where: { tenantId } });
  for (const h of hooks) {
    if (!h.active && h.failStreak >= 10) {
      out.push({
        key: `hook.paused.${h.id}`,
        area: "Event webhooks",
        level: "error",
        title: `${h.name} was paused after failing repeatedly`,
        detail: `${h.lastError || "The endpoint kept refusing."} Events are no longer being sent there.`,
        action: { label: "Fix", href: "/settings/connectors" },
      });
    } else if (h.active && h.failStreak > 0) {
      out.push({
        key: `hook.failing.${h.id}`,
        area: "Event webhooks",
        level: "warn",
        title: `${h.name} is failing`,
        detail: `${h.failStreak} in a row. ${h.lastError || ""}`.trim(),
        action: { label: "See log", href: "/settings/connectors" },
      });
    }
  }

  const scripts = await prisma.script.findMany({ where: { tenantId, enabled: true } });
  for (const s of scripts) {
    if (s.runs >= 5 && s.failures / s.runs > 0.5) {
      out.push({
        key: `script.failing.${s.id}`,
        area: "Scripts",
        level: "error",
        title: `"${s.name}" fails more often than it works`,
        detail: `${s.failures} of ${s.runs} runs failed. ${s.lastError || ""}`.trim(),
        action: { label: "Open", href: "/settings/scripts" },
      });
    }
  }

  if (out.length === 0 && (connectors.length || hooks.length || scripts.length)) {
    out.push({
      key: "integrations.ok",
      area: "Integrations",
      level: "ok",
      title: "Integrations are healthy",
      detail: `${connectors.length} connector(s), ${hooks.length} webhook(s), ${scripts.length} script(s) — none failing.`,
    });
  }
  return out;
}

/** Audience health: consent, and whether anyone is left to message. */
async function audienceChecks(tenantId: string): Promise<Check[]> {
  const out: Check[] = [];
  const [total, optedIn, optedOutWeek] = await Promise.all([
    prisma.contact.count({ where: { tenantId } }),
    prisma.contact.count({ where: { tenantId, optedIn: true } }),
    prisma.contact.count({
      where: { tenantId, optedIn: false, optedOutAt: { gte: new Date(Date.now() - 7 * day) } },
    }),
  ]);

  if (total === 0) {
    out.push({
      key: "audience.empty",
      area: "Audience",
      level: "warn",
      title: "No contacts yet",
      detail: "Import a CSV, or connect a system that sends them.",
      action: { label: "Import", href: "/contacts/import" },
    });
    return out;
  }

  // A spike in opt-outs is the earliest warning that messaging is landing badly.
  const optOutPct = total ? Math.round((optedOutWeek / total) * 100) : 0;
  if (optedOutWeek > 0 && optOutPct >= 2) {
    out.push({
      key: "audience.optout",
      area: "Audience",
      level: "error",
      title: `${optedOutWeek.toLocaleString()} people opted out this week`,
      detail: `${optOutPct}% of the audience. Something recent is landing badly — check what went out and to whom.`,
      action: { label: "See campaigns", href: "/reports" },
    });
  } else if (optedOutWeek > 0) {
    out.push({
      key: "audience.optout",
      area: "Audience",
      level: "ok",
      title: `${optedOutWeek} opted out this week`,
      detail: "Normal attrition.",
    });
  }

  const reachablePct = Math.round((optedIn / total) * 100);
  if (reachablePct < 70) {
    out.push({
      key: "audience.reachable",
      area: "Audience",
      level: "warn",
      title: `Only ${reachablePct}% of contacts can be messaged`,
      detail: `${(total - optedIn).toLocaleString()} of ${total.toLocaleString()} have opted out.`,
    });
  }
  return out;
}

export interface HealthReport {
  level: Level;
  summary: string;
  counts: { error: number; warn: number; ok: number };
  checks: Check[];
}

export async function healthReport(tenant: Tenant): Promise<HealthReport> {
  const groups = await Promise.all([
    whatsappChecks(tenant),
    campaignChecks(tenant.id),
    integrationChecks(tenant.id),
    audienceChecks(tenant.id),
  ]);
  const checks = groups.flat();

  const counts = {
    error: checks.filter((c) => c.level === "error").length,
    warn: checks.filter((c) => c.level === "warn").length,
    ok: checks.filter((c) => c.level === "ok").length,
  };
  const level: Level = counts.error > 0 ? "error" : counts.warn > 0 ? "warn" : "ok";
  const summary =
    counts.error > 0
      ? `${counts.error} thing${counts.error === 1 ? "" : "s"} need${counts.error === 1 ? "s" : ""} attention now`
      : counts.warn > 0
        ? `${counts.warn} thing${counts.warn === 1 ? "" : "s"} worth a look`
        : "Everything looks healthy";

  // Problems first — nobody scrolls past a wall of green to find the red.
  const order: Record<Level, number> = { error: 0, warn: 1, ok: 2 };
  checks.sort((a, b) => order[a.level] - order[b.level]);

  return { level, summary, counts, checks };
}
