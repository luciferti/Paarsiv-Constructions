import crypto from "crypto";
import { prisma } from "./prisma";

const REFRESH_TTL_DAYS = 7;

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Issue a new refresh token for a user (stored hashed). Returns the raw token. */
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = `wrt_${crypto.randomBytes(32).toString("hex")}`;
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000),
    },
  });
  return raw;
}

/**
 * Rotate: validate a raw refresh token, revoke it, and issue a replacement.
 * Returns the userId + new token, or null if invalid/expired/revoked.
 */
export async function rotateRefreshToken(
  raw: string
): Promise<{ userId: string; token: string } | null> {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!row || row.revokedAt || row.expiresAt < new Date()) return null;
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  const token = await issueRefreshToken(row.userId);
  return { userId: row.userId, token };
}

/** Revoke every live refresh token for a user (logout-all). */
export async function revokeUserRefreshTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
