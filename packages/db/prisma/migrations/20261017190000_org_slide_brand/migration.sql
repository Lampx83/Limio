-- Thương hiệu của trường cho slide Limio-Live + cờ tắt thương hiệu theo bài giảng. Chỉ thêm cột.
ALTER TABLE "Organization" ADD COLUMN "slideBrand" JSONB;
ALTER TABLE "LiveDeck" ADD COLUMN "brandOff" BOOLEAN NOT NULL DEFAULT false;
