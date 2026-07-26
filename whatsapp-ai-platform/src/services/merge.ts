import { prisma } from "../lib/prisma";
import type { Contact, Prisma } from "@prisma/client";

export interface MergeRules {
  phoneSuffix: boolean; // last-10-digit phone variants
  email: boolean; // exact email, case-insensitive
  externalId: boolean; // same external CRM id
  nameCity: boolean; // normalized name + same city (risky, off by default)
  customFields: string[]; // custom-field keys used as exact match keys
  survivor: "mostActive" | "oldest";
}

export const DEFAULT_MERGE_RULES: MergeRules = {
  phoneSuffix: true,
  email: true,
  externalId: true,
  nameCity: false,
  customFields: [],
  survivor: "mostActive",
};

export function mergeRulesOf(raw: unknown): MergeRules {
  const r = (raw || {}) as Partial<MergeRules>;
  return { ...DEFAULT_MERGE_RULES, ...r };
}

const last10 = (p: string) => p.replace(/\D/g, "").slice(-10);
const norm = (s?: string | null) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

export interface DuplicateGroup {
  reason: "phone" | "email" | "externalId" | "nameCity" | "customField";
  field?: string; // custom-field key when reason = customField
  key: string;
  contacts: Contact[];
}

/** Scan a tenant's contacts and group duplicates by the enabled rules. */
export async function findDuplicates(tenantId: string, rules: MergeRules): Promise<DuplicateGroup[]> {
  const contacts = await prisma.contact.findMany({
    where: { tenantId, status: { not: "archived" } },
    orderBy: { createdAt: "asc" },
  });

  const groups: DuplicateGroup[] = [];
  const grouped = new Set<string>(); // contacts already in a group (first rule wins)

  function collect(
    reason: DuplicateGroup["reason"],
    keyOf: (c: Contact) => string | null,
    field?: string
  ) {
    const byKey = new Map<string, Contact[]>();
    for (const c of contacts) {
      if (grouped.has(c.id)) continue;
      const k = keyOf(c);
      if (!k) continue;
      const arr = byKey.get(k) || [];
      arr.push(c);
      byKey.set(k, arr);
    }
    for (const [key, arr] of Array.from(byKey.entries())) {
      if (arr.length < 2) continue;
      arr.forEach((c) => grouped.add(c.id));
      groups.push({ reason, field, key, contacts: arr });
    }
  }

  if (rules.phoneSuffix) collect("phone", (c) => (last10(c.phone).length === 10 ? last10(c.phone) : null));
  if (rules.email) collect("email", (c) => (c.email ? norm(c.email) : null));
  if (rules.externalId) collect("externalId", (c) => c.externalId || null);
  if (rules.nameCity) collect("nameCity", (c) => (c.name && c.city ? `${norm(c.name)}|${norm(c.city)}` : null));
  // Tenant-chosen custom fields as exact match keys (e.g. PAN, GST, member id)
  for (const key of rules.customFields || []) {
    collect(
      "customField",
      (c) => {
        const v = (c.attributes as Record<string, unknown> | null)?.[key];
        return v !== undefined && v !== null && String(v).trim() !== "" ? norm(String(v)) : null;
      },
      key
    );
  }

  return groups;
}

/** Pick the survivor per policy: mostActive (has conversation/most messages) or oldest. */
export async function pickSurvivor(tenantId: string, group: Contact[], policy: MergeRules["survivor"]): Promise<Contact> {
  if (policy === "oldest") {
    return group.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
  }
  // mostActive: count messages in each contact's conversation
  let best = group[0];
  let bestScore = -1;
  for (const c of group) {
    const conv = await prisma.conversation.findUnique({
      where: { tenantId_phone: { tenantId, phone: c.phone } },
      select: { id: true, _count: { select: { messages: true } } },
    });
    const score = conv ? 1000 + conv._count.messages : 0;
    if (score > bestScore || (score === bestScore && c.createdAt < best.createdAt)) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Merge duplicates into the primary:
 * - fill primary's EMPTY profile fields from duplicates (never overwrite)
 * - union tags and attributes (primary's keys win on conflict)
 * - absorb duplicate phones into altPhones (prevents re-creation on inbound)
 * - delete the duplicates
 */
export async function mergeContacts(tenantId: string, primaryId: string, duplicateIds: string[]) {
  const primary = await prisma.contact.findFirst({ where: { id: primaryId, tenantId } });
  if (!primary) throw new Error("primary not found");
  const dups = await prisma.contact.findMany({
    where: { id: { in: duplicateIds }, tenantId, NOT: { id: primaryId } },
  });
  if (dups.length === 0) throw new Error("no duplicates to merge");

  const FILL_FIELDS = [
    "name", "email", "city", "company", "jobTitle", "country",
    "timezone", "language", "externalId", "ownerId",
  ] as const;

  const data: Prisma.ContactUpdateInput = {};
  for (const f of FILL_FIELDS) {
    if (!primary[f]) {
      const donor = dups.find((d) => d[f]);
      if (donor) (data as Record<string, unknown>)[f] = donor[f];
    }
  }

  const tagSet = new Set(primary.tags);
  dups.forEach((d) => d.tags.forEach((t) => tagSet.add(t)));
  data.tags = Array.from(tagSet);

  const attrs: Record<string, unknown> = {};
  for (const d of dups) Object.assign(attrs, (d.attributes as object) || {});
  Object.assign(attrs, (primary.attributes as object) || {}); // primary wins
  if (Object.keys(attrs).length) data.attributes = attrs as Prisma.InputJsonValue;

  const altSet = new Set(primary.altPhones);
  for (const d of dups) {
    if (d.phone !== primary.phone) altSet.add(d.phone);
    d.altPhones.forEach((p) => p !== primary.phone && altSet.add(p));
  }
  data.altPhones = Array.from(altSet);

  if (dups.some((d) => d.optedIn) || primary.optedIn) data.optedIn = true;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.contact.update({ where: { id: primary.id }, data });
    await tx.contact.deleteMany({ where: { id: { in: dups.map((d) => d.id) }, tenantId } });
    return u;
  });

  return { merged: updated, absorbed: dups.map((d) => ({ id: d.id, phone: d.phone, name: d.name })) };
}
