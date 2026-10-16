-- Thùng rác Hoạt động nhanh: cột nullable, chỉ thêm — không đụng dữ liệu cũ.
-- AlterTable
ALTER TABLE "ClassroomPoll" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WordCloud" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InteractiveBoard" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Whiteboard" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ClassroomPoll_deletedAt_idx" ON "ClassroomPoll"("deletedAt");

-- CreateIndex
CREATE INDEX "WordCloud_deletedAt_idx" ON "WordCloud"("deletedAt");

-- CreateIndex
CREATE INDEX "InteractiveBoard_deletedAt_idx" ON "InteractiveBoard"("deletedAt");

-- CreateIndex
CREATE INDEX "Whiteboard_deletedAt_idx" ON "Whiteboard"("deletedAt");

