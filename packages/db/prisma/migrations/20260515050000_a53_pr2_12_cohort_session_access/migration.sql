-- A5.3 PR2.12 — Cohort thành "lớp học" + per-session access mode/code.
--
-- 1. Cohort: add `code` (mã lớp 6-8 ký tự do trường định nghĩa) + `instructorId`
--    (GV phụ trách cohort, 1 GV : N cohort).
-- 2. ExamSession (table "ExamSchedule"): add `accessMode` + `openCode` để mỗi
--    ca có mode + mã access riêng. Backfill `accessMode` từ Exam.accessMode.
--    `openCode` để null cho legacy sessions — UI mới sẽ generate khi tạo ca.
-- 3. ExamCandidate: add `cohortId` để route kết quả về đúng GV.

-- ====================================================================
-- 1. Cohort: code + instructorId
-- ====================================================================
ALTER TABLE "Cohort"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "instructorId" TEXT;

ALTER TABLE "Cohort"
  ADD CONSTRAINT "Cohort_instructorId_fkey"
  FOREIGN KEY ("instructorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique mã lớp trong 1 course (cho phép NULL).
CREATE UNIQUE INDEX "Cohort_courseId_code_key" ON "Cohort"("courseId", "code");
CREATE INDEX "Cohort_instructorId_idx" ON "Cohort"("instructorId");

-- ====================================================================
-- 2. ExamSession (table "ExamSchedule"): accessMode + openCode
-- ====================================================================
ALTER TABLE "ExamSchedule"
  ADD COLUMN "accessMode" "ExamAccessMode" NOT NULL DEFAULT 'authenticated',
  ADD COLUMN "openCode" TEXT;

-- Backfill accessMode từ Exam (mode hiện đang sống ở Exam-level).
UPDATE "ExamSchedule" s
SET "accessMode" = e."accessMode"
FROM "Exam" e
WHERE s."examId" = e."id";

-- Không backfill openCode vì Exam.openCode globally unique nhưng nhiều
-- session cùng exam sẽ xung đột (roundId, openCode) unique.
-- UI mới sẽ generate per-session khi user chọn open mode.

CREATE UNIQUE INDEX "ExamSchedule_roundId_openCode_key"
  ON "ExamSchedule"("roundId", "openCode");

-- ====================================================================
-- 3. ExamCandidate: cohortId
-- ====================================================================
ALTER TABLE "ExamCandidate" ADD COLUMN "cohortId" TEXT;

ALTER TABLE "ExamCandidate"
  ADD CONSTRAINT "ExamCandidate_cohortId_fkey"
  FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ExamCandidate_cohortId_idx" ON "ExamCandidate"("cohortId");
