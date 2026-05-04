-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;
