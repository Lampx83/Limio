-- A5.8 M3 — Code-based exam access (P1.0).
-- Adds two new entry modes (open_code, assigned_code) alongside the existing
-- authenticated mode. ExamAttempt.userId becomes nullable so a candidate can
-- own an attempt without a User row; LearningEvent does the same so candidate
-- attempts still emit events for item analytics, while Module B/C consumers
-- filter `if (!userId) return` to skip BKT/XP updates.
--
-- Invariants enforced at DB level:
--   ExamAttempt: exactly one of (userId, candidateId) is set.
--   LearningEvent: at least one of (userId, candidateId) is set.

-- CreateEnum
CREATE TYPE "ExamAccessMode" AS ENUM ('authenticated', 'open_code', 'assigned_code');

-- DropIndex — replaced with partial unique below (Prisma can't express WHERE clauses).
DROP INDEX "ExamAttempt_examId_userId_key";

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "accessMode" "ExamAccessMode" NOT NULL DEFAULT 'authenticated',
ADD COLUMN     "openCode" TEXT,
ADD COLUMN     "openMaxAttempts" INTEGER;

-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "candidateDisplayName" TEXT,
ADD COLUMN     "candidateId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LearningEvent" ADD COLUMN     "candidateId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ExamCandidate" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "metadata" JSONB,
    "accessCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),

    CONSTRAINT "ExamCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamCandidate_examId_idx" ON "ExamCandidate"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamCandidate_examId_accessCode_key" ON "ExamCandidate"("examId", "accessCode");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_openCode_key" ON "Exam"("openCode");

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ExamCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ExamCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamCandidate" ADD CONSTRAINT "ExamCandidate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Raw SQL beyond Prisma's reach
-- ============================================================================

-- 1. ExamAttempt XOR — exactly one of userId / candidateId. Existing rows all
--    have userId set (P0 had no candidates), so the CHECK passes immediately.
ALTER TABLE "ExamAttempt"
  ADD CONSTRAINT "ExamAttempt_subject_xor"
  CHECK (
    (("userId" IS NOT NULL)::int + ("candidateId" IS NOT NULL)::int) = 1
  );

-- 2. LearningEvent: at least one subject must be set. (Both can't be set in
--    practice — emitEvent picks one — but we allow both for forward-compat.)
ALTER TABLE "LearningEvent"
  ADD CONSTRAINT "LearningEvent_subject_required"
  CHECK ("userId" IS NOT NULL OR "candidateId" IS NOT NULL);

-- 3. ExamAttempt: partial unique replaces the dropped @@unique([examId, userId]).
--    Authenticated SV: 1 user × 1 exam = 1 attempt.
--    Assigned_code candidate: 1 candidate × 1 exam = 1 attempt (Q5 resume).
--    Open_code candidate: each claim = new candidate row, so no constraint needed.
CREATE UNIQUE INDEX "ExamAttempt_examId_userId_partial_key"
  ON "ExamAttempt"("examId", "userId") WHERE "userId" IS NOT NULL;
CREATE UNIQUE INDEX "ExamAttempt_examId_candidateId_partial_key"
  ON "ExamAttempt"("examId", "candidateId") WHERE "candidateId" IS NOT NULL;

-- 4. LearningEvent: hot index for candidate-event lookup (item analytics, audit).
CREATE INDEX "LearningEvent_candidateId_occurredAt_idx"
  ON "LearningEvent"("candidateId", "occurredAt") WHERE "candidateId" IS NOT NULL;
