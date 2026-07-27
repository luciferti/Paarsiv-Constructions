import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { triggerNewContactJourneys } from "./journeys";
import { emitEvent } from "./eventHooks";
import { runScriptsFor } from "./scripts";
import type { Connector, Tenant } from "@prisma/client";

/**
 * Inbound connectors. Shopify, Salesforce, Zoho and ServiceNow all speak
 * "POST some JSON at a URL when something happens" — so each connector is a
 * webhook URL with a long secret in it, plus a mapper that turns that
 * product's payload into a contact.
 *
 * Records only flow in. Telling an external system that something happened
 * here is the job of event hooks (services/eventHooks.ts).
 */

export const CONNECTOR_TYPES = ["shopify", "salesforce", "zoho", "servicenow", "custom"] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export interface MappedContact {
  phone?: string;
  name?: string;
  email?: string;
  city?: string;
  country?: string;
  company?: string;
  externalId?: string;
  tags: string[];
  attributes: Record<string, string>;
}

export function newSecret(): string {
  return crypto.randomBytes(24).toString("hex");
}

/** Case-insensitive, multi-name field lookup on a flat-ish object. */
function pick(obj: Record<string, unknown>, ...names: string[]): string | undefined {
  const lower = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
  for (const n of names) {
    const key = lower.get(n.toLowerCase());
    if (key === undefined) continue;
    const v = obj[key];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return undefined;
}

const digits = (s?: string) => (s || "").replace(/[^\d]/g, "");

/** Shopify: customers/* webhooks, or orders/* (customer rides inside). */
function mapShopify(p: Record<string, unknown>): MappedContact {
  const customer = (p.customer as Record<string, unknown>) || p;
  const addr =
    (customer.default_address as Record<string, unknown>) ||
    (p.billing_address as Record<string, unknown>) ||
    {};
  const first = pick(customer, "first_name") || "";
  const last = pick(customer, "last_name") || "";
  const tags = (pick(customer, "tags") || "").split(",").map((t) => t.trim()).filter(Boolean);

  const out: MappedContact = {
    phone: pick(customer, "phone") || pick(addr, "phone") || pick(p, "phone"),
    name: `${first} ${last}`.trim() || undefined,
    email: pick(customer, "email") || pick(p, "email"),
    city: pick(addr, "city"),
    country: pick(addr, "country"),
    company: pick(addr, "company"),
    externalId: pick(customer, "id"),
    tags,
    attributes: {},
  };
  const total = pick(p, "total_price");
  if (total) out.attributes.last_order_total = total;
  const orderNo = pick(p, "order_number", "name");
  if (orderNo && p.customer) out.attributes.last_order = String(orderNo);
  return out;
}

/** Salesforce: JSON from a Flow HTTP callout / outbound message. */
function mapSalesforce(p: Record<string, unknown>): MappedContact {
  const first = pick(p, "FirstName", "first_name") || "";
  const last = pick(p, "LastName", "last_name") || "";
  return {
    phone: pick(p, "Phone", "MobilePhone", "phone", "mobile"),
    name: pick(p, "Name", "full_name") || `${first} ${last}`.trim() || undefined,
    email: pick(p, "Email", "email"),
    city: pick(p, "MailingCity", "City", "city"),
    country: pick(p, "MailingCountry", "Country", "country"),
    company: pick(p, "Company", "Account", "AccountName", "company"),
    externalId: pick(p, "Id", "id"),
    tags: [],
    attributes: {},
  };
}

/** Zoho CRM: workflow webhook params. */
function mapZoho(p: Record<string, unknown>): MappedContact {
  const first = pick(p, "First_Name", "First Name") || "";
  const last = pick(p, "Last_Name", "Last Name") || "";
  return {
    phone: pick(p, "Mobile", "Phone", "phone", "mobile"),
    name: pick(p, "Full_Name", "Full Name", "Lead_Name") || `${first} ${last}`.trim() || undefined,
    email: pick(p, "Email", "email"),
    city: pick(p, "City", "city"),
    country: pick(p, "Country", "country"),
    company: pick(p, "Company", "Account_Name", "company"),
    externalId: pick(p, "id", "Id", "EntityId"),
    tags: [],
    attributes: {},
  };
}

/** ServiceNow: business-rule REST message (users / incidents). */
function mapServiceNow(p: Record<string, unknown>): MappedContact {
  const out: MappedContact = {
    phone: pick(p, "mobile_phone", "phone", "u_phone"),
    name: pick(p, "name", "caller_name", "user_name"),
    email: pick(p, "email", "u_email"),
    city: pick(p, "city", "u_city"),
    country: pick(p, "country", "u_country"),
    company: pick(p, "company", "u_company"),
    externalId: pick(p, "sys_id"),
    tags: [],
    attributes: {},
  };
  const ticket = pick(p, "number", "incident_number");
  if (ticket) out.attributes.last_ticket = ticket;
  const desc = pick(p, "short_description");
  if (desc) out.attributes.last_ticket_subject = desc.slice(0, 200);
  return out;
}

/** Custom: our own documented shape — used by anything else. */
function mapCustom(p: Record<string, unknown>): MappedContact {
  const rawTags = p.tags;
  const rawAttrs = p.attributes;
  return {
    phone: pick(p, "phone", "mobile", "whatsapp"),
    name: pick(p, "name"),
    email: pick(p, "email"),
    city: pick(p, "city"),
    country: pick(p, "country"),
    company: pick(p, "company"),
    externalId: pick(p, "externalId", "external_id", "id"),
    tags: Array.isArray(rawTags) ? rawTags.map(String).filter(Boolean).slice(0, 20) : [],
    attributes:
      rawAttrs && typeof rawAttrs === "object" && !Array.isArray(rawAttrs)
        ? Object.fromEntries(
            Object.entries(rawAttrs as Record<string, unknown>)
              .slice(0, 30)
              .map(([k, v]) => [k, String(v)])
          )
        : {},
  };
}

const MAPPERS: Record<ConnectorType, (p: Record<string, unknown>) => MappedContact> = {
  shopify: mapShopify,
  salesforce: mapSalesforce,
  zoho: mapZoho,
  servicenow: mapServiceNow,
  custom: mapCustom,
};

export interface ConnectorConfig {
  /** Tag stamped on every contact this connector touches. */
  tag?: string;
  /** Marketing consent for contacts it creates (default true). */
  optInDefault?: boolean;
}

export interface ProcessResult {
  status: "processed" | "skipped";
  summary: string;
  created: boolean;
}

/**
 * One event in: map it, upsert the contact, log it, bump the counters.
 * Throwing is reserved for our own failures — a payload we can't use is a
 * "skipped" event with a reason, not an error.
 */
export async function processEvent(
  tenant: Tenant,
  connector: Connector,
  payload: unknown
): Promise<ProcessResult> {
  const body =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const mapper = MAPPERS[(connector.type as ConnectorType)] || mapCustom;
  const mapped = mapper(body);
  const cfg = (connector.config as ConnectorConfig | null) || {};

  const phone = digits(mapped.phone);
  const finish = async (r: ProcessResult, error?: string) => {
    await prisma.$transaction([
      prisma.connectorEvent.create({
        data: {
          connectorId: connector.id,
          status: error ? "skipped" : r.status,
          summary: r.summary,
          error: error || null,
          payload: body as object,
        },
      }),
      prisma.connector.update({
        where: { id: connector.id },
        data: {
          eventsReceived: { increment: 1 },
          lastEventAt: new Date(),
          lastError: error || null,
          ...(r.status === "processed" ? { contactsUpserted: { increment: 1 } } : {}),
        },
      }),
    ]);
    return r;
  };

  if (phone.length < 8) {
    return finish(
      { status: "skipped", summary: "No usable phone number in the payload", created: false },
      "no phone"
    );
  }

  const tags = [...new Set([...mapped.tags, ...(cfg.tag ? [cfg.tag] : [connector.type])])];
  const existing = await prisma.contact.findFirst({
    where: { tenantId: tenant.id, OR: [{ phone }, { altPhones: { has: phone } }] },
  });

  if (existing) {
    // Fill blanks, never overwrite what an agent already knows.
    const attrs = {
      ...((existing.attributes as Record<string, string> | null) || {}),
      ...mapped.attributes,
    };
    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        name: existing.name || mapped.name,
        email: existing.email || mapped.email,
        city: existing.city || mapped.city,
        country: existing.country || mapped.country,
        company: existing.company || mapped.company,
        externalId: existing.externalId || mapped.externalId,
        tags: [...new Set([...existing.tags, ...tags])],
        attributes: attrs,
      },
    });
    return finish({
      status: "processed",
      summary: `Updated ${mapped.name || `+${phone}`}`,
      created: false,
    });
  }

  await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      phone,
      name: mapped.name,
      email: mapped.email,
      city: mapped.city,
      country: mapped.country,
      company: mapped.company,
      externalId: mapped.externalId,
      tags,
      attributes: mapped.attributes,
      optedIn: cfg.optInDefault ?? true,
      consentSource: "api",
      source: "import",
    },
  });
  // A contact arriving from a CRM enters welcome journeys like any other.
  triggerNewContactJourneys(tenant, phone, mapped.name).catch(() => {});
  const created = { phone, name: mapped.name ?? null, source: connector.type };
  emitEvent(tenant.id, "contact.created", created);
  runScriptsFor(tenant.id, "contact.created", created);

  return finish({
    status: "processed",
    summary: `Created ${mapped.name || `+${phone}`}`,
    created: true,
  });
}
