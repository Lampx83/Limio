// A5.3 PR1b — Backfill simulation test.
//
// The real migration SQL ran once on dev DB at PR1b deploy. To keep that
// backfill logic regression-tested, this suite recreates a "PR1a state"
// (sessionId/roundId/orderIndex temporarily NULL) on the test DB, runs the
// backfill SQL inline, and asserts the same invariants the migration checks.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

// Lifted verbatim from the migration file's DO block + ROW_NUMBER update
// so the test exercises the same logic. If the migration changes, copy the
// updated SQL here too.
const BACKFILL_SQL = `
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
    INSERT INTO "ExamRound" (id, code, title, "courseId", "opensAt", "closesAt", status, "createdAt", "updatedAt")
    VALUES (
      round_id,
      'AUTO-EXAM-' || substring(e.id, 1, 8),
      'Đợt thi tự động — ' || COALESCE(e.title, 'Exam'),
      e."courseId",
      COALESCE(e."openAt", NOW()),
      COALESCE(e."closeAt", NOW() + INTERVAL '365 days'),
      CASE WHEN e.status::TEXT = 'archived' THEN 'archived'::"ExamRoundStatus" ELSE 'draft'::"ExamRoundStatus" END,
      NOW(), NOW()
    );
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
        '{}', NOW(), NOW()
      );
    ELSE
      SELECT id INTO session_id FROM "ExamSchedule"
      WHERE "examId" = e.id ORDER BY "opensAt" ASC, "createdAt" ASC LIMIT 1;
    END IF;
    UPDATE "ExamRoom" SET "sessionId" = session_id
    WHERE "examId" = e.id AND "sessionId" IS NULL;
    UPDATE "ExamCandidate" SET "sessionId" = session_id
    WHERE "examId" = e.id AND "sessionId" IS NULL;
  END LOOP;
END
$$;
`;

const BACKFILL_ORDER_INDEX_SQL = `
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "sessionId" ORDER BY "createdAt", id) AS rn
  FROM "ExamRoom" WHERE "orderIndex" IS NULL
)
UPDATE "ExamRoom" r SET "orderIndex" = n.rn FROM numbered n WHERE r.id = n.id;
`;

// PR1c.3 siết NOT NULL trên ExamRoom.sessionId + ExamRoom.orderIndex. Để
// simulate "PR1a state" (null sessionId/orderIndex), test phải tạm DROP
// NOT NULL trước khi seed, rồi SET NOT NULL lại sau khi cleanup. PR1c.5 sẽ
// siết tiếp ExamCandidate.sessionId + ExamSession.roundId — khi đó hook này
// cần thêm 2 cột nữa.
const RELAX_NOT_NULL_STATEMENTS = [
  `ALTER TABLE "ExamRoom" ALTER COLUMN "sessionId" DROP NOT NULL;`,
  `ALTER TABLE "ExamRoom" ALTER COLUMN "orderIndex" DROP NOT NULL;`,
  `ALTER TABLE "ExamCandidate" ALTER COLUMN "sessionId" DROP NOT NULL;`,
  `ALTER TABLE "ExamSchedule" ALTER COLUMN "roundId" DROP NOT NULL;`,
];

const RESTORE_NOT_NULL_STATEMENTS = [
  `ALTER TABLE "ExamRoom" ALTER COLUMN "sessionId" SET NOT NULL;`,
  `ALTER TABLE "ExamRoom" ALTER COLUMN "orderIndex" SET NOT NULL;`,
  `ALTER TABLE "ExamCandidate" ALTER COLUMN "sessionId" SET NOT NULL;`,
  `ALTER TABLE "ExamSchedule" ALTER COLUMN "roundId" SET NOT NULL;`,
];

async function runEach(stmts: readonly string[]) {
  for (const sql of stmts) await prisma.$executeRawUnsafe(sql);
}

