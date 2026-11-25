-- Mã kích hoạt combo (docs/tieu-chi/combo-khoa-hoc.md, AC8). Bảng thêm mới, không đụng dữ liệu hiện có.
CREATE TABLE "BundleAccessCode" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CourseAccessCodeStatus" NOT NULL DEFAULT 'unused',
    "redeemedByUserId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleAccessCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BundleAccessCode_code_key" ON "BundleAccessCode"("code");
CREATE INDEX "BundleAccessCode_bundleId_status_idx" ON "BundleAccessCode"("bundleId", "status");

ALTER TABLE "BundleAccessCode" ADD CONSTRAINT "BundleAccessCode_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "CourseBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
