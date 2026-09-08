-- B11 — mục tiêu học tập cho từng câu hỏi, phục vụ nước "feed up" của phản hồi.
-- Nullable: câu chưa có mục tiêu thì phản hồi lùi về tiêu đề bài học làm proxy.
ALTER TABLE "QuizQuestion" ADD COLUMN "learningObjective" TEXT;
