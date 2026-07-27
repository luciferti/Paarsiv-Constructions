import vm from "vm";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { sendOutbound } from "./outbound";
import type { Script, Tenant } from "@prisma/client";

/**
 * Customer-written code, run here.
 *
 * The request builder in the developer console covers "call this URL". This is
 * for the rest: fetch from two places, decide something, message the customer,
 * write the answer back. A script is plain JavaScript with a small SDK and a
 * hard timeout, triggered by an event, a URL, or a button.
 *
 * It is NOT a security boundary against the people who write it — anyone who
 * can save a script already has workspace-admin rights. It exists to stop an
 * accidental infinite loop or a runaway fetch from hurting the server.
 */

const TIMEOUT_MS = 10_000;
const MAX_LOG_CHARS = 8_000;
const MAX_HTTP_CALLS = 20;
/** Same guard as the developer console: nothing may reach our own network. */
const BLOCKED_HOSTS = /^(localhost|127\.|0\.0\.0\.0|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

export const TRIGGERS = [
  { key: "manual", label: "Only when I run it", desc: "For jobs you kick off yourself" },
  { key: "http", label: "A URL you can call", desc: "Anything that can POST can start it" },
  { key: "message.received", label: "A customer messages", desc: "Runs for every inbound message" },
  { key: "contact.created", label: "A new contact appears", desc: "However they arrived" },
  { key: "campaign.finished", label: "A campaign finishes", desc: "With its final counts" },
] as const;

export const TRIGGER_KEYS: string[] = TRIGGERS.map((t) => t.key);

export function newSecret(): string {
  return crypto.randomBytes(20).toString("hex");
}

export interface RunResult {
  status: "ok" | "failed" | "timeout";
  durationMs: number;
  logs: string[];
  result?: unknown;
  error?: string;
}

/** The `input` a script sees, shaped by whatever set it off. */
export type ScriptInput = Record<string, unknown>;

function buildSdk(tenant: Tenant, logs: string[], counters: { http: number }) {
  const print = (...args: unknown[]) => {
    const line = args
      .map((a) => (typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()))
      .join(" ");
    if (logs.join("\n").length < MAX_LOG_CHARS) logs.push(line);
  };

  return {
    log: print,
    console: { log: print, error: print, warn: print },

    /** Call anything on the public internet. */
    http: {
      async request(url: string, opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
        if (++counters.http > MAX_HTTP_CALLS) {
          throw new Error(`A script may make at most ${MAX_HTTP_CALLS} HTTP calls`);
        }
        let host = "";
        try { host = new URL(url).hostname; } catch { throw new Error(`Not a valid URL: ${url}`); }
        if (BLOCKED_HOSTS.test(host)) throw new Error("Private and loopback addresses aren't allowed");

        const body = opts.body === undefined ? undefined
          : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
        const resp = await fetch(url, {
          method: opts.method || (body ? "POST" : "GET"),
          headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) },
          body,
        });
        const text = await resp.text();
        let json: unknown;
        try { json = JSON.parse(text); } catch { /* not JSON */ }
        return { ok: resp.ok, status: resp.status, body: text, json };
      },
      get(url: string, headers?: Record<string, string>) {
        return this.request(url, { method: "GET", headers });
      },
      post(url: string, body?: unknown, headers?: Record<string, string>) {
        return this.request(url, { method: "POST", body, headers });
      },
    },

    /** Send a WhatsApp message. Lands in the inbox thread like any other. */
    whatsapp: {
      async send(phone: string, text: string, fromPhoneNumberId?: string) {
        const digits = String(phone || "").replace(/[^\d]/g, "");
        if (digits.length < 8) throw new Error(`Not a usable phone number: ${phone}`);
        if (!text || !String(text).trim()) throw new Error("Nothing to send");
        const r = await sendOutbound(tenant, digits, String(text), "AI", fromPhoneNumberId);
        return { ok: r.sendResult.ok, error: r.sendResult.error };
      },
    },

    contacts: {
      async find(phone: string) {
        const digits = String(phone || "").replace(/[^\d]/g, "");
        return prisma.contact.findFirst({
          where: { tenantId: tenant.id, OR: [{ phone: digits }, { altPhones: { has: digits } }] },
        });
      },
      async update(phone: string, fields: Record<string, unknown>) {
        const digits = String(phone || "").replace(/[^\d]/g, "");
        const existing = await prisma.contact.findFirst({
          where: { tenantId: tenant.id, OR: [{ phone: digits }, { altPhones: { has: digits } }] },
        });
        if (!existing) throw new Error(`No contact with the number ${phone}`);
        // Only the fields a script has any business touching.
        const allowed = ["name", "email", "city", "country", "company", "jobTitle", "externalId"] as const;
        const data: Record<string, unknown> = {};
        for (const k of allowed) if (fields[k] !== undefined) data[k] = String(fields[k]);
        if (fields.attributes && typeof fields.attributes === "object") {
          data.attributes = {
            ...((existing.attributes as Record<string, string> | null) || {}),
            ...Object.fromEntries(
              Object.entries(fields.attributes as Record<string, unknown>).map(([k, v]) => [k, String(v)])
            ),
          };
        }
        return prisma.contact.update({ where: { id: existing.id }, data });
      },
      async tag(phone: string, tag: string) {
        const digits = String(phone || "").replace(/[^\d]/g, "");
        const existing = await prisma.contact.findFirst({
          where: { tenantId: tenant.id, OR: [{ phone: digits }, { altPhones: { has: digits } }] },
        });
        if (!existing) throw new Error(`No contact with the number ${phone}`);
        if (existing.tags.includes(tag)) return existing;
        return prisma.contact.update({
          where: { id: existing.id },
          data: { tags: [...existing.tags, tag] },
        });
      },
    },
  };
}

