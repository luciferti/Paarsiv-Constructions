import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { conversationVisibilityWhere } from "../lib/visibility";
import { assistConversation } from "../ai/assist";

export const aiAssistRouter = Router();
aiAssistRouter.use(requireAuth);

/** POST /ai/assist — summary + sentiment + intent + suggested replies. */
aiAssistRouter.post("/assist", async (req, res) => {
  const conversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId : "";
  if (!conversationId) return res.status(400).json({ error: "conversationId required" });

  // Respect role visibility — an agent can only analyze threads they can see.
  const where = await conversationVisibilityWhere(req.auth!);
  const conv = await prisma.conversation.findFirst({ where: { ...where, id: conversationId } });
  if (!conv) return res.status(404).json({ error: "not found" });

  const tenant = await prisma.tenant.findUnique({ where: { id: req.auth!.tenantId } });
  if (!tenant) return res.status(404).json({ error: "tenant missing" });

  const result = await assistConversation(tenant, conv.id);
  if (!result) return res.status(404).json({ error: "no messages" });
  res.json(result);
});
