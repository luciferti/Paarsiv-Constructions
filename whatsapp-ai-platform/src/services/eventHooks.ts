import crypto from "crypto";
import { prisma } from "../lib/prisma";

/**
 * Outbound event webhooks — the mirror of connectors.
 *
 * Connectors bring records in; these push events out, so a CRM can react to a
 * customer replying, opting out, or a campaign finishing. Delivery is
 * fire-and-forget: nothing in the messaging path ever waits on someone else's
 * server being up.
 */

export const EVENTS = [
  { key: "message.received", label: "Customer sent a message", desc: "Any inbound WhatsApp message" },
  { key: "message.sent", label: "We sent a message", desc: "Replies from an agent, the AI or a journey" },
  { key: "conversation.handoff", label: "Chat handed to a human", desc: "AI stepped back for an agent" },
  { key: "contact.created", label: "New contact", desc: "First time we've seen this number" },
  { key: "contact.opted_out", label: "Contact opted out", desc: "Stop honouring marketing for them" },
  { key: "contact.opted_in", label: "Contact opted back in", desc: "They asked to resume" },
  { key: "campaign.finished", label: "Campaign finished", desc: "With its final counts" },
] as const;

export type EventKey = (typeof EVENTS)[number]["key"];
export const EVENT_KEYS: string[] = EVENTS.map((e) => e.key);

export function newSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
}

/** Signature a receiver can recompute to prove the body came from us. */
export function sign(secret: string, timestamp: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 1_000, 5_000];
/** Consecutive failures before we stop calling a dead endpoint. */
const PAUSE_AFTER = 10;

async function deliver(
  hook: { id: string; url: string; secret: string; failStreak: number },
  event: string,
  data: unknown
): Promise<void> {
  const timestamp = String(Date.now());
  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data });
  let statusCode: number | undefined;
  let error: string | undefined;
  let attempt = 0;

  for (attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (BACKOFF_MS[attempt - 1]) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const resp = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Event": event,
          "X-Timestamp": timestamp,
          "X-Signature": `sha256=${sign(hook.secret, timestamp, body)}`,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      statusCode = resp.status;
      if (resp.ok) { error = undefined; break; }
      error = `HTTP ${resp.status}`;
    } catch (e: any) {
      error = e?.name === "AbortError" ? "timed out after 10s" : e?.message || "network error";
    }
  }

  const ok = !error;
  const streak = ok ? 0 : hook.failStreak + 1;

  await prisma.$transaction([
    prisma.eventDelivery.create({
      data: {
        hookId: hook.id,
        event,
        status: ok ? "delivered" : "failed",
        statusCode: statusCode ?? null,
        attempts: Math.min(attempt, MAX_ATTEMPTS),
        error: error ?? null,
        payload: data as object,
      },
    }),
    prisma.eventHook.update({
      where: { id: hook.id },
      data: {
        lastDeliveryAt: new Date(),
        lastError: error ?? null,
        failStreak: streak,
        ...(ok ? { delivered: { increment: 1 } } : { failed: { increment: 1 } }),
        // Stop hammering something that has been down for a while. The owner
        // sees why on the connectors screen and can switch it back on.
        ...(streak >= PAUSE_AFTER ? { active: false } : {}),
      },
    }),
  ]);
}

/**
 * Announce that something happened. Never awaited by callers in the message
 * path — a slow subscriber must not slow down a reply.
 */
export function emitEvent(tenantId: string, event: EventKey, data: unknown): void {
  void (async () => {
    try {
      const hooks = await prisma.eventHook.findMany({
        where: { tenantId, active: true },
        select: { id: true, url: true, secret: true, events: true, failStreak: true },
      });
      const interested = hooks.filter((h) => h.events.length === 0 || h.events.includes(event));
      await Promise.all(interested.map((h) => deliver(h, event, data)));
    } catch (e: any) {
      console.error("[eventhook] emit failed:", e?.message || e);
    }
  })();
}

/** Same delivery path as a real event, so a test proves the real thing works. */
export async function sendTest(hookId: string): Promise<void> {
  const hook = await prisma.eventHook.findUniqueOrThrow({
    where: { id: hookId },
    select: { id: true, url: true, secret: true, failStreak: true },
  });
  await deliver(hook, "test.ping", {
    message: "If you can read this, your endpoint is wired up correctly.",
  });
}
