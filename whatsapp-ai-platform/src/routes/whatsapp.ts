import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { requireAuth, requirePermission } from "../middleware/auth";
import { audit, auditRaw } from "../lib/audit";
import { activeNumbers, setDefault, syncNumbers } from "../services/numbers";
import {
  MetaApiError,
  StepFailure,
  buildAuthUrl,
  completeSignup,
  getBusinessProfile,
  isAppConfigured,
  isSubscribed,
  listPhoneNumbers,
  redirectUri,
  registerNumber,
  requestVerificationCode,
  setBusinessProfile,
  statusOf,
  subscribeApp,
  verifyCode,
  verifyConnection,
} from "../services/metaOnboarding";

export const whatsappRouter = Router();

const allowedOrigins = () =>
  env.webOrigin.split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);

/**
 * Only ever send the browser back to an origin we already trust — the return
 * address rides in the signed state, but it is still checked against the
 * allow-list so a stolen state can't redirect anyone elsewhere.
 */
function safeOrigin(candidate?: string): string {
  const list = allowedOrigins();
  const wanted = (candidate || "").trim().replace(/\/$/, "");
  return list.includes(wanted) ? wanted : list[0] || "";
}

/** Where the browser lands back in the app after Meta is done with it. */
function appReturnUrl(origin: string, params: Record<string, string>): string {
  const url = new URL(`${safeOrigin(origin)}/settings/whatsapp`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * GET /whatsapp/callback — Meta sends the browser here when signup finishes.
 *
 * Public on purpose: it's a top-level redirect, so there's no Authorization
 * header to read. The signed `state` carries which workspace started it and
 * expires quickly, which is also what stops anyone else driving this endpoint.
 */
whatsappRouter.get("/callback", async (req, res) => {
  const { code, state, error_description: metaError } = req.query as Record<string, string | undefined>;

  // Decoded first so even a failure can go back to the right place.
  let tenantId = "";
  let origin = "";
  try {
    const payload = jwt.verify(state || "", env.jwtSecret) as {
      tenantId?: string; purpose?: string; origin?: string;
    };
    if (payload.purpose === "wa_oauth" && payload.tenantId) {
      tenantId = payload.tenantId;
      origin = payload.origin || "";
    }
  } catch { /* handled below */ }

  if (metaError) {
    return res.redirect(appReturnUrl(origin, { setup: "error", message: metaError }));
  }
  if (!code) {
    return res.redirect(appReturnUrl(origin, { setup: "cancelled" }));
  }
  if (!tenantId) {
    return res.redirect(appReturnUrl(origin, { setup: "error", message: "That sign-in link expired — start again." }));
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return res.redirect(appReturnUrl(origin, { setup: "error", message: "Workspace not found." }));

  try {
    const result = await completeSignup(tenant, { code });
    // Mirror every number on the account so each becomes a usable channel.
    const fresh = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    await syncNumbers(fresh).catch(() => {});
    auditRaw(tenant.id, "whatsapp.connected", {
      meta: { wabaId: result.wabaId, phoneNumberId: result.phoneNumberId, via: "redirect" },
    });
    return res.redirect(appReturnUrl(origin, { setup: "connected" }));
  } catch (e) {
    const message =
      e instanceof StepFailure ? e.message
      : e instanceof MetaApiError ? e.detail.message
      : (e as Error).message || "The connection failed.";
    const steps = e instanceof StepFailure ? e.steps : [];
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { connectionError: message, lastSetupSteps: steps as object },
    });
    return res.redirect(appReturnUrl(origin, { setup: "error", message }));
  }
});

whatsappRouter.use(requireAuth);

/**
 * GET /whatsapp/oauth/start — the Meta URL to send the browser to, with a
 * short-lived signed state so the callback knows who came back.
 */
whatsappRouter.get("/oauth/start", requirePermission("settings.manage"), async (req, res) => {
  const tenant = await tenantOf(req);
  if (!isAppConfigured(tenant)) {
    return res.status(400).json({ error: "Add the Meta app details before connecting." });
  }
  const state = jwt.sign(
    {
      tenantId: tenant.id,
      uid: req.auth!.uid,
      purpose: "wa_oauth",
      origin: safeOrigin(typeof req.query.returnTo === "string" ? req.query.returnTo : undefined),
    },
    env.jwtSecret,
    { expiresIn: "15m" }
  );
  res.json({ url: buildAuthUrl(tenant, state), redirectUri: redirectUri() });
});

async function tenantOf(req: any) {
  return prisma.tenant.findUniqueOrThrow({ where: { id: req.auth!.tenantId } });
}

/** Meta errors carry detail worth showing verbatim; anything else is a 500. */
function sendMetaError(res: any, e: unknown) {
  if (e instanceof StepFailure) {
    return res.status(400).json({ error: e.message, steps: e.steps });
  }
  if (e instanceof MetaApiError) {
    return res.status(400).json({ error: e.detail.message, meta: e.detail });
  }
  throw e;
}

/**
 * GET /whatsapp/status — everything the connection screen needs: whether the
 * Meta app is set up, whether we're connected, and the webhook details to
 * paste into the Meta app once.
 */
whatsappRouter.get("/status", requirePermission("settings.manage"), async (req, res) => {
  const tenant = await tenantOf(req);
  res.json({ status: statusOf(tenant, env.publicUrl) });
});

const appSchema = z.object({
  appId: z.string().trim().min(1),
  appSecret: z.string().trim().min(1).optional(),
  configId: z.string().trim().min(1),
});

/**
 * PATCH /whatsapp/app — the one-time Meta app details. The secret is
 * write-only: it goes in, it never comes back out.
 */
whatsappRouter.patch("/app", requirePermission("settings.manage"), async (req, res) => {
  const parsed = appSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tenant = await tenantOf(req);

  const data: any = { metaAppId: parsed.data.appId, metaConfigId: parsed.data.configId };
  if (parsed.data.appSecret) data.metaAppSecret = parsed.data.appSecret;
  // A verify token is ours to invent — generate one rather than asking for it.
  if (!tenant.verifyToken) data.verifyToken = crypto.randomBytes(16).toString("hex");

  const updated = await prisma.tenant.update({ where: { id: tenant.id }, data });
  audit(req, "whatsapp.app_configured", { meta: { appId: parsed.data.appId } });
  res.json({ status: statusOf(updated, env.publicUrl) });
});

const businessSchema = z.object({
  legalName: z.string().trim().max(200).optional(),
  email: z.string().trim().max(200).optional(),
  website: z.string().trim().max(300).optional(),
  country: z.string().trim().max(80).optional(),
  timezone: z.string().trim().max(80).optional(),
  vertical: z.string().trim().max(80).optional(),
  address: z.string().trim().max(300).optional(),
  description: z.string().trim().max(600).optional(),
});

/**
 * PATCH /whatsapp/business — step 1 of the wizard. Collected before the Meta
 * popup so the profile can be filled in for the customer afterwards.
 */
whatsappRouter.patch("/business", requirePermission("settings.manage"), async (req, res) => {
  const parsed = businessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tenant = await tenantOf(req);
  const d = parsed.data;

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      businessLegalName: d.legalName ?? undefined,
      businessEmail: d.email ?? undefined,
      businessWebsite: d.website ?? undefined,
      businessCountry: d.country ?? undefined,
      businessTimezone: d.timezone ?? undefined,
      businessVertical: d.vertical ?? undefined,
      businessAddress: d.address ?? undefined,
      businessDescription: d.description ?? undefined,
      setupStep: Math.max(tenant.setupStep, 1),
      // A verify token is ours to invent — never ask anyone to make one up.
      ...(tenant.verifyToken ? {} : { verifyToken: crypto.randomBytes(16).toString("hex") }),
    },
  });
  audit(req, "whatsapp.business_details");
  res.json({ status: statusOf(updated, env.publicUrl) });
});

