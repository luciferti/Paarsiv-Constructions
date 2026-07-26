import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requirePermission } from "../middleware/auth";
import { conversationVisibilityWhere, canAssignTo } from "../lib/visibility";
import { sendReply } from "../services/inbound";
import { emitRealtime } from "../lib/events";
import { pageMeta, parsePaging } from "../lib/pagination";

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);

// Load a conversation the caller is allowed to see, else null.
async function loadVisible(reqAuth: any, id: string) {
  const where = await conversationVisibilityWhere(reqAuth);
  return prisma.conversation.findFirst({ where: { ...where, id } });
}

/** GET /conversations — role-scoped list, newest activity first. */
conversationsRouter.get("/", requirePermission("inbox.view"), async (req, res) => {
  const where = await conversationVisibilityWhere(req.auth!);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  // Which of our numbers to show; absent means every number.
  const phoneNumberId = typeof req.query.phoneNumberId === "string" ? req.query.phoneNumberId : "";

  const paging = parsePaging(req, 50);
  const listWhere = {
    ...where,
    ...(status ? { status } : {}),
    ...(phoneNumberId ? { phoneNumberId } : {}),
    ...(search
      ? {
          OR: [
            { customerName: { contains: search as string, mode: "insensitive" as const } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };
  const [list, total] = await Promise.all([
    prisma.conversation.findMany({
      where: listWhere,
      orderBy: { lastMessageAt: "desc" },
      include: { assignedUser: { select: { id: true, displayName: true } } },
      skip: paging.skip,
      take: paging.take,
    }),
    prisma.conversation.count({ where: listWhere }),
  ]);
  // Attach which of our numbers each thread is on, for the inbox badges.
  const senders = await prisma.phoneNumber.findMany({
    where: { tenantId: req.auth!.tenantId },
    select: { phoneNumberId: true, displayPhoneNumber: true, label: true },
  });
  const byId = new Map(senders.map((n) => [n.phoneNumberId, n]));
  const conversations = list.map((c) => ({ ...c, senderNumber: byId.get(c.phoneNumberId) ?? null }));

  res.json({ conversations, ...pageMeta(total, paging) });
});

/**
 * GET /conversations/numbers — the senders that actually have conversations,
 * so the inbox filter only offers numbers with something behind them.
 */
conversationsRouter.get("/numbers", requirePermission("inbox.view"), async (req, res) => {
  const numbers = await prisma.phoneNumber.findMany({
    where: { tenantId: req.auth!.tenantId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      phoneNumberId: true, displayPhoneNumber: true, label: true,
      isDefault: true, active: true, qualityRating: true,
    },
  });
  // Conversation counts come from the column, since there's no FK relation.
  const counts = await prisma.conversation.groupBy({
    by: ["phoneNumberId"],
    where: { tenantId: req.auth!.tenantId },
    _count: { _all: true },
  });
  const countBy = new Map(counts.map((c) => [c.phoneNumberId, c._count._all]));
  res.json({
    numbers: numbers.map((n) => ({ ...n, conversationCount: countBy.get(n.phoneNumberId) ?? 0 })),
  });
});

/** GET /conversations/:id/messages — thread history + marks read. */
conversationsRouter.get("/:id/messages", requirePermission("inbox.view"), async (req, res) => {
  const conv = await loadVisible(req.auth!, req.params.id);
  if (!conv) return res.status(404).json({ error: "not found" });

  const messages = await prisma.message.findMany({
    where: { conversationId: conv.id },
    orderBy: { timestamp: "asc" },
    take: 500,
  });

  if (conv.unreadCount > 0) {
    const updated = await prisma.conversation.update({
      where: { id: conv.id },
      data: { unreadCount: 0 },
    });
    emitRealtime({ tenantId: conv.tenantId, type: "conversation", conversation: updated });
  }

  res.json({ conversation: conv, messages });
});

/** POST /conversations/:id/reply — human agent reply; flips mode to HUMAN. */
const replySchema = z.object({ text: z.string().min(1) });
conversationsRouter.post("/:id/reply", async (req, res) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "text required" });

  const conv = await loadVisible(req.auth!, req.params.id);
  if (!conv) return res.status(404).json({ error: "not found" });

  const tenant = await prisma.tenant.findUnique({ where: { id: conv.tenantId } });
  if (!tenant) return res.status(404).json({ error: "tenant missing" });

  // Sending as a human takes the conversation over.
  const owned = await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      mode: "HUMAN",
      assignedUserId: conv.assignedUserId ?? req.auth!.uid,
    },
  });

  const { sendResult } = await sendReply(tenant, owned, parsed.data.text, "AGENT", req.auth!.uid);
  res.json({ ok: sendResult.ok, error: sendResult.error });
});

