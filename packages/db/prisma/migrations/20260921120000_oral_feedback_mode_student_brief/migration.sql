-- A6.8 — Vấn đáp AI: chế độ phản hồi, tóm tắt cuối buổi, thẻ tình huống cho sinh viên. Chỉ THÊM (mặc định an toàn).

-- CreateEnum
CREATE TYPE "OralFeedbackMode" AS ENUM ('exam', 'coaching');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "oralClosingSummary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "oralFeedbackMode" "OralFeedbackMode" NOT NULL DEFAULT 'exam';

-- AlterTable
ALTER TABLE "OralExamTopic" ADD COLUMN     "studentBrief" TEXT;

