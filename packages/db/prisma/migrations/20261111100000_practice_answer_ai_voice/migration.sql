-- Câu mở trong Bài luyện: góp ý AI + bản ghi âm cuối của học viên.
ALTER TABLE "ExamPracticeAnswer" ADD COLUMN "aiFeedback" JSONB;
ALTER TABLE "ExamPracticeAnswer" ADD COLUMN "aiFeedbackHash" TEXT;
ALTER TABLE "ExamPracticeAnswer" ADD COLUMN "aiFeedbackAt" TIMESTAMP(3);
ALTER TABLE "ExamPracticeAnswer" ADD COLUMN "audioKey" TEXT;
ALTER TABLE "ExamPracticeAnswer" ADD COLUMN "audioMeta" JSONB;
