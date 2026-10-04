-- CreateEnum
CREATE TYPE "WritingFeedbackStatus" AS ENUM ('draft', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "WritingFeedback" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "WritingFeedbackStatus" NOT NULL DEFAULT 'draft',
    "submissionHash" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "level" "FeedbackLevel" NOT NULL,
    "levels" JSONB NOT NULL,
    "elaboration" "FeedbackElaboration" NOT NULL,
    "sourceKind" "FeedbackSourceKind" NOT NULL,
    "generationContext" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNote" TEXT,

    CONSTRAINT "WritingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WritingFeedback_submissionId_generatedAt_idx" ON "WritingFeedback"("submissionId", "generatedAt");

-- CreateIndex
CREATE INDEX "WritingFeedback_userId_courseId_status_idx" ON "WritingFeedback"("userId", "courseId", "status");

-- AddForeignKey
ALTER TABLE "WritingFeedback" ADD CONSTRAINT "WritingFeedback_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingFeedback" ADD CONSTRAINT "WritingFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingFeedback" ADD CONSTRAINT "WritingFeedback_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

