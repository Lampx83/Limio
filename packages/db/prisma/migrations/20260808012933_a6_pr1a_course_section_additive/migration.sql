-- A6 PR1a — CourseSection invite-link (MVP). Prisma model Cohort renamed to
-- CourseSection; SQL table name giữ nguyên "Cohort" qua @@map để zero
-- migration risk (mirror pattern ExamSchedule→ExamSession ở A5.3 PR1c.1).
--
-- Additive only — không đổi hành vi app. Backfill (default section per
-- course + Enrollment.sectionId) ở migration kế tiếp (PR1b).

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "inviteCode" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "sectionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_inviteCode_key" ON "Cohort"("inviteCode");

-- CreateIndex
CREATE INDEX "Enrollment_sectionId_idx" ON "Enrollment"("sectionId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
