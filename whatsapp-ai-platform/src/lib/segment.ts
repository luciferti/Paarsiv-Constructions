import { Prisma } from "@prisma/client";

/**
 * A segment rule set. `match: all` → AND, `match: any` → OR.
 * `field` is a built-in (name/phone/email/city/tag/optedIn) OR a custom field
 * key prefixed with "attr:" (e.g. "attr:budget"), stored in Contact.attributes.
 */
export interface SegmentCondition {
  field: string;
  op: "equals" | "contains" | "not_equals" | "is_set" | "has";
  value?: string | boolean;
}
export interface SegmentRules {
  match: "all" | "any";
  conditions: SegmentCondition[];
}

const STRING_FIELDS = ["name", "phone", "email", "city"] as const;

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

  // Boolean opt-in
  if (c.field === "optedIn") {
    const bool = c.value === true || c.value === "true";
    return { optedIn: bool };
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
