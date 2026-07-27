import { prisma } from "../lib/prisma";
import { resumeInterruptedCampaigns, runCampaign } from "./campaigns";

const POLL_MS = 60_000;

/**
 * Simple in-process scheduler: every minute, pick up SCHEDULED campaigns whose
 * time has come and send them. (A BullMQ/Redis queue can replace this later
 * without changing the API surface.)
 */
export function startScheduler() {
  // A deploy or crash mid-send would otherwise strand a campaign in SENDING
  // forever; each one carries on from the cursor it last wrote.
  resumeInterruptedCampaigns().catch((e) =>
    console.error("[scheduler] resume sweep failed:", e?.message || e)
  );

  setInterval(async () => {
    try {
      const due = await prisma.campaign.findMany({
        where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
        take: 10,
      });
      for (const c of due) {
        const tenant = await prisma.tenant.findUnique({ where: { id: c.tenantId } });
        if (!tenant) continue;
        console.log(`[scheduler] sending due campaign "${c.name}" (${c.id})`);
        // Mark SENDING immediately so the next tick can't pick it up again.
        await prisma.campaign.update({ where: { id: c.id }, data: { status: "SENDING" } });
        runCampaign(tenant, c.id).catch((e) =>
          console.error("[scheduler] campaign run error:", e?.message || e)
        );
      }
    } catch (e: any) {
      console.error("[scheduler] poll error:", e?.message || e);
    }
  }, POLL_MS);
  console.log("[scheduler] campaign scheduler started (60s poll)");
}
