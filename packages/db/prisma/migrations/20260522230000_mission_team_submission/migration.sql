-- Mission COLLECTIVE submission mode for team tournaments.
-- Default false (= INDIVIDUAL = current behavior, mỗi member nộp riêng SUM).
-- When true + tournament.teamSize > 1:
--   - chỉ captain được nộp
--   - 1 submission tính cho cả đội (không SUM)
-- Invalid combinations rejected at API layer (e.g. AUTO_GRADE + COLLECTIVE).
ALTER TABLE "TournamentMission"
  ADD COLUMN "isTeamSubmission" BOOLEAN NOT NULL DEFAULT false;
