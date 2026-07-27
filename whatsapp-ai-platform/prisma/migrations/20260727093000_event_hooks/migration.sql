-- CreateTable
CREATE TABLE "EventHook" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "failStreak" INTEGER NOT NULL DEFAULT 0,
    "lastDeliveryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventHook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDelivery" (
    "id" TEXT NOT NULL,
    "hookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusCode" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventHook_tenantId_idx" ON "EventHook"("tenantId");

-- CreateIndex
CREATE INDEX "EventDelivery_hookId_createdAt_idx" ON "EventDelivery"("hookId", "createdAt");

-- AddForeignKey
ALTER TABLE "EventHook" ADD CONSTRAINT "EventHook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDelivery" ADD CONSTRAINT "EventDelivery_hookId_fkey" FOREIGN KEY ("hookId") REFERENCES "EventHook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

