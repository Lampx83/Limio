-- AlterTable: thời gian dừng theo trang PDF (nullable — dòng cũ chưa từng đo)
ALTER TABLE "LessonEngagement" ADD COLUMN "pdfPages" JSONB;
