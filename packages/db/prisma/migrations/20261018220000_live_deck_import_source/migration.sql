-- Bài giảng Limio-Live nhập từ PowerPoint: dữ liệu từng slide gốc (xem apps/web/src/lib/limioLivePptx.ts).
ALTER TABLE "LiveDeck" ADD COLUMN "importSource" JSONB;
