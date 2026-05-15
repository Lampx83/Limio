-- CreateEnum
CREATE TYPE "ProctorSnapshotKind" AS ENUM ('periodic', 'on_event');

-- CreateTable
CREATE TABLE "AttemptProctorSnapshot" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "kind" "ProctorSnapshotKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "sizeBytes" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "AttemptProctorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttemptProctorSnapshot_attemptId_capturedAt_idx" ON "AttemptProctorSnapshot"("attemptId", "capturedAt");

-- AddForeignKey
ALTER TABLE "AttemptProctorSnapshot" ADD CONSTRAINT "AttemptProctorSnapshot_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptProctorSnapshot" ADD CONSTRAINT "AttemptProctorSnapshot_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

