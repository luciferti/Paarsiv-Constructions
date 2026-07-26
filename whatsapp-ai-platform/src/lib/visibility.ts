import { prisma } from "./prisma";
import type { AuthPayload } from "./jwt";
import type { Prisma } from "@prisma/client";

/**
 * Build a Prisma `where` fragment restricting which conversations a user may see.
 *  - ADMIN : all conversations in the tenant (incl. unassigned / AI-owned)
 *  - RM    : own conversations + those assigned to direct-report SALES users
 *  - SALES : only conversations assigned to self
 */
export async function conversationVisibilityWhere(
  auth: AuthPayload
): Promise<Prisma.ConversationWhereInput> {
  const base: Prisma.ConversationWhereInput = { tenantId: auth.tenantId };

  if (auth.role === "ADMIN") return base;

  if (auth.role === "RM") {
    const reports = await prisma.user.findMany({
      where: { tenantId: auth.tenantId, managerId: auth.uid },
      select: { id: true },
    });
    const ids = [auth.uid, ...reports.map((r) => r.id)];
    return { ...base, assignedUserId: { in: ids } };
  }

  // SALES
  return { ...base, assignedUserId: auth.uid };
}

/** Can `auth` (re)assign a conversation to user `targetUserId`? */
export async function canAssignTo(
  auth: AuthPayload,
  targetUserId: string | null
): Promise<boolean> {
  if (auth.role === "SALES") return false; // sales can't reassign
  if (auth.role === "ADMIN") return true;
  // RM: only within own team (self or a direct report), or unassign
  if (targetUserId === null || targetUserId === auth.uid) return true;
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, tenantId: auth.tenantId, managerId: auth.uid },
    select: { id: true },
  });
  return !!target;
}
