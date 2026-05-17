-- Email Dispatch — review-before-send queue for bulk emails.
-- A Batch represents one "send session" (e.g. send exam codes to one
-- exam's candidates). Items are per-recipient rows the reviewer can
-- untick before approving. After approval, the API sends each selected
-- item and records sent/failed outcomes.

CREATE TYPE "EmailDispatchStatus" AS ENUM ('draft', 'sending', 'completed', 'cancelled');
CREATE TYPE "EmailDispatchItemStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

CREATE TABLE "EmailDispatchBatch" (
    "id"               TEXT NOT NULL,
    "organizationId"   TEXT,
    "templateKey"      TEXT NOT NULL,
    "targetType"       TEXT NOT NULL,
    "targetId"         TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "description"      TEXT,
    "status"           "EmailDispatchStatus" NOT NULL DEFAULT 'draft',
    "totalItems"       INTEGER NOT NULL DEFAULT 0,
    "sentCount"        INTEGER NOT NULL DEFAULT 0,
    "failedCount"      INTEGER NOT NULL DEFAULT 0,
    "skippedCount"     INTEGER NOT NULL DEFAULT 0,
    "createdByUserId"  TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt"       TIMESTAMP(3),
    "completedAt"      TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDispatchBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailDispatchBatch_organizationId_createdAt_idx"
    ON "EmailDispatchBatch"("organizationId", "createdAt");
CREATE INDEX "EmailDispatchBatch_targetType_targetId_idx"
    ON "EmailDispatchBatch"("targetType", "targetId");
CREATE INDEX "EmailDispatchBatch_createdByUserId_createdAt_idx"
    ON "EmailDispatchBatch"("createdByUserId", "createdAt");
CREATE INDEX "EmailDispatchBatch_status_idx" ON "EmailDispatchBatch"("status");

ALTER TABLE "EmailDispatchBatch"
    ADD CONSTRAINT "EmailDispatchBatch_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailDispatchBatch"
    ADD CONSTRAINT "EmailDispatchBatch_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmailDispatchBatch"
    ADD CONSTRAINT "EmailDispatchBatch_approvedByUserId_fkey"
    FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmailDispatchItem" (
    "id"             TEXT NOT NULL,
    "batchId"        TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName"  TEXT NOT NULL,
    "variables"      JSONB NOT NULL,
    "sourceType"     TEXT,
    "sourceId"       TEXT,
    "selected"       BOOLEAN NOT NULL DEFAULT true,
    "status"         "EmailDispatchItemStatus" NOT NULL DEFAULT 'pending',
    "errorMessage"   TEXT,
    "attemptCount"   INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt"  TIMESTAMP(3),
    "sentAt"         TIMESTAMP(3),
    "providerId"     TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDispatchItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailDispatchItem_batchId_status_idx"
    ON "EmailDispatchItem"("batchId", "status");
CREATE INDEX "EmailDispatchItem_sourceType_sourceId_idx"
    ON "EmailDispatchItem"("sourceType", "sourceId");

ALTER TABLE "EmailDispatchItem"
    ADD CONSTRAINT "EmailDispatchItem_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "EmailDispatchBatch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
