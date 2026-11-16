-- CENTER K — Phân phối chương trình (docs/CENTER-schedule-attendance-AC.md, mục K). Chỉ thêm bảng mới.
CREATE TABLE "CourseSession" (
  "id"        TEXT NOT NULL,
  "courseId"  TEXT NOT NULL,
  "sessionNo" INTEGER NOT NULL,
  "topic"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CourseSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourseSession_courseId_fkey" FOREIGN KEY ("courseId")
    REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CourseSession_courseId_sessionNo_key" ON "CourseSession"("courseId", "sessionNo");

CREATE TABLE "CourseSessionLesson" (
  "sessionId"  TEXT NOT NULL,
  "lessonId"   TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,

  CONSTRAINT "CourseSessionLesson_pkey" PRIMARY KEY ("sessionId", "lessonId"),
  CONSTRAINT "CourseSessionLesson_sessionId_fkey" FOREIGN KEY ("sessionId")
    REFERENCES "CourseSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CourseSessionLesson_lessonId_fkey" FOREIGN KEY ("lessonId")
    REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CourseSessionLesson_lessonId_idx" ON "CourseSessionLesson"("lessonId");
