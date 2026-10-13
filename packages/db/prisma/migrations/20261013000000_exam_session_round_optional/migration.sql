-- Đợt thi chỉ dành cho kỳ thi chính thức. Link thi nhanh, thử nghiệm câu hỏi và
-- vấn đáp là buổi đơn, không có đợt → ExamSchedule.roundId thành nullable.
--
-- Mã vào thi trở thành duy nhất TOÀN HỆ THỐNG (trước đây chỉ trong một đợt).
-- Dừng ngay nếu đã có mã trùng, thay vì để CREATE UNIQUE INDEX lỗi giữa chừng.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ExamSchedule"
    WHERE "openCode" IS NOT NULL
    GROUP BY "openCode"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'ExamSchedule có openCode trùng — xử lý trước khi chạy migration này';
  END IF;
END $$;

-- DropIndex
DROP INDEX "ExamSchedule_roundId_openCode_key";

-- AlterTable
ALTER TABLE "ExamSchedule" ALTER COLUMN "roundId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ExamSchedule_openCode_key" ON "ExamSchedule"("openCode");
