-- A6 PR1b — Backfill CourseSection mặc định (isDefault=true) cho mọi Course,
-- và gán Enrollment.sectionId cho data cũ về section mặc định đó.
--
-- Quy tắc backfill:
--  * Mỗi Course chưa có section isDefault=true → tạo 1 CourseSection
--    "Học viên chưa gán lớp", isDefault=true, inviteCode NULL (không cho
--    join qua link — đây chỉ là nơi rơi vào cho enrollment không qua invite
--    link: mua khoá học, bulk-import, data cũ).
--  * Mỗi Enrollment.sectionId NULL → set = section mặc định của course đó.
--  * Verify invariants sau backfill. Fail loudly (RAISE EXCEPTION, rollback
--    transaction) nếu còn sót.
--
-- Siết NOT NULL trên Enrollment.sectionId chuyển sang migration kế tiếp
-- (PR1c) sau khi app code (enrollInCourse, enroll-bulk, Stripe webhook) đã
-- deploy để luôn set sectionId ở mọi write-path mới.

INSERT INTO "Cohort" (id, "courseId", name, "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 'Học viên chưa gán lớp', true, now(), now()
FROM "Course" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Cohort" s WHERE s."courseId" = c.id AND s."isDefault" = true
)
ON CONFLICT ("courseId", "name") DO NOTHING;

UPDATE "Enrollment" e
SET "sectionId" = s.id
FROM "Cohort" s
WHERE s."courseId" = e."courseId" AND s."isDefault" = true AND e."sectionId" IS NULL;

-- Verify invariants. Fail loudly + rollback if anything left dangling.
DO $$
DECLARE
  bad_courses_no_default INT;
  bad_enrollments_null INT;
BEGIN
  SELECT COUNT(*) INTO bad_courses_no_default
    FROM "Course" c
    WHERE NOT EXISTS (SELECT 1 FROM "Cohort" s WHERE s."courseId" = c.id AND s."isDefault" = true);

  SELECT COUNT(*) INTO bad_enrollments_null
    FROM "Enrollment" WHERE "sectionId" IS NULL;

  IF bad_courses_no_default > 0 OR bad_enrollments_null > 0 THEN
    RAISE EXCEPTION
      'A6 PR1b backfill verification failed: courses_without_default_section=%, enrollments_null_section=%',
      bad_courses_no_default, bad_enrollments_null;
  END IF;
END
$$;

-- PR1b kết thúc tại đây: data đã sạch, mọi Enrollment đã có sectionId.
-- Siết NOT NULL + refactor call-site (enroll.ts, payments.ts, enroll-bulk)
-- chuyển sang PR1c để giữ PR1b deploy-safe.
