-- A6 — ngưỡng hoàn thành để nhận chứng nhận, theo từng khoá (mặc định 100% = như trước).
ALTER TABLE "Course" ADD COLUMN "certificateMinCompletionPct" INTEGER NOT NULL DEFAULT 100;

-- Sáu vi tín chỉ MICRO4ASIA (apps/web/src/lib/micro4asia.ts): học viên hoàn thành từ 90% bài học được cấp
-- chứng nhận. Máy chủ không có các khoá này thì câu lệnh không đụng hàng nào.
UPDATE "Course" SET "certificateMinCompletionPct" = 90
WHERE "slug" IN (
  'mathematical-foundations-for-data-science',
  'programming-for-data-science',
  'data-cleaning-and-preprocessing-with-python',
  'data-visualization-for-business-insights',
  'fundamental-of-machine-learning',
  'prompt-engineering'
);
