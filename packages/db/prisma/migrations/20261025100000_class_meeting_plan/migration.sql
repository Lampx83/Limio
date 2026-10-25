-- AlterTable
ALTER TABLE "ClassMeeting" ADD COLUMN     "planCustomized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planTopic" TEXT;

-- CreateTable
CREATE TABLE "ClassMeetingLesson" (
    "meetingId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassMeetingLesson_pkey" PRIMARY KEY ("meetingId","lessonId")
);

-- CreateIndex
CREATE INDEX "ClassMeetingLesson_lessonId_idx" ON "ClassMeetingLesson"("lessonId");

-- AddForeignKey
ALTER TABLE "ClassMeetingLesson" ADD CONSTRAINT "ClassMeetingLesson_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ClassMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMeetingLesson" ADD CONSTRAINT "ClassMeetingLesson_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
