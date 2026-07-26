import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
  isActive: true,
} as const;

/** GET /users — team roster. Admin: all; RM: self + direct reports; Sales: self. */
usersRouter.get("/", async (req, res) => {
  const auth = req.auth!;
  let where: any = { tenantId: auth.tenantId };
  if (auth.role === "RM") {
    where = { tenantId: auth.tenantId, OR: [{ id: auth.uid }, { managerId: auth.uid }] };
  } else if (auth.role === "SALES") {
    where = { id: auth.uid };
  }
  const users = await prisma.user.findMany({
    where,
    select: publicSelect,
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
  });
  res.json({ users });
});

const createSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(4),
  displayName: z.string().min(1),
  role: z.enum(["ADMIN", "RM", "SALES"]),
  managerId: z.string().optional(),
  team: z.string().optional(),
});

/** POST /users — create an agent (admin only). */
usersRouter.post("/", requireRole("ADMIN"), async (req, res) => {
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
    },
    select: publicSelect,
  });
  res.status(201).json({ user });
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
  res.json({ user });
});
