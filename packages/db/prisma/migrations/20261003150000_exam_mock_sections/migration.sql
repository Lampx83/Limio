-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "mockMode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ExamSection" ADD COLUMN     "durationMin" INTEGER,
ADD COLUMN     "languageSkill" "LanguageSkill";

-- CreateTable
CREATE TABLE "ExamAttemptSection" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "endedAt" TIMESTAMP(3),
    "extraSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamAttemptSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamAttemptSection_sectionId_idx" ON "ExamAttemptSection"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAttemptSection_attemptId_sectionId_key" ON "ExamAttemptSection"("attemptId", "sectionId");

-- AddForeignKey
ALTER TABLE "ExamAttemptSection" ADD CONSTRAINT "ExamAttemptSection_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttemptSection" ADD CONSTRAINT "ExamAttemptSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ExamSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

