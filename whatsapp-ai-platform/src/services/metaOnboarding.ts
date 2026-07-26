import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import type { Tenant } from "@prisma/client";

/**
 * WhatsApp Embedded Signup.
 *
 * The customer clicks Connect, Meta's own popup handles login, business
 * selection and number verification, and hands back a short-lived code. From
 * there everything is server-side: exchange the code, discover the WABA and
 * phone number, subscribe our webhook, register the number for Cloud API.
 *
 * Nothing here asks anyone to copy a token by hand.
 */

/** A Graph error, kept whole — fbtrace_id is what Meta support asks for. */
export interface MetaError {
  message: string;
  type?: string;
  code?: number;
  subcode?: number;
  fbtraceId?: string;
  /** Our own plain-English reading of the error. */
  hint?: string;
}

export class MetaApiError extends Error {
  detail: MetaError;
  constructor(detail: MetaError) {
    super(detail.message);
    this.detail = detail;
  }
}

/** Turn Meta's codes into something an operator can act on. */
function hintFor(code?: number, subcode?: number, message = ""): string | undefined {
  if (code === 101) return "Meta doesn't recognise that App ID. Copy it from Meta → App settings → Basic.";
  if (code === 1 && /client secret|invalid appsecret/i.test(message))
    return "The App Secret is wrong. Copy it from Meta → App settings → Basic and save again.";
  if (code === 190) return "The access token expired or was revoked. Reconnect to get a fresh one.";
  if (code === 100 && /config_id|configuration/i.test(message))
    return "The login configuration id doesn't belong to this app. Check Configuration ID in Meta → Facebook Login for Business.";
  if (code === 100) return "Meta rejected one of the parameters — usually a wrong id or a missing permission.";
  if (code === 200 || code === 10)
    return "The app is missing a permission. Make sure whatsapp_business_management and whatsapp_business_messaging were granted during login.";
  if (code === 133016 || subcode === 133016)
    return "This number is already registered to another WhatsApp account. Delete it there first, or pick a different number.";
  if (code === 133005) return "The two-step PIN is wrong. Use the 6-digit PIN set for this number, or reset it in Meta.";
  if (code === 131031) return "The account is restricted by Meta. Check Business Manager for a policy notice.";
  if (code === 4 || code === 613) return "Rate limited by Meta. Wait a minute and try again.";
  if (code === 368) return "The account is temporarily blocked for policy reasons.";
  return undefined;
}

