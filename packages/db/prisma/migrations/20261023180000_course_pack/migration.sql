-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "sourcePackId" TEXT,
ADD COLUMN     "sourcePackVersion" INTEGER;

-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "sessionNo" INTEGER;

-- CreateTable
CREATE TABLE "CoursePack" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "outcomeLevel" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoursePack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoursePack_courseId_key" ON "CoursePack"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePack_slug_key" ON "CoursePack"("slug");

-- CreateIndex
CREATE INDEX "CoursePack_isPublished_language_idx" ON "CoursePack"("isPublished", "language");

-- CreateIndex
CREATE INDEX "Module_courseId_sessionNo_idx" ON "Module"("courseId", "sessionNo");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_sourcePackId_fkey" FOREIGN KEY ("sourcePackId") REFERENCES "CoursePack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePack" ADD CONSTRAINT "CoursePack_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

