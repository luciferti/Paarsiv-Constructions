import { prisma } from "../lib/prisma";

export interface RuleReply {
  answer: string;
  handoff: boolean;
  intentKey: string;
}

/**
 * Rule-based matcher (₹0, no LLM). Reads the tenant's active intents and
 * scores each by keyword hits, weighted by priority. Highest score wins.
 * Keywords are pipe-separated and matched case-insensitively (English + Hinglish).
 */
export async function ruleMatch(
  tenantId: string,
  text: string
): Promise<RuleReply | null> {
  const intents = await prisma.intent.findMany({
    where: { tenantId, isActive: true },
    orderBy: { priority: "desc" },
  });
  if (intents.length === 0) return null;

  const hay = ` ${text.toLowerCase()} `;
  let best: { intent: (typeof intents)[number]; score: number } | null = null;

  for (const intent of intents) {
    const kws = intent.keywords
      .split("|")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    let hits = 0;
    for (const kw of kws) {
      if (kw && hay.includes(kw)) hits++;
    }
    if (hits === 0) continue;
    const score = hits * 100 + intent.priority;
    if (!best || score > best.score) best = { intent, score };
  }

  if (!best) return null;
  return {
    answer: best.intent.answer,
    handoff: best.intent.isHandoff,
    intentKey: best.intent.intentKey,
  };
}
