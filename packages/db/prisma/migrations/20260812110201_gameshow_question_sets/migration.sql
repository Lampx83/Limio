-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_quizId_fkey";

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "questionSetId" TEXT,
ALTER COLUMN "quizId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GameQuestionSet" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameQuestionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameQuestionSetItem" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "timeLimitSec" INTEGER NOT NULL DEFAULT 20,

    CONSTRAINT "GameQuestionSetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameQuestionSetOption" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "GameQuestionSetOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSessionQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "timeLimitSec" INTEGER NOT NULL,

    CONSTRAINT "GameSessionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSessionQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "GameSessionQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameQuestionSet_ownerId_createdAt_idx" ON "GameQuestionSet"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "GameQuestionSetItem_setId_idx" ON "GameQuestionSetItem"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "GameQuestionSetItem_setId_orderIndex_key" ON "GameQuestionSetItem"("setId", "orderIndex");

-- CreateIndex
CREATE INDEX "GameQuestionSetOption_itemId_idx" ON "GameQuestionSetOption"("itemId");

-- CreateIndex
CREATE INDEX "GameSessionQuestion_sessionId_idx" ON "GameSessionQuestion"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSessionQuestion_sessionId_orderIndex_key" ON "GameSessionQuestion"("sessionId", "orderIndex");

-- CreateIndex
CREATE INDEX "GameSessionQuestionOption_questionId_idx" ON "GameSessionQuestionOption"("questionId");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "GameQuestionSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameQuestionSet" ADD CONSTRAINT "GameQuestionSet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameQuestionSetItem" ADD CONSTRAINT "GameQuestionSetItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "GameQuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameQuestionSetOption" ADD CONSTRAINT "GameQuestionSetOption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GameQuestionSetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSessionQuestion" ADD CONSTRAINT "GameSessionQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSessionQuestionOption" ADD CONSTRAINT "GameSessionQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "GameSessionQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

