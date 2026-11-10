-- Limio Vấn đáp Mốc 0/1 (docs/tieu-chi/limio-van-dap.md): bảng riêng, không đụng Exam/OralExam*.
CREATE TYPE "VanDapExamStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "VanDapLevel" AS ENUM ('basic', 'intermediate', 'advanced');
CREATE TYPE "VanDapSessionStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "VanDapExam" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "courseId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "VanDapExamStatus" NOT NULL DEFAULT 'draft',
    "language" "OralExamLanguage" NOT NULL DEFAULT 'vi',
    "durationMin" INTEGER NOT NULL DEFAULT 15,
    "toneNote" TEXT,
    "rubricText" TEXT,
    "legacyPrompt" TEXT,
    "importedFromExamId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VanDapExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanDapMaterial" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "s3Key" TEXT,
    "extractedText" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VanDapMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanDapItem" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "core" TEXT NOT NULL,
    "sourceExcerpt" TEXT NOT NULL DEFAULT '',
    "level" "VanDapLevel" NOT NULL DEFAULT 'intermediate',
    "expectedAnswer" TEXT NOT NULL DEFAULT '',
    "maxFollowUps" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VanDapItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanDapScenario" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "aiContext" TEXT NOT NULL,
    "studentBrief" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VanDapScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanDapSession" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "title" TEXT,
    "joinCode" TEXT NOT NULL,
    "status" "VanDapSessionStatus" NOT NULL DEFAULT 'open',
    "openedById" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "VanDapSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VanDapExam_createdById_createdAt_idx" ON "VanDapExam"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "VanDapExam_courseId_idx" ON "VanDapExam"("courseId");

-- CreateIndex
CREATE INDEX "VanDapMaterial_examId_orderIndex_idx" ON "VanDapMaterial"("examId", "orderIndex");

-- CreateIndex
CREATE INDEX "VanDapItem_examId_orderIndex_idx" ON "VanDapItem"("examId", "orderIndex");

-- CreateIndex
CREATE INDEX "VanDapScenario_examId_orderIndex_idx" ON "VanDapScenario"("examId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "VanDapSession_joinCode_key" ON "VanDapSession"("joinCode");

-- CreateIndex
CREATE INDEX "VanDapSession_examId_status_idx" ON "VanDapSession"("examId", "status");

-- AddForeignKey
ALTER TABLE "VanDapExam" ADD CONSTRAINT "VanDapExam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanDapExam" ADD CONSTRAINT "VanDapExam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanDapMaterial" ADD CONSTRAINT "VanDapMaterial_examId_fkey" FOREIGN KEY ("examId") REFERENCES "VanDapExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanDapItem" ADD CONSTRAINT "VanDapItem_examId_fkey" FOREIGN KEY ("examId") REFERENCES "VanDapExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanDapScenario" ADD CONSTRAINT "VanDapScenario_examId_fkey" FOREIGN KEY ("examId") REFERENCES "VanDapExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanDapSession" ADD CONSTRAINT "VanDapSession_examId_fkey" FOREIGN KEY ("examId") REFERENCES "VanDapExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

