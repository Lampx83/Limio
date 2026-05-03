-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('draft', 'published', 'active', 'ended');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'draft',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "teamSize" INTEGER NOT NULL DEFAULT 1,
    "prizeXp" INTEGER NOT NULL DEFAULT 0,
    "prizeDistribution" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentRegistration" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disqualifiedAt" TIMESTAMP(3),

    CONSTRAINT "TournamentRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentMission" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 100,
    "prerequisiteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentRanking" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "rank" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRanking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tournament_status_startsAt_idx" ON "Tournament"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Tournament_courseId_status_idx" ON "Tournament"("courseId", "status");

-- CreateIndex
CREATE INDEX "TournamentRegistration_tournamentId_teamId_idx" ON "TournamentRegistration"("tournamentId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_userId_key" ON "TournamentRegistration"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentMission_tournamentId_orderIndex_key" ON "TournamentMission"("tournamentId", "orderIndex");

-- CreateIndex
CREATE INDEX "TournamentRanking_tournamentId_rank_idx" ON "TournamentRanking"("tournamentId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRanking_tournamentId_userId_key" ON "TournamentRanking"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRanking_tournamentId_teamId_key" ON "TournamentRanking"("tournamentId", "teamId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMission" ADD CONSTRAINT "TournamentMission_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMission" ADD CONSTRAINT "TournamentMission_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "TournamentMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRanking" ADD CONSTRAINT "TournamentRanking_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
