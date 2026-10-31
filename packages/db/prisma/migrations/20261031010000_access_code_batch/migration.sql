-- AC2 lô mã kích hoạt: chỉ thêm. Mã có từ trước có batchId NULL, giữ nguyên.
CREATE TABLE "CourseAccessCodeBatch" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "count" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseAccessCodeBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseAccessCodeBatch_courseId_createdAt_idx" ON "CourseAccessCodeBatch"("courseId", "createdAt");

ALTER TABLE "CourseAccessCode" ADD COLUMN "batchId" TEXT;

CREATE INDEX "CourseAccessCode_batchId_status_idx" ON "CourseAccessCode"("batchId", "status");

ALTER TABLE "CourseAccessCodeBatch" ADD CONSTRAINT "CourseAccessCodeBatch_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseAccessCodeBatch" ADD CONSTRAINT "CourseAccessCodeBatch_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourseAccessCode" ADD CONSTRAINT "CourseAccessCode_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CourseAccessCodeBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
