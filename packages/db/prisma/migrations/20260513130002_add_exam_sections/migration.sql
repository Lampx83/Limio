-- CreateEnum
CREATE TYPE "ExamSectionSelectionMode" AS ENUM ('fixed', 'random_from_bank');

-- CreateEnum
CREATE TYPE "ExamSectionResolutionMode" AS ENUM ('per_attempt', 'per_publish');

-- CreateTable
CREATE TABLE "ExamSection" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "selectionMode" "ExamSectionSelectionMode" NOT NULL DEFAULT 'fixed',
    "resolutionMode" "ExamSectionResolutionMode" NOT NULL DEFAULT 'per_attempt',
    "poolFilter" JSONB,
    "materializedQuestionIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSectionItem" (
    "sectionId" TEXT NOT NULL,
    "examQuestionId" TEXT NOT NULL,
    "orderInSection" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "ExamSectionItem_pkey" PRIMARY KEY ("sectionId","examQuestionId")
);

-- CreateIndex
CREATE INDEX "ExamSection_examId_idx" ON "ExamSection"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSection_examId_orderIndex_key" ON "ExamSection"("examId", "orderIndex");

-- CreateIndex
CREATE INDEX "ExamSectionItem_sectionId_orderInSection_idx" ON "ExamSectionItem"("sectionId", "orderInSection");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSectionItem_examQuestionId_key" ON "ExamSectionItem"("examQuestionId");

-- AddForeignKey
ALTER TABLE "ExamSection" ADD CONSTRAINT "ExamSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSectionItem" ADD CONSTRAINT "ExamSectionItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ExamSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSectionItem" ADD CONSTRAINT "ExamSectionItem_examQuestionId_fkey" FOREIGN KEY ("examQuestionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- Data backfill — every existing Exam gets 1 default section "Main"
-- (selectionMode=fixed) owning all current ExamQuestions.
-- Idempotent: only runs when no section exists yet for the exam.
-- =====================================================================
INSERT INTO "ExamSection" (id, "examId", title, "orderIndex", "selectionMode", "resolutionMode", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e.id,
  'Main',
  0,
  'fixed',
  'per_attempt',
  NOW(),
  NOW()
FROM "Exam" e
WHERE NOT EXISTS (
  SELECT 1 FROM "ExamSection" s WHERE s."examId" = e.id
);

-- Link every existing ExamQuestion to its exam's default section, preserving
-- orderInExam → orderInSection. Skip questions already linked (forward-compat).
INSERT INTO "ExamSectionItem" ("sectionId", "examQuestionId", "orderInSection", points)
SELECT
  s.id,
  q.id,
  q."orderInExam",
  q.points
FROM "ExamQuestion" q
JOIN "ExamSection" s ON s."examId" = q."examId" AND s."orderIndex" = 0
WHERE NOT EXISTS (
  SELECT 1 FROM "ExamSectionItem" si WHERE si."examQuestionId" = q.id
);
