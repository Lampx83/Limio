-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "ExamQuestionStats" (
    "examQuestionId" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "pValue" DOUBLE PRECISION NOT NULL DEFAULT -1,
    "discrimination" DOUBLE PRECISION NOT NULL DEFAULT -2,
    "avgTimeSec" DOUBLE PRECISION,
    "distractorStats" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamQuestionStats_pkey" PRIMARY KEY ("examQuestionId")
);

-- CreateTable
CREATE TABLE "BankQuestionStats" (
    "bankQuestionId" TEXT NOT NULL,
    "totalUses" INTEGER NOT NULL DEFAULT 0,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "pValueAvg" DOUBLE PRECISION NOT NULL DEFAULT -1,
    "discriminationAvg" DOUBLE PRECISION NOT NULL DEFAULT -2,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankQuestionStats_pkey" PRIMARY KEY ("bankQuestionId")
);

-- AddForeignKey
ALTER TABLE "ExamQuestionStats" ADD CONSTRAINT "ExamQuestionStats_examQuestionId_fkey" FOREIGN KEY ("examQuestionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestionStats" ADD CONSTRAINT "BankQuestionStats_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "BankQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

