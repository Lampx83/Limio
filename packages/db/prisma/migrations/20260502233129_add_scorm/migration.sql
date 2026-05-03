-- AlterEnum
ALTER TYPE "ContentType" ADD VALUE 'scorm';

-- CreateTable
CREATE TABLE "ScormPackage" (
    "id" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.2',
    "title" TEXT NOT NULL,
    "entryHref" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScormPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScormAttempt" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "lessonId" TEXT,
    "lessonStatus" TEXT NOT NULL DEFAULT 'not attempted',
    "completionStatus" TEXT,
    "scoreRaw" DOUBLE PRECISION,
    "scoreMin" DOUBLE PRECISION,
    "scoreMax" DOUBLE PRECISION,
    "suspendData" TEXT,
    "location" TEXT,
    "totalTime" TEXT,
    "lastCommitAt" TIMESTAMP(3),
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScormAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScormPackage_uploaderId_uploadedAt_idx" ON "ScormPackage"("uploaderId", "uploadedAt");

-- CreateIndex
CREATE INDEX "ScormAttempt_userId_updatedAt_idx" ON "ScormAttempt"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ScormAttempt_packageId_finished_idx" ON "ScormAttempt"("packageId", "finished");

-- CreateIndex
CREATE UNIQUE INDEX "ScormAttempt_packageId_userId_key" ON "ScormAttempt"("packageId", "userId");

-- AddForeignKey
ALTER TABLE "ScormPackage" ADD CONSTRAINT "ScormPackage_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScormAttempt" ADD CONSTRAINT "ScormAttempt_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ScormPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScormAttempt" ADD CONSTRAINT "ScormAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
