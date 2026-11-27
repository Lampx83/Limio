-- Mỗi thiết bị một phiếu mỗi poll (Hoạt động nhanh › Vote). Phiếu cũ để clientId NULL.
ALTER TABLE "ClassroomPollVote" ADD COLUMN "clientId" TEXT;

CREATE UNIQUE INDEX "ClassroomPollVote_pollId_clientId_key" ON "ClassroomPollVote"("pollId", "clientId");
