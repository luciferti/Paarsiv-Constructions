import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requirePermission } from "../middleware/auth";
import { audit } from "../lib/audit";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

// Never leak secrets to the client — mask them.
function maskTenant(t: any) {
  const mask = (v?: string | null) => (v ? "•••• set" : null);
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    wabaId: t.wabaId,
    phoneNumberId: t.phoneNumberId,
    graphVersion: t.graphVersion,
    aiSource: t.aiSource,
    aiEnabled: t.aiEnabled,
    botName: t.botName,
    claudeModel: t.claudeModel,
    openaiModel: t.openaiModel,
    systemPrompt: t.systemPrompt,
    whatsappToken: mask(t.whatsappToken),
    verifyToken: mask(t.verifyToken),
    claudeKey: mask(t.claudeKey),
    openaiKey: mask(t.openaiKey),
    mergeRules: t.mergeRules ?? null,
  };
}

/** GET /settings — masked tenant config + usage counters. */
settingsRouter.get("/", async (req, res) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.auth!.tenantId } });
  if (!tenant) return res.status(404).json({ error: "not found" });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [aiToday, agentToday, openConvs] = await Promise.all([
    prisma.message.count({
      where: { tenantId: tenant.id, sentBy: "AI", timestamp: { gte: startOfDay } },
    }),
    prisma.message.count({
      where: { tenantId: tenant.id, sentBy: "AGENT", timestamp: { gte: startOfDay } },
    }),
    prisma.conversation.count({ where: { tenantId: tenant.id, status: "open" } }),
  ]);

  res.json({ tenant: maskTenant(tenant), usage: { aiToday, agentToday, openConvs } });
});

const updateSchema = z.object({
  aiSource: z.enum(["OWN", "CLAUDE", "GPT", "OFF"]).optional(),
  aiEnabled: z.boolean().optional(),
  botName: z.string().optional(),
  claudeModel: z.string().optional(),
  openaiModel: z.string().optional(),
  systemPrompt: z.string().nullable().optional(),
  mergeRules: z
    .object({
      phoneSuffix: z.boolean(),
      email: z.boolean(),
      externalId: z.boolean(),
      nameCity: z.boolean(),
      customFields: z.array(z.string()).max(10),
      survivor: z.enum(["mostActive", "oldest"]),
    })
    .optional(),
  // Secrets: only applied if a non-empty value is provided.
  claudeKey: z.string().optional(),
  openaiKey: z.string().optional(),
  whatsappToken: z.string().optional(),
  verifyToken: z.string().optional(),
  phoneNumberId: z.string().optional(),
  wabaId: z.string().optional(),
  graphVersion: z.string().optional(),
});

/** PATCH /settings — admin-only config update (AI Control Panel). */
settingsRouter.patch("/", requirePermission("settings.manage"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const d = parsed.data;

  // Build update object; skip empty secret strings so the mask can't wipe them.
  const data: any = {};
  const passthrough = [
    "aiSource",
    "aiEnabled",
    "botName",
    "claudeModel",
    "openaiModel",
    "graphVersion",
  ] as const;
  for (const k of passthrough) if (d[k] !== undefined) data[k] = d[k];
  if (d.systemPrompt !== undefined) data.systemPrompt = d.systemPrompt;
  if (d.mergeRules !== undefined) data.mergeRules = d.mergeRules;

  const secrets = ["claudeKey", "openaiKey", "whatsappToken", "verifyToken", "phoneNumberId", "wabaId"] as const;
  for (const k of secrets) if (d[k] && d[k]!.trim()) data[k] = d[k]!.trim();

  const tenant = await prisma.tenant.update({
    where: { id: req.auth!.tenantId },
    data,
  });
  audit(req, "settings.update", { meta: { fields: Object.keys(data) } });
  res.json({ tenant: maskTenant(tenant) });
});
