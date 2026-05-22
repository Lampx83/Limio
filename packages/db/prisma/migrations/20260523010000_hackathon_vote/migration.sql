-- Popular vote cho hackathon showcase. 1 vote per (mission, voter) → cho phép
-- voter chọn project yêu thích cho từng mission ("Best Algorithm" / "Best UX")
-- nếu tournament có nhiều mission COLLECTIVE.

CREATE TABLE "HackathonVote" (
  "id"           TEXT NOT NULL,
  "missionId"    TEXT NOT NULL,
  "voterUserId"  TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HackathonVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HackathonVote_missionId_voterUserId_key"
  ON "HackathonVote"("missionId", "voterUserId");
CREATE INDEX "HackathonVote_submissionId_idx"
  ON "HackathonVote"("submissionId");

ALTER TABLE "HackathonVote"
  ADD CONSTRAINT "HackathonVote_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "TournamentMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HackathonVote"
  ADD CONSTRAINT "HackathonVote_voterUserId_fkey"
  FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HackathonVote"
  ADD CONSTRAINT "HackathonVote_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "MissionSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
