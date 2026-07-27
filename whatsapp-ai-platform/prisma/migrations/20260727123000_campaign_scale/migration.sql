-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "cursor" TEXT,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "rateLimit" INTEGER NOT NULL DEFAULT 20;

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_contactId_key" ON "CampaignRecipient"("campaignId", "contactId");

