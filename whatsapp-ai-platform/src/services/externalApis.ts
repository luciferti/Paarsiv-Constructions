import { prisma } from "../lib/prisma";
import type { Contact, ExternalApi, ExternalApiRequest } from "@prisma/client";

/**
 * Calling somebody else's API from inside the platform.
 *
 * A workspace describes an API once — base URL, how it authenticates, any
 * standing headers — and then saves named requests against it. A request can
 * carry {{tokens}} filled from the contact it runs for, and can copy pieces of
 * the response back onto that contact.
 */

const MAX_RESPONSE_CHARS = 20_000;
const TIMEOUT_MS = 15_000;
/** Hosts we refuse to call, so a saved request can't be pointed inward. */
const BLOCKED_HOSTS = /^(localhost|127\.|0\.0\.0\.0|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

export interface CallContext {
  contact?: Partial<Contact> | null;
  /** Extra values available as tokens, e.g. the message that triggered it. */
  extra?: Record<string, string>;
}

/**
 * Fill {{tokens}} from the contact, its custom fields, and anything extra.
 * Unknown tokens become empty rather than being left as literal braces —
 * a stray {{ in a URL would break the request.
 */
export function fillTokens(text: string, ctx: CallContext): string {
  const c = ctx.contact || {};
  const attrs = (c.attributes as Record<string, string> | null) || {};
  const base: Record<string, string> = {
    name: c.name || "",
    phone: c.phone || "",
    email: c.email || "",
    city: c.city || "",
    country: c.country || "",
    company: c.company || "",
    externalid: c.externalId || "",
    ...Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k.toLowerCase(), String(v ?? "")])),
    ...Object.fromEntries(Object.entries(ctx.extra || {}).map(([k, v]) => [k.toLowerCase(), v])),
  };
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => base[key.toLowerCase()] ?? "");
}

/** Read "data.items.0.status" out of a parsed response. */
export function readPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc === null || acc === undefined) return undefined;
    if (Array.isArray(acc)) return acc[Number(part)];
    if (typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

function authHeaders(api: ExternalApi): Record<string, string> {
  const v = api.authValue || "";
  if (!v) return {};
  if (api.authType === "bearer") return { Authorization: `Bearer ${v}` };
  if (api.authType === "basic") return { Authorization: `Basic ${Buffer.from(v).toString("base64")}` };
  if (api.authType === "header" && api.authName) return { [api.authName]: v };
  return {};
}

export interface CallResult {
  ok: boolean;
  statusCode?: number;
  durationMs: number;
  url: string;
  requestBody?: string;
  response?: string;
  parsed?: unknown;
  error?: string;
  /** What was written back onto the contact, if anything. */
  saved?: Record<string, string>;
}

/**
 * Run one saved request. Never throws — a failed call is a result with an
 * error on it, because journeys keep going and the console wants to show it.
 */
export async function runRequest(
  api: ExternalApi,
  request: ExternalApiRequest,
  ctx: CallContext = {},
  opts: { ranBy?: string; dryRun?: boolean } = {}
): Promise<CallResult> {
  const started = Date.now();
  const path = fillTokens(request.path || "/", ctx);
  const url = `${api.baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

  let host = "";
  try { host = new URL(url).hostname; } catch {
    return { ok: false, durationMs: 0, url, error: "That base URL and path don't make a valid address." };
  }
  if (BLOCKED_HOSTS.test(host)) {
    return {
      ok: false, durationMs: 0, url,
      error: "Private and loopback addresses aren't allowed — point this at a public API.",
    };
  }

  const body = request.bodyTemplate ? fillTokens(request.bodyTemplate, ctx) : undefined;
  const method = (request.method || "GET").toUpperCase();
  const sendsBody = method !== "GET" && method !== "DELETE" && !!body;

  const result: CallResult = { ok: false, durationMs: 0, url, requestBody: sendsBody ? body : undefined };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const resp = await fetch(url, {
      method,
      headers: {
        ...((api.headers as Record<string, string> | null) || {}),
        ...authHeaders(api),
        ...(sendsBody ? { "Content-Type": "application/json" } : {}),
      },
      body: sendsBody ? body : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = (await resp.text()).slice(0, MAX_RESPONSE_CHARS);
    result.statusCode = resp.status;
    result.response = text;
    result.ok = resp.ok;
    try { result.parsed = JSON.parse(text); } catch { /* not JSON — fine */ }
    if (!resp.ok) result.error = `HTTP ${resp.status}`;
  } catch (e: any) {
    result.error = e?.name === "AbortError" ? `No response within ${TIMEOUT_MS / 1000}s` : e?.message || "network error";
  }

  result.durationMs = Date.now() - started;

  // Copy response fields onto the contact, if the request asks for it.
  const map = (request.saveTo as Record<string, string> | null) || {};
  if (result.ok && ctx.contact?.id && Object.keys(map).length && !opts.dryRun) {
    const saved: Record<string, string> = {};
    for (const [path, attr] of Object.entries(map)) {
      const value = readPath(result.parsed, path);
      if (value === undefined || value === null) continue;
      saved[attr] = typeof value === "object" ? JSON.stringify(value) : String(value);
    }
    if (Object.keys(saved).length) {
      const existing = await prisma.contact.findUnique({ where: { id: ctx.contact.id } });
      if (existing) {
        await prisma.contact.update({
          where: { id: existing.id },
          data: {
            attributes: {
              ...((existing.attributes as Record<string, string> | null) || {}),
              ...saved,
            },
          },
        });
        result.saved = saved;
      }
    }
  }

  if (!opts.dryRun) {
    await prisma.$transaction([
      prisma.externalApiLog.create({
        data: {
          requestId: request.id,
          status: result.ok ? "ok" : "failed",
          statusCode: result.statusCode ?? null,
          durationMs: result.durationMs,
          error: result.error ?? null,
          requestUrl: url,
          response: (result.response || "").slice(0, 4_000),
          ranBy: opts.ranBy || "console",
        },
      }),
      prisma.externalApiRequest.update({
        where: { id: request.id },
        data: {
          lastStatus: result.statusCode ?? null,
          lastError: result.error ?? null,
          lastRunAt: new Date(),
        },
      }),
    ]);
  }

  return result;
}

/** Journeys call this: find the saved request, run it for one contact. */
export async function runSavedRequest(
  tenantId: string,
  requestId: string,
  ctx: CallContext
): Promise<CallResult | null> {
  const request = await prisma.externalApiRequest.findUnique({
    where: { id: requestId },
    include: { api: true },
  });
  if (!request || request.api.tenantId !== tenantId || !request.api.active) return null;
  return runRequest(request.api, request, ctx, { ranBy: "journey" });
}
