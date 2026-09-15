-- A6.3/A6.6 — Exam.language: ngôn ngữ hỏi-đáp buổi vấn đáp, khai báo tường
-- minh thay vì để AI đoán từ câu trả lời SV (câu hỏi mở màn chưa có gì để
-- đoán — đã gặp lỗi trộn tiếng Anh/Việt thật khi test). Mặc định 'vi' vì
-- toàn bộ đề vấn đáp hiện có đều tiếng Việt.
CREATE TYPE "OralExamLanguage" AS ENUM ('vi', 'en');

ALTER TABLE "Exam" ADD COLUMN "language" "OralExamLanguage" NOT NULL DEFAULT 'vi';
