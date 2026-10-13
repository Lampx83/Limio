-- Embeddings chuyển từ OpenAI (text-embedding-3-small) sang Qwen3-Embedding tự host. Vector của hai model
-- không so sánh được, nên mỗi chunk ghi model đã sinh ra nó; tìm kiếm chỉ xét chunk cùng model hiện hành.
ALTER TABLE "OralExamMaterialChunk" ADD COLUMN "embeddingModel" TEXT;

-- Mọi vector hiện có đều do OpenAI sinh. Chúng bị bỏ qua khi tìm (AI lùi về từ khoá) cho tới khi tài liệu
-- được embed lại bằng model mới.
UPDATE "OralExamMaterialChunk" SET "embeddingModel" = 'text-embedding-3-small' WHERE "embedding" IS NOT NULL;
