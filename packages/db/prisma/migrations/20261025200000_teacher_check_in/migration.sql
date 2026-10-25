-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "checkinThresholdMin" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "TeacherCheckIn" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL,
    "checkedOutAt" TIMESTAMP(3),
    "method" TEXT NOT NULL DEFAULT 'self',
    "editedById" TEXT,
    "editReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherCheckIn_meetingId_key" ON "TeacherCheckIn"("meetingId");

-- CreateIndex
CREATE INDEX "TeacherCheckIn_teacherId_checkedInAt_idx" ON "TeacherCheckIn"("teacherId", "checkedInAt");

-- AddForeignKey
ALTER TABLE "TeacherCheckIn" ADD CONSTRAINT "TeacherCheckIn_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ClassMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCheckIn" ADD CONSTRAINT "TeacherCheckIn_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
