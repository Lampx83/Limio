-- CreateEnum
CREATE TYPE "ExamPracticeStatus" AS ENUM ('in_progress', 'completed', 'abandoned');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "allowPractice" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ExamPracticeSession" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ExamPracticeStatus" NOT NULL DEFAULT 'in_progress',
    "scope" JSONB NOT NULL,
    "checkEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExamPracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamPracticeAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerJson" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "score" DOUBLE PRECISION,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamPracticeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamPracticeSession_userId_examId_status_idx" ON "ExamPracticeSession"("userId", "examId", "status");

-- CreateIndex
CREATE INDEX "ExamPracticeAnswer_questionId_idx" ON "ExamPracticeAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamPracticeAnswer_sessionId_questionId_key" ON "ExamPracticeAnswer"("sessionId", "questionId");

-- AddForeignKey
ALTER TABLE "ExamPracticeSession" ADD CONSTRAINT "ExamPracticeSession_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPracticeSession" ADD CONSTRAINT "ExamPracticeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPracticeAnswer" ADD CONSTRAINT "ExamPracticeAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamPracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPracticeAnswer" ADD CONSTRAINT "ExamPracticeAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Mỗi người tối đa MỘT buổi luyện đang làm dở cho mỗi đề (bấm đúp / nhiều tab không tạo hai buổi).
-- Prisma không mô hình hoá chỉ mục duy nhất có điều kiện nên viết tay (như ExamAttempt).
CREATE UNIQUE INDEX "ExamPracticeSession_userId_examId_in_progress_key"
  ON "ExamPracticeSession"("userId", "examId") WHERE "status" = 'in_progress';
