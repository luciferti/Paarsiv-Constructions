import { apiRequest } from "@/lib/api/client";

export interface AuthUser {
  id: string;
  org_id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
  org_name: string;
}

export function signup(payload: {
  company_name: string;
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/signup", { method: "POST", body: payload });
}

export function login(payload: { email: string; password: string }): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", { method: "POST", body: payload });
}

// ---- Team / user management (admin) ----

export type Role = "admin" | "manager" | "accountant" | "site_engineer" | "viewer";

export const ROLES: Role[] = ["admin", "manager", "accountant", "site_engineer", "viewer"];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  accountant: "Accountant",
  site_engineer: "Site Engineer",
  viewer: "Viewer",
};

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
}

export function listTeam(): Promise<TeamMember[]> {
  return apiRequest<TeamMember[]>("/auth/users");
}

export function createTeamMember(payload: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<TeamMember> {
  return apiRequest<TeamMember>("/auth/users", { method: "POST", body: payload });
}

export function updateTeamMember(
  userId: string,
  payload: { role?: Role; is_active?: boolean }
): Promise<TeamMember> {
  return apiRequest<TeamMember>(`/auth/users/${userId}`, { method: "PATCH", body: payload });
}
