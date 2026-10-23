-- CreateEnum
CREATE TYPE "ClassMeetingStatus" AS ENUM ('planned', 'held', 'cancelled');

-- CreateTable
CREATE TABLE "ClassSchedule" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "totalMeetings" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassScheduleSlot" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "room" TEXT,
    "plannedTeacherId" TEXT,

    CONSTRAINT "ClassScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassMeeting" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "seq" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "room" TEXT,
    "plannedTeacherId" TEXT,
    "status" "ClassMeetingStatus" NOT NULL DEFAULT 'planned',
    "cancelReason" TEXT,
    "makeupOfId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassSchedule_sectionId_key" ON "ClassSchedule"("sectionId");

-- CreateIndex
CREATE INDEX "ClassScheduleSlot_scheduleId_idx" ON "ClassScheduleSlot"("scheduleId");

-- CreateIndex
CREATE INDEX "ClassMeeting_sectionId_startsAt_idx" ON "ClassMeeting"("sectionId", "startsAt");

-- CreateIndex
CREATE INDEX "ClassMeeting_plannedTeacherId_startsAt_idx" ON "ClassMeeting"("plannedTeacherId", "startsAt");

-- AddForeignKey
ALTER TABLE "ClassSchedule" ADD CONSTRAINT "ClassSchedule_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassScheduleSlot" ADD CONSTRAINT "ClassScheduleSlot_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ClassSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassScheduleSlot" ADD CONSTRAINT "ClassScheduleSlot_plannedTeacherId_fkey" FOREIGN KEY ("plannedTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMeeting" ADD CONSTRAINT "ClassMeeting_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMeeting" ADD CONSTRAINT "ClassMeeting_plannedTeacherId_fkey" FOREIGN KEY ("plannedTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMeeting" ADD CONSTRAINT "ClassMeeting_makeupOfId_fkey" FOREIGN KEY ("makeupOfId") REFERENCES "ClassMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

