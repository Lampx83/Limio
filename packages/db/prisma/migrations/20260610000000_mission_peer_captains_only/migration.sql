-- TournamentMission: thêm cờ peerReviewCaptainsOnly.
-- true  = peer review nộp-nhóm chỉ phân cho captain (người nộp) chấm chéo.
-- false = (default) mở cho mọi thành viên active của giải.
-- Bỏ qua với mission solo (luôn dùng pool người-đã-nộp).
-- Existing rows giữ default false → backward compatible.

ALTER TABLE "TournamentMission"
    ADD COLUMN "peerReviewCaptainsOnly" BOOLEAN NOT NULL DEFAULT false;
