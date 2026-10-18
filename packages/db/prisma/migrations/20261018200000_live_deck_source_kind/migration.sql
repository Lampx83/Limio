-- Bài giảng Limio-Live soạn từ mô tả chủ đề (có thể kèm nguồn internet).
ALTER TABLE "LiveDeck" ADD COLUMN "sourceKind" TEXT;
ALTER TABLE "LiveDeck" ADD COLUMN "sourceRefs" JSONB;
