-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuestionType" ADD VALUE 'matching';
ALTER TYPE "QuestionType" ADD VALUE 'numerical';
ALTER TYPE "QuestionType" ADD VALUE 'essay';
ALTER TYPE "QuestionType" ADD VALUE 'short_answer';

-- AlterTable
ALTER TABLE "AnswerResponse" ADD COLUMN     "manualScore" INTEGER,
ADD COLUMN     "needsGrading" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "QuestionOption" ADD COLUMN     "extra" JSONB;

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "extra" JSONB;
