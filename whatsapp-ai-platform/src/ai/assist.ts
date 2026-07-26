import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Tenant, Message } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ruleMatch } from "./rules";

export interface AssistResult {
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  intent: string;
  suggestions: string[];
  engine: "llm" | "rules";
}

const NEGATIVE = ["angry", "refund", "complaint", "bad", "worst", "cancel", "problem", "issue", "nahi chahiye", "galat", "kharab", "waste", "disappointed"];
const POSITIVE = ["thanks", "thank you", "great", "good", "interested", "love", "perfect", "shukriya", "badhiya", "chahiye", "book", "confirm"];

function transcript(messages: Message[]): string {
  return messages
    .map((m) => `${m.sentBy === "CUSTOMER" ? "Customer" : m.sentBy === "AI" ? "Bot" : "Agent"}: ${m.body}`)
    .join("\n");
}

/** Try the tenant's LLM (any configured key); returns null when unavailable. */
async function llmAssist(tenant: Tenant, convo: string): Promise<AssistResult | null> {
  const system =
    "You analyze a WhatsApp business conversation. Reply with ONLY minified JSON: " +
    '{"summary":"2-3 sentence summary","sentiment":"positive|neutral|negative","intent":"short intent label","suggestions":["reply 1","reply 2","reply 3"]}. ' +
    "Suggestions are ready-to-send agent replies in the customer's context, short, warm, no emoji.";

  try {
    const claudeKey = tenant.claudeKey || process.env.ANTHROPIC_API_KEY;
    const openaiKey = tenant.openaiKey || process.env.OPENAI_API_KEY;
    let raw = "";
    if (claudeKey) {
      const client = new Anthropic({ apiKey: claudeKey });
      const resp = await client.messages.create({
        model: tenant.claudeModel || "claude-haiku-4-5",
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: convo }],
      });
      raw = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    } else if (openaiKey) {
      const client = new OpenAI({ apiKey: openaiKey });
      const resp = await client.chat.completions.create({
        model: tenant.openaiModel || "gpt-4o-mini",
        max_tokens: 500,
        messages: [
          { role: "system", content: system },
          { role: "user", content: convo },
        ],
      });
      raw = resp.choices[0]?.message?.content || "";
    } else {
      return null;
    }

    const jsonText = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonText);
    if (!parsed?.summary) return null;
    return {
      summary: String(parsed.summary),
      sentiment: ["positive", "neutral", "negative"].includes(parsed.sentiment) ? parsed.sentiment : "neutral",
      intent: String(parsed.intent || "general"),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3).map(String) : [],
      engine: "llm",
    };
  } catch (e) {
    console.error("[assist] llm failed, falling back:", (e as Error)?.message);
    return null;
  }
}

/** Zero-cost heuristic fallback so the copilot works without any API key. */
async function ruleAssist(tenant: Tenant, messages: Message[]): Promise<AssistResult> {
  const customerMsgs = messages.filter((m) => m.sentBy === "CUSTOMER");
  const firstAsk = customerMsgs[0]?.body || "";
  const lastMsg = messages[messages.length - 1];
  const allCustomerText = customerMsgs.map((m) => m.body.toLowerCase()).join(" ");

  const negHits = NEGATIVE.filter((w) => allCustomerText.includes(w)).length;
  const posHits = POSITIVE.filter((w) => allCustomerText.includes(w)).length;
  const sentiment = negHits > posHits ? "negative" : posHits > negHits ? "positive" : "neutral";

  const lastCustomer = customerMsgs[customerMsgs.length - 1]?.body || firstAsk;
  const match = await ruleMatch(tenant.id, lastCustomer);
  const intent = match?.intentKey || "general";

  const suggestions: string[] = [];
  if (match) suggestions.push(match.answer);
  suggestions.push("Would you like to book a free site visit? I can arrange a convenient slot for you.");
  if (sentiment === "negative") {
    suggestions.push("I understand your concern — let me connect you with our senior team member right away.");
  } else {
    suggestions.push("Is there anything specific I can help you shortlist — budget, city or configuration?");
  }

  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const summary =
    `${messages.length} messages. Customer opened with "${clip(firstAsk, 80)}". ` +
    `Last message (${lastMsg?.sentBy.toLowerCase() || "n/a"}): "${clip(lastMsg?.body || "", 80)}".`;

  return { summary, sentiment, intent, suggestions: suggestions.slice(0, 3), engine: "rules" };
}

/** Analyze a conversation: LLM when a key is configured, heuristic otherwise. */
export async function assistConversation(
  tenant: Tenant,
  conversationId: string
): Promise<AssistResult | null> {
  const messages = await prisma.message.findMany({
    where: { conversationId, tenantId: tenant.id },
    orderBy: { timestamp: "asc" },
    take: 50,
  });
  if (messages.length === 0) return null;

  const viaLlm = await llmAssist(tenant, transcript(messages));
  if (viaLlm) return viaLlm;
  return ruleAssist(tenant, messages);
}
