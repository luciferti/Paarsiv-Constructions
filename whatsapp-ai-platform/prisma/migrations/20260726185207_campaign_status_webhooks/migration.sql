-- AlterTable
ALTER TABLE "CampaignRecipient" ADD COLUMN     "waMessageId" TEXT;

-- CreateIndex
CREATE INDEX "CampaignRecipient_waMessageId_idx" ON "CampaignRecipient"("waMessageId");
