import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { requireAuth, requirePermission } from "../middleware/auth";
import { pageMeta, parsePaging } from "../lib/pagination";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomBytes(10).toString("hex")}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 }, // 16 MB (WhatsApp media cap)
});

export const assetsRouter = Router();
assetsRouter.use(requireAuth);

/** GET /assets — media library, optionally filtered by ?folderId=. */
assetsRouter.get("/", async (req, res) => {
  const folderId = typeof req.query.folderId === "string" && req.query.folderId ? req.query.folderId : undefined;
  const paging = parsePaging(req, 24);
  const where = { tenantId: req.auth!.tenantId, ...(folderId ? { folderId } : {}) };
  const [assets, total] = await Promise.all([
    prisma.asset.findMany({ where, orderBy: { createdAt: "desc" }, skip: paging.skip, take: paging.take }),
    prisma.asset.count({ where }),
  ]);
  res.json({ assets, ...pageMeta(total, paging) });
});

/** POST /assets — multipart upload (field: "file", optional folderId). admin/RM. */
assetsRouter.post("/", requirePermission("media.manage"), upload.single("file"), async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: "file required" });
  const folderId = typeof req.body?.folderId === "string" && req.body.folderId ? req.body.folderId : null;
  const asset = await prisma.asset.create({
    data: {
      tenantId: req.auth!.tenantId,
      filename: f.filename,
      originalName: f.originalname,
      mimeType: f.mimetype,
      size: f.size,
      url: `/uploads/${f.filename}`,
      folderId,
    },
  });
  res.status(201).json({ asset });
});

/** PATCH /assets/:id — move to a folder (admin/RM). */
assetsRouter.patch("/:id", requirePermission("media.manage"), async (req, res) => {
  const a = await prisma.asset.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!a) return res.status(404).json({ error: "not found" });
  const asset = await prisma.asset.update({
    where: { id: a.id },
    data: { folderId: req.body?.folderId || null },
  });
  res.json({ asset });
});

/** DELETE /assets/:id (admin/RM) — removes DB row + file. */
assetsRouter.delete("/:id", requirePermission("media.manage"), async (req, res) => {
  const a = await prisma.asset.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!a) return res.status(404).json({ error: "not found" });
  fs.unlink(path.join(UPLOAD_DIR, a.filename), () => {});
  await prisma.asset.delete({ where: { id: a.id } });
  res.json({ ok: true });
});
