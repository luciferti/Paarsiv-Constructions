-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "consentSource" TEXT,
ADD COLUMN     "optedInAt" TIMESTAMP(3),
ADD COLUMN     "optedOutAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "consentRules" JSONB;
