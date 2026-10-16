-- Giới hạn số thí sinh theo từng ca (trước đây chỉ có trần theo cả đề:
-- Exam.openMaxAttempts, cộng dồn qua mọi ca và không có chỗ cài trên giao diện).
ALTER TABLE "ExamSchedule" ADD COLUMN IF NOT EXISTS "maxCandidates" INTEGER;

-- Giữ nguyên ý định cũ: ca mã chung của đề đang có trần thì mang trần đó sang ca.
UPDATE "ExamSchedule" s
SET "maxCandidates" = e."openMaxAttempts"
FROM "Exam" e
WHERE s."examId" = e."id"
  AND s."accessMode" = 'open_code'
  AND e."openMaxAttempts" IS NOT NULL
  AND s."maxCandidates" IS NULL;
