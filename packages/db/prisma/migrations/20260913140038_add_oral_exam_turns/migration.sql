-- CreateEnum
CREATE TYPE "OralExamTurnRole" AS ENUM ('examiner', 'student');

-- CreateTable
CREATE TABLE "OralExamTurn" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "role" "OralExamTurnRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OralExamTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OralExamTurn_attemptId_createdAt_idx" ON "OralExamTurn"("attemptId", "createdAt");

-- AddForeignKey
ALTER TABLE "OralExamTurn" ADD CONSTRAINT "OralExamTurn_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

