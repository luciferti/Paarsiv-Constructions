import { prisma } from "../lib/prisma";
import { segmentWhere, type SegmentRules } from "../lib/segment";
import { fillTokens } from "../lib/tokens";
import { sendOutbound } from "./outbound";
import type { Tenant } from "@prisma/client";

export interface JourneyStep {
  type: "message" | "wait" | "handoff" | "tag";
  text?: string; // message step
  templateId?: string; // message step (alternative to text)
  hours?: number; // wait step
  tag?: string; // tag step
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
      continue;
    }
    if (step.type === "handoff") {
      // Stop AI auto-replies for this conversation so a human takes over.
      await prisma.conversation.updateMany({
        where: { tenantId: tenant.id, phone: ctx.phone },
        data: { mode: "HUMAN" },
      });
      continue;
    }
    if (step.type === "tag" && step.tag) {
      // Anyone we message belongs in the audience — create the contact if new.
      const contact = await prisma.contact.findFirst({
        where: { tenantId: tenant.id, OR: [{ phone: ctx.phone }, { altPhones: { has: ctx.phone } }] },
      });
      if (!contact) {
        await prisma.contact.create({
          data: {
            tenantId: tenant.id,
            phone: ctx.phone,
            name: ctx.name ?? undefined,
            tags: [step.tag],
            source: "inbound",
          },
        });
      } else if (!contact.tags.includes(step.tag)) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { tags: [...contact.tags, step.tag] },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Graph execution (supports branching via condition nodes)
// ---------------------------------------------------------------------------

interface GraphNodeLike {
  id: string;
  data?: Record<string, unknown>;
}
interface GraphEdgeLike {
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface JourneyContext {
  phone: string;
  name?: string | null;
  triggerText?: string; // the inbound message that started the journey
  startedAt?: Date;
}

/** Evaluate a condition node against the contact/conversation right now. */
async function evaluateCondition(
  tenantId: string,
  data: Record<string, unknown>,
  ctx: JourneyContext
): Promise<boolean> {
  const check = String(data.check || "has_tag");
  const value = String(data.value || "").trim().toLowerCase();

  if (check === "text_contains") {
    return !!value && (ctx.triggerText || "").toLowerCase().includes(value);
  }

  if (check === "has_tag") {
    if (!value) return false;
    const contact = await prisma.contact.findFirst({
      where: { tenantId, OR: [{ phone: ctx.phone }, { altPhones: { has: ctx.phone } }] },
      select: { tags: true },
    });
    return !!contact?.tags.some((t) => t.toLowerCase() === value);
  }

  if (check === "replied") {
    // Any customer message after the journey started.
    const since = ctx.startedAt ?? new Date(Date.now() - 60_000);
    const conv = await prisma.conversation.findUnique({
      where: { tenantId_phone: { tenantId, phone: ctx.phone } },
      select: { id: true },
    });
    if (!conv) return false;
    const reply = await prisma.message.findFirst({
      where: { conversationId: conv.id, direction: "INBOUND", timestamp: { gt: since } },
      select: { id: true },
    });
    return !!reply;
  }

  if (check === "opted_in") {
    const contact = await prisma.contact.findFirst({
      where: { tenantId, OR: [{ phone: ctx.phone }, { altPhones: { has: ctx.phone } }] },
      select: { optedIn: true },
    });
    return !!contact?.optedIn;
  }

  return false;
}

/**
 * Walk the journey graph from the trigger, executing each node and following
 * the branch a condition resolves to. Cycles are guarded and the number of
 * executed nodes is capped.
 */
export async function runJourneyGraph(
  tenant: Tenant,
  nodes: GraphNodeLike[],
  edges: GraphEdgeLike[],
  ctx: JourneyContext,
  opts: { ignoreWaits?: boolean } = {}
): Promise<{ executed: number; messages: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outFrom = (id: string, handle?: string) =>
    edges.filter(
      (e) => e.source === id && (handle === undefined || (e.sourceHandle || "yes") === handle)
    );

  const start = nodes.find((n) => n.data?.kind === "trigger") || nodes[0];
  if (!start) return { executed: 0, messages: 0 };

  const context: JourneyContext = { ...ctx, startedAt: ctx.startedAt ?? new Date() };
  let currentId: string | undefined = outFrom(start.id)[0]?.target;
  const visited = new Set<string>();
  let executed = 0;
  let messages = 0;

  while (currentId && !visited.has(currentId) && executed < 50) {
    visited.add(currentId);
    const node = byId.get(currentId);
    if (!node) break;
    const data = (node.data || {}) as Record<string, unknown>;
    const kind = String(data.kind || "");
    executed++;

    if (kind === "condition") {
      const result = await evaluateCondition(tenant.id, data, context);
      currentId = outFrom(node.id, result ? "yes" : "no")[0]?.target;
      continue;
    }

    const step: JourneyStep =
      kind === "wait" ? { type: "wait", hours: Number(data.hours) || 0 }
      : kind === "handoff" ? { type: "handoff" }
      : kind === "tag" ? { type: "tag", tag: typeof data.tag === "string" ? data.tag : undefined }
      : {
          type: "message",
          text: typeof data.text === "string" ? data.text : undefined,
          templateId: typeof data.templateId === "string" && data.templateId ? data.templateId : undefined,
        };

    await runJourney(tenant, [step], { phone: context.phone, name: context.name }, opts);
    if (step.type === "message") messages++;

    currentId = outFrom(node.id)[0]?.target;
  }

  return { executed, messages };
}

/**
 * Enroll every opted-in contact of a journey's segment (entry source =
 * segment) and run the flow for each. Returns how many were enrolled.
 */
export async function runJourneyForSegment(
  tenant: Tenant,
  journey: { id: string; nodes: unknown; edges: unknown; triggerValue: string | null }
): Promise<{ enrolled: number }> {
  const segmentId = journey.triggerValue;
  if (!segmentId) return { enrolled: 0 };

  const segment = await prisma.segment.findFirst({
    where: { id: segmentId, tenantId: tenant.id },
  });
  if (!segment) return { enrolled: 0 };

  const where = {
    AND: [
      segmentWhere(tenant.id, segment.rules as unknown as SegmentRules),
      { optedIn: true },
    ],
  };
  const contacts = await prisma.contact.findMany({ where, take: 5000 });

  const nodes = (journey.nodes as GraphNodeLike[]) || [];
  const edges = (journey.edges as GraphEdgeLike[]) || [];
  if (nodes.length === 0) return { enrolled: 0 };

  for (const c of contacts) {
    // Sequential so a big segment doesn't hammer the send path.
    await runJourneyGraph(tenant, nodes, edges, { phone: c.phone, name: c.name }).catch((e) =>
      console.error("[journey] segment run error:", e?.message || e)
    );
  }
  return { enrolled: contacts.length };
}

/**
 * Run any ACTIVE journeys whose entry source is "new contact". Called when a
 * contact is created from an inbound message.
 */
export async function triggerNewContactJourneys(
  tenant: Tenant,
  phone: string,
  name?: string
): Promise<void> {
  const journeys = await prisma.journey.findMany({
    where: { tenantId: tenant.id, status: "ACTIVE", triggerType: "new_contact" },
  });
  for (const j of journeys) {
    const nodes = (j.nodes as unknown as GraphNodeLike[]) || [];
    if (!nodes.length) continue;
    const edges = (j.edges as unknown as GraphEdgeLike[]) || [];
    runJourneyGraph(tenant, nodes, edges, { phone, name }).catch((e) =>
      console.error("[journey] new-contact run error:", e?.message || e)
    );
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
      const nodes = (j.nodes as unknown as GraphNodeLike[]) || [];
      const edges = (j.edges as unknown as GraphEdgeLike[]) || [];
      // fire-and-forget so inbound handling stays fast
      const run = nodes.length
        ? runJourneyGraph(tenant, nodes, edges, { phone, name, triggerText: text })
        : runJourney(tenant, (j.steps as unknown as JourneyStep[]) || [], { phone, name });
      run.catch((e: Error) => console.error("[journey] run error:", e?.message || e));
      return true;
    }
  }
  return false;
}
