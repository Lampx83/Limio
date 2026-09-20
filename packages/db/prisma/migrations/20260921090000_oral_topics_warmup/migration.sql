-- A6.7 — Vấn đáp AI: pha khởi động tách riêng + chủ đề giao cho từng sinh viên.
-- Chỉ THÊM (cột mặc định false/NULL, bảng mới) nên an toàn với dữ liệu hiện có.

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "oralWarmup" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "oralTopicId" TEXT;

-- CreateTable
CREATE TABLE "OralExamTopic" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OralExamTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OralExamTopic_examId_orderIndex_idx" ON "OralExamTopic"("examId", "orderIndex");

-- CreateIndex
CREATE INDEX "ExamAttempt_oralTopicId_idx" ON "ExamAttempt"("oralTopicId");

-- AddForeignKey
ALTER TABLE "OralExamTopic" ADD CONSTRAINT "OralExamTopic_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_oralTopicId_fkey" FOREIGN KEY ("oralTopicId") REFERENCES "OralExamTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

