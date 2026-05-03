-- CreateEnum
CREATE TYPE "QuestKind" AS ENUM ('daily', 'weekly');

-- CreateEnum
CREATE TYPE "QuestObjective" AS ENUM ('complete_lessons', 'pass_quizzes', 'resolve_misconceptions', 'earn_xp');

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "emoji" TEXT,
    "kind" "QuestKind" NOT NULL DEFAULT 'daily',
    "objective" "QuestObjective" NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 1,
    "rewardXp" INTEGER NOT NULL DEFAULT 20,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuestProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "courseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserQuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quest_code_key" ON "Quest"("code");

-- CreateIndex
CREATE INDEX "UserQuestProgress_userId_periodKey_idx" ON "UserQuestProgress"("userId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuestProgress_userId_questId_periodKey_key" ON "UserQuestProgress"("userId", "questId", "periodKey");

-- AddForeignKey
ALTER TABLE "UserQuestProgress" ADD CONSTRAINT "UserQuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestProgress" ADD CONSTRAINT "UserQuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
