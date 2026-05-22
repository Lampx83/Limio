-- C5.x — Tournament custom missions (content ngoài course + 4 verify mode).
-- See docs/tournament-custom-missions-AC.md

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('COURSE_LINKED', 'CUSTOM', 'EXTERNAL');
CREATE TYPE "VerifyMode" AS ENUM ('AUTO_GRADE', 'AUTO_CHECK', 'PEER_REVIEW', 'MANUAL_REVIEW');
CREATE TYPE "MissionSubmissionStatus" AS ENUM ('pending', 'passed', 'failed', 'disqualified');

-- AlterTable: Quiz can back an AUTO_GRADE mission (hidden from course listings).
ALTER TABLE "Quiz" ADD COLUMN "tournamentMissionId" TEXT;
CREATE UNIQUE INDEX "Quiz_tournamentMissionId_key" ON "Quiz"("tournamentMissionId");

-- AlterTable: Assignment can back a MANUAL_REVIEW mission and live without a lesson.
ALTER TABLE "Assignment" ALTER COLUMN "lessonId" DROP NOT NULL;
ALTER TABLE "Assignment" ADD COLUMN "tournamentMissionId" TEXT;
CREATE UNIQUE INDEX "Assignment_tournamentMissionId_key" ON "Assignment"("tournamentMissionId");
CREATE INDEX "Assignment_tournamentMissionId_idx" ON "Assignment"("tournamentMissionId");

-- CHECK constraint — every Assignment must belong to a lesson OR a tournament mission.
ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_lesson_or_mission_check"
  CHECK ("lessonId" IS NOT NULL OR "tournamentMissionId" IS NOT NULL);

-- AlterTable: TournamentMission gains type/verify-mode + custom content + peer review config.
ALTER TABLE "TournamentMission"
  ADD COLUMN "missionType"         "MissionType"  NOT NULL DEFAULT 'COURSE_LINKED',
  ADD COLUMN "verifyMode"          "VerifyMode",
  ADD COLUMN "submissionDeadline"  TIMESTAMP(3),
  ADD COLUMN "contentPayload"      JSONB,
  ADD COLUMN "autoCheckRule"       JSONB,
  ADD COLUMN "rubric"              JSONB,
  ADD COLUMN "peerReviewerCount"   INTEGER DEFAULT 3,
  ADD COLUMN "reviewWindowEndAt"   TIMESTAMP(3),
  ADD COLUMN "passThreshold"       DOUBLE PRECISION,
  ADD COLUMN "reviewExtendCount"   INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "TournamentMission_missionType_verifyMode_idx"
  ON "TournamentMission"("missionType", "verifyMode");

-- CreateTable: MissionSubmission
CREATE TABLE "MissionSubmission" (
    "id"          TEXT NOT NULL,
    "missionId"   TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload"     JSONB NOT NULL,
    "status"      "MissionSubmissionStatus" NOT NULL DEFAULT 'pending',
    "finalScore"  DOUBLE PRECISION,
    "verifiedAt"  TIMESTAMP(3),
    CONSTRAINT "MissionSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissionSubmission_missionId_userId_key"
  ON "MissionSubmission"("missionId", "userId");
CREATE INDEX "MissionSubmission_userId_submittedAt_idx"
  ON "MissionSubmission"("userId", "submittedAt");
CREATE INDEX "MissionSubmission_missionId_status_idx"
  ON "MissionSubmission"("missionId", "status");

-- CreateTable: MissionReviewAssignment
CREATE TABLE "MissionReviewAssignment" (
    "id"              TEXT NOT NULL,
    "submissionId"    TEXT NOT NULL,
    "reviewerId"      TEXT NOT NULL,
    "assignedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt"           TIMESTAMP(3) NOT NULL,
    "completedAt"     TIMESTAMP(3),
    "scores"          JSONB,
    "comment"         TEXT,
    "aggregateScore"  DOUBLE PRECISION,
    "deltaFromMedian" DOUBLE PRECISION,
    "xpAwarded"       INTEGER,
    "flagged"         BOOLEAN NOT NULL DEFAULT false,
    "flagReason"      TEXT,
    CONSTRAINT "MissionReviewAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissionReviewAssignment_submissionId_reviewerId_key"
  ON "MissionReviewAssignment"("submissionId", "reviewerId");
CREATE INDEX "MissionReviewAssignment_reviewerId_completedAt_idx"
  ON "MissionReviewAssignment"("reviewerId", "completedAt");
CREATE INDEX "MissionReviewAssignment_submissionId_completedAt_idx"
  ON "MissionReviewAssignment"("submissionId", "completedAt");

-- Foreign keys
ALTER TABLE "Quiz"
  ADD CONSTRAINT "Quiz_tournamentMissionId_fkey"
  FOREIGN KEY ("tournamentMissionId") REFERENCES "TournamentMission"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_tournamentMissionId_fkey"
  FOREIGN KEY ("tournamentMissionId") REFERENCES "TournamentMission"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MissionSubmission"
  ADD CONSTRAINT "MissionSubmission_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "TournamentMission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionSubmission"
  ADD CONSTRAINT "MissionSubmission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionReviewAssignment"
  ADD CONSTRAINT "MissionReviewAssignment_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "MissionSubmission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionReviewAssignment"
  ADD CONSTRAINT "MissionReviewAssignment_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
