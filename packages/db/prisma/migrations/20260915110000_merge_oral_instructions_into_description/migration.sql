-- A6.6 (UI) — gộp Exam.oralInstructionsHtml vào Exam.description: 2 field
-- trùng mục đích cho đề vấn đáp (mô tả chung vs hướng dẫn hiện trong phòng
-- vấn đáp), gây nhầm lẫn GV điền nhầm chỗ. Từ nay description vừa là mô tả
-- chung vừa là nội dung hiện ở panel phòng vấn đáp khi kind=oral.
--
-- Backfill trước khi xoá cột: nếu đề nào đã có oralInstructionsHtml mà chưa
-- có description, chuyển nội dung đó sang description để không mất dữ liệu.
-- Đề nào đã có SẴN description thì giữ nguyên (không ghi đè) — chấp nhận
-- oralInstructionsHtml của đề đó bị bỏ, vì hệ thống đang ở giai đoạn thử
-- nghiệm, số đề có cả 2 field cùng lúc rất ít.
UPDATE "Exam"
SET "description" = "oralInstructionsHtml"
WHERE "oralInstructionsHtml" IS NOT NULL
  AND ("description" IS NULL OR "description" = '');

ALTER TABLE "Exam" DROP COLUMN "oralInstructionsHtml";
