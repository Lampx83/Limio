-- CreateEnum
CREATE TYPE "SubmissionMode" AS ENUM ('individual', 'team');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "teamMaxSize" INTEGER,
ADD COLUMN     "teamsLockedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "submissionMode" "SubmissionMode" NOT NULL DEFAULT 'individual';

-- AlterTable
ALTER TABLE "AssignmentSubmission" ADD COLUMN     "contributionNote" TEXT,
ADD COLUMN     "scoreOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scoreOverrideNote" TEXT,
ADD COLUMN     "submittedById" TEXT,
ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "teamScore" INTEGER,
ADD COLUMN     "teamSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CourseTeam" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "captainId" TEXT,
    "joinCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseTeam_joinCode_key" ON "CourseTeam"("joinCode");

-- CreateIndex
CREATE INDEX "CourseTeam_courseId_idx" ON "CourseTeam"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseTeam_courseId_name_key" ON "CourseTeam"("courseId", "name");

-- CreateIndex
CREATE INDEX "CourseTeamMember_teamId_joinedAt_idx" ON "CourseTeamMember"("teamId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseTeamMember_courseId_userId_key" ON "CourseTeamMember"("courseId", "userId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_assignmentId_teamId_idx" ON "AssignmentSubmission"("assignmentId", "teamId");

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "CourseTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTeam" ADD CONSTRAINT "CourseTeam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTeam" ADD CONSTRAINT "CourseTeam_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTeamMember" ADD CONSTRAINT "CourseTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "CourseTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTeamMember" ADD CONSTRAINT "CourseTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

