-- AlterTable
ALTER TABLE "LessonDraft" ADD COLUMN     "targetContentItemId" TEXT;

-- CreateTable
CREATE TABLE "ContentItemVersion" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentItemVersion_contentItemId_createdAt_idx" ON "ContentItemVersion"("contentItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "ContentItemVersion" ADD CONSTRAINT "ContentItemVersion_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

