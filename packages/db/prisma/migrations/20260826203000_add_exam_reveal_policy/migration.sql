-- Chính sách lộ đáp án đặt được cho TỪNG CA THI (B-exam).
--
-- Viết tay bằng `prisma migrate diff` giữa schema ở HEAD và schema mới, KHÔNG
-- dùng `migrate dev`: DB dev đang drift, nên migrate dev chèn thêm vài DROP
-- INDEX không liên quan (đã dính mấy lần trước). Diff schema-với-schema thì
-- chỉ ra đúng thay đổi của lần này.
--
-- Cả hai cột đều NULL được, không backfill: NULL mang nghĩa "theo gói đề"
-- (Exam.showResultsAfterSubmit), nên ca cũ và bài làm cũ giữ nguyên hành vi.

-- CreateEnum
CREATE TYPE "ExamRevealPolicy" AS ENUM ('immediately', 'never', 'after_close');

-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "ExamSchedule" ADD COLUMN     "revealAnswers" "ExamRevealPolicy";

-- CreateIndex
CREATE INDEX "ExamAttempt_sessionId_idx" ON "ExamAttempt"("sessionId");

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

