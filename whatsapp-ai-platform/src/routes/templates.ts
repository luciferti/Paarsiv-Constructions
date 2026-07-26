import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { extractTokens } from "../lib/tokens";

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

function shape(t: any) {
  return { ...t, tokens: extractTokens(t.body || "") };
}

/** GET /templates — list with the tokens each body uses. */
templatesRouter.get("/", async (req, res) => {
  const templates = await prisma.template.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ templates: templates.map(shape) });
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

/** POST /templates — create (admin/RM). Demo: auto-APPROVED. */
templatesRouter.post("/", requireRole("ADMIN", "RM"), async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exists = await prisma.template.findFirst({
    where: { tenantId: req.auth!.tenantId, name: parsed.data.name },
  });
  if (exists) return res.status(409).json({ error: "template name taken" });

  const template = await prisma.template.create({
    data: { tenantId: req.auth!.tenantId, status: "APPROVED", ...toData(parsed.data) },
  });
  res.status(201).json({ template: shape(template) });
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
    data: toData(parsed.data),
  });
  res.json({ template: shape(updated) });
});

/** DELETE /templates/:id (admin/RM). */
templatesRouter.delete("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
  const t = await prisma.template.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!t) return res.status(404).json({ error: "not found" });
  await prisma.template.delete({ where: { id: t.id } });
  res.json({ ok: true });
});
