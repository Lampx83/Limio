-- A5.3 PR2.8 — Add ExamCandidate.arrivedAt for proctor check-in attendance.
-- Nullable additive column, zero risk.

ALTER TABLE "ExamCandidate" ADD COLUMN "arrivedAt" TIMESTAMP(3);
