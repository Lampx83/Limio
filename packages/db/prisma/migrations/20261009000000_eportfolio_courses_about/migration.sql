-- A8 — e-portfolio: đoạn giới thiệu + chọn khoá học để khoe (kèm chứng nhận).
-- AlterTable
ALTER TABLE "Portfolio" ADD COLUMN "about" TEXT;

-- CreateTable
CREATE TABLE "PortfolioCourse" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioCourse_certificateId_idx" ON "PortfolioCourse"("certificateId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioCourse_portfolioId_certificateId_key" ON "PortfolioCourse"("portfolioId", "certificateId");

-- AddForeignKey
ALTER TABLE "PortfolioCourse" ADD CONSTRAINT "PortfolioCourse_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCourse" ADD CONSTRAINT "PortfolioCourse_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Từ nay bài của một khoá chỉ hiện khi khoá đó được khoe. Hồ sơ đã ghim bài
-- từ trước (bản tối giản) giữ nguyên diện mạo: tự khoe các khoá đã có chứng
-- nhận và có bài được ghim.
INSERT INTO "PortfolioCourse" ("id", "portfolioId", "certificateId")
SELECT gen_random_uuid()::text, pi."portfolioId", c."id"
FROM (
    SELECT DISTINCT pit."portfolioId", p."userId", m."courseId"
    FROM "PortfolioItem" pit
    JOIN "Portfolio" p ON p."id" = pit."portfolioId"
    JOIN "AssignmentSubmission" s ON s."id" = pit."submissionId"
    JOIN "Assignment" a ON a."id" = s."assignmentId"
    JOIN "Lesson" l ON l."id" = a."lessonId"
    JOIN "Module" m ON m."id" = l."moduleId"
) pi
JOIN "Certificate" c ON c."userId" = pi."userId" AND c."courseId" = pi."courseId"
ON CONFLICT DO NOTHING;
