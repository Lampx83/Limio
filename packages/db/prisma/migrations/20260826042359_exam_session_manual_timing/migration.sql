-- Ca thi đóng thủ công (ExamSessionTimingMode).
--
-- Additive hoàn toàn: mọi ca đang có được gán `scheduled` nên hành vi không đổi.
-- `closesAt` nới thành nullable vì ca thủ công không có giờ đóng; ràng buộc
-- "scheduled thì bắt buộc có closesAt" nằm ở tầng application (zod), không ở DB,
-- để tránh CHECK constraint chặn dữ liệu cũ lúc migrate.
--
-- LƯU Ý: prisma migrate dev tự sinh kèm 4 lệnh DROP INDEX không liên quan
-- (Course_organizationId_idx, ExamRound_code_key, Quiz_cuepointOnly_idx,
-- User_organizationId_idx) do schema.prisma đã bỏ khai báo chúng từ trước mà
-- chưa ai sinh migration. Đã CỐ Ý gỡ khỏi đây — drift đó phải được xử lý bằng
-- một migration riêng, có review, chứ không đi ké thay đổi này.

-- CreateEnum
CREATE TYPE "ExamSessionTimingMode" AS ENUM ('scheduled', 'manual');

-- AlterTable
ALTER TABLE "ExamSchedule" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "timingMode" "ExamSessionTimingMode" NOT NULL DEFAULT 'scheduled',
ALTER COLUMN "closesAt" DROP NOT NULL;
