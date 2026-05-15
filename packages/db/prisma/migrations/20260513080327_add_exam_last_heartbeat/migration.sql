-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ExamAttempt_status_lastHeartbeatAt_idx" ON "ExamAttempt"("status", "lastHeartbeatAt");
