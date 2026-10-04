-- CreateTable
CREATE TABLE "SubmissionTranscript" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "language" TEXT,
    "text" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingFeedback" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "WritingFeedbackStatus" NOT NULL DEFAULT 'draft',
    "transcriptHash" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "level" "FeedbackLevel" NOT NULL,
    "levels" JSONB NOT NULL,
    "elaboration" "FeedbackElaboration" NOT NULL,
    "sourceKind" "FeedbackSourceKind" NOT NULL,
    "generationContext" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNote" TEXT,

    CONSTRAINT "SpeakingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionTranscript_submissionId_audioUrl_key" ON "SubmissionTranscript"("submissionId", "audioUrl");

-- CreateIndex
CREATE INDEX "SubmissionTranscript_userId_courseId_idx" ON "SubmissionTranscript"("userId", "courseId");

-- CreateIndex
CREATE INDEX "SpeakingFeedback_submissionId_generatedAt_idx" ON "SpeakingFeedback"("submissionId", "generatedAt");

-- CreateIndex
CREATE INDEX "SpeakingFeedback_userId_courseId_status_idx" ON "SpeakingFeedback"("userId", "courseId", "status");

-- AddForeignKey
ALTER TABLE "SubmissionTranscript" ADD CONSTRAINT "SubmissionTranscript_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionTranscript" ADD CONSTRAINT "SubmissionTranscript_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingFeedback" ADD CONSTRAINT "SpeakingFeedback_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingFeedback" ADD CONSTRAINT "SpeakingFeedback_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "SubmissionTranscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingFeedback" ADD CONSTRAINT "SpeakingFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingFeedback" ADD CONSTRAINT "SpeakingFeedback_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
