import { prisma } from "../lib/prisma";
import { emitRealtime } from "../lib/events";
import { sendWhatsAppText } from "./whatsapp";
import { resolveSender, senderCredentials } from "./numbers";
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
  sentBy: "AI" | "AGENT",
  /** Which of our numbers to send from; the default when not given. */
  fromPhoneNumberId?: string | null
) {
  const sender = await resolveSender(tenant.id, fromPhoneNumberId);
  const on = sender?.phoneNumberId ?? "";

  const conv = await prisma.conversation.upsert({
    where: { tenantId_phoneNumberId_phone: { tenantId: tenant.id, phoneNumberId: on, phone } },
    update: {},
    create: { tenantId: tenant.id, phoneNumberId: on, phone },
  });

  const result = await sendWhatsAppText(senderCredentials(tenant, sender), phone, text);

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
