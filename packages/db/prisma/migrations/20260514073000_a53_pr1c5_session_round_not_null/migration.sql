-- A5.3 PR1c.5 — Siết NOT NULL trên ExamSession.roundId (bảng SQL vẫn tên
-- "ExamSchedule" do @@map giữ tên ở PR1c.1).
--
-- PR1b backfill đã set roundId cho mọi session hiện tại. PR1c.5 cập nhật
-- createExamSession() (cohorts.ts) để luôn ensure round mặc định. An toàn.
--
-- Cột cohortId không drop ở PR1c.5 — UI SchedulesPanel vẫn dùng. Sẽ drop khi
-- UI chuyển sang IA mới (round → session → room) ở PR2+.

DO $$
DECLARE
  bad INT;
BEGIN
  SELECT COUNT(*) INTO bad FROM "ExamSchedule" WHERE "roundId" IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION
      'PR1c.5 cannot tighten NOT NULL: ExamSchedule has % row(s) with NULL roundId. Run PR1b backfill first.',
      bad;
  END IF;
END
$$;

ALTER TABLE "ExamSchedule" ALTER COLUMN "roundId" SET NOT NULL;
