-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "OralExamMaterialChunk" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OralExamMaterialChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OralExamMaterialChunk_materialId_chunkIndex_idx" ON "OralExamMaterialChunk"("materialId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "OralExamMaterialChunk" ADD CONSTRAINT "OralExamMaterialChunk_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "OralExamMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

