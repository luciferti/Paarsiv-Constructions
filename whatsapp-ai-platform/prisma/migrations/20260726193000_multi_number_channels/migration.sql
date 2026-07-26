-- DropIndex
DROP INDEX "Conversation_tenantId_phone_key";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "phoneNumberId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "phoneNumberId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "PhoneNumber" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT,
    "displayPhoneNumber" TEXT NOT NULL,
    "verifiedName" TEXT,
    "qualityRating" TEXT,
    "messagingLimit" TEXT,
    "codeVerificationStatus" TEXT,
    "label" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNumber_phoneNumberId_key" ON "PhoneNumber"("phoneNumberId");

-- CreateIndex
CREATE INDEX "PhoneNumber_tenantId_idx" ON "PhoneNumber"("tenantId");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_phoneNumberId_idx" ON "Conversation"("tenantId", "phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_tenantId_phoneNumberId_phone_key" ON "Conversation"("tenantId", "phoneNumberId", "phone");

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

