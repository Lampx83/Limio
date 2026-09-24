-- CreateEnum
CREATE TYPE "QuizScoringPolicy" AS ENUM ('highest', 'latest', 'average');

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "opensAt" TIMESTAMP(3),
ADD COLUMN     "scoringPolicy" "QuizScoringPolicy" NOT NULL DEFAULT 'highest';
