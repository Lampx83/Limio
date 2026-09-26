-- CreateTable
CREATE TABLE "EmailSendLog" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT,
    "toDomain" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailSendLog_createdAt_idx" ON "EmailSendLog"("createdAt");

-- CreateIndex
CREATE INDEX "EmailSendLog_templateKey_createdAt_idx" ON "EmailSendLog"("templateKey", "createdAt");

