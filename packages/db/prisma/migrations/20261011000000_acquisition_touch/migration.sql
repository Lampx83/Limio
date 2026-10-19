-- Growth attribution (first touch) + chỉ mục cho luồng growth events.
--
-- Chỉ cộng thêm: một bảng mới và 4 index. Không đụng dữ liệu cũ, không đụng
-- LearningEvent. Các bảng được đánh index (User, Enrollment, Order) nhỏ — CREATE
-- INDEX giữ khoá ghi trong chớp nhoáng.

-- CreateTable
CREATE TABLE "AcquisitionTouch" (
    "userId" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "clickIdKind" TEXT,
    "landingPath" TEXT,
    "referrerHost" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcquisitionTouch_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "AcquisitionTouch" ADD CONSTRAINT "AcquisitionTouch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "User_emailVerifiedAt_idx" ON "User"("emailVerifiedAt");

-- CreateIndex
CREATE INDEX "Enrollment_enrolledAt_idx" ON "Enrollment"("enrolledAt");

-- CreateIndex
CREATE INDEX "Order_paidAt_idx" ON "Order"("paidAt");

-- CreateIndex
CREATE INDEX "Order_refundedAt_idx" ON "Order"("refundedAt");
