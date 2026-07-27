import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "../lib/prisma";
import { segmentWhere, type SegmentRules } from "../lib/segment";
import type { Tenant } from "@prisma/client";

/**
 * AI over segments, in two directions.
 *
 * One: describe an audience in words and get rules back. Two: look at a
 * segment that already exists and say whether it's worth sending to.
 *
 * The judgement half is deliberately grounded — the numbers are computed here,
 * from the database, and the model is only asked to read them. A model left to
 * guess at engagement would invent figures, and someone would spend money on
 * them.
 */

const FIELD_GUIDE = `
Fields and the operators each accepts:

  name, phone, email, city, country, company   equals | contains | not_equals | is_set
  tag                                          has          value = the tag
  optedIn                                      equals       value = true | false  (false = opted out)
  attr:<key>                                   equals | contains | is_set   (a custom field)

  delivered | read | replied                   at_least | at_most    value = a number
        how many campaign messages reached them / were read / how many times they wrote back

  added                                        within_days | not_within_days   value = days
        when the contact was created — "last month" is within_days 30
  lastDelivered | lastReplied | lastCampaign   within_days | not_within_days   value = days

  campaign                                     in_campaign | not_in_campaign   value = a campaign id
  anyCampaignDelivered                         equals true    (a campaign actually reached them)
`.trim();

export interface DescribeResult {
  rules: SegmentRules;
  name: string;
  explanation: string;
  engine: "llm" | "rules";
}

function jsonFrom(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in the reply");
  return JSON.parse(raw.slice(start, end + 1));
}

async function askModel(tenant: Tenant, system: string, user: string): Promise<string | null> {
  const claudeKey = tenant.claudeKey || process.env.ANTHROPIC_API_KEY;
  const openaiKey = tenant.openaiKey || process.env.OPENAI_API_KEY;

  if (tenant.aiSource !== "OFF" && claudeKey) {
    const client = new Anthropic({ apiKey: claudeKey });
    const resp = await client.messages.create({
      model: tenant.claudeModel || "claude-haiku-4-5",
      max_tokens: 900,
      system,
      messages: [{ role: "user", content: user }],
    });
    return resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }
  if (tenant.aiSource !== "OFF" && openaiKey) {
    const client = new OpenAI({ apiKey: openaiKey });
    const resp = await client.chat.completions.create({
      model: tenant.openaiModel || "gpt-4o-mini",
      max_tokens: 900,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    });
    return resp.choices[0]?.message?.content?.trim() || null;
  }
  return null;
}

