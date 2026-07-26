-- DropIndex
DROP INDEX "Asset_tenantId_idx";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "folderId" TEXT;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "buttons" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "cards" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "headerAssetId" TEXT,
ADD COLUMN     "headerType" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'standard';

-- CreateTable
CREATE TABLE "TemplateFolder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetFolder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateFolder_tenantId_name_key" ON "TemplateFolder"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AssetFolder_tenantId_name_key" ON "AssetFolder"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Asset_tenantId_folderId_idx" ON "Asset"("tenantId", "folderId");

-- CreateIndex
CREATE INDEX "Template_tenantId_folderId_idx" ON "Template"("tenantId", "folderId");

-- AddForeignKey
ALTER TABLE "TemplateFolder" ADD CONSTRAINT "TemplateFolder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "TemplateFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetFolder" ADD CONSTRAINT "AssetFolder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "AssetFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
