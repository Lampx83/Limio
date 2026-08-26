-- Cờ mục đích của đề (ExamPurpose).
--
-- Additive: mọi đề đang có nhận `assessment` nên hành vi không đổi một ly.
--
-- LƯU Ý: đã CỐ Ý gỡ 4 lệnh DROP INDEX và 3 lệnh ALTER ... DROP DEFAULT không
-- liên quan mà prisma migrate dev tự chèn (drift có sẵn giữa schema.prisma và
-- lịch sử migration). Xem ghi chú ở 20260826042359_exam_session_manual_timing.

-- CreateEnum
CREATE TYPE "ExamPurpose" AS ENUM ('assessment', 'field_test');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "purpose" "ExamPurpose" NOT NULL DEFAULT 'assessment';
