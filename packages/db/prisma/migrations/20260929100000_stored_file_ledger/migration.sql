-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "contentType" TEXT,
    "kind" TEXT NOT NULL,
    "uploaderUserId" TEXT,
    "billedUserId" TEXT,
    "courseId" TEXT,
    "attribution" TEXT,
    "attributedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoredFile_billedUserId_deletedAt_idx" ON "StoredFile"("billedUserId", "deletedAt");

-- CreateIndex
CREATE INDEX "StoredFile_uploaderUserId_idx" ON "StoredFile"("uploaderUserId");

-- CreateIndex
CREATE INDEX "StoredFile_kind_deletedAt_idx" ON "StoredFile"("kind", "deletedAt");

-- CreateIndex
CREATE INDEX "StoredFile_courseId_idx" ON "StoredFile"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_layer_key_key" ON "StoredFile"("layer", "key");

