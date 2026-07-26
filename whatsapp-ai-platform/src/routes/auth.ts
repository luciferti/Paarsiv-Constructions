import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { issueRefreshToken, rotateRefreshToken, revokeUserRefreshTokens } from "../lib/refresh";
import { auditRaw, audit } from "../lib/audit";

export const authRouter = Router();

const loginSchema = z.object({
  tenantSlug: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "tenantSlug, username, password required" });
  }
  const { tenantSlug, username, password } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return res.status(401).json({ error: "invalid credentials" });

  const user = await prisma.user.findUnique({
    where: { tenantId_username: { tenantId: tenant.id, username } },
  });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });

  const token = signToken({
    uid: user.id,
    tenantId: tenant.id,
    role: user.role,
    username: user.username,
  });
  const refreshToken = await issueRefreshToken(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { presence: "online" },
  });
  auditRaw(tenant.id, "auth.login", { userId: user.id, username: user.username, ip: req.ip });

  res.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      team: user.team,
    },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
  });
});

/** POST /auth/refresh — rotate a refresh token for a new access+refresh pair. */
authRouter.post("/refresh", async (req, res) => {
  const raw = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  if (!raw) return res.status(400).json({ error: "refreshToken required" });

  const rotated = await rotateRefreshToken(raw);
  if (!rotated) return res.status(401).json({ error: "invalid refresh token" });

  const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
  if (!user || !user.isActive) return res.status(401).json({ error: "invalid refresh token" });
  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  if (!tenant) return res.status(401).json({ error: "invalid refresh token" });

  const token = signToken({
    uid: user.id,
    tenantId: tenant.id,
    role: user.role,
    username: user.username,
  });
  res.json({ token, refreshToken: rotated.token });
});

/** POST /auth/logout — revoke all refresh tokens + mark offline. */
authRouter.post("/logout", requireAuth, async (req, res) => {
  await revokeUserRefreshTokens(req.auth!.uid);
  await prisma.user.update({
    where: { id: req.auth!.uid },
    data: { presence: "offline" },
  }).catch(() => {});
  audit(req, "auth.logout");
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.uid },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      team: true,
      presence: true,
    },
  });
  if (!user) return res.status(404).json({ error: "not found" });
  res.json({ user });
});
