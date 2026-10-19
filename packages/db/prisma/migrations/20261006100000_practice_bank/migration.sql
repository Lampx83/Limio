-- CreateEnum
CREATE TYPE "CourseKind" AS ENUM ('standard', 'practice_bank');

-- CreateEnum
CREATE TYPE "ExamPaperType" AS ENUM ('official', 'mock', 'practice_set');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "kind" "CourseKind" NOT NULL DEFAULT 'standard';

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN "paperType" "ExamPaperType",
ADD COLUMN "sourceLabel" TEXT,
ADD COLUMN "yearLabel" TEXT,
ADD COLUMN "seq" INTEGER,
ADD COLUMN "difficulty" INTEGER,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "freePreview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "collectionId" TEXT;

-- CreateTable
CREATE TABLE "ExamCollection" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamCollection_courseId_orderIndex_idx" ON "ExamCollection"("courseId", "orderIndex");

-- CreateIndex
CREATE INDEX "Exam_courseId_collectionId_seq_idx" ON "Exam"("courseId", "collectionId", "seq");

-- CreateIndex
CREATE INDEX "Exam_courseId_status_paperType_idx" ON "Exam"("courseId", "status", "paperType");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ExamCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamCollection" ADD CONSTRAINT "ExamCollection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
