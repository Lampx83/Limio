-- Video giảng viên nói (Ditto) của lời giảng: cột thêm, cho phép rỗng, không đụng dữ liệu cũ.
ALTER TABLE "LessonNarration"
  ADD COLUMN "videoKey" TEXT,
  ADD COLUMN "videoSmKey" TEXT,
  ADD COLUMN "videoSizeBytes" INTEGER,
  ADD COLUMN "videoSmSizeBytes" INTEGER,
  ADD COLUMN "videoForHash" TEXT,
  ADD COLUMN "videoLecturer" TEXT,
  ADD COLUMN "videoBuiltAt" TIMESTAMP(3);
