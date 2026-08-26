-- Lịch sử thử nghiệm câu hỏi (ItemTrialStat).
--
-- Bảng mới hoàn toàn, không đụng dữ liệu đang có.
--
-- LƯU Ý: đã CỐ Ý gỡ các lệnh DROP INDEX / ALTER ... DROP DEFAULT không liên
-- quan mà prisma migrate dev tự chèn (drift có sẵn giữa schema.prisma và lịch
-- sử migration). Xem ghi chú ở 20260826042359_exam_session_manual_timing.

-- CreateTable
CREATE TABLE "ItemTrialStat" (
    "examQuestionId" TEXT NOT NULL,
    "bankQuestionId" TEXT NOT NULL,
    "bankQuestionVersionId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "roundId" TEXT,
    "trialLabel" TEXT,
    "attemptCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "pValue" DOUBLE PRECISION NOT NULL,
    "discrimination" DOUBLE PRECISION NOT NULL,
    "avgTimeSec" DOUBLE PRECISION,
    "distractorStats" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "ItemTrialStat_pkey" PRIMARY KEY ("examQuestionId")
);

-- CreateIndex
CREATE INDEX "ItemTrialStat_bankQuestionId_computedAt_idx" ON "ItemTrialStat"("bankQuestionId", "computedAt");

-- CreateIndex
CREATE INDEX "ItemTrialStat_bankQuestionVersionId_idx" ON "ItemTrialStat"("bankQuestionVersionId");

-- CreateIndex
CREATE INDEX "ItemTrialStat_examId_idx" ON "ItemTrialStat"("examId");

-- AddForeignKey
ALTER TABLE "ItemTrialStat" ADD CONSTRAINT "ItemTrialStat_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "BankQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTrialStat" ADD CONSTRAINT "ItemTrialStat_bankQuestionVersionId_fkey" FOREIGN KEY ("bankQuestionVersionId") REFERENCES "BankQuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
