import { prisma } from "../lib/prisma";
import { listPhoneNumbers } from "./metaOnboarding";
import type { PhoneNumber, Tenant } from "@prisma/client";

/**
 * The workspace's WhatsApp senders.
 *
 * A workspace can own several numbers — Sales, Support, a second brand — and
 * each one is its own channel: its own conversations, its own 24-hour windows,
 * its own quality rating. Inbound is routed by Meta's `phone_number_id`, and
 * an outbound message always leaves from the number its conversation is on.
 */

/** Pull the numbers off the connected account and mirror them locally. */
export async function syncNumbers(tenant: Tenant): Promise<PhoneNumber[]> {
  if (!tenant.whatsappToken || !tenant.wabaId) return activeNumbers(tenant.id);

  const remote = await listPhoneNumbers(tenant, tenant.whatsappToken, tenant.wabaId);
  const existing = await prisma.phoneNumber.findMany({ where: { tenantId: tenant.id } });
  const hasDefault = existing.some((n) => n.isDefault);

  for (const [i, n] of remote.entries()) {
    const fields = {
      wabaId: tenant.wabaId,
      displayPhoneNumber: n.displayPhoneNumber,
      verifiedName: n.verifiedName || null,
      qualityRating: n.qualityRating || null,
      messagingLimit: n.messagingLimit || null,
      codeVerificationStatus: n.codeVerificationStatus || null,
    };
    await prisma.phoneNumber.upsert({
      where: { phoneNumberId: n.id },
      update: fields,
      create: {
        tenantId: tenant.id,
        phoneNumberId: n.id,
        ...fields,
        // First number in becomes the default so sending always has a home.
        isDefault: !hasDefault && i === 0,
      },
    });
  }

  // A number removed in Meta is deactivated, not deleted — its conversations
  // and campaign history have to stay readable.
  const remoteIds = new Set(remote.map((n) => n.id));
  await prisma.phoneNumber.updateMany({
    where: { tenantId: tenant.id, phoneNumberId: { notIn: [...remoteIds] } },
    data: { active: false },
  });

  return activeNumbers(tenant.id);
}

export function activeNumbers(tenantId: string) {
  return prisma.phoneNumber.findMany({
    where: { tenantId, active: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

/** The number to use when nothing more specific is known. */
export async function defaultNumber(tenantId: string): Promise<PhoneNumber | null> {
  const rows = await activeNumbers(tenantId);
  return rows.find((n) => n.isDefault) || rows[0] || null;
}

/** Exactly one default per workspace. */
export async function setDefault(tenantId: string, phoneNumberId: string) {
  await prisma.$transaction([
    prisma.phoneNumber.updateMany({ where: { tenantId }, data: { isDefault: false } }),
    prisma.phoneNumber.updateMany({ where: { tenantId, phoneNumberId }, data: { isDefault: true } }),
  ]);
}

/**
 * Resolve which of our numbers an outbound message leaves from.
 * `preferred` wins when it's ours and active; otherwise the default.
 */
export async function resolveSender(
  tenantId: string,
  preferred?: string | null
): Promise<PhoneNumber | null> {
  if (preferred) {
    const n = await prisma.phoneNumber.findFirst({
      where: { tenantId, phoneNumberId: preferred, active: true },
    });
    if (n) return n;
  }
  return defaultNumber(tenantId);
}

/**
 * What `sendWhatsAppText` needs: a specific number plus the tenant's token.
 * Falls back to the tenant's own field so a workspace that never ran the
 * multi-number sync still sends.
 */
export function senderCredentials(tenant: Tenant, number: PhoneNumber | null) {
  return {
    phoneNumberId: number?.phoneNumberId || tenant.phoneNumberId,
    whatsappToken: tenant.whatsappToken,
    graphVersion: tenant.graphVersion,
  };
}

/** Human label for a number, for badges and pickers. */
export function numberLabel(n: Pick<PhoneNumber, "label" | "displayPhoneNumber" | "verifiedName">) {
  return n.label || n.verifiedName || n.displayPhoneNumber;
}
