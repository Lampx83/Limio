-- A5.3 PR1c.4 — Siết NOT NULL trên ExamCandidate.sessionId.
--
-- PR1b backfill đã set sessionId cho mọi candidate hiện có. PR1c.4 cập nhật
-- 2 service tạo candidate (createCandidate assigned-code + claimOpenCode
-- self-register) để luôn write sessionId. An toàn để siết NOT NULL.

DO $$
DECLARE
  bad INT;
BEGIN
  SELECT COUNT(*) INTO bad FROM "ExamCandidate" WHERE "sessionId" IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION
      'PR1c.4 cannot tighten NOT NULL: ExamCandidate has % row(s) with NULL sessionId. Run PR1b backfill first.',
      bad;
  END IF;
END
$$;

ALTER TABLE "ExamCandidate" ALTER COLUMN "sessionId" SET NOT NULL;
