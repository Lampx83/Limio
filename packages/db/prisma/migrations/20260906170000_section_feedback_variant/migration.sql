-- B10 — điều kiện thực nghiệm feedback ở cấp lớp học.
-- Bảng CourseSection map sang "Cohort" (đổi tên model 2026-08-08, giữ tên bảng).
CREATE TYPE "FeedbackVariant" AS ENUM ('personalized', 'minimal');

ALTER TABLE "Cohort"
  ADD COLUMN "feedbackVariant" "FeedbackVariant" NOT NULL DEFAULT 'personalized';
