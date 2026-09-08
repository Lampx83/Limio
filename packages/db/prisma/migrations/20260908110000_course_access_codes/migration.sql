-- Mã kích hoạt khoá học có phí: giảng viên sinh mã, học viên gõ mã tự động
-- ghi danh, không qua admin duyệt. Khác AiTokenOrder (chỉ để đối soát) — mã
-- này tự nó cấp quyền, không ai xác minh lại.

CREATE TYPE "CourseAccessCodeStatus" AS ENUM ('unused', 'redeemed', 'revoked');

CREATE TABLE "CourseAccessCode" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CourseAccessCodeStatus" NOT NULL DEFAULT 'unused',
    "priceCentsSnapshot" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "createdBy" TEXT NOT NULL,
    "redeemedByUserId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseAccessCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseAccessCode_code_key" ON "CourseAccessCode"("code");
CREATE INDEX "CourseAccessCode_courseId_status_idx" ON "CourseAccessCode"("courseId", "status");
CREATE INDEX "CourseAccessCode_redeemedByUserId_idx" ON "CourseAccessCode"("redeemedByUserId");

ALTER TABLE "CourseAccessCode" ADD CONSTRAINT "CourseAccessCode_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseAccessCode" ADD CONSTRAINT "CourseAccessCode_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseAccessCode" ADD CONSTRAINT "CourseAccessCode_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
