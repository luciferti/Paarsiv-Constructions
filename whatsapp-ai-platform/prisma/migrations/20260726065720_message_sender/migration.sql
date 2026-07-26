-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "senderId" TEXT;

-- CreateIndex
CREATE INDEX "Message_tenantId_senderId_idx" ON "Message"("tenantId", "senderId");
