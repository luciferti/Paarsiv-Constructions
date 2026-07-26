import { prisma } from "../lib/prisma";
import { emitRealtime } from "../lib/events";
import { sendWhatsAppText } from "./whatsapp";
import type { Tenant } from "@prisma/client";

const PREVIEW_LEN = 120;
const preview = (t: string) => (t.length > PREVIEW_LEN ? t.slice(0, PREVIEW_LEN - 1) + "…" : t);

/**
 * Send an automated/agent message to a phone number and record it in that
 * contact's conversation (creating the conversation if needed) so it shows in
 * the inbox thread. Used by journeys and any other automated sender.
 */
export async function sendOutbound(
  tenant: Tenant,
  phone: string,
  text: string,
  sentBy: "AI" | "AGENT"
) {
  const conv = await prisma.conversation.upsert({
    where: { tenantId_phone: { tenantId: tenant.id, phone } },
    update: {},
    create: { tenantId: tenant.id, phone },
  });

  const result = await sendWhatsAppText(tenant, phone, text);

  const message = await prisma.message.create({
    data: {
      tenantId: tenant.id,
      conversationId: conv.id,
      waMessageId: result.waMessageId,
      direction: "OUTBOUND",
      type: "text",
      body: text,
      status: result.ok ? "SENT" : "FAILED",
      sentBy,
    },
  });

  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessage: preview(text), lastMessageAt: new Date() },
  });

  emitRealtime({ tenantId: tenant.id, type: "message", conversationId: conv.id, message });
  emitRealtime({ tenantId: tenant.id, type: "conversation", conversation: updated });

  return { message, sendResult: result };
}
