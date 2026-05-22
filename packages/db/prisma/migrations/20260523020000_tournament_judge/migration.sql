-- Tournament judges: instructor chỉ định N user làm giám khảo cho hackathon.
-- Khi có judges, mission PEER_REVIEW + isTeamSubmission sẽ assign judges
-- (thay vì random peer) để chấm theo rubric.
CREATE TABLE "TournamentJudge" (
  "id"           TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "addedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentJudge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TournamentJudge_tournamentId_userId_key"
  ON "TournamentJudge"("tournamentId", "userId");
CREATE INDEX "TournamentJudge_tournamentId_idx" ON "TournamentJudge"("tournamentId");

ALTER TABLE "TournamentJudge"
  ADD CONSTRAINT "TournamentJudge_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentJudge"
  ADD CONSTRAINT "TournamentJudge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
