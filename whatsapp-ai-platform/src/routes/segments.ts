import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requirePermission } from "../middleware/auth";
import { segmentWhere, type SegmentRules } from "../lib/segment";

export const segmentsRouter = Router();
segmentsRouter.use(requireAuth);

const conditionSchema = z.object({
  // built-in field name, or a custom field as "attr:<key>"
  field: z.string().min(1),
  op: z.enum(["equals", "contains", "not_equals", "is_set", "has"]),
  value: z.union([z.string(), z.boolean()]).optional(),
});
const rulesSchema = z.object({
  match: z.enum(["all", "any"]),
  conditions: z.array(conditionSchema).max(20),
});

/** GET /segments — list saved segments with a live contact count each. */
segmentsRouter.get("/", requirePermission("contacts.view"), async (req, res) => {
  const segments = await prisma.segment.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "desc" },
  });
  const withCounts = await Promise.all(
    segments.map(async (s) => ({
      ...s,
      count: await prisma.contact.count({
        where: segmentWhere(req.auth!.tenantId, s.rules as unknown as SegmentRules),
      }),
    }))
  );
  res.json({ segments: withCounts });
});

/** POST /segments/preview — count + sample for unsaved rules (live builder). */
segmentsRouter.post("/preview", async (req, res) => {
  const parsed = rulesSchema.safeParse(req.body?.rules);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const where = segmentWhere(req.auth!.tenantId, parsed.data);
  const [count, sample] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({ where, take: 5, orderBy: { createdAt: "desc" } }),
  ]);
  res.json({ count, sample });
});

/** POST /segments — save a segment (admin/RM). */
segmentsRouter.post("/", requirePermission("segments.manage"), async (req, res) => {
  const nameOk = z.string().min(1).safeParse(req.body?.name);
  const rulesOk = rulesSchema.safeParse(req.body?.rules);
  const folderId = typeof req.body?.folderId === "string" ? req.body.folderId : null;
  if (!nameOk.success || !rulesOk.success) {
    return res.status(400).json({ error: "name and valid rules required" });
  }
  const exists = await prisma.segment.findFirst({
    where: { tenantId: req.auth!.tenantId, name: nameOk.data },
  });
  if (exists) return res.status(409).json({ error: "segment name taken" });

  const segment = await prisma.segment.create({
    data: {
      tenantId: req.auth!.tenantId,
      name: nameOk.data,
      rules: rulesOk.data as object,
      folderId,
    },
  });
  const count = await prisma.contact.count({
    where: segmentWhere(req.auth!.tenantId, rulesOk.data),
  });
  res.status(201).json({ segment: { ...segment, count } });
});

/** PATCH /segments/:id — update name/rules/folder (admin/RM). */
segmentsRouter.patch("/:id", requirePermission("segments.manage"), async (req, res) => {
  const s = await prisma.segment.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!s) return res.status(404).json({ error: "not found" });

  const data: any = {};
  if (typeof req.body?.name === "string" && req.body.name.trim()) data.name = req.body.name.trim();
  if (req.body?.rules !== undefined) {
    const rulesOk = rulesSchema.safeParse(req.body.rules);
    if (!rulesOk.success) return res.status(400).json({ error: "invalid rules" });
    data.rules = rulesOk.data as object;
  }
  if (req.body?.folderId !== undefined) {
    data.folderId = req.body.folderId || null; // "" → un-folder
  }

  const segment = await prisma.segment.update({ where: { id: s.id }, data });
  const count = await prisma.contact.count({
    where: segmentWhere(req.auth!.tenantId, segment.rules as unknown as SegmentRules),
  });
  res.json({ segment: { ...segment, count } });
});

/** DELETE /segments/:id (admin/RM). */
segmentsRouter.delete("/:id", requirePermission("segments.manage"), async (req, res) => {
  const s = await prisma.segment.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!s) return res.status(404).json({ error: "not found" });
  await prisma.segment.delete({ where: { id: s.id } });
  res.json({ ok: true });
});
