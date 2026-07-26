import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Tenant } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { buildSystemPrompt } from "./prompt";

export interface LlmReply {
  answer: string;
  handoff: boolean;
}

const HANDOFF_TOKEN = "[[HANDOFF]]";

function stripHandoff(text: string): LlmReply {
  const handoff = text.includes(HANDOFF_TOKEN);
  const answer = text.replace(HANDOFF_TOKEN, "").trim();
  return { answer, handoff };
}

/** Last N messages of a conversation as chat history (oldest first). */
async function recentHistory(conversationId: string, n = 6) {
  const msgs = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { timestamp: "desc" },
    take: n,
  });
  return msgs
    .reverse()
    .map((m) => ({
      role: m.sentBy === "CUSTOMER" ? ("user" as const) : ("assistant" as const),
      content: m.body,
    }));
}

export async function llmReply(
  tenant: Tenant,
  conversationId: string,
  userText: string
): Promise<LlmReply> {
  const system = await buildSystemPrompt(tenant);
  const history = await recentHistory(conversationId);
  // Ensure the latest user message is present as the final turn.
  const messages = [...history, { role: "user" as const, content: userText }];

  if (tenant.aiSource === "CLAUDE") {
    const key = tenant.claudeKey || process.env.ANTHROPIC_API_KEY;
    if (!key) return fallback();
    const client = new Anthropic({ apiKey: key });
    const resp = await client.messages.create({
      model: tenant.claudeModel || "claude-haiku-4-5",
      max_tokens: 400,
      system,
      messages,
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return stripHandoff(text);
  }

  if (tenant.aiSource === "GPT") {
    const key = tenant.openaiKey || process.env.OPENAI_API_KEY;
    if (!key) return fallback();
    const client = new OpenAI({ apiKey: key });
    const resp = await client.chat.completions.create({
      model: tenant.openaiModel || "gpt-4o-mini",
      max_tokens: 400,
      messages: [{ role: "system", content: system }, ...messages],
    });
    const text = resp.choices[0]?.message?.content?.trim() || "";
    return stripHandoff(text);
  }

  return fallback();
}

function fallback(): LlmReply {
  return {
    answer:
      "Thanks for your message! Let me connect you with a team member who can help further.",
    handoff: true,
  };
}
