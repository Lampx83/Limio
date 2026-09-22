-- AlterEnum
BEGIN;
CREATE TYPE "ExamQuestionType_new" AS ENUM ('mcq', 'multi', 'true_false_notgiven', 'gap_fill', 'short_answer', 'essay', 'matching', 'ordering', 'numerical', 'drag_drop_fill');
ALTER TABLE "ExamQuestion" ALTER COLUMN "type" TYPE "ExamQuestionType_new" USING ("type"::text::"ExamQuestionType_new");
ALTER TABLE "BankQuestion" ALTER COLUMN "type" TYPE "ExamQuestionType_new" USING ("type"::text::"ExamQuestionType_new");
ALTER TYPE "ExamQuestionType" RENAME TO "ExamQuestionType_old";
ALTER TYPE "ExamQuestionType_new" RENAME TO "ExamQuestionType";
DROP TYPE "ExamQuestionType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'multi';
