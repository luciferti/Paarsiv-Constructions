import { prisma } from "../lib/prisma";
import { fillTokens } from "../lib/tokens";
import { sendOutbound } from "./outbound";
import type { Tenant } from "@prisma/client";

export interface JourneyStep {
  type: "message" | "wait";
  text?: string; // message step
  templateId?: string; // message step (alternative to text)
  hours?: number; // wait step
}

const MAX_WAIT_MS = 60_000; // cap real waits in this simplified runner

async function resolveMessage(
  tenantId: string,
  step: JourneyStep,
  ctx: { name?: string | null; phone: string }
): Promise<string | null> {
  if (step.templateId) {
    const tpl = await prisma.template.findFirst({
      where: { id: step.templateId, tenantId },
    });
    if (!tpl) return null;
    return fillTokens(tpl.body, { name: ctx.name ?? undefined, phone: ctx.phone });
  }
  if (step.text) return fillTokens(step.text, { name: ctx.name ?? undefined, phone: ctx.phone });
  return null;
}

/** Execute a journey's steps for one contact (sequential). */
export async function runJourney(
  tenant: Tenant,
  steps: JourneyStep[],
  ctx: { name?: string | null; phone: string },
  opts: { ignoreWaits?: boolean } = {}
) {
  for (const step of steps) {
    if (step.type === "wait") {
      if (opts.ignoreWaits) continue;
      const ms = Math.min((step.hours ?? 0) * 3_600_000, MAX_WAIT_MS);
      if (ms > 0) await new Promise((r) => setTimeout(r, ms));
      continue;
    }
    if (step.type === "message") {
      const text = await resolveMessage(tenant.id, step, ctx);
      if (text) await sendOutbound(tenant, ctx.phone, text, "AI");
    }
  }
}

/**
 * If any ACTIVE keyword journey matches this inbound text, run it and return
 * true (so the caller can skip the normal AI auto-reply). First match wins.
 */
export async function tryTriggerJourney(
  tenant: Tenant,
  phone: string,
  name: string | undefined,
  text: string
): Promise<boolean> {
  const journeys = await prisma.journey.findMany({
    where: { tenantId: tenant.id, status: "ACTIVE", triggerType: "keyword" },
  });
  const hay = text.toLowerCase();
  for (const j of journeys) {
    const kw = (j.triggerValue || "").toLowerCase().trim();
    if (kw && hay.includes(kw)) {
      const steps = (j.steps as unknown as JourneyStep[]) || [];
      // fire-and-forget so inbound handling stays fast
      runJourney(tenant, steps, { phone, name }).catch((e) =>
        console.error("[journey] run error:", e?.message || e)
      );
      return true;
    }
  }
  return false;
}
