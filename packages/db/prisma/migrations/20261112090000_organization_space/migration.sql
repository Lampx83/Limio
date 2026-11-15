-- SPACE: trang riêng + nhận diện thương hiệu của trường/dự án (thêm cột, không đụng dữ liệu cũ).
ALTER TABLE "Organization" ADD COLUMN "spaceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "spaceSlug" TEXT;
ALTER TABLE "Organization" ADD COLUMN "space" JSONB;
CREATE UNIQUE INDEX "Organization_spaceSlug_key" ON "Organization"("spaceSlug");
