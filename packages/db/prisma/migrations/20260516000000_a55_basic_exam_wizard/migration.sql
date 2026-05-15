-- A5.5 — Cơ bản/Nâng cao mode + Wizard "Tạo đề trong 3 bước"
-- Tất cả thay đổi additive (có DEFAULT), an toàn cho production.

-- 1. Enum CognitiveLevel (Bloom gộp 3 nhóm cho Cơ bản mode)
CREATE TYPE "CognitiveLevel" AS ENUM ('remember_understand', 'apply', 'analyze_plus');

-- 2. User: toggle Cơ bản/Nâng cao + counter exam đã tạo (cho banner upgrade)
ALTER TABLE "User"
  ADD COLUMN "expertAssessmentMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "examsCreatedCount"    INTEGER NOT NULL DEFAULT 0;

-- 3. BankQuestion: mức tư duy Bloom
ALTER TABLE "BankQuestion"
  ADD COLUMN "cognitiveLevel" "CognitiveLevel" NOT NULL DEFAULT 'remember_understand';

-- Backfill heuristic theo difficulty: 1-2 → remember_understand,
-- 3 → apply, 4-5 → analyze_plus. GV chỉnh tay sau qua Bank Workbench.
UPDATE "BankQuestion" SET "cognitiveLevel" = 'apply'        WHERE "difficulty" = 3;
UPDATE "BankQuestion" SET "cognitiveLevel" = 'analyze_plus' WHERE "difficulty" >= 4;
-- (rows với difficulty <= 2 giữ default 'remember_understand')

-- Composite index cho pool query của wizard assemble
CREATE INDEX "BankQuestion_bankId_cognitiveLevel_difficulty_idx"
  ON "BankQuestion" ("bankId", "cognitiveLevel", "difficulty");

-- 4. Exam: trường người tạo (nullable, FK SET NULL khi user xoá)
ALTER TABLE "Exam"
  ADD COLUMN "createdById" TEXT;

ALTER TABLE "Exam"
  ADD CONSTRAINT "Exam_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Exam_createdById_idx" ON "Exam" ("createdById");

-- Backfill Exam.createdById = primary instructor (CourseInstructor đầu tiên theo createdAt)
-- của course. Exam không có instructor → để NULL.
UPDATE "Exam" e
SET "createdById" = ci."userId"
FROM (
  SELECT DISTINCT ON ("courseId") "courseId", "userId"
  FROM "CourseInstructor"
  ORDER BY "courseId", "createdAt" ASC
) ci
WHERE ci."courseId" = e."courseId" AND e."createdById" IS NULL;

-- Backfill User.examsCreatedCount = COUNT(Exam) đã publish của user.
-- Status 'published' hoặc 'closed' (đã từng phát hành).
UPDATE "User" u
SET "examsCreatedCount" = sub.cnt
FROM (
  SELECT "createdById", COUNT(*)::int AS cnt
  FROM "Exam"
  WHERE "createdById" IS NOT NULL
    AND "status" IN ('published', 'archived')
  GROUP BY "createdById"
) sub
WHERE u."id" = sub."createdById";

-- 5. ExamWizardConfig (1:1 với Exam)
CREATE TABLE "ExamWizardConfig" (
  "examId"            TEXT NOT NULL,
  "lessonIds"         TEXT[] NOT NULL,
  "questionCount"     INTEGER NOT NULL,
  "bloomMix"          JSONB NOT NULL,
  "difficultyProfile" TEXT NOT NULL,
  "distributionMode"  TEXT NOT NULL,
  "sessionCount"      INTEGER,
  "autoEquating"      BOOLEAN NOT NULL DEFAULT true,
  "createdMode"       TEXT NOT NULL DEFAULT 'basic',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamWizardConfig_pkey" PRIMARY KEY ("examId")
);

ALTER TABLE "ExamWizardConfig"
  ADD CONSTRAINT "ExamWizardConfig_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
