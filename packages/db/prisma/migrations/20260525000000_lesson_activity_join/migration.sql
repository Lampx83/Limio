-- LessonActivity: unified ordering layer for ContentItem + Quiz + Assignment
-- within a lesson. Lets instructor drag-drop reorder across types.

-- 1. Enum
CREATE TYPE "LessonActivityKind" AS ENUM ('content', 'quiz', 'assignment');

-- 2. Table
CREATE TABLE "LessonActivity" (
  "id"            TEXT NOT NULL,
  "lessonId"     TEXT NOT NULL,
  "kind"         "LessonActivityKind" NOT NULL,
  "contentItemId" TEXT,
  "quizId"       TEXT,
  "assignmentId" TEXT,
  "orderIndex"   INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LessonActivity_pkey" PRIMARY KEY ("id")
);

-- 3. FKs
ALTER TABLE "LessonActivity"
  ADD CONSTRAINT "LessonActivity_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonActivity"
  ADD CONSTRAINT "LessonActivity_contentItemId_fkey"
  FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonActivity"
  ADD CONSTRAINT "LessonActivity_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonActivity"
  ADD CONSTRAINT "LessonActivity_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Uniques + indexes
CREATE UNIQUE INDEX "LessonActivity_contentItemId_key" ON "LessonActivity"("contentItemId");
CREATE UNIQUE INDEX "LessonActivity_quizId_key"        ON "LessonActivity"("quizId");
CREATE UNIQUE INDEX "LessonActivity_assignmentId_key"  ON "LessonActivity"("assignmentId");
CREATE UNIQUE INDEX "LessonActivity_lessonId_orderIndex_key"
  ON "LessonActivity"("lessonId", "orderIndex");
CREATE INDEX "LessonActivity_lessonId_orderIndex_idx"
  ON "LessonActivity"("lessonId", "orderIndex");

-- 5. Backfill
-- Strategy: per lesson, lay out activities in fixed order:
--   1. ContentItems sorted by existing orderIndex
--   2. Then Quizzes (excluding cuepointOnly + tournament-bound), sorted by createdAt
--   3. Then Assignments (excluding tournament-bound), sorted by createdAt
-- Mirror current ActivitySection display order so users don't see anything shift.

WITH ordered AS (
  -- ContentItems first
  SELECT
    gen_random_uuid()::text AS id,
    ci."lessonId" AS lesson_id,
    'content'::"LessonActivityKind" AS kind,
    ci."id" AS content_id,
    NULL::text AS quiz_id,
    NULL::text AS assignment_id,
    ROW_NUMBER() OVER (
      PARTITION BY ci."lessonId"
      ORDER BY ci."orderIndex" ASC, ci."createdAt" ASC, ci."id" ASC
    ) AS pos
  FROM "ContentItem" ci

  UNION ALL

  -- Quizzes after content
  SELECT
    gen_random_uuid()::text,
    q."lessonId",
    'quiz'::"LessonActivityKind",
    NULL::text,
    q."id",
    NULL::text,
    -- offset by count of contentItems in same lesson, then rank within quizzes
    (SELECT COUNT(*) FROM "ContentItem" ci2 WHERE ci2."lessonId" = q."lessonId")
      + ROW_NUMBER() OVER (PARTITION BY q."lessonId" ORDER BY q."createdAt" ASC, q."id" ASC)
  FROM "Quiz" q
  WHERE q."lessonId" IS NOT NULL
    AND q."cuepointOnly" = false
    AND q."tournamentMissionId" IS NULL

  UNION ALL

  -- Assignments last
  SELECT
    gen_random_uuid()::text,
    a."lessonId",
    'assignment'::"LessonActivityKind",
    NULL::text,
    NULL::text,
    a."id",
    (SELECT COUNT(*) FROM "ContentItem" ci3 WHERE ci3."lessonId" = a."lessonId")
      + (
        SELECT COUNT(*) FROM "Quiz" q2
        WHERE q2."lessonId" = a."lessonId"
          AND q2."cuepointOnly" = false
          AND q2."tournamentMissionId" IS NULL
      )
      + ROW_NUMBER() OVER (PARTITION BY a."lessonId" ORDER BY a."createdAt" ASC, a."id" ASC)
  FROM "Assignment" a
  WHERE a."lessonId" IS NOT NULL
    AND a."tournamentMissionId" IS NULL
)
INSERT INTO "LessonActivity"
  ("id", "lessonId", "kind", "contentItemId", "quizId", "assignmentId", "orderIndex")
SELECT id, lesson_id, kind, content_id, quiz_id, assignment_id, (pos - 1)::int
FROM ordered;
