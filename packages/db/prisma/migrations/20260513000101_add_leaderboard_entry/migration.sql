-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "courseId" TEXT,
    "period" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderboardEntry_scope_courseId_period_periodKey_rank_idx" ON "LeaderboardEntry"("scope", "courseId", "period", "periodKey", "rank");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_userId_period_periodKey_idx" ON "LeaderboardEntry"("userId", "period", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_scope_courseId_period_periodKey_userId_key" ON "LeaderboardEntry"("scope", "courseId", "period", "periodKey", "userId");

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
