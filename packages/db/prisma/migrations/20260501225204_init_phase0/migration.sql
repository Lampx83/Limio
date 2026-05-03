-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('draft', 'review', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('video', 'markdown', 'embed', 'file', 'external_link');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'completed', 'dropped', 'refunded');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('mcq', 'true_false', 'fill_in', 'ordering');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('in_progress', 'submitted', 'abandoned');

-- CreateEnum
CREATE TYPE "SkillContentType" AS ENUM ('lesson', 'content_item', 'quiz');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthProvider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "courseId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "level" TEXT NOT NULL DEFAULT 'beginner',
    "category" TEXT,
    "coverUrl" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseInstructor" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseInstructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "completionThresholdPct" INTEGER DEFAULT 80,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "payload" JSONB NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseVersion" INTEGER NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastLessonId" TEXT,
    "lastPositionSec" INTEGER,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" INTEGER,
    "passThresholdPct" INTEGER NOT NULL DEFAULT 70,
    "timeLimitSec" INTEGER,
    "maxAttempts" INTEGER,
    "randomizeOrder" BOOLEAN NOT NULL DEFAULT false,
    "requireConfidence" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "misconceptionId" TEXT,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "scorePct" DOUBLE PRECISION,
    "passed" BOOLEAN,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerResponse" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "confidence" INTEGER,
    "responseTimeMs" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Misconception" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Misconception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillPrerequisite" (
    "skillId" TEXT NOT NULL,
    "prerequisiteSkillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillPrerequisite_pkey" PRIMARY KEY ("skillId","prerequisiteSkillId")
);

-- CreateTable
CREATE TABLE "ContentSkillMapping" (
    "id" TEXT NOT NULL,
    "contentType" "SkillContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "coverageWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSkillMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSkillTag" (
    "questionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "QuestionSkillTag_pkey" PRIMARY KEY ("questionId","skillId")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" BIGSERIAL NOT NULL,
    "eventKey" TEXT,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "courseId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "AuthProvider_userId_idx" ON "AuthProvider"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthProvider_provider_providerUserId_key" ON "AuthProvider"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_courseId_idx" ON "UserRole"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_courseId_key" ON "UserRole"("userId", "roleId", "courseId");

-- CreateIndex
CREATE INDEX "AuditLog_action_occurredAt_idx" ON "AuditLog"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_occurredAt_idx" ON "AuditLog"("targetUserId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_status_publishedAt_idx" ON "Course"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Course_category_level_idx" ON "Course"("category", "level");

-- CreateIndex
CREATE UNIQUE INDEX "CourseInstructor_courseId_userId_key" ON "CourseInstructor"("courseId", "userId");

-- CreateIndex
CREATE INDEX "Module_courseId_idx" ON "Module"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_courseId_orderIndex_key" ON "Module"("courseId", "orderIndex");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_idx" ON "Lesson"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_moduleId_orderIndex_key" ON "Lesson"("moduleId", "orderIndex");

-- CreateIndex
CREATE INDEX "ContentItem_lessonId_idx" ON "ContentItem"("lessonId");

-- CreateIndex
CREATE INDEX "Enrollment_userId_status_idx" ON "Enrollment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_courseId_key" ON "Enrollment"("userId", "courseId");

-- CreateIndex
CREATE INDEX "Quiz_lessonId_idx" ON "Quiz"("lessonId");

-- CreateIndex
CREATE INDEX "Quiz_courseId_idx" ON "Quiz"("courseId");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_orderIndex_idx" ON "QuizQuestion"("quizId", "orderIndex");

-- CreateIndex
CREATE INDEX "QuestionOption_questionId_idx" ON "QuestionOption"("questionId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizId_idx" ON "QuizAttempt"("userId", "quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_status_idx" ON "QuizAttempt"("quizId", "status");

-- CreateIndex
CREATE INDEX "AnswerResponse_questionId_isCorrect_idx" ON "AnswerResponse"("questionId", "isCorrect");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerResponse_attemptId_questionId_key" ON "AnswerResponse"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Misconception_code_key" ON "Misconception"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_code_key" ON "Skill"("code");

-- CreateIndex
CREATE INDEX "SkillPrerequisite_prerequisiteSkillId_idx" ON "SkillPrerequisite"("prerequisiteSkillId");

-- CreateIndex
CREATE INDEX "ContentSkillMapping_skillId_idx" ON "ContentSkillMapping"("skillId");

-- CreateIndex
CREATE INDEX "ContentSkillMapping_contentType_contentId_idx" ON "ContentSkillMapping"("contentType", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentSkillMapping_contentType_contentId_skillId_key" ON "ContentSkillMapping"("contentType", "contentId", "skillId");

-- CreateIndex
CREATE INDEX "QuestionSkillTag_skillId_idx" ON "QuestionSkillTag"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningEvent_eventKey_key" ON "LearningEvent"("eventKey");

-- CreateIndex
CREATE INDEX "LearningEvent_userId_occurredAt_idx" ON "LearningEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "LearningEvent_eventType_occurredAt_idx" ON "LearningEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "LearningEvent_courseId_occurredAt_idx" ON "LearningEvent"("courseId", "occurredAt");

-- AddForeignKey
ALTER TABLE "AuthProvider" ADD CONSTRAINT "AuthProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_misconceptionId_fkey" FOREIGN KEY ("misconceptionId") REFERENCES "Misconception"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerResponse" ADD CONSTRAINT "AnswerResponse_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerResponse" ADD CONSTRAINT "AnswerResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPrerequisite" ADD CONSTRAINT "SkillPrerequisite_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPrerequisite" ADD CONSTRAINT "SkillPrerequisite_prerequisiteSkillId_fkey" FOREIGN KEY ("prerequisiteSkillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSkillMapping" ADD CONSTRAINT "ContentSkillMapping_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSkillMapping" ADD CONSTRAINT "csm_lesson_fk" FOREIGN KEY ("contentId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSkillTag" ADD CONSTRAINT "QuestionSkillTag_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSkillTag" ADD CONSTRAINT "QuestionSkillTag_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