/** POST /conversations/:id/takeover — agent takes over from AI. */
conversationsRouter.post("/:id/takeover", async (req, res) => {
  const conv = await loadVisible(req.auth!, req.params.id);
  if (!conv) return res.status(404).json({ error: "not found" });
  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: { mode: "HUMAN", assignedUserId: conv.assignedUserId ?? req.auth!.uid },
  });
  emitRealtime({ tenantId: conv.tenantId, type: "conversation", conversation: updated });
  res.json({ conversation: updated });
});

/** POST /conversations/:id/handback — return control to AI. */
conversationsRouter.post("/:id/handback", async (req, res) => {
  const conv = await loadVisible(req.auth!, req.params.id);
  if (!conv) return res.status(404).json({ error: "not found" });
  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: { mode: "AI" },
  });
  emitRealtime({ tenantId: conv.tenantId, type: "conversation", conversation: updated });
  res.json({ conversation: updated });
});

/** PATCH /conversations/:id/labels — replace the label set. */
const labelsSchema = z.object({ labels: z.array(z.string().min(1)).max(20) });
conversationsRouter.patch("/:id/labels", async (req, res) => {
  const parsed = labelsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "labels[] required" });
  const conv = await loadVisible(req.auth!, req.params.id);
  if (!conv) return res.status(404).json({ error: "not found" });
  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: { labels: parsed.data.labels.map((l) => l.trim()).filter(Boolean) },
    include: { assignedUser: { select: { id: true, displayName: true } } },
  });
  emitRealtime({ tenantId: conv.tenantId, type: "conversation", conversation: updated });
  res.json({ conversation: updated });
});

/** GET /conversations/:id/notes — internal notes (never sent to customer). */
conversationsRouter.get("/:id/notes", requirePermission("inbox.notes"), async (req, res) => {
  const conv = await loadVisible(req.auth!, req.params.id);
  if (!conv) return res.status(404).json({ error: "not found" });
  const notes = await prisma.note.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ notes });
});

/** POST /conversations/:id/notes — add an internal note. */
const noteSchema = z.object({ body: z.string().min(1) });
conversationsRouter.post("/:id/notes", async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "body required" });
  const conv = await loadVisible(req.auth!, req.params.id);
  if (!conv) return res.status(404).json({ error: "not found" });
  const note = await prisma.note.create({
    data: {
      conversationId: conv.id,
      authorId: req.auth!.uid,
      authorName: req.auth!.username,
      body: parsed.data.body,
    },
  });
  res.status(201).json({ note });
});

/** POST /conversations/:id/assign — reassign (admin/RM within scope). */
const assignSchema = z.object({ userId: z.string().nullable() });
conversationsRouter.post("/:id/assign", async (req, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "userId required" });

  const conv = await loadVisible(req.auth!, req.params.id);
  if (!conv) return res.status(404).json({ error: "not found" });

  const allowed = await canAssignTo(req.auth!, parsed.data.userId);
  if (!allowed) return res.status(403).json({ error: "cannot assign to that user" });

  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: { assignedUserId: parsed.data.userId },
    include: { assignedUser: { select: { id: true, displayName: true } } },
  });
  emitRealtime({ tenantId: conv.tenantId, type: "conversation", conversation: updated });
  res.json({ conversation: updated });
});
