-- CreateTable
CREATE TABLE "OralAiGradeBatch" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "status" "AiGradeBatchStatus" NOT NULL DEFAULT 'running',
    "queue" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "done" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "stopRequested" BOOLEAN NOT NULL DEFAULT false,
    "haltReason" TEXT,
    "problems" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "OralAiGradeBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OralAiGradeBatch_examId_status_idx" ON "OralAiGradeBatch"("examId", "status");

-- AddForeignKey
ALTER TABLE "OralAiGradeBatch" ADD CONSTRAINT "OralAiGradeBatch_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OralAiGradeBatch" ADD CONSTRAINT "OralAiGradeBatch_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tối đa MỘT lượt chấm hàng loạt đang chạy cho mỗi đề vấn đáp. Prisma không diễn đạt được chỉ mục duy nhất
-- từng phần nên nằm ở SQL thô (DB dựng bằng `db push` thì thiếu — kiểm sau mỗi lần push).
CREATE UNIQUE INDEX "OralAiGradeBatch_one_running_per_exam" ON "OralAiGradeBatch"("examId") WHERE "status" = 'running';
