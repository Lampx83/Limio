-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "ExamRoundStatus" AS ENUM ('draft', 'open', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "ExamSessionStatus" AS ENUM ('draft', 'open', 'closed', 'archived');

-- AlterTable
ALTER TABLE "ExamCandidate" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "ExamRoom" ADD COLUMN     "orderIndex" INTEGER,
ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "ExamSchedule" ADD COLUMN     "code" TEXT,
ADD COLUMN     "roundId" TEXT,
ADD COLUMN     "status" "ExamSessionStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "ExamRound" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "status" "ExamRoundStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamRoundCourse" (
    "roundId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamRoundCourse_pkey" PRIMARY KEY ("roundId","courseId")
);

-- CreateTable
CREATE TABLE "ExamRoundAdmin" (
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,

    CONSTRAINT "ExamRoundAdmin_pkey" PRIMARY KEY ("roundId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamRound_code_key" ON "ExamRound"("code");

-- CreateIndex
CREATE INDEX "ExamRound_opensAt_idx" ON "ExamRound"("opensAt");

-- CreateIndex
CREATE INDEX "ExamRound_status_opensAt_idx" ON "ExamRound"("status", "opensAt");

-- CreateIndex
CREATE INDEX "ExamRoundCourse_courseId_idx" ON "ExamRoundCourse"("courseId");

-- CreateIndex
CREATE INDEX "ExamRoundAdmin_userId_idx" ON "ExamRoundAdmin"("userId");

-- CreateIndex
CREATE INDEX "ExamCandidate_sessionId_idx" ON "ExamCandidate"("sessionId");

-- CreateIndex
CREATE INDEX "ExamCandidate_userId_idx" ON "ExamCandidate"("userId");

-- CreateIndex
CREATE INDEX "ExamRoom_sessionId_idx" ON "ExamRoom"("sessionId");

-- CreateIndex
CREATE INDEX "ExamSchedule_roundId_opensAt_idx" ON "ExamSchedule"("roundId", "opensAt");

-- AddForeignKey
ALTER TABLE "ExamCandidate" ADD CONSTRAINT "ExamCandidate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamCandidate" ADD CONSTRAINT "ExamCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRoom" ADD CONSTRAINT "ExamRoom_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ExamRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRoundCourse" ADD CONSTRAINT "ExamRoundCourse_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ExamRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRoundCourse" ADD CONSTRAINT "ExamRoundCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRoundAdmin" ADD CONSTRAINT "ExamRoundAdmin_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ExamRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRoundAdmin" ADD CONSTRAINT "ExamRoundAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRoundAdmin" ADD CONSTRAINT "ExamRoundAdmin_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