const codeSchema = z.object({
  phoneNumberId: z.string().min(1),
  method: z.enum(["SMS", "VOICE"]).default("SMS"),
  language: z.string().default("en_US"),
});

/** POST /whatsapp/numbers/request-code — Meta texts or calls the number. */
whatsappRouter.post("/numbers/request-code", requirePermission("settings.manage"), async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tenant = await tenantOf(req);
  if (!tenant.whatsappToken) return res.status(400).json({ error: "Connect the Meta account first." });
  try {
    await requestVerificationCode(tenant, tenant.whatsappToken, parsed.data.phoneNumberId, parsed.data.method, parsed.data.language);
    res.json({ sent: true, method: parsed.data.method });
  } catch (e) {
    sendMetaError(res, e);
  }
});

const verifySchema = z.object({
  phoneNumberId: z.string().min(1),
  code: z.string().regex(/^\d{3}-?\d{3}$/, "Six digits, as Meta sent them"),
  pin: z.string().regex(/^\d{6}$/).optional(),
});

/**
 * POST /whatsapp/numbers/verify-code — confirm the code, then register the
 * number so it can actually send.
 */
whatsappRouter.post("/numbers/verify-code", requirePermission("settings.manage"), async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tenant = await tenantOf(req);
  if (!tenant.whatsappToken) return res.status(400).json({ error: "Connect the Meta account first." });

  const code = parsed.data.code.replace(/-/g, "");
  try {
    await verifyCode(tenant, tenant.whatsappToken, parsed.data.phoneNumberId, code);
    let registerNote: string | undefined;
    try {
      await registerNumber(tenant, tenant.whatsappToken, parsed.data.phoneNumberId, parsed.data.pin || "000000");
    } catch (e) {
      registerNote = e instanceof MetaApiError ? e.detail.message : (e as Error).message;
    }
    const numbers = await listPhoneNumbers(tenant, tenant.whatsappToken, tenant.wabaId!).catch(() => []);
    const n = numbers.find((x) => x.id === parsed.data.phoneNumberId);
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        phoneNumberId: parsed.data.phoneNumberId,
        displayPhoneNumber: n?.displayPhoneNumber ?? undefined,
        verifiedName: n?.verifiedName ?? undefined,
        qualityRating: n?.qualityRating ?? undefined,
        messagingLimit: n?.messagingLimit ?? undefined,
        setupStep: Math.max(tenant.setupStep, 3),
      },
    });
    audit(req, "whatsapp.number_verified", { meta: { phoneNumberId: parsed.data.phoneNumberId } });
    res.json({ status: statusOf(updated, env.publicUrl), registerNote });
  } catch (e) {
    sendMetaError(res, e);
  }
});

