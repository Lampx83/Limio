-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ExamAttemptPolicy" AS ENUM ('single', 'multi');

-- CreateEnum
CREATE TYPE "ExamGradingMode" AS ENUM ('auto', 'manual', 'hybrid');

-- CreateEnum
CREATE TYPE "ExamProctoringLevel" AS ENUM ('none', 'basic', 'strict');

-- CreateEnum
CREATE TYPE "ExamAttemptStatus" AS ENUM ('in_progress', 'submitted', 'auto_submitted', 'graded', 'flagged');

-- CreateEnum
CREATE TYPE "ExamQuestionType" AS ENUM ('mcq', 'multi', 'true_false_notgiven', 'gap_fill', 'short_answer', 'essay', 'matching_heading');

-- CreateEnum
CREATE TYPE "ExamAssetType" AS ENUM ('image', 'audio', 'video');

-- CreateEnum
CREATE TYPE "ExamPassageAudioPolicy" AS ENUM ('free_replay', 'limited_replay', 'once_only');

-- CreateEnum
CREATE TYPE "ExamPassageRevealMode" AS ENUM ('all_at_once', 'sequential');

-- CreateEnum
CREATE TYPE "ExamIncidentType" AS ENUM ('tab_blur', 'fullscreen_exit', 'paste', 'multi_tab', 'network_lost', 'multi_face');

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMin" INTEGER NOT NULL,
    "openAt" TIMESTAMP(3) NOT NULL,
    "closeAt" TIMESTAMP(3) NOT NULL,
    "attemptPolicy" "ExamAttemptPolicy" NOT NULL DEFAULT 'single',
    "gradingMode" "ExamGradingMode" NOT NULL DEFAULT 'hybrid',
    "proctoringLevel" "ExamProctoringLevel" NOT NULL DEFAULT 'none',
    "passScore" INTEGER NOT NULL DEFAULT 50,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT true,
    "showResultsAfterSubmit" BOOLEAN NOT NULL DEFAULT true,
    "status" "ExamStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamPassage" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "audioPolicy" "ExamPassageAudioPolicy" NOT NULL DEFAULT 'free_replay',
    "maxAudioPlays" INTEGER,
    "revealMode" "ExamPassageRevealMode" NOT NULL DEFAULT 'all_at_once',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamPassage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamPassageSkillTag" (
    "passageId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "ExamPassageSkillTag_pkey" PRIMARY KEY ("passageId","skillId")
);

-- CreateTable
CREATE TABLE "ExamAsset" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "type" "ExamAssetType" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "metadata" JSONB,
    "altText" TEXT,
    "transcript" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "passageId" TEXT,
    "type" "ExamQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "evidenceSpan" JSONB,
    "points" INTEGER NOT NULL DEFAULT 1,
    "orderInPassage" INTEGER,
    "orderInExam" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestionSkillTag" (
    "questionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "ExamQuestionSkillTag_pkey" PRIMARY KEY ("questionId","skillId")
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ExamAttemptStatus" NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "resumeCount" INTEGER NOT NULL DEFAULT 0,
    "shuffleSnapshot" JSONB,
    "score" DOUBLE PRECISION,
    "scorePct" DOUBLE PRECISION,
    "passed" BOOLEAN,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerJson" JSONB,
    "autoScore" DOUBLE PRECISION,
    "manualScore" DOUBLE PRECISION,
    "needsGrading" BOOLEAN NOT NULL DEFAULT false,
    "answerHash" TEXT,
    "graderId" TEXT,
    "gradedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamGradeHistory" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "oldScore" DOUBLE PRECISION,
    "newScore" DOUBLE PRECISION,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamGradeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamIncident" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" "ExamIncidentType" NOT NULL,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exam_courseId_status_idx" ON "Exam"("courseId", "status");

-- CreateIndex
CREATE INDEX "Exam_status_openAt_closeAt_idx" ON "Exam"("status", "openAt", "closeAt");

-- CreateIndex
CREATE INDEX "ExamPassage_examId_idx" ON "ExamPassage"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamPassage_examId_orderIndex_key" ON "ExamPassage"("examId", "orderIndex");

-- CreateIndex
CREATE INDEX "ExamPassageSkillTag_skillId_idx" ON "ExamPassageSkillTag"("skillId");

-- CreateIndex
CREATE INDEX "ExamAsset_examId_type_idx" ON "ExamAsset"("examId", "type");

-- CreateIndex
CREATE INDEX "ExamQuestion_examId_orderInExam_idx" ON "ExamQuestion"("examId", "orderInExam");

-- CreateIndex
CREATE INDEX "ExamQuestion_passageId_orderInPassage_idx" ON "ExamQuestion"("passageId", "orderInPassage");

-- CreateIndex
CREATE INDEX "ExamQuestionSkillTag_skillId_idx" ON "ExamQuestionSkillTag"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAttempt_sessionToken_key" ON "ExamAttempt"("sessionToken");

-- CreateIndex
CREATE INDEX "ExamAttempt_examId_status_idx" ON "ExamAttempt"("examId", "status");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_submittedAt_idx" ON "ExamAttempt"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "ExamAttempt_status_startedAt_idx" ON "ExamAttempt"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAttempt_examId_userId_key" ON "ExamAttempt"("examId", "userId");

-- CreateIndex
CREATE INDEX "ExamAnswer_attemptId_needsGrading_idx" ON "ExamAnswer"("attemptId", "needsGrading");

-- CreateIndex
CREATE INDEX "ExamAnswer_questionId_idx" ON "ExamAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAnswer_attemptId_questionId_key" ON "ExamAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "ExamGradeHistory_answerId_changedAt_idx" ON "ExamGradeHistory"("answerId", "changedAt");

-- CreateIndex
CREATE INDEX "ExamIncident_attemptId_occurredAt_idx" ON "ExamIncident"("attemptId", "occurredAt");

-- CreateIndex
CREATE INDEX "ExamIncident_type_occurredAt_idx" ON "ExamIncident"("type", "occurredAt");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPassage" ADD CONSTRAINT "ExamPassage_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPassageSkillTag" ADD CONSTRAINT "ExamPassageSkillTag_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "ExamPassage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPassageSkillTag" ADD CONSTRAINT "ExamPassageSkillTag_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAsset" ADD CONSTRAINT "ExamAsset_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAsset" ADD CONSTRAINT "ExamAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "ExamPassage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestionSkillTag" ADD CONSTRAINT "ExamQuestionSkillTag_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestionSkillTag" ADD CONSTRAINT "ExamQuestionSkillTag_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_graderId_fkey" FOREIGN KEY ("graderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamGradeHistory" ADD CONSTRAINT "ExamGradeHistory_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ExamAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamGradeHistory" ADD CONSTRAINT "ExamGradeHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamIncident" ADD CONSTRAINT "ExamIncident_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

