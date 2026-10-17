-- Mã tham gia theo từng slide tương tác của một phiên Limio-Live, và cờ tạm dừng phiên.
ALTER TABLE "LiveSession" ADD COLUMN "pausedAt" TIMESTAMP(3);

CREATE TABLE "LiveSlideCode" (
    "code" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveSlideCode_pkey" PRIMARY KEY ("code")
);

CREATE UNIQUE INDEX "LiveSlideCode_sessionId_slideId_key" ON "LiveSlideCode"("sessionId", "slideId");
CREATE INDEX "LiveSlideCode_slideId_idx" ON "LiveSlideCode"("slideId");

ALTER TABLE "LiveSlideCode" ADD CONSTRAINT "LiveSlideCode_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveSlideCode" ADD CONSTRAINT "LiveSlideCode_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "LiveSlide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
