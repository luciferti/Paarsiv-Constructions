-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "metaCategory" TEXT,
ADD COLUMN     "metaError" TEXT,
ADD COLUMN     "metaId" TEXT,
ADD COLUMN     "metaStatus" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3);
