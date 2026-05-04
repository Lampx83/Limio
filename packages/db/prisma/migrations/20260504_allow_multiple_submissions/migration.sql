-- Remove unique constraint from ClassroomPollVote to allow multiple votes per user per poll
ALTER TABLE "ClassroomPollVote" DROP CONSTRAINT IF EXISTS "ClassroomPollVote_pollId_userId_key";

-- Remove unique constraint from WordCloudSubmission to allow multiple submissions per user per word cloud
ALTER TABLE "WordCloudSubmission" DROP CONSTRAINT IF EXISTS "WordCloudSubmission_cloudId_userId_key";