/** Keyword reading, for when there's no API key. Narrow but never wrong. */
function describeWithoutModel(text: string, campaigns: { id: string; name: string }[]): DescribeResult {
  const t = text.toLowerCase();
  const conditions: SegmentRules["conditions"] = [];

  const days =
    /last month|past month|30 day/.test(t) ? 30 :
    /last week|past week|7 day/.test(t) ? 7 :
    /last (\d+) days?/.exec(t) ? Number(/last (\d+) days?/.exec(t)![1]) :
    /90 day|3 month|quarter/.test(t) ? 90 : null;
  // Hinglish spellings vary a lot: "add hue", "add hua", "judne wale", "naye".
  if (days && /\badd(ed)?\b|joined|sign(ed)? ?up|\bnew\b|naye|naya|jude|judn/.test(t)) {
    conditions.push({ field: "added", op: "within_days", value: days });
  }

  if (/opted?[ -]?out|unsubscrib|opt out kiya/.test(t)) {
    conditions.push({ field: "optedIn", op: "equals", value: false });
  } else if (/opted?[ -]?in|subscrib/.test(t)) {
    conditions.push({ field: "optedIn", op: "equals", value: true });
  }

  const delivered = /(\d+)\s*(?:se zyada|or more|\+)?\s*(?:times?|baar)?\s*(?:deliver)/.exec(t)
    || /deliver\w*\s*(?:at least\s*)?(\d+)/.exec(t)
    || /(\d+)\s*baar\s*(?:message|msg)/.exec(t);
  if (delivered) {
    conditions.push({ field: "delivered", op: "at_least", value: Number(delivered[1]) });
  }

  if (/replied|repl(y|ies)|jawab|responded/.test(t)) {
    conditions.push({ field: "replied", op: "at_least", value: 1 });
  }

  const named = campaigns.find((c) => t.includes(c.name.toLowerCase()));
  if (named) {
    const negated = /(not|nahi|didn'?t|without)\s+[^.]*\b(campaign|in)\b/.test(t);
    conditions.push({
      field: "campaign",
      op: negated ? "not_in_campaign" : "in_campaign",
      value: named.id,
    });
  }

  const city = /(?:in|from|se|ke)\s+([A-Z][a-z]+)/.exec(text);
  if (city) conditions.push({ field: "city", op: "equals", value: city[1] });

  return {
    rules: { match: "all", conditions },
    name: text.slice(0, 60),
    explanation: conditions.length
      ? "Built from the words in your description. Connect an AI key for a more careful reading."
      : "Nothing recognisable in that description — add conditions by hand, or connect an AI key.",
    engine: "rules",
  };
}

/** Turn a sentence into segment rules. */
export async function describeToRules(tenant: Tenant, text: string): Promise<DescribeResult> {
  const campaigns = await prisma.campaign.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, name: true },
  });
  const fields = await prisma.contactField.findMany({
    where: { tenantId: tenant.id },
    select: { key: true, label: true },
  });

  const system = `You turn a description of an audience into segment rules for a WhatsApp marketing platform.

${FIELD_GUIDE}

Custom fields available: ${fields.map((f) => `attr:${f.key} (${f.label})`).join(", ") || "none"}
Campaigns available (use the id, never the name):
${campaigns.map((c) => `  ${c.id} = ${c.name}`).join("\n") || "  none"}

Reply with JSON only:
{"name":"a short segment name","rules":{"match":"all"|"any","conditions":[{"field":"...","op":"...","value":...}]},"explanation":"one sentence, plain English"}

Rules:
- Only use fields and operators from the guide. Never invent one.
- The user may write in Hindi, English or a mix.
- If part of the request can't be expressed, leave it out and say so in the explanation.
- Prefer "all" unless the user clearly means any-of.`;

  try {
    const reply = await askModel(tenant, system, text);
    if (!reply) return describeWithoutModel(text, campaigns);
    const parsed = jsonFrom(reply);
    const conditions = Array.isArray(parsed?.rules?.conditions) ? parsed.rules.conditions : [];
    return {
      rules: {
        match: parsed?.rules?.match === "any" ? "any" : "all",
        conditions: conditions.slice(0, 20),
      },
      name: String(parsed?.name || text.slice(0, 60)),
      explanation: String(parsed?.explanation || ""),
      engine: "llm",
    };
  } catch (e: any) {
    console.warn("[ai/segments] describe failed, falling back:", e?.message || e);
    return describeWithoutModel(text, campaigns);
  }
}

export interface SegmentStats {
  size: number;
  optedIn: number;
  optedOut: number;
  neverReached: number;
  everDelivered: number;
  everReplied: number;
  addedLast30: number;
  staleOver90: number;
  readRate: number;
  replyRate: number;
}

/** The real numbers behind a rule set. Computed, never guessed. */
export async function segmentStats(tenantId: string, rules: SegmentRules): Promise<SegmentStats> {
  const base = segmentWhere(tenantId, rules);
  const and = (extra: any) => ({ AND: [base, extra] });
  const day = 86_400_000;

  const [size, optedIn, everDelivered, everReplied, addedLast30, staleOver90, everRead] =
    await Promise.all([
      prisma.contact.count({ where: base }),
      prisma.contact.count({ where: and({ optedIn: true }) }),
      prisma.contact.count({ where: and({ deliveredCount: { gt: 0 } }) }),
      prisma.contact.count({ where: and({ repliedCount: { gt: 0 } }) }),
      prisma.contact.count({ where: and({ createdAt: { gte: new Date(Date.now() - 30 * day) } }) }),
      prisma.contact.count({
        where: and({
          OR: [{ lastInboundAt: { lt: new Date(Date.now() - 90 * day) } }, { lastInboundAt: null }],
        }),
      }),
      prisma.contact.count({ where: and({ readCount: { gt: 0 } }) }),
    ]);

  return {
    size,
    optedIn,
    optedOut: size - optedIn,
    neverReached: size - everDelivered,
    everDelivered,
    everReplied,
    addedLast30,
    staleOver90,
    readRate: everDelivered ? Math.round((everRead / everDelivered) * 100) : 0,
    replyRate: size ? Math.round((everReplied / size) * 100) : 0,
  };
}

export interface Assessment {
  verdict: "good" | "mixed" | "poor";
  headline: string;
  reasons: string[];
  suggestions: string[];
  stats: SegmentStats;
  engine: "llm" | "rules";
}

