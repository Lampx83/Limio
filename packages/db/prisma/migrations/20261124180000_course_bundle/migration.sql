-- Combo khoá học (docs/tieu-chi/combo-khoa-hoc.md). Bảng thêm mới + hai cột trên Order; đơn hiện có không đổi.

-- Đơn combo không gắn một khoá cụ thể.
ALTER TABLE "Order" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "bundleId" TEXT;

CREATE TABLE "CourseBundle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "coverUrl" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "priceCents" INTEGER NOT NULL,
    "originalPriceCents" INTEGER,
    "durationMonths" INTEGER,
    "status" "CourseStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseBundleItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CourseBundleItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseBundle_slug_key" ON "CourseBundle"("slug");
CREATE INDEX "CourseBundle_status_idx" ON "CourseBundle"("status");
CREATE UNIQUE INDEX "CourseBundleItem_bundleId_courseId_key" ON "CourseBundleItem"("bundleId", "courseId");
CREATE INDEX "CourseBundleItem_courseId_idx" ON "CourseBundleItem"("courseId");
CREATE INDEX "Order_bundleId_status_idx" ON "Order"("bundleId", "status");

ALTER TABLE "CourseBundleItem" ADD CONSTRAINT "CourseBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "CourseBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseBundleItem" ADD CONSTRAINT "CourseBundleItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "CourseBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
