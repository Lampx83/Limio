-- "Thử nghiệm câu hỏi" chuyển từ GÓI ĐỀ xuống BUỔI THI.
--
-- Sinh bằng `prisma migrate diff` giữa schema ở HEAD và schema mới (xem
-- migration add_exam_reveal_policy để biết vì sao không dùng `migrate dev`).
--
-- NULL = theo gói đề, nên không backfill: mọi ca cũ giữ nguyên hành vi.

-- AlterTable
ALTER TABLE "ExamSchedule" ADD COLUMN     "purpose" "ExamPurpose";

