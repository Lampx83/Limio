-- CreateTable
CREATE TABLE "UserCourseProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "growthScore" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCourseProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCourseProgress_courseId_xp_idx" ON "UserCourseProgress"("courseId", "xp");

-- CreateIndex
CREATE UNIQUE INDEX "UserCourseProgress_userId_courseId_key" ON "UserCourseProgress"("userId", "courseId");

-- CreateIndex
CREATE INDEX "XpTransaction_userId_courseId_occurredAt_idx" ON "XpTransaction"("userId", "courseId", "occurredAt");

-- CreateIndex
CREATE INDEX "XpTransaction_courseId_occurredAt_idx" ON "XpTransaction"("courseId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "XpTransaction_userId_reason_sourceId_key" ON "XpTransaction"("userId", "reason", "sourceId");

-- AddForeignKey
ALTER TABLE "UserCourseProgress" ADD CONSTRAINT "UserCourseProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourseProgress" ADD CONSTRAINT "UserCourseProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
