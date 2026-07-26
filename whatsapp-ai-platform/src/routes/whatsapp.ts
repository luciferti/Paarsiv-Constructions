import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { requireAuth, requirePermission } from "../middleware/auth";
import { audit } from "../lib/audit";
import {
  MetaApiError,
  StepFailure,
  completeSignup,
  isSubscribed,
  listPhoneNumbers,
  registerNumber,
  statusOf,
  subscribeApp,
  verifyConnection,
} from "../services/metaOnboarding";

export const whatsappRouter = Router();
whatsappRouter.use(requireAuth);

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

/** GET /whatsapp/numbers — the numbers on the connected account. */
whatsappRouter.get("/numbers", requirePermission("settings.manage"), async (req, res) => {
  const tenant = await tenantOf(req);
  if (!tenant.whatsappToken || !tenant.wabaId) return res.json({ numbers: [] });
  try {
    res.json({ numbers: await listPhoneNumbers(tenant, tenant.whatsappToken, tenant.wabaId) });
  } catch (e) {
    sendMetaError(res, e);
  }
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
