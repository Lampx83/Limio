-- A5.3 PR2.11 — Mỗi đợt thi (ExamRound) chỉ gắn với 1 học phần (Course).
-- Drop bridge ExamRoundCourse, thêm courseId NOT NULL trên ExamRound.
--
-- Backfill: với mỗi round đang tồn tại, lấy courseId đầu tiên từ bridge
-- (nếu round span multi course → chỉ giữ 1; data dev có 1 round = 1 bridge nên
-- không mất gì). Drop bridge sau đó.

ALTER TABLE "ExamRound" ADD COLUMN "courseId" TEXT;

UPDATE "ExamRound" r
SET "courseId" = (
  SELECT rc."courseId"
  FROM "ExamRoundCourse" rc
  WHERE rc."roundId" = r.id
  ORDER BY rc."createdAt" ASC
  LIMIT 1
);

-- Verify all rounds got a courseId. Any orphan round (chưa có bridge nào) thì
-- abort + fail rõ ràng để instructor xử lý tay.
DO $$
DECLARE
  bad INT;
BEGIN
  SELECT COUNT(*) INTO bad FROM "ExamRound" WHERE "courseId" IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION
      'PR2.11 backfill failed: % round(s) have no ExamRoundCourse to derive courseId from. Delete or attach a course manually then re-run.',
      bad;
  END IF;
END
$$;

ALTER TABLE "ExamRound" ALTER COLUMN "courseId" SET NOT NULL;

-- Drop old global unique on code (was global vì cross-course). Replace bằng
-- unique-per-course: (courseId, code).
ALTER TABLE "ExamRound" DROP CONSTRAINT IF EXISTS "ExamRound_code_key";
CREATE UNIQUE INDEX "ExamRound_courseId_code_key" ON "ExamRound" ("courseId", "code");
CREATE INDEX "ExamRound_courseId_opensAt_idx" ON "ExamRound" ("courseId", "opensAt");

-- FK Course (Restrict — không cho xoá course khi còn round).
ALTER TABLE "ExamRound" ADD CONSTRAINT "ExamRound_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- Drop bridge table entirely.
DROP TABLE "ExamRoundCourse";
