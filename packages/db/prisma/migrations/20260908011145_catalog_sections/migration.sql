-- CreateEnum
CREATE TYPE "CatalogSectionType" AS ENUM ('MANUAL', 'AUTO_RECENT');

-- CreateTable
CREATE TABLE "CatalogSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CatalogSectionType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSectionCourse" (
    "sectionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogSectionCourse_pkey" PRIMARY KEY ("sectionId","courseId")
);

-- CreateIndex
CREATE INDEX "CatalogSection_isActive_order_idx" ON "CatalogSection"("isActive", "order");

-- CreateIndex
CREATE INDEX "CatalogSectionCourse_courseId_idx" ON "CatalogSectionCourse"("courseId");

-- AddForeignKey
ALTER TABLE "CatalogSectionCourse" ADD CONSTRAINT "CatalogSectionCourse_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CatalogSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSectionCourse" ADD CONSTRAINT "CatalogSectionCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