/** GET /whatsapp/profile — the public profile customers see. */
whatsappRouter.get("/profile", requirePermission("settings.manage"), async (req, res) => {
  const tenant = await tenantOf(req);
  if (!tenant.whatsappToken || !tenant.phoneNumberId) return res.json({ profile: null });
  try {
    res.json({ profile: await getBusinessProfile(tenant, tenant.whatsappToken, tenant.phoneNumberId) });
  } catch (e) {
    sendMetaError(res, e);
  }
});

const profileSchema = z.object({
  about: z.string().max(139).optional(),
  address: z.string().max(256).optional(),
  description: z.string().max(512).optional(),
  email: z.string().max(128).optional(),
  websites: z.array(z.string()).max(2).optional(),
  vertical: z.string().optional(),
});

/** POST /whatsapp/profile — step 4 of the wizard. */
whatsappRouter.post("/profile", requirePermission("settings.manage"), async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tenant = await tenantOf(req);
  if (!tenant.whatsappToken || !tenant.phoneNumberId) {
    return res.status(400).json({ error: "Connect a number first." });
  }
  try {
    await setBusinessProfile(tenant, tenant.whatsappToken, tenant.phoneNumberId, parsed.data);
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { setupStep: Math.max(tenant.setupStep, 4) },
    });
    audit(req, "whatsapp.profile_updated");
    res.json({ status: statusOf(updated, env.publicUrl), profile: parsed.data });
  } catch (e) {
    sendMetaError(res, e);
  }
});

const connectSchema = z.object({
  code: z.string().min(4),
  wabaId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  pin: z.string().regex(/^\d{6}$/).optional(),
});

/** POST /whatsapp/connect — the code from Meta's popup, then everything else. */
whatsappRouter.post("/connect", requirePermission("settings.manage"), async (req, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tenant = await tenantOf(req);

  if (!tenant.metaAppId && !env.metaAppId) {
    return res.status(400).json({ error: "Add your Meta app details before connecting." });
  }

  try {
    const result = await completeSignup(tenant, parsed.data);
    audit(req, "whatsapp.connected", { meta: { wabaId: result.wabaId, phoneNumberId: result.phoneNumberId } });
    const fresh = await tenantOf(req);
    await syncNumbers(fresh).catch(() => {});
    res.json({ status: statusOf(fresh, env.publicUrl), steps: result.steps });
  } catch (e) {
    if (e instanceof StepFailure) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { connectionError: e.message },
      });
    }
    sendMetaError(res, e);
  }
});

/** POST /whatsapp/verify — re-run the live checks against Meta. */
whatsappRouter.post("/verify", requirePermission("settings.manage"), async (req, res) => {
  const tenant = await tenantOf(req);
  const checks = await verifyConnection(tenant);
  const fresh = await tenantOf(req);
  await syncNumbers(fresh).catch(() => {});
  res.json({ status: statusOf(fresh, env.publicUrl), checks });
});

