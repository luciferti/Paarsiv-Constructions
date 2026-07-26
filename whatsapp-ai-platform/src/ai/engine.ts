// Pluggable AI engine — mirrors the SFMC design in TypeScript.
// One tenant runs exactly ONE engine at a time (tenant.aiSource):
//   OWN    -> rule-based keyword matcher (free)
//   CLAUDE -> Claude Haiku (Anthropic SDK)
//   GPT    -> GPT-4o-mini (OpenAI SDK)
//   OFF    -> no auto-reply
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Tenant, Intent, Project } from "@prisma/client";

export interface Reply {
  intent: string;
  handoff: boolean;
  answer: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// ---- Rule-based (OWN) ----
export function ruleMatch(message: string, intents: Intent[]): Reply {
  const text = " " + (message || "").toLowerCase().trim() + " ";
  const sorted = [...intents]
    .filter((i) => i.isActive)
    .sort((a, b) => b.priority - a.priority);
  for (const row of sorted) {
    for (const kwRaw of (row.keywords || "").split("|")) {
      const kw = kwRaw.toLowerCase().trim();
      if (kw && text.includes(kw)) {
        return { intent: row.intentKey, handoff: row.isHandoff, answer: row.answer || "" };
      }
    }
  }
  return {
    intent: "fallback",
    handoff: false,
    answer:
      "Sorry, I didn't quite get that. Could you share a bit more, or type *agent* to connect with an advisor?",
  };
}

// ---- System prompt for LLM engines (grounded in knowledge + real projects) ----
export function buildSystemPrompt(tenant: Tenant, intents: Intent[], projects: Project[]): string {
  if (tenant.systemPrompt && tenant.systemPrompt.trim()) return tenant.systemPrompt;
  const facts = intents
    .filter((i) => i.isActive && !i.isHandoff && i.answer)
    .map((i) => "- " + i.answer.replace(/\*/g, ""));
  const plines = projects
    .filter((p) => p.isActive)
    .map(
      (p) =>
        `- ${p.name} (${p.propType ?? ""}${p.config ? ", " + p.config : ""}) in ${p.area ?? ""}, ${p.city ?? ""} — ${p.status ?? ""} — from Rs ${p.priceText ?? ""}`
    );
  const projectBlock = plines.length
    ? "\n\nCurrent live projects (use these REAL names, areas, statuses and prices; match by city/type/budget; never invent a project — if unsure, offer an advisor):\n" +
      plines.join("\n")
    : "";
  return (
    `You are the WhatsApp assistant for ${tenant.name}. ` +
    "Rules:\n" +
    "1. Reply ONLY in English, short and friendly, WhatsApp style. Use *bold* sparingly, no long paragraphs.\n" +
    "2. Answer using ONLY the knowledge and project list below. Suggest 1-3 matching real projects with name + price when relevant. Never invent details; if unsure, offer an advisor.\n" +
    "3. If the customer wants a human/agent/advisor, a callback, or to book a visit, put the exact token [[HANDOFF]] on the last line.\n" +
    "4. Avoid emojis.\n\n" +
    "Knowledge:\n" +
    facts.join("\n") +
    projectBlock
  );
}

export async function askClaude(
  tenant: Tenant,
  system: string,
  history: ChatTurn[]
): Promise<string> {
  if (!tenant.claudeKey) return "";
  const client = new Anthropic({ apiKey: tenant.claudeKey });
  const res = await client.messages.create({
    model: tenant.claudeModel || "claude-haiku-4-5",
    max_tokens: 400,
    system,
    messages: history,
  });
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

export async function askGpt(
  tenant: Tenant,
  system: string,
  history: ChatTurn[]
): Promise<string> {
  if (!tenant.openaiKey) return "";
  const client = new OpenAI({ apiKey: tenant.openaiKey });
  const res = await client.chat.completions.create({
    model: tenant.openaiModel || "gpt-4o-mini",
    max_tokens: 400,
    messages: [{ role: "system", content: system }, ...history],
  });
  return res.choices[0]?.message?.content ?? "";
}

// ---- Orchestrator: produce a reply for one inbound message ----
export async function llmReply(
  tenant: Tenant,
  intents: Intent[],
  projects: Project[],
  history: ChatTurn[],
  currentText: string
): Promise<Reply> {
  const system = buildSystemPrompt(tenant, intents, projects);
  let turns = [...history];
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    turns.push({ role: "user", content: currentText });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();

  let raw = "";
  try {
    raw = tenant.aiSource === "GPT" ? await askGpt(tenant, system, turns) : await askClaude(tenant, system, turns);
  } catch (e) {
    raw = "";
  }
  if (!raw) {
    return {
      intent: tenant.aiSource.toLowerCase(),
      handoff: false,
      answer: "Sorry, I'm having trouble right now. Please type *agent* and our team will assist you.",
    };
  }
  const handoff = raw.includes("[[HANDOFF]]");
  const answer = raw.replace(/\[\[HANDOFF\]\]/g, "").trim();
  return { intent: tenant.aiSource.toLowerCase(), handoff, answer };
}
