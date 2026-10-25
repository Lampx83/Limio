-- Bài giảng slide gắn với bài học (docs/tieu-chi/nghe-giang-slide.md, AC1).
ALTER TABLE "Lesson" ADD COLUMN "liveDeckId" TEXT;

CREATE UNIQUE INDEX "Lesson_liveDeckId_key" ON "Lesson"("liveDeckId");

ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_liveDeckId_fkey" FOREIGN KEY ("liveDeckId") REFERENCES "LiveDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
