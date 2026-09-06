-- B14 — khoá nội dung: học viên thấy tên bài trong mục lục kèm ổ khoá, nhưng
-- không mở được. Khác với ẩn, vốn làm nội dung biến mất hoàn toàn.
ALTER TABLE "Module" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lesson" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
