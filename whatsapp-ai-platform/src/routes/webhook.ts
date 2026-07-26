import { Router } from "express";
import { prisma } from "../lib/prisma";
import { handleInbound, type InboundMessage } from "../services/inbound";
import { handleStatuses } from "../services/deliveryStatus";

export const webhookRouter = Router();

/**
 * GET /webhook — Meta verification handshake.
 * Matches hub.verify_token against ANY tenant's verifyToken.
 */
webhookRouter.get("/", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && typeof token === "string") {
    const tenant = await prisma.tenant.findFirst({ where: { verifyToken: token } });
    if (tenant) return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * POST /webhook — inbound WhatsApp events. Meta fans out to all subscribed
 * apps; we route each message to the tenant matching metadata.phone_number_id.
 * Always 200 quickly, then process.
 */
webhookRouter.post("/", async (req, res) => {
  res.sendStatus(200); // ack immediately

  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneNumberId: string | undefined = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const tenant = await prisma.tenant.findFirst({
          where: { phoneNumberId },
        });
        // Keep an inspectable trail of every inbound event.
        prisma.webhookLog
          .create({
            data: {
              tenantId: tenant?.id ?? null,
              phoneNumberId,
              event: value as object,
              status: tenant ? "processed" : "ignored",
              error: tenant ? null : "no tenant for phone_number_id",
            },
          })
          .catch(() => {});
        if (!tenant) continue;

        const contacts: any[] = value.contacts || [];
        const nameByWa: Record<string, string> = {};
        for (const c of contacts) {
          if (c.wa_id) nameByWa[c.wa_id] = c.profile?.name || "";
        }

        for (const m of value.messages || []) {
          const text =
            m.text?.body ??
            m.button?.text ??
            m.interactive?.list_reply?.title ??
            m.interactive?.button_reply?.title ??
            "";
          if (!text) continue;

          const inbound: InboundMessage = {
            phone: m.from,
            text,
            waMessageId: m.id,
            customerName: nameByWa[m.from] || undefined,
            type: m.type || "text",
          };
          await handleInbound(tenant, inbound);
        }

        // Delivery receipts for messages we sent — this is where a live
        // campaign's delivered/read numbers actually come from.
        if (value.statuses?.length) {
          await handleStatuses(tenant.id, value.statuses);
        }
      }
    }
  } catch (e: any) {
    console.error("[webhook] processing error:", e?.message || e);
  }
});
