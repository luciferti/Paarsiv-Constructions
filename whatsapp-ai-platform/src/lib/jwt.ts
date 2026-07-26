import jwt from "jsonwebtoken";
import { env } from "./env";
import type { Role } from "@prisma/client";

export interface AuthPayload {
  uid: string;
  tenantId: string;
  role: Role;
  username: string;
  /** Explicit grants; empty/absent means the role defaults apply. */
  permissions?: string[];
  /** Set for scoped API keys: `permissions` is the complete allow-list. */
  strict?: boolean;
}

export function signToken(payload: AuthPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.jwtExpires as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, env.jwtSecret) as AuthPayload;
}
