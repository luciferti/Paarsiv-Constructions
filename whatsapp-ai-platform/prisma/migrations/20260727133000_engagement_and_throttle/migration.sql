-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "deliveredCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastCampaignAt" TIMESTAMP(3),
ADD COLUMN     "lastDeliveredAt" TIMESTAMP(3),
ADD COLUMN     "lastInboundAt" TIMESTAMP(3),
ADD COLUMN     "readCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "repliedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "sendRateLimit" INTEGER NOT NULL DEFAULT 60;

-- CreateIndex
CREATE INDEX "Contact_tenantId_createdAt_idx" ON "Contact"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Contact_tenantId_deliveredCount_idx" ON "Contact"("tenantId", "deliveredCount");

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

