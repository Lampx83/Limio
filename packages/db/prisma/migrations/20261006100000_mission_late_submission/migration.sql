-- Cho nộp muộn ở mission đấu trường: cờ trên mission + dấu "nộp muộn" trên bài nộp.
-- Cộng thêm, có default nên không đụng dữ liệu cũ (mọi mission cũ vẫn đóng khi quá hạn).
ALTER TABLE "TournamentMission" ADD COLUMN "allowLateSubmission" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MissionSubmission" ADD COLUMN "isLate" BOOLEAN NOT NULL DEFAULT false;
