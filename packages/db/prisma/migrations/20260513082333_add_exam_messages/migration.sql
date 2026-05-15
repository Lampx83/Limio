-- CreateTable
CREATE TABLE "ExamMessage" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "attemptId" TEXT,
    "fromUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "ExamMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamMessage_attemptId_sentAt_idx" ON "ExamMessage"("attemptId", "sentAt");

-- CreateIndex
CREATE INDEX "ExamMessage_examId_sentAt_idx" ON "ExamMessage"("examId", "sentAt");

-- AddForeignKey
ALTER TABLE "ExamMessage" ADD CONSTRAINT "ExamMessage_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMessage" ADD CONSTRAINT "ExamMessage_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMessage" ADD CONSTRAINT "ExamMessage_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
