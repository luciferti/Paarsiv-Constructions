import { prisma } from "../lib/prisma";
import type { Tenant } from "@prisma/client";

/**
 * Build the LLM system prompt for a tenant from its knowledge intents and
 * live project inventory. If the tenant set an explicit systemPrompt override,
 * that is used as the base and grounding is appended.
 */
export async function buildSystemPrompt(tenant: Tenant): Promise<string> {
  const [intents, projects] = await Promise.all([
    prisma.intent.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { priority: "desc" },
    }),
    prisma.project.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { city: "asc" },
    }),
  ]);

  const base =
    tenant.systemPrompt?.trim() ||
    `You are ${tenant.botName}, a helpful WhatsApp assistant for ${tenant.name}. ` +
      `Answer customer questions concisely and warmly. Customers may write in English or Hinglish; ` +
      `always reply in clear English. Keep replies short (2-4 sentences), suitable for WhatsApp. ` +
      `Do not use emoji. Prices should be written like "Rs 99L" or "Rs 2.5 Cr".`;

  const lines: string[] = [base, ""];

  if (intents.length) {
    lines.push("KNOWLEDGE (use to answer FAQs):");
    for (const i of intents) {
      lines.push(`- [${i.intentKey}] ${i.answer}`);
    }
    lines.push("");
  }

  if (projects.length) {
    lines.push("INVENTORY (real projects — use exact names and prices):");
    for (const p of projects) {
      const parts = [
        p.name,
        p.city,
        p.propType,
        p.config,
        p.area,
        p.status,
        p.priceText,
      ]
        .filter(Boolean)
        .join(" | ");
      lines.push(`- ${parts}`);
    }
    lines.push("");
  }

  lines.push(
    "If the customer explicitly asks for a human agent, or you cannot help, " +
      "reply with a brief handoff message and include the token [[HANDOFF]] at the very end."
  );

  return lines.join("\n");
}