/**
 * Run one script. Never throws — the caller wants the failure, not an
 * exception, because a broken script must not break the message that
 * triggered it.
 */
export async function runScript(
  tenant: Tenant,
  script: Script,
  input: ScriptInput,
  opts: { trigger?: string; record?: boolean } = {}
): Promise<RunResult> {
  const started = Date.now();
  const logs: string[] = [];
  const counters = { http: 0 };
  const out: RunResult = { status: "ok", durationMs: 0, logs };

  try {
    const sandbox: Record<string, unknown> = {
      input,
      ...buildSdk(tenant, logs, counters),
      // Deliberately present so scripts can use them; everything else
      // (require, process, globalThis internals) is simply absent.
      JSON, Math, Date, Number, String, Boolean, Array, Object, Promise,
      RegExp, Error, encodeURIComponent, decodeURIComponent, isNaN, parseInt, parseFloat,
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, Math.min(ms, 5_000)),
    };

    const context = vm.createContext(sandbox);
    // Wrapped in an async IIFE so scripts can await without ceremony.
    const compiled = new vm.Script(`(async () => {\n${script.code}\n})()`, { filename: `${script.name}.js` });

    const value = compiled.runInContext(context, { timeout: TIMEOUT_MS });
    // The vm timeout only covers synchronous work — guard the awaits too.
    out.result = await Promise.race([
      value,
      new Promise((_r, reject) =>
        setTimeout(() => reject(new Error(`Still running after ${TIMEOUT_MS / 1000}s — stopped`)), TIMEOUT_MS)
      ),
    ]);
  } catch (e: any) {
    const message = e?.message || String(e);
    out.status = /Still running after|Script execution timed out/.test(message) ? "timeout" : "failed";
    out.error = message;
  }

  out.durationMs = Date.now() - started;

  if (opts.record !== false) {
    let resultText: string | undefined;
    try { resultText = out.result === undefined ? undefined : JSON.stringify(out.result).slice(0, 4_000); }
    catch { resultText = String(out.result).slice(0, 4_000); }

    await prisma.$transaction([
      prisma.scriptRun.create({
        data: {
          scriptId: script.id,
          status: out.status,
          durationMs: out.durationMs,
          trigger: opts.trigger || script.trigger,
          logs: logs.join("\n").slice(0, MAX_LOG_CHARS) || null,
          result: resultText ?? null,
          error: out.error ?? null,
        },
      }),
      prisma.script.update({
        where: { id: script.id },
        data: {
          runs: { increment: 1 },
          ...(out.status === "ok" ? {} : { failures: { increment: 1 } }),
          lastRunAt: new Date(),
          lastError: out.error ?? null,
        },
      }),
    ]);
  }

  return out;
}

/**
 * Run every enabled script listening for this event. Fire-and-forget: a
 * customer's message must not wait on their code.
 */
export function runScriptsFor(tenantId: string, trigger: string, input: ScriptInput): void {
  void (async () => {
    try {
      const scripts = await prisma.script.findMany({
        where: { tenantId, trigger, enabled: true },
      });
      if (!scripts.length) return;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return;
      for (const s of scripts) {
        const r = await runScript(tenant, s, input, { trigger });
        if (r.status !== "ok") console.warn(`[script:${s.name}] ${r.status}: ${r.error}`);
      }
    } catch (e: any) {
      console.error("[script] trigger failed:", e?.message || e);
    }
  })();
}
