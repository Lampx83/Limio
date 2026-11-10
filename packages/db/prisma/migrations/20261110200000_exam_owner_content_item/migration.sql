-- LANG — editor riêng cho "Bài luyện" (docs/tieu-chi/limio-language-bai-luyen-editor.md).
-- Khối Bài luyện sở hữu một bản đề ẩn: Exam.ownerContentItemId trỏ tới ContentItem. Xoá khối thì xoá đề (và đoạn, câu,
-- lượt luyện) theo. Cột mới null cho mọi đề đang có nên không đổi dữ liệu nào.
ALTER TABLE "Exam" ADD COLUMN "ownerContentItemId" TEXT;
CREATE UNIQUE INDEX "Exam_ownerContentItemId_key" ON "Exam"("ownerContentItemId");
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_ownerContentItemId_fkey" FOREIGN KEY ("ownerContentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
