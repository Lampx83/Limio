-- A5.3 PR1c.3 — Siết NOT NULL trên ExamRoom.sessionId + ExamRoom.orderIndex.
--
-- Backfill đã chạy ở PR1b nên mọi row hiện tại đều có sessionId/orderIndex.
-- Service createExamRoom giờ tự ensure session + auto orderIndex, nên rows
-- mới cũng luôn có 2 cột này. An toàn để siết NOT NULL.
--
-- Defensive: nếu có row null lọt qua (vd test fixture cũ), abort với rõ
-- nguyên nhân thay vì để Postgres lỗi cryptic giữa migration.

DO $$
DECLARE
  bad_session INT;
  bad_order INT;
BEGIN
  SELECT COUNT(*) INTO bad_session FROM "ExamRoom" WHERE "sessionId" IS NULL;
  SELECT COUNT(*) INTO bad_order FROM "ExamRoom" WHERE "orderIndex" IS NULL;
  IF bad_session > 0 OR bad_order > 0 THEN
    RAISE EXCEPTION
      'PR1c.3 cannot tighten NOT NULL: ExamRoom has % row(s) with NULL sessionId, % with NULL orderIndex. Run PR1b backfill first.',
      bad_session, bad_order;
  END IF;
END
$$;

ALTER TABLE "ExamRoom" ALTER COLUMN "sessionId" SET NOT NULL;
ALTER TABLE "ExamRoom" ALTER COLUMN "orderIndex" SET NOT NULL;
