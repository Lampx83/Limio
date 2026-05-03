-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('submitted', 'graded');

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "score" INTEGER,
    "feedback" TEXT,
    "graderId" TEXT,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_lessonId_idx" ON "Assignment"("lessonId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_userId_submittedAt_idx" ON "AssignmentSubmission"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_assignmentId_status_idx" ON "AssignmentSubmission"("assignmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_userId_key" ON "AssignmentSubmission"("assignmentId", "userId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_graderId_fkey" FOREIGN KEY ("graderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
