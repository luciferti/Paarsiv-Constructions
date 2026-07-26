-- AlterTable
ALTER TABLE "Segment" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "SegmentFolder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SegmentFolder_tenantId_name_key" ON "SegmentFolder"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Segment_tenantId_folderId_idx" ON "Segment"("tenantId", "folderId");

-- AddForeignKey
ALTER TABLE "SegmentFolder" ADD CONSTRAINT "SegmentFolder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "SegmentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
