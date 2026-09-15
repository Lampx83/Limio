-- A6.3/A6.4 (UI) — 2 field mới cho Exam:
--   examinerInstructions — hướng dẫn phong cách/luật hỏi GV tự gõ, chèn vào
--     system prompt của AI giám khảo mỗi lượt hỏi.
--   oralRubricText — rubric chấm điểm GV tự gõ/sửa, thay thế
--     OralExamMaterial.type='rubric' (tài liệu file, khoá sau publish) vì
--     rubric chỉ ảnh hưởng cách CHẤM sau thi, không ảnh hưởng câu hỏi SV
--     nhận lúc thi — nên cần sửa được bất cứ lúc nào.
ALTER TABLE "Exam" ADD COLUMN "examinerInstructions" TEXT;
ALTER TABLE "Exam" ADD COLUMN "oralRubricText" TEXT;

-- Backfill: đề nào đã từng upload rubric dạng file thì chuyển nội dung đã
-- trích (extractedText) sang oralRubricText — lấy bản đứng đầu (orderIndex
-- nhỏ nhất) nếu lỡ có nhiều hơn 1. Không xoá row OralExamMaterial cũ (giữ
-- lịch sử), chỉ ngừng dùng nó để chấm từ nay.
UPDATE "Exam" e
SET "oralRubricText" = m."extractedText"
FROM (
  SELECT DISTINCT ON ("examId") "examId", "extractedText"
  FROM "OralExamMaterial"
  WHERE "type" = 'rubric' AND "extractedText" IS NOT NULL
  ORDER BY "examId", "orderIndex" ASC
) m
WHERE e.id = m."examId" AND e."oralRubricText" IS NULL;
