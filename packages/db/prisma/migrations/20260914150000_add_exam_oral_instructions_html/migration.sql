-- A6.6 (UI) — hướng dẫn/thông báo richtext của GV, hiện ở panel bên phải
-- phòng vấn đáp. Chỉ có ý nghĩa khi kind=oral.
ALTER TABLE "Exam" ADD COLUMN "oralInstructionsHtml" TEXT;
