-- Phiên bản cũ của slide Limio-Live để hoàn tác. Bảng mới, không đụng dữ liệu cũ.
CREATE TABLE "LiveSlideVersion" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" "LiveSlideType" NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveSlideVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveSlideVersion_slideId_createdAt_idx" ON "LiveSlideVersion"("slideId", "createdAt");

ALTER TABLE "LiveSlideVersion" ADD CONSTRAINT "LiveSlideVersion_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "LiveSlide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
