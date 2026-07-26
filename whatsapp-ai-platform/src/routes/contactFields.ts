import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const contactFieldsRouter = Router();
contactFieldsRouter.use(requireAuth);

// Turn a label into a safe machine key: "Budget Range" -> "budget_range"
function toKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** GET /contact-fields — tenant's custom field definitions. */
contactFieldsRouter.get("/", async (req, res) => {
  const fields = await prisma.contactField.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: { createdAt: "asc" },
  });
  res.json({ fields });
});

const schema = z.object({
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "boolean"]).optional(),
});

/** POST /contact-fields — define a new custom field (admin/RM). */
contactFieldsRouter.post("/", requireRole("ADMIN", "RM"), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const key = toKey(parsed.data.label);
  if (!key) return res.status(400).json({ error: "invalid label" });

  const exists = await prisma.contactField.findFirst({
    where: { tenantId: req.auth!.tenantId, key },
  });
  if (exists) return res.status(409).json({ error: "field already exists" });

  const field = await prisma.contactField.create({
    data: {
      tenantId: req.auth!.tenantId,
      key,
      label: parsed.data.label.trim(),
      type: parsed.data.type || "text",
    },
  });
  res.status(201).json({ field });
});

/** DELETE /contact-fields/:id (admin/RM). Leaves existing attribute values intact. */
contactFieldsRouter.delete("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
  const f = await prisma.contactField.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!f) return res.status(404).json({ error: "not found" });
  await prisma.contactField.delete({ where: { id: f.id } });
  res.json({ ok: true });
});
