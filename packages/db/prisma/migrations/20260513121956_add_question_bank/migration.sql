-- CreateEnum
CREATE TYPE "QuestionBankVisibility" AS ENUM ('private', 'course', 'org');

-- CreateEnum
CREATE TYPE "BankQuestionStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "QuestionBank" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "courseId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "QuestionBankVisibility" NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankQuestion" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "type" "ExamQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "estimatedTimeSec" INTEGER,
    "status" "BankQuestionStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankQuestionSkillTag" (
    "bankQuestionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "BankQuestionSkillTag_pkey" PRIMARY KEY ("bankQuestionId","skillId")
);

-- CreateTable
CREATE TABLE "BankQuestionVersion" (
    "id" TEXT NOT NULL,
    "bankQuestionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankQuestionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestionFromBank" (
    "examQuestionId" TEXT NOT NULL,
    "bankQuestionId" TEXT NOT NULL,
    "bankQuestionVersionId" TEXT NOT NULL,
    "copiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamQuestionFromBank_pkey" PRIMARY KEY ("examQuestionId")
);

-- CreateIndex
CREATE INDEX "QuestionBank_ownerUserId_idx" ON "QuestionBank"("ownerUserId");

-- CreateIndex
CREATE INDEX "QuestionBank_courseId_idx" ON "QuestionBank"("courseId");

-- CreateIndex
CREATE INDEX "BankQuestion_bankId_status_idx" ON "BankQuestion"("bankId", "status");

-- CreateIndex
CREATE INDEX "BankQuestion_difficulty_idx" ON "BankQuestion"("difficulty");

-- CreateIndex
CREATE INDEX "BankQuestionSkillTag_skillId_idx" ON "BankQuestionSkillTag"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "BankQuestionVersion_bankQuestionId_versionNumber_key" ON "BankQuestionVersion"("bankQuestionId", "versionNumber");

-- CreateIndex
CREATE INDEX "ExamQuestionFromBank_bankQuestionId_idx" ON "ExamQuestionFromBank"("bankQuestionId");

-- AddForeignKey
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestion" ADD CONSTRAINT "BankQuestion_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "QuestionBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestionSkillTag" ADD CONSTRAINT "BankQuestionSkillTag_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "BankQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestionSkillTag" ADD CONSTRAINT "BankQuestionSkillTag_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestionVersion" ADD CONSTRAINT "BankQuestionVersion_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "BankQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestionFromBank" ADD CONSTRAINT "ExamQuestionFromBank_examQuestionId_fkey" FOREIGN KEY ("examQuestionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestionFromBank" ADD CONSTRAINT "ExamQuestionFromBank_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "BankQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestionFromBank" ADD CONSTRAINT "ExamQuestionFromBank_bankQuestionVersionId_fkey" FOREIGN KEY ("bankQuestionVersionId") REFERENCES "BankQuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
