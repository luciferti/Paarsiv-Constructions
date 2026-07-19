"use client";

/**
 * Client-side session storage for the real JWT issued by
 * POST /api/v1/auth/login|signup. The token rides on every API call
 * via lib/api/client.ts; a 401 there clears this session and returns
 * the user to /login.
 */

const TOKEN_KEY = "hrms_auth_token";
const USER_KEY = "hrms_auth_user";

export interface SessionUser {
  name: string;
  email: string;
  role?: string;
  org_name?: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: SessionUser): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
