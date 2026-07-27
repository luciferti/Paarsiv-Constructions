-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptRun" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "durationMs" INTEGER,
    "trigger" TEXT,
    "logs" TEXT,
    "result" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Script_secret_key" ON "Script"("secret");

-- CreateIndex
CREATE INDEX "Script_tenantId_trigger_idx" ON "Script"("tenantId", "trigger");

-- CreateIndex
CREATE UNIQUE INDEX "Script_tenantId_name_key" ON "Script"("tenantId", "name");

-- CreateIndex
CREATE INDEX "ScriptRun_scriptId_createdAt_idx" ON "ScriptRun"("scriptId", "createdAt");

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptRun" ADD CONSTRAINT "ScriptRun_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;

