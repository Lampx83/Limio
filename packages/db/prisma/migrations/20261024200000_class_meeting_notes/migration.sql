-- CreateEnum
CREATE TYPE "MeetingMailStatus" AS ENUM ('sent', 'failed', 'skipped_optout', 'skipped_no_email');

-- CreateEnum
CREATE TYPE "MeetingNoteStatus" AS ENUM ('draft', 'approved', 'sent');

-- AlterTable
ALTER TABLE "ClassMeeting" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "summary" JSONB;

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "autoSendSummary" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "classEmailOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MeetingSummaryDelivery" (
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MeetingMailStatus" NOT NULL,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "sentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingSummaryDelivery_pkey" PRIMARY KEY ("meetingId","userId")
);

-- CreateTable
CREATE TABLE "MeetingStudentNote" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MeetingNoteStatus" NOT NULL DEFAULT 'draft',
    "body" TEXT NOT NULL,
    "teacherHint" TEXT,
    "source" TEXT NOT NULL,
    "facts" JSONB,
    "correctionOfId" TEXT,
    "draftedById" TEXT,
    "draftedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "sendAttempts" INTEGER NOT NULL DEFAULT 0,
    "sendError" TEXT,
    "feedbackDeliveryId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingStudentNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingSummaryDelivery_userId_idx" ON "MeetingSummaryDelivery"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingStudentNote_feedbackDeliveryId_key" ON "MeetingStudentNote"("feedbackDeliveryId");

-- CreateIndex
CREATE INDEX "MeetingStudentNote_meetingId_userId_idx" ON "MeetingStudentNote"("meetingId", "userId");

-- CreateIndex
CREATE INDEX "MeetingStudentNote_userId_sentAt_idx" ON "MeetingStudentNote"("userId", "sentAt");

-- AddForeignKey
ALTER TABLE "MeetingSummaryDelivery" ADD CONSTRAINT "MeetingSummaryDelivery_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ClassMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSummaryDelivery" ADD CONSTRAINT "MeetingSummaryDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingStudentNote" ADD CONSTRAINT "MeetingStudentNote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ClassMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingStudentNote" ADD CONSTRAINT "MeetingStudentNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
