-- Team-based tournament registration. teamSize > 1 tournaments need a Team
-- entity to hold captain + joinCode; TournamentRegistration.teamId becomes
-- an FK to TournamentTeam.id (still nullable so solo registrations remain).

CREATE TABLE "TournamentTeam" (
  "id"           TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "captainId"    TEXT NOT NULL,
  "joinCode"     TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TournamentTeam_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentTeam_joinCode_key" ON "TournamentTeam"("joinCode");
CREATE UNIQUE INDEX "TournamentTeam_tournamentId_name_key" ON "TournamentTeam"("tournamentId", "name");
CREATE INDEX "TournamentTeam_tournamentId_idx" ON "TournamentTeam"("tournamentId");

ALTER TABLE "TournamentTeam"
  ADD CONSTRAINT "TournamentTeam_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentTeam"
  ADD CONSTRAINT "TournamentTeam_captainId_fkey"
  FOREIGN KEY ("captainId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing TournamentRegistration.teamId is plain TEXT — keep type, add FK so
-- registrations can be joined to a team row. Set NULL on team delete so the
-- registration row survives (member becomes "soloed" until they re-join).
ALTER TABLE "TournamentRegistration"
  ADD CONSTRAINT "TournamentRegistration_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
