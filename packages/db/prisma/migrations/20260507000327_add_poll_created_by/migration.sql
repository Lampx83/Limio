-- AlterTable
ALTER TABLE "ClassroomPoll" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "ClassroomPoll_createdById_createdAt_idx" ON "ClassroomPoll"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "ClassroomPoll" ADD CONSTRAINT "ClassroomPoll_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
