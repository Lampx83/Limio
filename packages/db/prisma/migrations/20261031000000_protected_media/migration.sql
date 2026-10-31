-- AC1 học liệu bản quyền: cờ theo khoá + bảng tra file → khoá. Chỉ thêm, mặc định false nên khoá đang có không đổi.
ALTER TABLE "Course" ADD COLUMN "protectedMedia" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ProtectedMediaFile" (
    "filename" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtectedMediaFile_pkey" PRIMARY KEY ("filename","courseId")
);

CREATE INDEX "ProtectedMediaFile_courseId_idx" ON "ProtectedMediaFile"("courseId");

ALTER TABLE "ProtectedMediaFile" ADD CONSTRAINT "ProtectedMediaFile_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
