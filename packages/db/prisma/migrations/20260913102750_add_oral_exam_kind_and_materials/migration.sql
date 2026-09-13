-- CreateEnum
CREATE TYPE "ExamKind" AS ENUM ('written', 'oral');

-- CreateEnum
CREATE TYPE "OralExamMaterialType" AS ENUM ('document', 'topic_list', 'rubric');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "kind" "ExamKind" NOT NULL DEFAULT 'written';

-- CreateTable
CREATE TABLE "OralExamMaterial" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "type" "OralExamMaterialType" NOT NULL,
    "title" TEXT NOT NULL,
    "s3Key" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "extractedText" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OralExamMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OralExamMaterial_examId_orderIndex_idx" ON "OralExamMaterial"("examId", "orderIndex");

-- AddForeignKey
ALTER TABLE "OralExamMaterial" ADD CONSTRAINT "OralExamMaterial_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OralExamMaterial" ADD CONSTRAINT "OralExamMaterial_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

