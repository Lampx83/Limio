-- AddUniqueConstraint
ALTER TABLE "WordCloudSubmission" ADD CONSTRAINT "WordCloudSubmission_cloudId_userId_key" UNIQUE ("cloudId", "userId");
