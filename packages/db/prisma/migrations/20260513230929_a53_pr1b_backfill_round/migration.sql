-- A5.3 PR1b — Backfill ExamRound / sessionId / orderIndex cho data cũ từ
-- PR1a, sau đó siết NOT NULL trên các cột mới.
--
-- Quy tắc backfill:
--  * Mỗi Exam có dependents (ExamRoom / ExamCandidate / ExamSchedule) chưa
--    có sessionId/roundId được tạo 1 ExamRound mặc định 1-1 với Exam đó.
--  * ExamRoundCourse gắn round mới vào course của exam.
--  * Mỗi ExamSchedule cũ → set roundId = round mặc định của exam.
--  * Nếu exam chưa có schedule, tạo 1 schedule "CA-DEFAULT" để gắn rooms /
--    candidates vào (ExamRoom.sessionId và ExamCandidate.sessionId sẽ NOT
--    NULL sau migration này).
--  * Mỗi ExamRoom → set sessionId = schedule mặc định của exam (chọn schedule
--    sớm nhất theo opensAt nếu có nhiều). orderIndex = ROW_NUMBER theo
--    createdAt trong cùng sessionId.
--  * Mỗi ExamCandidate → cùng logic như ExamRoom.
--  * Sau backfill, verify invariants. Nếu fail, RAISE EXCEPTION (transaction
--    rollback).
--  * Cuối cùng ALTER COLUMN SET NOT NULL.
--
-- Cột examId trên ExamRoom / ExamCandidate GIỮ NGUYÊN ở PR1b (drop ở PR1c).

DO $$
DECLARE
  e RECORD;
  round_id TEXT;
  session_id TEXT;
BEGIN
  FOR e IN
    SELECT id, "courseId", title, "openAt", "closeAt", status
    FROM "Exam"
    WHERE id IN (
      SELECT "examId" FROM "ExamRoom" WHERE "sessionId" IS NULL
      UNION
      SELECT "examId" FROM "ExamCandidate" WHERE "sessionId" IS NULL
      UNION
      SELECT "examId" FROM "ExamSchedule" WHERE "roundId" IS NULL
    )
  LOOP
    round_id := gen_random_uuid()::TEXT;
    INSERT INTO "ExamRound" (id, code, title, "opensAt", "closesAt", status, "createdAt", "updatedAt")
    VALUES (
      round_id,
      'AUTO-EXAM-' || substring(e.id, 1, 8),
      'Đợt thi tự động — ' || COALESCE(e.title, 'Exam'),
      COALESCE(e."openAt", NOW()),
      COALESCE(e."closeAt", NOW() + INTERVAL '365 days'),
      CASE WHEN e.status::TEXT = 'archived' THEN 'archived'::"ExamRoundStatus" ELSE 'draft'::"ExamRoundStatus" END,
      NOW(),
      NOW()
    );

    INSERT INTO "ExamRoundCourse" ("roundId", "courseId", "createdAt")
    VALUES (round_id, e."courseId", NOW())
    ON CONFLICT DO NOTHING;

    UPDATE "ExamSchedule" SET "roundId" = round_id
    WHERE "examId" = e.id AND "roundId" IS NULL;

    IF NOT EXISTS (SELECT 1 FROM "ExamSchedule" WHERE "examId" = e.id) THEN
      session_id := gen_random_uuid()::TEXT;
      INSERT INTO "ExamSchedule" (
        id, "examId", "roundId", code, title, status,
        "opensAt", "closesAt", "ipAllowlist", "createdAt", "updatedAt"
      )
      VALUES (
        session_id, e.id, round_id, 'CA-DEFAULT', 'Ca mặc định',
        'draft'::"ExamSessionStatus",
        COALESCE(e."openAt", NOW()),
        COALESCE(e."closeAt", NOW() + INTERVAL '365 days'),
        '{}',
        NOW(), NOW()
      );
    ELSE
      SELECT id INTO session_id
      FROM "ExamSchedule"
      WHERE "examId" = e.id
      ORDER BY "opensAt" ASC, "createdAt" ASC
      LIMIT 1;
    END IF;

    UPDATE "ExamRoom" SET "sessionId" = session_id
    WHERE "examId" = e.id AND "sessionId" IS NULL;

    UPDATE "ExamCandidate" SET "sessionId" = session_id
    WHERE "examId" = e.id AND "sessionId" IS NULL;
  END LOOP;
END
$$;

-- Backfill orderIndex (1-based per session, by createdAt ASC).
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "sessionId" ORDER BY "createdAt", id) AS rn
  FROM "ExamRoom"
  WHERE "orderIndex" IS NULL
)
UPDATE "ExamRoom" r
SET "orderIndex" = n.rn
FROM numbered n
WHERE r.id = n.id;

-- Verify invariants. Fail loudly + rollback if anything left dangling.
DO $$
DECLARE
  bad_rooms INT;
  bad_room_order INT;
  bad_candidates INT;
  bad_schedules INT;
  bad_session_mismatch INT;
  bad_round_course INT;
BEGIN
  SELECT COUNT(*) INTO bad_rooms FROM "ExamRoom" WHERE "sessionId" IS NULL;
  SELECT COUNT(*) INTO bad_room_order FROM "ExamRoom" WHERE "orderIndex" IS NULL;
  SELECT COUNT(*) INTO bad_candidates FROM "ExamCandidate" WHERE "sessionId" IS NULL;
  SELECT COUNT(*) INTO bad_schedules FROM "ExamSchedule" WHERE "roundId" IS NULL;
  SELECT COUNT(*) INTO bad_session_mismatch
    FROM "ExamCandidate" c
    JOIN "ExamRoom" r ON c."roomId" = r.id
    WHERE c."sessionId" <> r."sessionId";
  SELECT COUNT(*) INTO bad_round_course
    FROM "ExamSchedule" s
    JOIN "Exam" e ON e.id = s."examId"
    LEFT JOIN "ExamRoundCourse" rc ON rc."roundId" = s."roundId" AND rc."courseId" = e."courseId"
    WHERE rc."roundId" IS NULL;

  IF bad_rooms > 0 OR bad_room_order > 0 OR bad_candidates > 0
     OR bad_schedules > 0 OR bad_session_mismatch > 0 OR bad_round_course > 0 THEN
    RAISE EXCEPTION
      'PR1b backfill verification failed: rooms_null=%, room_order_null=%, candidates_null=%, schedules_null=%, session_mismatch=%, round_course_missing=%',
      bad_rooms, bad_room_order, bad_candidates, bad_schedules, bad_session_mismatch, bad_round_course;
  END IF;
END
$$;

-- PR1b kết thúc tại đây: data đã sạch, mọi row đã có sessionId/roundId/orderIndex.
-- Việc siết NOT NULL + refactor call-site (cohorts.ts, candidates.ts, code-access.ts,
-- exam-rooms.ts) chuyển sang PR1c để giữ PR1b deploy-safe.
