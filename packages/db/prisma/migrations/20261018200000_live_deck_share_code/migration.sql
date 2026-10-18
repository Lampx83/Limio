-- Link xem chỉ đọc của bài giảng Limio-Live (/bai-giang/<shareCode>). Null = không chia sẻ.
ALTER TABLE "LiveDeck" ADD COLUMN "shareCode" TEXT;

CREATE UNIQUE INDEX "LiveDeck_shareCode_key" ON "LiveDeck"("shareCode");
