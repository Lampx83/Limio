-- LANG đợt 2 — Thư viện giáo trình (docs/tieu-chi/limio-language-hoc-vien-dot-2.md).
-- Cột thêm có mặc định hoặc cho phép rỗng: khoá đang có không đổi hành vi và không tự vào thư viện.
ALTER TABLE "Course"
  ADD COLUMN "inLibrary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publisher" TEXT,
  ADD COLUMN "authors" TEXT,
  ADD COLUMN "edition" TEXT,
  ADD COLUMN "levelBand" TEXT,
  ADD COLUMN "focusTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Course_inLibrary_status_idx" ON "Course"("inLibrary", "status");

CREATE TABLE "CourseSave" (
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseSave_pkey" PRIMARY KEY ("userId", "courseId")
);

CREATE INDEX "CourseSave_userId_createdAt_idx" ON "CourseSave"("userId", "createdAt");
CREATE INDEX "CourseSave_courseId_idx" ON "CourseSave"("courseId");

ALTER TABLE "CourseSave" ADD CONSTRAINT "CourseSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSave" ADD CONSTRAINT "CourseSave_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
