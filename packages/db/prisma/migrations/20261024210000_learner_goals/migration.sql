-- CreateEnum
CREATE TYPE "GoalFramework" AS ENUM ('HSK', 'IELTS', 'TOEIC', 'CEFR', 'custom');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('active', 'achieved', 'archived');

-- CreateTable
CREATE TABLE "LearnerGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "framework" "GoalFramework" NOT NULL,
    "targetLevel" TEXT NOT NULL,
    "targetDate" DATE NOT NULL,
    "hoursPerWeek" DOUBLE PRECISION,
    "status" "GoalStatus" NOT NULL DEFAULT 'active',
    "setById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionGoal" (
    "sectionId" TEXT NOT NULL,
    "framework" "GoalFramework" NOT NULL,
    "targetLevel" TEXT NOT NULL,
    "targetDate" DATE,
    "hoursPerWeek" DOUBLE PRECISION,
    "setById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionGoal_pkey" PRIMARY KEY ("sectionId")
);

-- CreateIndex
CREATE INDEX "LearnerGoal_userId_status_idx" ON "LearnerGoal"("userId", "status");

-- CreateIndex
CREATE INDEX "LearnerGoal_courseId_idx" ON "LearnerGoal"("courseId");

-- AddForeignKey
ALTER TABLE "LearnerGoal" ADD CONSTRAINT "LearnerGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionGoal" ADD CONSTRAINT "SectionGoal_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
