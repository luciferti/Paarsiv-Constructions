import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { extractTokens } from "../lib/tokens";
import { deleteOnMeta, submitToMeta, syncFromMeta } from "../services/metaTemplates";
import { pageMeta, parsePaging } from "../lib/pagination";

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

const buttonSchema = z.object({
  type: z.enum(["quick_reply", "url", "phone"]),
  text: z.string().min(1),
  value: z.string().optional(),
});
const cardSchema = z.object({
  assetId: z.string().optional(),
  body: z.string().default(""),
  buttons: z.array(buttonSchema).max(2).optional(),
});
const templateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
  language: z.string().optional(),
  type: z.enum(["standard", "carousel"]).optional(),
  headerType: z.enum(["none", "text", "image", "video", "document"]).optional(),
  headerText: z.string().optional(),
  headerAssetId: z.string().optional(),
  body: z.string().min(1),
  footerText: z.string().optional(),
  buttons: z.array(buttonSchema).max(3).optional(),
  cards: z.array(cardSchema).max(10).optional(),
  folderId: z.string().nullable().optional(),
});

function shape(t: any, assetUrls?: Map<string, string>) {
  return {
    ...t,
    tokens: extractTokens(t.body || ""),
    headerAssetUrl: t.headerAssetId ? assetUrls?.get(t.headerAssetId) ?? null : null,
  };
}

/** Resolve /uploads URLs for header + carousel-card assets in one query. */
async function assetUrlMap(tenantId: string, templates: { headerAssetId: string | null; cards: unknown }[]) {
  const ids = new Set<string>();
  for (const t of templates) {
    if (t.headerAssetId) ids.add(t.headerAssetId);
    for (const c of (t.cards as { assetId?: string }[]) || []) if (c?.assetId) ids.add(c.assetId);
  }
  if (ids.size === 0) return new Map<string, string>();
  const assets = await prisma.asset.findMany({
    where: { tenantId, id: { in: Array.from(ids) } },
    select: { id: true, url: true },
  });
  return new Map(assets.map((a) => [a.id, a.url]));
}

/** GET /templates — list with tokens, Meta status and resolved media URLs. */
templatesRouter.get("/", async (req, res) => {
  const paging = parsePaging(req, 24);
  const folderId = typeof req.query.folderId === "string" && req.query.folderId ? req.query.folderId : undefined;
  const where = { tenantId: req.auth!.tenantId, ...(folderId ? { folderId } : {}) };
  const [templates, total] = await Promise.all([
    prisma.template.findMany({ where, orderBy: { createdAt: "desc" }, skip: paging.skip, take: paging.take }),
    prisma.template.count({ where }),
  ]);
  const urls = await assetUrlMap(req.auth!.tenantId, templates);
  res.json({
    ...pageMeta(total, paging),
    templates: templates.map((t) => ({
      ...shape(t, urls),
      cards: ((t.cards as { assetId?: string; body?: string }[]) || []).map((c) => ({
        ...c,
        assetUrl: c?.assetId ? urls.get(c.assetId) ?? null : null,
      })),
    })),
  });
});

/** POST /templates/sync — pull live statuses from Meta (admin/RM). */
templatesRouter.post("/sync", requireRole("ADMIN", "RM"), async (req, res) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.auth!.tenantId } });
  if (!tenant) return res.status(404).json({ error: "tenant missing" });
  const result = await syncFromMeta(tenant);
  res.json(result);
});

function toData(d: z.infer<typeof templateSchema>) {
  return {
    name: d.name,
    category: d.category || "MARKETING",
    language: d.language || "en",
    type: d.type || "standard",
    headerType: d.headerType || "none",
    headerText: d.headerText || null,
    headerAssetId: d.headerAssetId || null,
    body: d.body,
    footerText: d.footerText || null,
    buttons: (d.buttons || []) as object[],
    cards: (d.cards || []) as object[],
    folderId: d.folderId ?? null,
  };
}

/**
 * POST /templates — create locally and submit to Meta for approval.
 * Without WhatsApp credentials the template stays local (status LOCAL) so the
 * platform is still usable before a number is connected.
 */
templatesRouter.post("/", requireRole("ADMIN", "RM"), async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exists = await prisma.template.findFirst({
    where: { tenantId: req.auth!.tenantId, name: parsed.data.name },
  });
  if (exists) return res.status(409).json({ error: "template name taken" });

  let template = await prisma.template.create({
    data: { tenantId: req.auth!.tenantId, status: "DRAFT", ...toData(parsed.data) },
  });

  const tenant = await prisma.tenant.findUnique({ where: { id: req.auth!.tenantId } });
  const submit = tenant ? await submitToMeta(tenant, template) : { ok: false, skipped: true, error: "tenant missing" };

  template = await prisma.template.update({
    where: { id: template.id },
    data: submit.ok
      ? {
          status: "PENDING",
          metaId: submit.metaId ?? null,
          metaStatus: submit.status ?? "PENDING",
          metaCategory: submit.category ?? null,
          metaError: null,
          syncedAt: new Date(),
        }
      : {
          status: submit.skipped ? "LOCAL" : "DRAFT",
          metaStatus: submit.skipped ? null : "SUBMIT_FAILED",
          metaError: submit.error ?? null,
        },
  });

  const urls = await assetUrlMap(req.auth!.tenantId, [template]);
  res.status(201).json({
    template: shape(template, urls),
    meta: { submitted: submit.ok, skipped: !!submit.skipped, error: submit.error ?? null },
  });
});

/** PATCH /templates/:id — edit (admin/RM). */
templatesRouter.patch("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
  const t = await prisma.template.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!t) return res.status(404).json({ error: "not found" });

  // Allow a partial folder-only move, else full validation.
  if (req.body && Object.keys(req.body).length === 1 && "folderId" in req.body) {
    const updated = await prisma.template.update({
      where: { id: t.id },
      data: { folderId: req.body.folderId || null },
    });
    return res.json({ template: shape(updated) });
  }

  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await prisma.template.update({
    where: { id: t.id },
    data: {
      ...toData(parsed.data),
      // Meta keeps the previously approved version until it is resubmitted.
      metaError: t.metaId ? "Edited locally — resubmit to Meta to update the approved version" : t.metaError,
    },
  });
  const urls = await assetUrlMap(req.auth!.tenantId, [updated]);
  res.json({ template: shape(updated, urls) });
});

/** DELETE /templates/:id (admin/RM). */
templatesRouter.delete("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
  const t = await prisma.template.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!t) return res.status(404).json({ error: "not found" });
  const tenant = await prisma.tenant.findUnique({ where: { id: req.auth!.tenantId } });
  if (tenant) await deleteOnMeta(tenant, t); // best effort, before the local row goes
  await prisma.template.delete({ where: { id: t.id } });
  res.json({ ok: true });
});
