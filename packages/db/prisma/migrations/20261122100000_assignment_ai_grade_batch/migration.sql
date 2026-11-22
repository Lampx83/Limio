-- CreateEnum
CREATE TYPE "AiGradeBatchStatus" AS ENUM ('running', 'completed', 'stopped', 'halted');

-- CreateTable
CREATE TABLE "AssignmentAiGradeSuggestion" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "criteria" JSONB,
    "hadRubric" BOOLEAN NOT NULL DEFAULT false,
    "readSources" JSONB,
    "unread" JSONB,
    "truncated" JSONB,
    "tokensUsed" INTEGER,
    "basedOnSubmissionUpdatedAt" TIMESTAMP(3) NOT NULL,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentAiGradeSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentAiGradeBatch" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "status" "AiGradeBatchStatus" NOT NULL DEFAULT 'running',
    "queue" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "done" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "stopRequested" BOOLEAN NOT NULL DEFAULT false,
    "haltReason" TEXT,
    "problems" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AssignmentAiGradeBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentAiGradeSuggestion_submissionId_key" ON "AssignmentAiGradeSuggestion"("submissionId");

-- CreateIndex
CREATE INDEX "AssignmentAiGradeSuggestion_assignmentId_idx" ON "AssignmentAiGradeSuggestion"("assignmentId");

-- CreateIndex
CREATE INDEX "AssignmentAiGradeBatch_assignmentId_status_idx" ON "AssignmentAiGradeBatch"("assignmentId", "status");

-- AddForeignKey
ALTER TABLE "AssignmentAiGradeSuggestion" ADD CONSTRAINT "AssignmentAiGradeSuggestion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentAiGradeSuggestion" ADD CONSTRAINT "AssignmentAiGradeSuggestion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentAiGradeBatch" ADD CONSTRAINT "AssignmentAiGradeBatch_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentAiGradeBatch" ADD CONSTRAINT "AssignmentAiGradeBatch_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tối đa MỘT lượt chấm hàng loạt đang chạy cho mỗi bài tập. Prisma không diễn đạt được chỉ mục duy nhất
-- từng phần nên nằm ở SQL thô (cùng loại với các CHECK ở CLAUDE.md/memory: dựng bằng `db push` thì thiếu).
CREATE UNIQUE INDEX "AssignmentAiGradeBatch_one_running_per_assignment" ON "AssignmentAiGradeBatch"("assignmentId") WHERE "status" = 'running';
