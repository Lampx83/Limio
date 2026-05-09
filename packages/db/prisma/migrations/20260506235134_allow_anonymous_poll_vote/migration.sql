-- DropForeignKey
ALTER TABLE "ClassroomPollVote" DROP CONSTRAINT "ClassroomPollVote_userId_fkey";

-- DropIndex
DROP INDEX "ClassroomPollVote_pollId_userId_key";

-- AlterTable
ALTER TABLE "ClassroomPollVote" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TimerTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "notes" TEXT,
    "musicId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimerTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimerTemplate_userId_idx" ON "TimerTemplate"("userId");

-- CreateIndex
CREATE INDEX "TimerTemplate_courseId_idx" ON "TimerTemplate"("courseId");

-- CreateIndex
CREATE INDEX "TimerTemplate_isPublic_idx" ON "TimerTemplate"("isPublic");

-- AddForeignKey
ALTER TABLE "ClassroomPollVote" ADD CONSTRAINT "ClassroomPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerTemplate" ADD CONSTRAINT "TimerTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerTemplate" ADD CONSTRAINT "TimerTemplate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
