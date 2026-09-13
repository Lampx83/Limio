-- Whiteboard Phase B: annotate-tài-liệu (multi-page background images).
-- snapshot đổi shape từ mảng elements phẳng → map theo trang { "page": [...] }.
-- Migrate dữ liệu cũ (nếu có) sang shape mới, key "0" (trang ảo duy nhất của
-- bảng trắng tự do Phase A).

-- AlterTable
ALTER TABLE "Whiteboard" ADD COLUMN     "pages" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Whiteboard" ADD COLUMN     "currentPage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Whiteboard" ALTER COLUMN "snapshot" SET DEFAULT '{}';

-- DataMigration: bọc snapshot dạng mảng cũ vào key "0" của map mới.
UPDATE "Whiteboard"
SET snapshot = jsonb_build_object('0', snapshot)
WHERE jsonb_typeof(snapshot) = 'array';