async function graph<T = any>(
  path: string,
  opts: { token?: string; method?: string; body?: unknown; version?: string; query?: Record<string, string> } = {}
): Promise<T> {
  const version = opts.version || env.graphVersion || "v21.0";
  const url = new URL(`https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(opts.query || {})) url.searchParams.set(k, v);

  let resp: Response;
  try {
    resp = await fetch(url.toString(), {
      method: opts.method || "GET",
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e: any) {
    throw new MetaApiError({
      message: e?.message || "Could not reach Meta",
      hint: "The server couldn't reach graph.facebook.com — check outbound network access.",
    });
  }

  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.error) {
    const err = data?.error || {};
    throw new MetaApiError({
      message: err.message || `HTTP ${resp.status}`,
      type: err.type,
      code: err.code,
      subcode: err.error_subcode,
      fbtraceId: err.fbtrace_id,
      hint: hintFor(err.code, err.error_subcode, err.message || ""),
    });
  }
  return data as T;
}

/** App credentials come from the tenant, falling back to server env. */
export function appConfigOf(tenant: Tenant) {
  return {
    appId: tenant.metaAppId || env.metaAppId || "",
    appSecret: tenant.metaAppSecret || env.metaAppSecret || "",
    configId: tenant.metaConfigId || env.metaConfigId || "",
  };
}

export function isAppConfigured(tenant: Tenant): boolean {
  const c = appConfigOf(tenant);
  return !!(c.appId && c.appSecret && c.configId);
}

/** Step 1 — swap the popup's code for a business access token. */
export async function exchangeCode(tenant: Tenant, code: string): Promise<string> {
  const { appId, appSecret } = appConfigOf(tenant);
  const data = await graph<{ access_token: string }>("oauth/access_token", {
    version: tenant.graphVersion,
    query: { client_id: appId, client_secret: appSecret, code },
  });
  if (!data.access_token) {
    throw new MetaApiError({ message: "Meta returned no access token for that code." });
  }
  return data.access_token;
}

/**
 * Step 2 — find which WhatsApp account the token was granted for. The popup
 * also posts the ids to the browser, but reading them off the token is the
 * version we can trust server-side.
 */
export async function discoverWaba(
  tenant: Tenant,
  token: string
): Promise<{ wabaId?: string; businessId?: string }> {
  const { appId, appSecret } = appConfigOf(tenant);
  const data = await graph<any>("debug_token", {
    version: tenant.graphVersion,
    query: { input_token: token, access_token: `${appId}|${appSecret}` },
  });
  const scopes: any[] = data?.data?.granular_scopes || [];
  const find = (scope: string) =>
    scopes.find((s) => s.scope === scope)?.target_ids?.[0] as string | undefined;

  return {
    wabaId: find("whatsapp_business_management") || find("whatsapp_business_messaging"),
    businessId: find("business_management"),
  };
}

export interface PhoneNumber {
  id: string;
  displayPhoneNumber: string;
  verifiedName?: string;
  qualityRating?: string;
  status?: string;
  codeVerificationStatus?: string;
  messagingLimit?: string;
}

export async function listPhoneNumbers(tenant: Tenant, token: string, wabaId: string): Promise<PhoneNumber[]> {
  const data = await graph<{ data: any[] }>(`${wabaId}/phone_numbers`, {
    token,
    version: tenant.graphVersion,
    query: {
      fields: "id,display_phone_number,verified_name,quality_rating,status,code_verification_status,messaging_limit_tier",
    },
  });
  return (data.data || []).map((p) => ({
    id: p.id,
    displayPhoneNumber: p.display_phone_number,
    verifiedName: p.verified_name,
    qualityRating: p.quality_rating,
    status: p.status,
    codeVerificationStatus: p.code_verification_status,
    messagingLimit: p.messaging_limit_tier,
  }));
}

export async function wabaDetails(tenant: Tenant, token: string, wabaId: string) {
  return graph<any>(wabaId, {
    token,
    version: tenant.graphVersion,
    query: { fields: "id,name,account_review_status,timezone_id,message_template_namespace,on_behalf_of_business_info" },
  });
}

export async function businessDetails(tenant: Tenant, token: string, businessId: string) {
  return graph<any>(businessId, {
    token,
    version: tenant.graphVersion,
    query: { fields: "id,name,verification_status,vertical" },
  });
}

/** Step 3 — point the WABA's webhooks at us. Without this nothing arrives. */
export async function subscribeApp(tenant: Tenant, token: string, wabaId: string) {
  return graph<any>(`${wabaId}/subscribed_apps`, { token, method: "POST", version: tenant.graphVersion });
}

export async function isSubscribed(tenant: Tenant, token: string, wabaId: string): Promise<boolean> {
  const { appId } = appConfigOf(tenant);
  const data = await graph<{ data: any[] }>(`${wabaId}/subscribed_apps`, { token, version: tenant.graphVersion });
  const apps = data.data || [];
  if (!apps.length) return false;
  if (!appId) return true;
  return apps.some((a) => String(a?.whatsapp_business_api_data?.id) === String(appId));
}

/**
 * Step 4 — register the number for Cloud API. The PIN is the number's
 * two-step verification code; a fresh number from the popup accepts any
 * 6 digits, which is why we can default it.
 */
export async function registerNumber(tenant: Tenant, token: string, phoneNumberId: string, pin: string) {
  return graph<any>(`${phoneNumberId}/register`, {
    token,
    method: "POST",
    version: tenant.graphVersion,
    body: { messaging_product: "whatsapp", pin },
  });
}

export interface ConnectResult {
  wabaId: string;
  phoneNumberId?: string;
  steps: { key: string; label: string; ok: boolean; detail?: string; error?: MetaError }[];
}

/**
 * The whole connect flow. Every step is reported back — a failure late in the
 * chain still shows what already worked, so the operator knows where they are.
 */
export async function completeSignup(
  tenant: Tenant,
  input: { code: string; wabaId?: string; phoneNumberId?: string; pin?: string }
): Promise<ConnectResult> {
  const steps: ConnectResult["steps"] = [];
  const run = async <T>(key: string, label: string, fn: () => Promise<T>, soft = false): Promise<T | undefined> => {
    try {
      const value = await fn();
      steps.push({ key, label, ok: true });
      return value;
    } catch (e) {
      const detail = e instanceof MetaApiError ? e.detail : { message: (e as Error).message };
      steps.push({ key, label, ok: false, error: detail });
      if (!soft) throw new StepFailure(steps);
      return undefined;
    }
  };

  const token = (await run("token", "Exchange the login code for a token", () =>
    exchangeCode(tenant, input.code)
  ))!;

  const discovered = await run("discover", "Find the WhatsApp Business Account", async () => {
    const d = await discoverWaba(tenant, token);
    const wabaId = input.wabaId || d.wabaId;
    if (!wabaId) {
      throw new MetaApiError({
        message: "The login didn't grant access to a WhatsApp Business Account.",
        hint: "Re-run Connect and make sure a WhatsApp account is selected in the Meta popup.",
      });
    }
    return { wabaId, businessId: d.businessId };
  });
  const wabaId = discovered!.wabaId;

  const numbers = await run("numbers", "Read the phone numbers on the account", () =>
    listPhoneNumbers(tenant, token, wabaId)
  );
  const chosen =
    numbers?.find((n) => n.id === input.phoneNumberId) || numbers?.[0];

  await run("webhook", "Point Meta's webhooks at this server", () => subscribeApp(tenant, token, wabaId), true);

  if (chosen) {
    await run(
      "register",
      `Register ${chosen.displayPhoneNumber} for the Cloud API`,
      () => registerNumber(tenant, token, chosen.id, input.pin || "000000"),
      true // a number already registered fails here harmlessly
    );
  }

  // Profile details are nice-to-have; never fail the connection over them.
  const waba = await run("details", "Read account details", () => wabaDetails(tenant, token, wabaId), true);
  const business = discovered!.businessId
    ? await run("business", "Read the business portfolio", () => businessDetails(tenant, token, discovered!.businessId!), true)
    : undefined;

  const subscribed = await isSubscribed(tenant, token, wabaId).catch(() => false);

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      whatsappToken: token,
      wabaId,
      phoneNumberId: chosen?.id || tenant.phoneNumberId,
      wabaName: waba?.name || null,
      wabaReviewStatus: waba?.account_review_status || null,
      businessId: discovered!.businessId || null,
      businessName: business?.name || null,
      businessVerification: business?.verification_status || null,
      displayPhoneNumber: chosen?.displayPhoneNumber || null,
      verifiedName: chosen?.verifiedName || null,
      qualityRating: chosen?.qualityRating || null,
      messagingLimit: chosen?.messagingLimit || null,
      webhookSubscribed: subscribed,
      connectedAt: new Date(),
      connectionError: null,
    },
  });

  return { wabaId, phoneNumberId: chosen?.id, steps };
}

/** Thrown when a required step fails; carries the steps run so far. */
export class StepFailure extends Error {
  steps: ConnectResult["steps"];
  constructor(steps: ConnectResult["steps"]) {
    super(steps[steps.length - 1]?.error?.message || "Connection failed");
    this.steps = steps;
  }
}

export interface ConnectionStatus {
  configured: boolean;          // Meta app details present
  connected: boolean;           // token + waba + number present
  appId?: string;
  configId?: string;
  business?: { id?: string | null; name?: string | null; verification?: string | null };
  waba?: { id?: string | null; name?: string | null; reviewStatus?: string | null };
  number?: {
    id?: string | null;
    display?: string | null;
    verifiedName?: string | null;
    quality?: string | null;
    messagingLimit?: string | null;
  };
  webhookSubscribed: boolean;
  webhookUrl: string;
  verifyToken?: string | null;
  connectedAt?: Date | null;
  error?: string | null;
  /** Live re-check against Meta, present only when asked for. */
  checks?: { key: string; label: string; ok: boolean; detail?: string; error?: MetaError }[];
}

export function statusOf(tenant: Tenant, publicUrl: string): ConnectionStatus {
  const cfg = appConfigOf(tenant);
  return {
    configured: isAppConfigured(tenant),
    connected: !!(tenant.whatsappToken && tenant.wabaId && tenant.phoneNumberId),
    appId: cfg.appId || undefined,
    configId: cfg.configId || undefined,
    business: { id: tenant.businessId, name: tenant.businessName, verification: tenant.businessVerification },
    waba: { id: tenant.wabaId, name: tenant.wabaName, reviewStatus: tenant.wabaReviewStatus },
    number: {
      id: tenant.phoneNumberId,
      display: tenant.displayPhoneNumber,
      verifiedName: tenant.verifiedName,
      quality: tenant.qualityRating,
      messagingLimit: tenant.messagingLimit,
    },
    webhookSubscribed: tenant.webhookSubscribed,
    webhookUrl: `${publicUrl.replace(/\/$/, "")}/api/webhook`,
    verifyToken: tenant.verifyToken,
    connectedAt: tenant.connectedAt,
    error: tenant.connectionError,
  };
}

/** Re-run the live checks and refresh the stored snapshot. */
export async function verifyConnection(tenant: Tenant): Promise<ConnectionStatus["checks"]> {
  const checks: NonNullable<ConnectionStatus["checks"]> = [];
  const token = tenant.whatsappToken;
  if (!token || !tenant.wabaId) {
    return [{ key: "token", label: "Access token", ok: false, error: { message: "Not connected yet." } }];
  }

  const push = async (key: string, label: string, fn: () => Promise<string | undefined>) => {
    try {
      checks.push({ key, label, ok: true, detail: await fn() });
    } catch (e) {
      const detail = e instanceof MetaApiError ? e.detail : { message: (e as Error).message };
      checks.push({ key, label, ok: false, error: detail });
    }
  };

  const update: any = {};

  await push("waba", "WhatsApp Business Account reachable", async () => {
    const w = await wabaDetails(tenant, token, tenant.wabaId!);
    update.wabaName = w?.name || null;
    update.wabaReviewStatus = w?.account_review_status || null;
    return w?.name ? `${w.name} · review ${w.account_review_status || "unknown"}` : undefined;
  });

  await push("number", "Phone number registered", async () => {
    const nums = await listPhoneNumbers(tenant, token, tenant.wabaId!);
    const n = nums.find((x) => x.id === tenant.phoneNumberId) || nums[0];
    if (!n) throw new MetaApiError({ message: "No phone number on this account yet." });
    update.displayPhoneNumber = n.displayPhoneNumber;
    update.verifiedName = n.verifiedName || null;
    update.qualityRating = n.qualityRating || null;
    update.messagingLimit = n.messagingLimit || null;
    return `${n.displayPhoneNumber} · quality ${n.qualityRating || "n/a"} · ${n.messagingLimit || "no tier"}`;
  });

  await push("webhook", "Webhook subscription active", async () => {
    const ok = await isSubscribed(tenant, token, tenant.wabaId!);
    update.webhookSubscribed = ok;
    if (!ok) throw new MetaApiError({
      message: "This app is not subscribed to the account's webhooks.",
      hint: "Press Repair to subscribe — inbound messages won't arrive until it is.",
    });
    return "Inbound messages will reach this server";
  });

  update.connectionError = checks.some((c) => !c.ok)
    ? checks.find((c) => !c.ok)!.error?.message || "Connection check failed"
    : null;

  await prisma.tenant.update({ where: { id: tenant.id }, data: update });
  return checks;
}
