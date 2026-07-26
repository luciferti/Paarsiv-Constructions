-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "altPhones" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "mergeRules" JSONB;
