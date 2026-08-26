-- Quy mô tổ chức của một lần thi (ExamSessionScale).
--
-- Additive. Mặc định `formal` cho ca CŨ: chúng đều sinh ra từ đường đợt/ca/phòng
-- nên xếp vào kỳ thi là đúng. Ca tạo bằng "Phát link" ghi `simple` tường minh.
--
-- LƯU Ý: đã CỐ Ý gỡ các lệnh DROP INDEX / ALTER ... DROP DEFAULT không liên quan
-- mà prisma migrate dev tự chèn (drift có sẵn). Xem ghi chú ở
-- 20260826042359_exam_session_manual_timing.

-- CreateEnum
CREATE TYPE "ExamSessionScale" AS ENUM ('simple', 'formal');

-- AlterTable
ALTER TABLE "ExamSchedule" ADD COLUMN     "scale" "ExamSessionScale" NOT NULL DEFAULT 'formal';
