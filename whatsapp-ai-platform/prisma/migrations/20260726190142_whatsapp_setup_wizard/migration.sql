-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "businessAddress" TEXT,
ADD COLUMN     "businessCountry" TEXT,
ADD COLUMN     "businessDescription" TEXT,
ADD COLUMN     "businessEmail" TEXT,
ADD COLUMN     "businessLegalName" TEXT,
ADD COLUMN     "businessTimezone" TEXT,
ADD COLUMN     "businessVertical" TEXT,
ADD COLUMN     "businessWebsite" TEXT,
ADD COLUMN     "setupStep" INTEGER NOT NULL DEFAULT 0;
