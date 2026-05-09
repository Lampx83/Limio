-- DropForeignKey
ALTER TABLE "WordCloudSubmission" DROP CONSTRAINT "WordCloudSubmission_userId_fkey";

-- AlterTable
ALTER TABLE "WordCloud" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "WordCloudSubmission" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "WordCloud_createdById_createdAt_idx" ON "WordCloud"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "WordCloud" ADD CONSTRAINT "WordCloud_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordCloudSubmission" ADD CONSTRAINT "WordCloudSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