describe("A5.3 PR1b — backfill simulation", () => {
  beforeEach(async () => {
    await runEach(RELAX_NOT_NULL_STATEMENTS);
  });

  afterEach(async () => {
    // Cleanup synthetic null rows before restoring NOT NULL.
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ExamRoom" WHERE "sessionId" IS NULL OR "orderIndex" IS NULL;`,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ExamCandidate" WHERE "sessionId" IS NULL;`,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ExamSchedule" WHERE "roundId" IS NULL;`,
    );
    await runEach(RESTORE_NOT_NULL_STATEMENTS);
  });

  it("creates a round + auto session, backfills rooms/candidates, sets orderIndex", async () => {
    // Seed PR1a-style state: exam + 2 rooms + 1 candidate, all with null sessionId.
    const owner = await registerUser(
      { email: `bf-${Date.now()}@e.com`, password: "password1234", displayName: "O" },
      BASE,
    );
    const c = await createCourse(owner.userId, {
      title: "Backfill course",
      description: "x",
      slug: `bf-course-${Date.now().toString(36)}`,
    });
    const exam = await prisma.exam.create({
      data: {
        courseId: c.courseId,
        title: "Backfill exam",
        durationMin: 60,
        openAt: new Date(),
        closeAt: new Date(Date.now() + 60_000),
      },
    });
    // 2 rooms, intentionally null sessionId / orderIndex (PR1a shape).
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ExamRoom" (id, "examId", name, "proctorUserId", "ipAllowlist", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'Room 1', $2, '{}', NOW() - INTERVAL '2 minutes', NOW()),
              (gen_random_uuid()::text, $1, 'Room 2', $2, '{}', NOW() - INTERVAL '1 minute', NOW());`,
      exam.id,
      owner.userId,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ExamCandidate" (id, "examId", "displayName", "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'Thí sinh 1', NOW());`,
      exam.id,
    );

    // Sanity: nulls actually present pre-backfill. Prisma client (compiled
    // from the tight schema) refuses `sessionId: null`, so check via raw SQL.
    const preRooms = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "ExamRoom" WHERE "examId" = $1 AND "sessionId" IS NULL`,
      exam.id,
    );
    expect(Number(preRooms[0]!.count)).toBe(2);

    // Run backfill.
    await prisma.$executeRawUnsafe(BACKFILL_SQL);
    await prisma.$executeRawUnsafe(BACKFILL_ORDER_INDEX_SQL);

    // Verify: 1 round created for this exam, gắn vào course.
    const rounds = await prisma.examRound.findMany({
      where: { code: `AUTO-EXAM-${exam.id.slice(0, 8)}` },
    });
    expect(rounds).toHaveLength(1);
    const round = rounds[0]!;
    expect(round.courseId).toBe(c.courseId);

    // Verify: auto session "CA-DEFAULT" created.
    const sessions = await prisma.examSession.findMany({
      where: { examId: exam.id },
    });
    expect(sessions).toHaveLength(1);
    const session = sessions[0]!;
    expect(session.code).toBe("CA-DEFAULT");
    expect(session.roundId).toBe(round.id);

    // Verify: both rooms backfilled with sessionId + orderIndex 1, 2.
    const rooms = await prisma.examRoom.findMany({
      where: { examId: exam.id },
      orderBy: { orderIndex: "asc" },
    });
    expect(rooms).toHaveLength(2);
    expect(rooms[0]!.sessionId).toBe(session.id);
    expect(rooms[1]!.sessionId).toBe(session.id);
    expect(rooms[0]!.orderIndex).toBe(1);
    expect(rooms[1]!.orderIndex).toBe(2);

    // Verify: candidate backfilled.
    const cands = await prisma.examCandidate.findMany({
      where: { examId: exam.id },
    });
    expect(cands).toHaveLength(1);
    expect(cands[0]!.sessionId).toBe(session.id);
  });

  it("reuses earliest existing schedule when one already exists for the exam", async () => {
    const owner = await registerUser(
      { email: `bfr-${Date.now()}@e.com`, password: "password1234", displayName: "O" },
      BASE,
    );
    const c = await createCourse(owner.userId, {
      title: "Backfill reuse",
      description: "x",
      slug: `bf-reuse-${Date.now().toString(36)}`,
    });
    const exam = await prisma.exam.create({
      data: {
        courseId: c.courseId,
        title: "Reuse exam",
        durationMin: 60,
        openAt: new Date(),
        closeAt: new Date(Date.now() + 60_000),
      },
    });
    // Pre-existing schedule WITHOUT roundId (PR1a shape).
    const earlySched = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO "ExamSchedule" (id, "examId", "opensAt", "closesAt", "ipAllowlist", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, NOW(), NOW() + INTERVAL '1 hour', '{}', 'draft'::"ExamSessionStatus", NOW() - INTERVAL '1 hour', NOW())
       RETURNING id;`,
      exam.id,
    );
    const earlyId = earlySched[0]!.id;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ExamRoom" (id, "examId", name, "proctorUserId", "ipAllowlist", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'R1', $2, '{}', NOW(), NOW());`,
      exam.id,
      owner.userId,
    );

    await prisma.$executeRawUnsafe(BACKFILL_SQL);
    await prisma.$executeRawUnsafe(BACKFILL_ORDER_INDEX_SQL);

    // Existing schedule must have gained a roundId (no new "CA-DEFAULT" auto-session).
    const sessions = await prisma.examSession.findMany({
      where: { examId: exam.id },
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe(earlyId);
    expect(sessions[0]!.roundId).not.toBeNull();

    const room = await prisma.examRoom.findFirstOrThrow({
      where: { examId: exam.id },
    });
    expect(room.sessionId).toBe(earlyId);
    expect(room.orderIndex).toBe(1);
  });
});
