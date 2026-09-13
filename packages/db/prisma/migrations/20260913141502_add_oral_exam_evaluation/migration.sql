-- CreateEnum
CREATE TYPE "OralExamEvaluationStatus" AS ENUM ('pending_review', 'approved', 'overridden');

-- CreateTable
CREATE TABLE "OralExamEvaluation" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "aiSuggestedScore" DOUBLE PRECISION,
    "aiRubricBreakdown" JSONB,
    "aiSummary" TEXT,
    "instructorScore" DOUBLE PRECISION,
    "instructorNotes" TEXT,
    "status" "OralExamEvaluationStatus" NOT NULL DEFAULT 'pending_review',
    "gradedAt" TIMESTAMP(3),
    "gradedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OralExamEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OralExamEvaluation_attemptId_key" ON "OralExamEvaluation"("attemptId");

-- AddForeignKey
ALTER TABLE "OralExamEvaluation" ADD CONSTRAINT "OralExamEvaluation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OralExamEvaluation" ADD CONSTRAINT "OralExamEvaluation_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

