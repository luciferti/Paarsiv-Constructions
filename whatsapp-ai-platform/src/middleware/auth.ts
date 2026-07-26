import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { verifyToken, type AuthPayload } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import type { Role } from "@prisma/client";
import { can } from "../lib/permissions";

// Augment Express Request with the authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      viaApiKey?: boolean;
    }
  }
}

const sha256 = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });

  // Programmatic access with an API key (Authorization: Bearer wak_...)
  if (token.startsWith("wak_")) {
    try {
      const key = await prisma.apiKey.findUnique({ where: { keyHash: sha256(token) } });
      if (!key || key.revokedAt) return res.status(401).json({ error: "invalid api key" });
      // A key with no scopes keeps full tenant access; one with scopes is
      // limited to exactly those, regardless of the admin role it carries.
      const scoped = key.scopes.length > 0;
      req.auth = {
        uid: `apikey:${key.id}`,
        tenantId: key.tenantId,
        role: "ADMIN",
        username: `api:${key.name}`,
        permissions: scoped ? key.scopes : undefined,
        strict: scoped,
      };
      req.viaApiKey = true;
      // Best-effort usage stamp; don't block the request on it.
      prisma.apiKey
        .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
      return next();
    } catch {
      return res.status(401).json({ error: "invalid api key" });
    }
  }

  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

/**
 * Permission gate. Roles supply defaults (see lib/permissions), so existing
 * behaviour is unchanged unless a user has an explicit permission list.
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
    if (!can({ role: req.auth.role, permissions: req.auth.permissions, strict: req.auth.strict }, permission)) {
      return res.status(403).json({ error: `missing permission: ${permission}` });
    }
    next();
  };
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}
