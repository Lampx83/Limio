-- TournamentMission: thêm reviewQuorum (số review hoàn thành tối thiểu để tự
-- chốt 1 bài), tách khỏi peerReviewerCount (số reviewer phân).
-- Null = dùng peerReviewerCount (backward compatible). Khi tính luôn kẹp ≤ N.
ALTER TABLE "TournamentMission"
    ADD COLUMN "reviewQuorum" INTEGER;
