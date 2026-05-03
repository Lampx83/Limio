-- CreateTable
CREATE TABLE "StreakRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreakRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StreakRecord_courseId_currentStreak_idx" ON "StreakRecord"("courseId", "currentStreak");

-- CreateIndex
CREATE UNIQUE INDEX "StreakRecord_userId_courseId_key" ON "StreakRecord"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "StreakRecord" ADD CONSTRAINT "StreakRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreakRecord" ADD CONSTRAINT "StreakRecord_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
