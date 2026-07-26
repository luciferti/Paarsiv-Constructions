import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
  const folderId = typeof req.query.folderId === "string" ? req.query.folderId : undefined;
  const assets = await prisma.asset.findMany({
    where: { tenantId: req.auth!.tenantId, ...(folderId ? { folderId } : {}) },
    orderBy: { createdAt: "desc" },
  });
  res.json({ assets });
});

/** POST /assets — multipart upload (field: "file", optional folderId). admin/RM. */
assetsRouter.post("/", requireRole("ADMIN", "RM"), upload.single("file"), async (req, res) => {
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
assetsRouter.patch("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
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
assetsRouter.delete("/:id", requireRole("ADMIN", "RM"), async (req, res) => {
  const a = await prisma.asset.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!a) return res.status(404).json({ error: "not found" });
  fs.unlink(path.join(UPLOAD_DIR, a.filename), () => {});
  await prisma.asset.delete({ where: { id: a.id } });
  res.json({ ok: true });
});
