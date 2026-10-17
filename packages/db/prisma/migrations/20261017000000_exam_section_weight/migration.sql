-- Trọng số (%) của từng Phần trong điểm chính thức của bài thi. Null = chưa đặt;
-- đề chưa đặt trọng số vẫn tính điểm theo tỉ lệ điểm như trước.
ALTER TABLE "ExamSection" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION;
