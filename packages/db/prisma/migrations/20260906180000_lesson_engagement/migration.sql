-- B11 — mức tương tác của người học với từng bài, cộng dồn qua nhiều lượt đọc.
CREATE TABLE "LessonEngagement" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "lessonId"     TEXT NOT NULL,
  "courseId"     TEXT NOT NULL,
  "activeSec"    INTEGER NOT NULL DEFAULT 0,
  "maxScrollPct" INTEGER NOT NULL DEFAULT 0,
  "maxVideoPct"  INTEGER NOT NULL DEFAULT 0,
  "sessionCount" INTEGER NOT NULL DEFAULT 0,
  "firstSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonEngagement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LessonEngagement_userId_lessonId_key" ON "LessonEngagement"("userId", "lessonId");
CREATE INDEX "LessonEngagement_courseId_lastSeenAt_idx" ON "LessonEngagement"("courseId", "lastSeenAt");
CREATE INDEX "LessonEngagement_lessonId_idx" ON "LessonEngagement"("lessonId");

ALTER TABLE "LessonEngagement" ADD CONSTRAINT "LessonEngagement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonEngagement" ADD CONSTRAINT "LessonEngagement_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
