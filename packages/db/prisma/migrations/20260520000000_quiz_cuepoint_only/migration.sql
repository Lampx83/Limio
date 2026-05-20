-- Adds `cuepointOnly` flag so auto-created 1-question in-video cuepoint quizzes
-- can be distinguished from regular lesson quizzes (hidden from learner lesson
-- list, badged in instructor Question Bank).
ALTER TABLE "Quiz" ADD COLUMN "cuepointOnly" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Quiz_cuepointOnly_idx" ON "Quiz" ("cuepointOnly");