/** The honest read, with or without a model. */
function assessWithoutModel(stats: SegmentStats): Omit<Assessment, "stats" | "engine"> {
  const reasons: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  if (stats.size === 0) {
    return {
      verdict: "poor",
      headline: "Nobody is in this segment right now.",
      reasons: ["The rules match no contacts."],
      suggestions: ["Loosen a condition, or check the values are spelled the way they are in your data."],
    };
  }

  const optedOutPct = Math.round((stats.optedOut / stats.size) * 100);
  if (optedOutPct > 0) {
    reasons.push(`${optedOutPct}% have opted out and will be skipped — ${stats.optedIn.toLocaleString()} will actually receive this.`);
    if (optedOutPct > 20) suggestions.push("Add an 'opted in = yes' condition so the numbers you plan against are the real ones.");
  } else score++;

  const reachedPct = Math.round((stats.everDelivered / stats.size) * 100);
  if (reachedPct < 30) {
    reasons.push(`Only ${reachedPct}% have ever received a message from you, so past behaviour says little about them.`);
    suggestions.push("Treat this as a first-touch audience and keep the message simple.");
  } else {
    score++;
    reasons.push(`${reachedPct}% have been reached before${stats.readRate ? `, and ${stats.readRate}% of those read what you sent` : ""}.`);
  }

  if (stats.replyRate >= 20) { score++; reasons.push(`${stats.replyRate}% have replied at some point — this is an engaged list.`); }
  else if (stats.replyRate > 0) reasons.push(`${stats.replyRate}% have ever replied.`);

  const stalePct = Math.round((stats.staleOver90 / stats.size) * 100);
  if (stalePct > 60) {
    reasons.push(`${stalePct}% haven't been heard from in over 90 days.`);
    suggestions.push("Split off the quiet ones and send them a re-engagement message before a full campaign.");
  } else score++;

  if (stats.addedLast30 > 0) {
    reasons.push(`${stats.addedLast30.toLocaleString()} joined in the last 30 days.`);
  }

  const verdict = score >= 3 ? "good" : score >= 2 ? "mixed" : "poor";
  const headline =
    verdict === "good" ? `Worth sending to — ${stats.optedIn.toLocaleString()} reachable people with real engagement behind them.`
    : verdict === "mixed" ? `Usable, but ${stats.optedIn.toLocaleString()} of ${stats.size.toLocaleString()} will actually receive it.`
    : `Low expected return — most of this list is unreachable or cold.`;

  return { verdict, headline, reasons, suggestions };
}

/**
 * Judge a segment, optionally against the message about to go to it.
 * The stats are always real; the model only interprets them.
 */
export async function assessSegment(
  tenant: Tenant,
  rules: SegmentRules,
  context?: { segmentName?: string; templateBody?: string }
): Promise<Assessment> {
  const stats = await segmentStats(tenant.id, rules);
  const baseline = assessWithoutModel(stats);

  const system = `You advise a marketing team on whether an audience is worth sending a WhatsApp campaign to.

You are given real figures from their database. Use only those figures — never invent a number,
and never claim to know anything about individual people. Be direct and short.

Reply with JSON only:
{"verdict":"good"|"mixed"|"poor","headline":"one sentence","reasons":["..."],"suggestions":["..."]}

Judge on: how many will actually receive it after opt-outs, whether they have engaged before,
how stale the list is, and whether the message suits them. At most 4 reasons and 3 suggestions.`;

  const user = `Segment: ${context?.segmentName || "(unnamed)"}
Figures:
- in the segment: ${stats.size}
- opted in (will receive): ${stats.optedIn}
- opted out (skipped): ${stats.optedOut}
- have been delivered a message before: ${stats.everDelivered}
- read rate among those: ${stats.readRate}%
- have ever replied: ${stats.everReplied} (${stats.replyRate}%)
- joined in the last 30 days: ${stats.addedLast30}
- not heard from in 90+ days: ${stats.staleOver90}
${context?.templateBody ? `\nThe message they would get:\n"""${context.templateBody.slice(0, 500)}"""` : ""}`;

  try {
    const reply = await askModel(tenant, system, user);
    if (!reply) return { ...baseline, stats, engine: "rules" };
    const p = jsonFrom(reply);
    return {
      verdict: ["good", "mixed", "poor"].includes(p?.verdict) ? p.verdict : baseline.verdict,
      headline: String(p?.headline || baseline.headline),
      reasons: Array.isArray(p?.reasons) ? p.reasons.slice(0, 4).map(String) : baseline.reasons,
      suggestions: Array.isArray(p?.suggestions) ? p.suggestions.slice(0, 3).map(String) : baseline.suggestions,
      stats,
      engine: "llm",
    };
  } catch (e: any) {
    console.warn("[ai/segments] assess failed, falling back:", e?.message || e);
    return { ...baseline, stats, engine: "rules" };
  }
}
