-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Journey" ADD COLUMN     "phoneNumberId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "eventsReceived" INTEGER NOT NULL DEFAULT 0,
    "contactsUpserted" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorEvent" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "summary" TEXT,
    "error" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Connector_secret_key" ON "Connector"("secret");

-- CreateIndex
CREATE INDEX "Connector_tenantId_idx" ON "Connector"("tenantId");

-- CreateIndex
CREATE INDEX "ConnectorEvent_connectorId_createdAt_idx" ON "ConnectorEvent"("connectorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorEvent" ADD CONSTRAINT "ConnectorEvent_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

