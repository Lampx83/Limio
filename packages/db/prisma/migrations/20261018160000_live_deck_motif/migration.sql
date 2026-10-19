-- Hoa văn trang trí của cả bài giảng Limio-Live: null = tự động, "none" = không dùng, hoặc mã hoa văn chủ đạo
-- (apps/web/src/lib/limioLiveMotifs.ts). Cột nullable, không đụng dữ liệu cũ.
ALTER TABLE "LiveDeck" ADD COLUMN "motif" TEXT;
