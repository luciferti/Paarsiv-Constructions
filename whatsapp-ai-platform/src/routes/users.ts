import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requirePermission } from "../middleware/auth";
import { audit } from "../lib/audit";
import {
  ALL_PERMISSIONS, ROLE_DEFAULTS, effectivePermissions, permissionCatalog,
} from "../lib/permissions";
import { revokeUserRefreshTokens } from "../lib/refresh";

export const usersRouter = Router();
usersRouter.use(requireAuth);

const publicSelect = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  team: true,
  presence: true,
  managerId: true,
  permissions: true,
  phoneNumberIds: true,
  isActive: true,
  createdAt: true,
} as const;

type UserRow = { role: "ADMIN" | "RM" | "SALES"; permissions: string[] };
const shape = <T extends UserRow>(u: T) => ({
  ...u,
  effectivePermissions: effectivePermissions(u),
  usesRoleDefaults: u.permissions.length === 0,
});

/** GET /users/numbers — the numbers a user can be assigned to. */
usersRouter.get("/numbers", requirePermission("users.manage"), async (req, res) => {
  const numbers = await prisma.phoneNumber.findMany({
    where: { tenantId: req.auth!.tenantId, active: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { phoneNumberId: true, displayPhoneNumber: true, label: true },
  });
  res.json({ numbers });
});

/** GET /users/permissions — catalog + role defaults for the settings UI. */
usersRouter.get("/permissions", async (_req, res) => {
  res.json({ groups: permissionCatalog(), roleDefaults: ROLE_DEFAULTS });
});

/** GET /users — roster. Admin: all; RM: self + direct reports; Sales: self. */
usersRouter.get("/", async (req, res) => {
  const auth = req.auth!;
  let where: Record<string, unknown> = { tenantId: auth.tenantId };
  if (auth.role === "RM") {
    where = { tenantId: auth.tenantId, OR: [{ id: auth.uid }, { managerId: auth.uid }] };
  } else if (auth.role === "SALES") {
    where = { id: auth.uid };
  }
  const users = await prisma.user.findMany({
    where,
    select: publicSelect,
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { displayName: "asc" }],
  });
  res.json({ users: users.map(shape) });
});

const createSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  displayName: z.string().min(1),
  role: z.enum(["ADMIN", "RM", "SALES"]),
  managerId: z.string().nullable().optional(),
  team: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  /** Numbers this person works on; empty means every number. */
  phoneNumberIds: z.array(z.string()).max(20).optional(),
});

/** POST /users — create a user (needs users.manage). */
usersRouter.post("/", requirePermission("users.manage"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const exists = await prisma.user.findUnique({
    where: { tenantId_username: { tenantId: req.auth!.tenantId, username: d.username } },
  });
  if (exists) return res.status(409).json({ error: "username taken" });

  const user = await prisma.user.create({
    data: {
      tenantId: req.auth!.tenantId,
      username: d.username,
      passwordHash: await bcrypt.hash(d.password, 10),
      displayName: d.displayName,
      role: d.role,
      managerId: d.managerId || null,
      team: d.team || null,
      permissions: (d.permissions || []).filter((p) => ALL_PERMISSIONS.includes(p)),
      phoneNumberIds: d.phoneNumberIds || [],
    },
    select: publicSelect,
  });
  audit(req, "user.create", { entity: "user", entityId: user.id, meta: { username: d.username, role: d.role } });
  res.status(201).json({ user: shape(user) });
});

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "RM", "SALES"]).optional(),
  managerId: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  /** Empty array resets the user back to their role defaults. */
  permissions: z.array(z.string()).optional(),
  /** Numbers this person works on; empty means every number. */
  phoneNumberIds: z.array(z.string()).max(20).optional(),
});

/** PATCH /users/:id — edit profile, role and permissions (needs users.manage). */
usersRouter.patch("/:id", requirePermission("users.manage"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const target = await prisma.user.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!target) return res.status(404).json({ error: "not found" });

  // Guard: never let the last active admin be demoted or switched off.
  const losingAdmin =
    target.role === "ADMIN" && ((d.role && d.role !== "ADMIN") || d.isActive === false);
  if (losingAdmin) {
    const admins = await prisma.user.count({
      where: { tenantId: req.auth!.tenantId, role: "ADMIN", isActive: true },
    });
    if (admins <= 1) {
      return res.status(400).json({ error: "this is the last active admin — promote someone else first" });
    }
  }
  if (target.id === req.auth!.uid && d.isActive === false) {
    return res.status(400).json({ error: "you cannot deactivate yourself" });
  }
  if (d.managerId && d.managerId === target.id) {
    return res.status(400).json({ error: "a user cannot report to themselves" });
  }

  const data: Record<string, unknown> = {};
  if (d.displayName !== undefined) data.displayName = d.displayName;
  if (d.role !== undefined) data.role = d.role;
  if (d.managerId !== undefined) data.managerId = d.managerId || null;
  if (d.team !== undefined) data.team = d.team || null;
  if (d.isActive !== undefined) data.isActive = d.isActive;
  if (d.permissions !== undefined) {
    data.permissions = d.permissions.filter((p) => ALL_PERMISSIONS.includes(p));
  }
  if (d.phoneNumberIds !== undefined) {
    // Only numbers this workspace actually owns.
    const owned = await prisma.phoneNumber.findMany({
      where: { tenantId: req.auth!.tenantId, phoneNumberId: { in: d.phoneNumberIds } },
      select: { phoneNumberId: true },
    });
    data.phoneNumberIds = owned.map((n) => n.phoneNumberId);
  }

  const user = await prisma.user.update({
    where: { id: target.id },
    data,
    select: publicSelect,
  });

  // Access changes must not linger in an old session.
  if (
    d.role !== undefined || d.permissions !== undefined ||
    d.phoneNumberIds !== undefined || d.isActive === false
  ) {
    await revokeUserRefreshTokens(target.id);
  }
  audit(req, "user.update", { entity: "user", entityId: user.id, meta: { fields: Object.keys(data) } });
  res.json({ user: shape(user) });
});

/** POST /users/:id/password — set a new password (needs users.manage). */
usersRouter.post("/:id/password", requirePermission("users.manage"), async (req, res) => {
  const password = z.string().min(6).safeParse(req.body?.password);
  if (!password.success) return res.status(400).json({ error: "password must be at least 6 characters" });

  const target = await prisma.user.findFirst({
    where: { id: req.params.id, tenantId: req.auth!.tenantId },
  });
  if (!target) return res.status(404).json({ error: "not found" });

  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash: await bcrypt.hash(password.data, 10) },
  });
  await revokeUserRefreshTokens(target.id);
  audit(req, "user.password_reset", { entity: "user", entityId: target.id });
  res.json({ ok: true });
});

const presenceSchema = z.object({ presence: z.enum(["online", "away", "offline"]) });

/** PATCH /users/me/presence — set own presence. */
usersRouter.patch("/me/presence", async (req, res) => {
  const parsed = presenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid presence" });
  const user = await prisma.user.update({
    where: { id: req.auth!.uid },
    data: { presence: parsed.data.presence },
    select: publicSelect,
  });
  res.json({ user: shape(user) });
});
