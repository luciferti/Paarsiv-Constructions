import { prisma } from "../lib/prisma";
import { emitRealtime } from "../lib/events";
import { generateReply } from "../ai";
import { tryTriggerJourney } from "./journeys";
import { sendWhatsAppText } from "./whatsapp";
import type { Tenant, Conversation } from "@prisma/client";

const PREVIEW_LEN = 120;

function preview(text: string): string {
  return text.length > PREVIEW_LEN ? text.slice(0, PREVIEW_LEN - 1) + "…" : text;
}

/** Find or create a conversation for a phone within a tenant. */
async function upsertConversation(
  tenantId: string,
  phone: string,
  customerName?: string
): Promise<Conversation> {
  const existing = await prisma.conversation.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
  });
  if (existing) {
    if (customerName && !existing.customerName) {
      return prisma.conversation.update({
        where: { id: existing.id },
        data: { customerName },
      });
    }
    return existing;
  }
  return prisma.conversation.create({
    data: { tenantId, phone, customerName },
  });
}

/** Create the contact on first inbound, or fill in a missing name later. */
async function upsertContact(tenantId: string, phone: string, name?: string) {
  const existing = await prisma.contact.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
  });
  if (existing) {
    if (name && !existing.name) {
      await prisma.contact.update({ where: { id: existing.id }, data: { name } });
    }
    return;
  }
  await prisma.contact.create({
    data: { tenantId, phone, name, source: "inbound" },
  });
}

export interface InboundMessage {
  phone: string;
  text: string;
  waMessageId?: string;
  customerName?: string;
  type?: string;
}

/**
 * Handle one inbound customer message end-to-end:
 * store it, bump the conversation, emit realtime, and — if the conversation
 * is in AI mode — generate + send an auto-reply (handoff flips to HUMAN).
 */
export async function handleInbound(tenant: Tenant, msg: InboundMessage) {
  // Idempotency: skip if we've already stored this wamid.
  if (msg.waMessageId) {
    const dupe = await prisma.message.findUnique({
      where: { waMessageId: msg.waMessageId },
    });
    if (dupe) return;
  }

  const conv = await upsertConversation(tenant.id, msg.phone, msg.customerName);

  // Every inbound customer becomes a Contact (marketing audience).
  await upsertContact(tenant.id, msg.phone, msg.customerName);

  const inbound = await prisma.message.create({
    data: {
      tenantId: tenant.id,
      conversationId: conv.id,
      waMessageId: msg.waMessageId,
      direction: "INBOUND",
      type: msg.type || "text",
      body: msg.text,
      status: "RECEIVED",
      sentBy: "CUSTOMER",
    },
  });

  const updatedConv = await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      lastMessage: preview(msg.text),
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 },
    },
  });

  emitRealtime({
    tenantId: tenant.id,
    type: "message",
    conversationId: conv.id,
    message: inbound,
  });
  emitRealtime({ tenantId: tenant.id, type: "conversation", conversation: updatedConv });

  // Auto-reply only when the conversation is still AI-owned.
  if (updatedConv.mode !== "AI") return;

  // An active keyword journey takes precedence over the AI auto-reply.
  const handledByJourney = await tryTriggerJourney(
    tenant,
    msg.phone,
    msg.customerName,
    msg.text
  );
  if (handledByJourney) return;

  const reply = await generateReply(tenant, conv.id, msg.text);
  if (!reply) return;

  await sendReply(tenant, updatedConv, reply.answer, "AI");

  if (reply.handoff) {
    const handedOff = await prisma.conversation.update({
      where: { id: conv.id },
      data: { mode: "HUMAN" },
    });
    emitRealtime({
      tenantId: tenant.id,
      type: "conversation",
      conversation: handedOff,
    });
  }
}

/**
 * Send an outbound reply (from AI or a human agent), persist it, and emit.
 * Returns the created message.
 */
export async function sendReply(
  tenant: Tenant,
  conv: Conversation,
  text: string,
  sentBy: "AI" | "AGENT",
  senderId?: string
) {
  const result = await sendWhatsAppText(tenant, conv.phone, text);

  const outbound = await prisma.message.create({
    data: {
      tenantId: tenant.id,
      conversationId: conv.id,
      waMessageId: result.waMessageId,
      direction: "OUTBOUND",
      type: "text",
      body: text,
      status: result.ok ? "SENT" : "FAILED",
      sentBy,
      senderId: senderId ?? null,
    },
  });

  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      lastMessage: preview(text),
      lastMessageAt: new Date(),
      // A human replying implies they've read the thread.
      unreadCount: sentBy === "AGENT" ? 0 : undefined,
    },
  });

  emitRealtime({
    tenantId: tenant.id,
    type: "message",
    conversationId: conv.id,
    message: outbound,
  });
  emitRealtime({ tenantId: tenant.id, type: "conversation", conversation: updated });

  return { message: outbound, sendResult: result };
}
