-- CreateTable
CREATE TABLE "ExternalApi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'none',
    "authName" TEXT,
    "authValue" TEXT,
    "headers" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalApi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalApiRequest" (
    "id" TEXT NOT NULL,
    "apiId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "path" TEXT NOT NULL DEFAULT '/',
    "bodyTemplate" TEXT,
    "saveTo" JSONB,
    "lastStatus" INTEGER,
    "lastError" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalApiRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalApiLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "statusCode" INTEGER,
    "durationMs" INTEGER,
    "error" TEXT,
    "requestUrl" TEXT,
    "response" TEXT,
    "ranBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalApi_tenantId_idx" ON "ExternalApi"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalApiRequest_apiId_idx" ON "ExternalApiRequest"("apiId");

-- CreateIndex
CREATE INDEX "ExternalApiLog_requestId_createdAt_idx" ON "ExternalApiLog"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExternalApi" ADD CONSTRAINT "ExternalApi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalApiRequest" ADD CONSTRAINT "ExternalApiRequest_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "ExternalApi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalApiLog" ADD CONSTRAINT "ExternalApiLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExternalApiRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

