"use client";

import { ReactNode, useEffect, useState } from "react";

import { hasPermission } from "@/lib/auth/permissions";
import { getUser } from "@/lib/auth/session";

/**
 * Renders children only if the current user's role holds `perm`. Reads the
 * role after mount to avoid SSR/hydration mismatch. Purely cosmetic — the API
 * still enforces permissions server-side.
 */
export function Can({ perm, children }: { perm: string; children: ReactNode }) {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(getUser()?.role ?? "viewer");
  }, []);

  if (role === null) return null;
  return hasPermission(role, perm) ? <>{children}</> : null;
}