/** POST /whatsapp/repair — re-subscribe the webhook without a full reconnect. */
whatsappRouter.post("/repair", requirePermission("settings.manage"), async (req, res) => {
  const tenant = await tenantOf(req);
  if (!tenant.whatsappToken || !tenant.wabaId) {
    return res.status(400).json({ error: "Connect the account first." });
  }
  try {
    await subscribeApp(tenant, tenant.whatsappToken, tenant.wabaId);
    const ok = await isSubscribed(tenant, tenant.whatsappToken, tenant.wabaId).catch(() => false);
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { webhookSubscribed: ok, connectionError: null },
    });
    audit(req, "whatsapp.webhook_repaired");
    res.json({ status: statusOf(updated, env.publicUrl) });
  } catch (e) {
    sendMetaError(res, e);
  }
});

/**
 * GET /whatsapp/numbers — the workspace's senders. Refreshed from Meta when a
 * connection exists, so labels and defaults survive but quality is current.
 */
whatsappRouter.get("/numbers", requirePermission("settings.manage"), async (req, res) => {
  const tenant = await tenantOf(req);
  try {
    const numbers = tenant.whatsappToken && tenant.wabaId
      ? await syncNumbers(tenant)
      : await activeNumbers(tenant.id);
    res.json({ numbers });
  } catch (e) {
    sendMetaError(res, e);
  }
});

const numberPatchSchema = z.object({
  label: z.string().trim().max(60).nullable().optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

/** PATCH /whatsapp/numbers/:phoneNumberId — name it, default it, retire it. */
whatsappRouter.patch("/numbers/:phoneNumberId", requirePermission("settings.manage"), async (req, res) => {
  const parsed = numberPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tenant = await tenantOf(req);
  const target = await prisma.phoneNumber.findFirst({
    where: { tenantId: tenant.id, phoneNumberId: req.params.phoneNumberId },
  });
  if (!target) return res.status(404).json({ error: "That number isn't in this workspace." });

  const d = parsed.data;
  if (d.isDefault) await setDefault(tenant.id, target.phoneNumberId);
  if (d.active === false && target.isDefault) {
    return res.status(400).json({ error: "Make another number the default before retiring this one." });
  }
  await prisma.phoneNumber.update({
    where: { id: target.id },
    data: {
      ...(d.label !== undefined ? { label: d.label } : {}),
      ...(d.active !== undefined ? { active: d.active } : {}),
    },
  });
  audit(req, "whatsapp.number_updated", { meta: { phoneNumberId: target.phoneNumberId, ...d } });
  res.json({ numbers: await activeNumbers(tenant.id) });
});

const numberSchema = z.object({
  phoneNumberId: z.string().min(1),
  pin: z.string().regex(/^\d{6}$/).optional(),
});

/** POST /whatsapp/numbers/select — switch the sending number. */
whatsappRouter.post("/numbers/select", requirePermission("settings.manage"), async (req, res) => {
  const parsed = numberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tenant = await tenantOf(req);
  if (!tenant.whatsappToken || !tenant.wabaId) {
    return res.status(400).json({ error: "Connect the account first." });
  }

  try {
    const numbers = await listPhoneNumbers(tenant, tenant.whatsappToken, tenant.wabaId);
    const n = numbers.find((x) => x.id === parsed.data.phoneNumberId);
    if (!n) return res.status(404).json({ error: "That number isn't on this account." });

    // Already-registered numbers reject this; that's fine, we still switch.
    let registerNote: string | undefined;
    try {
      await registerNumber(tenant, tenant.whatsappToken, n.id, parsed.data.pin || "000000");
    } catch (e) {
      registerNote = e instanceof MetaApiError ? e.detail.message : (e as Error).message;
    }

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        phoneNumberId: n.id,
        displayPhoneNumber: n.displayPhoneNumber,
        verifiedName: n.verifiedName || null,
        qualityRating: n.qualityRating || null,
        messagingLimit: n.messagingLimit || null,
      },
    });
    audit(req, "whatsapp.number_selected", { meta: { phoneNumberId: n.id } });
    res.json({ status: statusOf(updated, env.publicUrl), registerNote });
  } catch (e) {
    sendMetaError(res, e);
  }
});

/** POST /whatsapp/disconnect — forget the token and the account snapshot. */
whatsappRouter.post("/disconnect", requirePermission("settings.manage"), async (req, res) => {
  const tenant = await tenantOf(req);
  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      whatsappToken: null, wabaId: null, phoneNumberId: null,
      wabaName: null, wabaReviewStatus: null,
      businessId: null, businessName: null, businessVerification: null,
      displayPhoneNumber: null, verifiedName: null, qualityRating: null, messagingLimit: null,
      webhookSubscribed: false, connectedAt: null, connectionError: null,
    },
  });
  audit(req, "whatsapp.disconnected");
  res.json({ status: statusOf(updated, env.publicUrl) });
});
