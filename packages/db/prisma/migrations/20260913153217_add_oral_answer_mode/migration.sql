-- CreateEnum
CREATE TYPE "OralAnswerMode" AS ENUM ('text', 'voice');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "answerMode" "OralAnswerMode" NOT NULL DEFAULT 'text';

