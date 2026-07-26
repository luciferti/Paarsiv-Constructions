import type { Tenant } from "@prisma/client";
import { ruleMatch } from "./rules";
import { llmReply } from "./llm";

export interface AiReply {
  answer: string;
  handoff: boolean;
  engine: "OWN" | "CLAUDE" | "GPT" | "OFF";
}

/**
 * Produce an auto-reply for an inbound customer message based on the tenant's
 * configured aiSource. Returns null when AI is disabled/OFF (no auto-reply).
 */
export async function generateReply(
  tenant: Tenant,
  conversationId: string,
  userText: string
): Promise<AiReply | null> {
  if (!tenant.aiEnabled || tenant.aiSource === "OFF") return null;

  if (tenant.aiSource === "OWN") {
    const match = await ruleMatch(tenant.id, userText);
    if (!match) {
      return {
        answer:
          "Thanks for reaching out! A team member will get back to you shortly.",
        handoff: true,
        engine: "OWN",
      };
    }
    return { answer: match.answer, handoff: match.handoff, engine: "OWN" };
  }

  // CLAUDE or GPT
  const reply = await llmReply(tenant, conversationId, userText);
  return { ...reply, engine: tenant.aiSource };
}
