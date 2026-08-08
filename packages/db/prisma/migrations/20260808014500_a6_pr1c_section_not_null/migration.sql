-- A6 PR1c — Siết NOT NULL trên Enrollment.sectionId.
--
-- PR1b backfill đã set sectionId cho mọi Enrollment hiện có. App code
-- (enrollInCourse, enrollBySectionCode, payments.ts webhook, enroll-bulk
-- route, seed scripts) đã deploy để luôn set sectionId ở mọi write-path
-- mới, nên an toàn để siết NOT NULL + đổi FK onDelete từ SetNull sang
-- Restrict (xoá 1 CourseSection còn enrollment phải reject ở service layer
-- — deleteCourseSection đã chặn việc này trước khi tới DB).

DO $$
DECLARE
  bad INT;
BEGIN
  SELECT COUNT(*) INTO bad FROM "Enrollment" WHERE "sectionId" IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION
      'A6 PR1c cannot tighten NOT NULL: Enrollment has % row(s) with NULL sectionId. Run PR1b backfill first.',
      bad;
  END IF;
END
$$;

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_sectionId_fkey";

-- AlterTable
ALTER TABLE "Enrollment" ALTER COLUMN "sectionId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
