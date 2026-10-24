-- Lời giảng / podcast của bài và tệp âm thanh đã tạo (docs/tieu-chi/nghe-giang-podcast.md).
-- Bảng mới, không đụng dữ liệu cũ.
CREATE TABLE "LessonNarration" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "script" JSONB NOT NULL,
    "scriptHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'script',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "audioKey" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "segments" JSONB,
    "voices" JSONB,
    "generatedHash" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonNarration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LessonNarration_lessonId_kind_key" ON "LessonNarration"("lessonId", "kind");
CREATE INDEX "LessonNarration_status_idx" ON "LessonNarration"("status");

ALTER TABLE "LessonNarration" ADD CONSTRAINT "LessonNarration_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
