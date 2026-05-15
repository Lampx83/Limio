-- A5.3 PR2.15 — Mỗi cohort có 2-4 mã lớp thi (exam class), unique trong course,
-- cascade delete theo cohort. Mỗi mã lớp thi tương ứng 1 phòng vật lý.

CREATE TABLE "CohortExamClass" (
  id            TEXT PRIMARY KEY,
  "cohortId"    TEXT NOT NULL,
  "courseId"    TEXT NOT NULL,
  code          TEXT NOT NULL,
  "roomLocation" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CohortExamClass_cohortId_fkey" FOREIGN KEY ("cohortId")
    REFERENCES "Cohort"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CohortExamClass_courseId_fkey" FOREIGN KEY ("courseId")
    REFERENCES "Course"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CohortExamClass_courseId_code_key"
  ON "CohortExamClass"("courseId", code);
CREATE INDEX "CohortExamClass_cohortId_idx"
  ON "CohortExamClass"("cohortId");
