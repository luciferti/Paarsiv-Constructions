import { prisma } from "../lib/prisma";
import type { Tenant } from "@prisma/client";

/**
 * Opt-out handling. WhatsApp expects a business to honour a customer asking to
 * stop, and to do it without a human in the loop — so this runs on every
 * inbound message before anything else replies.
 */
export interface ConsentRules {
  enabled: boolean;
  optOutKeywords: string[];
  optInKeywords: string[];
  optOutReply: string;
  optInReply: string;
}

export const DEFAULT_CONSENT_RULES: ConsentRules = {
  enabled: true,
  // Hinglish phrasings matter here — real customers write "band karo", not STOP.
  optOutKeywords: [
    "stop", "unsubscribe", "opt out", "optout", "remove me",
    "band karo", "band kro", "message mat bhejo", "mat bhejo", "no more messages",
  ],
  optInKeywords: ["start", "subscribe", "resume", "opt in", "optin", "chalu karo"],
  optOutReply:
    "You've been unsubscribed and won't get any more marketing messages from us. Reply START any time to resume.",
  optInReply: "You're subscribed again — welcome back. Reply STOP any time to unsubscribe.",
};

export function consentRulesOf(tenant: Tenant): ConsentRules {
  const raw = (tenant.consentRules as Partial<ConsentRules> | null) || {};
  return {
    ...DEFAULT_CONSENT_RULES,
    ...raw,
    optOutKeywords: raw.optOutKeywords?.length ? raw.optOutKeywords : DEFAULT_CONSENT_RULES.optOutKeywords,
    optInKeywords: raw.optInKeywords?.length ? raw.optInKeywords : DEFAULT_CONSENT_RULES.optInKeywords,
  };
}

/** Punctuation and spacing vary wildly; compare on a squashed form. */
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * A keyword counts when the whole message is that phrase, or the message
 * starts with it. "STOP" opts out; "don't stop sending photos" does not.
 */
function matches(text: string, keywords: string[]): boolean {
  const t = normalize(text);
  if (!t) return false;
  return keywords.some((k) => {
    const kw = normalize(k);
    if (!kw) return false;
    return t === kw || t.startsWith(kw + " ");
  });
}

export type ConsentAction = "opt_out" | "opt_in" | null;

export function classify(tenant: Tenant, text: string): ConsentAction {
  const rules = consentRulesOf(tenant);
  if (!rules.enabled) return null;
  if (matches(text, rules.optOutKeywords)) return "opt_out";
  if (matches(text, rules.optInKeywords)) return "opt_in";
  return null;
}

/**
 * Record the consent change against the contact (creating one if this is the
 * first we've heard from them) and return the confirmation to send back.
 */
export async function applyConsent(
  tenant: Tenant,
  phone: string,
  action: Exclude<ConsentAction, null>
): Promise<{ reply: string }> {
  const rules = consentRulesOf(tenant);
  const optedIn = action === "opt_in";
  const now = new Date();

  const existing = await prisma.contact.findFirst({
    where: { tenantId: tenant.id, OR: [{ phone }, { altPhones: { has: phone } }] },
  });

  const consent = {
    optedIn,
    consentSource: "customer_keyword",
    ...(optedIn ? { optedInAt: now } : { optedOutAt: now }),
  };

  if (existing) {
    await prisma.contact.update({ where: { id: existing.id }, data: consent });
  } else {
    await prisma.contact.create({
      data: { tenantId: tenant.id, phone, source: "inbound", ...consent },
    });
  }

  return { reply: optedIn ? rules.optInReply : rules.optOutReply };
}
