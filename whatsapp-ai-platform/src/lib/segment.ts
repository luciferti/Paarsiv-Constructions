import { Prisma } from "@prisma/client";

/**
 * A segment rule set. `match: all` → AND, `match: any` → OR.
 * `field` is a built-in (name/phone/email/city/tag/optedIn) OR a custom field
 * key prefixed with "attr:" (e.g. "attr:budget"), stored in Contact.attributes.
 */
export interface SegmentCondition {
  field: string;
  op:
    | "equals" | "contains" | "not_equals" | "is_set" | "has"
    // behaviour + time
    | "at_least" | "at_most" | "within_days" | "not_within_days" | "in_campaign" | "not_in_campaign";
  value?: string | boolean | number;
}
export interface SegmentRules {
  match: "all" | "any";
  conditions: SegmentCondition[];
}

const STRING_FIELDS = ["name", "phone", "email", "city", "country", "company"] as const;

/** Engagement counters kept live on the contact by the delivery webhook. */
const COUNT_FIELDS: Record<string, "deliveredCount" | "readCount" | "repliedCount"> = {
  delivered: "deliveredCount",
  read: "readCount",
  replied: "repliedCount",
};

/** Date columns a rule can talk about in "last N days" terms. */
const DATE_FIELDS: Record<string, "createdAt" | "lastDeliveredAt" | "lastInboundAt" | "lastCampaignAt"> = {
  added: "createdAt",
  lastDelivered: "lastDeliveredAt",
  lastReplied: "lastInboundAt",
  lastCampaign: "lastCampaignAt",
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

function conditionToWhere(c: SegmentCondition): Prisma.ContactWhereInput | null {
  // Custom field, stored in the attributes JSON under its key.
  if (c.field.startsWith("attr:")) {
    const key = c.field.slice(5);
    if (!key) return null;
    if (c.op === "is_set") return { attributes: { path: [key], not: Prisma.DbNull } };
    const v = typeof c.value === "string" ? c.value.trim() : c.value;
    if (v === "" || v === undefined) return null;
    if (c.op === "contains") {
      return { attributes: { path: [key], string_contains: String(v) } };
    }
    // equals / not_equals
    const eq: Prisma.ContactWhereInput = { attributes: { path: [key], equals: v as any } };
    return c.op === "not_equals" ? { NOT: eq } : eq;
  }

  // Tags array membership
  if (c.field === "tag") {
    if (c.op === "has" && typeof c.value === "string" && c.value.trim()) {
      return { tags: { has: c.value.trim() } };
    }
    return null;
  }

  // Boolean opt-in — "opted out" is just this with false.
  if (c.field === "optedIn") {
    const bool = c.value === true || c.value === "true";
    return { optedIn: bool };
  }

  // How many times something has happened: delivered / read / replied.
  if (COUNT_FIELDS[c.field]) {
    const column = COUNT_FIELDS[c.field];
    const n = Number(c.value);
    if (!Number.isFinite(n)) return null;
    if (c.op === "at_most") return { [column]: { lte: n } } as Prisma.ContactWhereInput;
    // "at least 4 deliveries" is the common one, so it's the default.
    return { [column]: { gte: n } } as Prisma.ContactWhereInput;
  }

  // How recently: "added in the last 30 days", "not messaged for 90".
  if (DATE_FIELDS[c.field]) {
    const column = DATE_FIELDS[c.field];
    const n = Number(c.value);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (c.op === "not_within_days") {
      // Either it happened before the window, or it never happened at all.
      return { OR: [{ [column]: { lt: daysAgo(n) } }, { [column]: null }] } as Prisma.ContactWhereInput;
    }
    return { [column]: { gte: daysAgo(n) } } as Prisma.ContactWhereInput;
  }

  // Was (or wasn't) in a particular campaign.
  if (c.field === "campaign") {
    const id = typeof c.value === "string" ? c.value.trim() : "";
    if (!id) return null;
    const inIt: Prisma.ContactWhereInput = {
      campaignRecipients: { some: { campaignId: id } },
    };
    return c.op === "not_in_campaign" ? { NOT: inIt } : inIt;
  }

  // Was in any campaign that actually reached them.
  if (c.field === "anyCampaignDelivered") {
    return {
      campaignRecipients: { some: { status: { in: ["DELIVERED", "READ"] } } },
    };
  }

  // String fields
  if ((STRING_FIELDS as readonly string[]).includes(c.field)) {
    const field = c.field as (typeof STRING_FIELDS)[number];
    if (c.op === "is_set") return { NOT: { [field]: null } } as Prisma.ContactWhereInput;
    const v = typeof c.value === "string" ? c.value.trim() : "";
    if (!v) return null;
    if (c.op === "equals") return { [field]: { equals: v, mode: "insensitive" } };
    if (c.op === "not_equals") return { NOT: { [field]: { equals: v, mode: "insensitive" } } };
    // default: contains
    return { [field]: { contains: v, mode: "insensitive" } };
  }

  return null;
}

/** Build a Prisma `where` for a tenant's contacts from segment rules. */
export function segmentWhere(
  tenantId: string,
  rules: SegmentRules | null | undefined
): Prisma.ContactWhereInput {
  const base: Prisma.ContactWhereInput = { tenantId };
  if (!rules || !Array.isArray(rules.conditions) || rules.conditions.length === 0) {
    return base;
  }
  const parts = rules.conditions
    .map(conditionToWhere)
    .filter((w): w is Prisma.ContactWhereInput => w !== null);
  if (parts.length === 0) return base;

  return rules.match === "any"
    ? { AND: [base, { OR: parts }] }
    : { AND: [base, ...parts] };
}
