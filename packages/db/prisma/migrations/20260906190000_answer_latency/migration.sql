-- B12 — thời gian thật của từng câu, tách khỏi responseTimeMs (vốn là thời
-- gian cộng dồn từ lúc bắt đầu cả lượt làm bài).
-- Nullable có chủ ý: hàng trước B12 không có số đo này, và không được làm cho
-- giống như đã có.
ALTER TABLE "AnswerResponse" ADD COLUMN "latencyMs" INTEGER;
ALTER TABLE "AnswerResponse" ADD COLUMN "revisionCount" INTEGER NOT NULL DEFAULT 0;
