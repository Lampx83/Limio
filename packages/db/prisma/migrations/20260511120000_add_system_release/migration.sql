-- CreateTable
CREATE TABLE "SystemRelease" (
    "id"         TEXT          NOT NULL,
    "tag"        TEXT          NOT NULL,
    "sha"        TEXT          NOT NULL,
    "body"       TEXT          NOT NULL,
    "deployedAt" TIMESTAMP(3)  NOT NULL,
    "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemRelease_tag_key" ON "SystemRelease"("tag");

-- CreateIndex
CREATE INDEX "SystemRelease_deployedAt_idx" ON "SystemRelease"("deployedAt");
