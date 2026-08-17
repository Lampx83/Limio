-- AlterTable
ALTER TABLE "GameParticipant" ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "teamModeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GameTeam" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameTeam_sessionId_idx" ON "GameTeam"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GameTeam_sessionId_name_key" ON "GameTeam"("sessionId", "name");

-- AddForeignKey
ALTER TABLE "GameTeam" ADD CONSTRAINT "GameTeam_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "GameTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

