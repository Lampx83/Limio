-- AlterTable: số lượt tối đa mỗi người khi attemptPolicy=multi (vấn đáp AI).
ALTER TABLE "Exam" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3;

-- ExamAttempt: cho phép nhiều lượt cho cùng (đề, người dùng). Chỉ mục duy nhất cũ chặn mọi lượt thứ 2;
-- thay bằng chỉ mục chỉ áp cho lượt ĐANG LÀM DỞ — vẫn chặn mở 2 lượt song song (bấm đúp/nhiều tab),
-- còn việc "single = 1 lượt" do tầng ứng dụng kiểm (attemptPolicy).
DROP INDEX "ExamAttempt_examId_userId_partial_key";
CREATE UNIQUE INDEX "ExamAttempt_examId_userId_in_progress_key"
  ON "ExamAttempt"("examId", "userId") WHERE "userId" IS NOT NULL AND "status" = 'in_progress';
