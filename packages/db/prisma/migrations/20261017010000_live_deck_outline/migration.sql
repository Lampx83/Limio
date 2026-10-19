-- Dàn ý AI cho bài giảng Limio-Live sinh từ tài liệu. Cột nullable, không đụng dữ liệu cũ.
ALTER TABLE "LiveDeck" ADD COLUMN "outline" JSONB,
ADD COLUMN "outlineMinutes" INTEGER,
ADD COLUMN "outlineConfirmedAt" TIMESTAMP(3),
ADD COLUMN "sourceName" TEXT,
ADD COLUMN "sourceText" TEXT;
