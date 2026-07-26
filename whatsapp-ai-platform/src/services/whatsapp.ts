import type { Tenant } from "@prisma/client";
import { env } from "../lib/env";

export interface SendResult {
  ok: boolean;
  waMessageId?: string;
  error?: string;
}

/**
 * Send a WhatsApp session text message via the Meta Cloud API.
 * Per-tenant phoneNumberId + token. Safe to call in dev with no creds —
 * it short-circuits and reports a simulated send so the UI/flow still works.
 */
export async function sendWhatsAppText(
  tenant: Pick<Tenant, "phoneNumberId" | "whatsappToken" | "graphVersion">,
  toPhone: string,
  text: string
): Promise<SendResult> {
  const { phoneNumberId, whatsappToken } = tenant;
  const version = tenant.graphVersion || env.graphVersion;

  if (!phoneNumberId || !whatsappToken) {
    // Dev / not-yet-provisioned tenant: don't fail the pipeline.
    console.warn(
      `[whatsapp] no phoneNumberId/token for tenant — simulating send to ${toPhone}`
    );
    return { ok: true, waMessageId: `sim-${Date.now()}` };
  }

  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toPhone,
    type: "text",
    text: { preview_url: false, body: text },
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data: any = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || `HTTP ${resp.status}`;
      console.error(`[whatsapp] send failed: ${msg}`);
      return { ok: false, error: msg };
    }
    return { ok: true, waMessageId: data?.messages?.[0]?.id };
  } catch (e: any) {
    console.error(`[whatsapp] send exception:`, e?.message || e);
    return { ok: false, error: e?.message || "network error" };
  }
}
