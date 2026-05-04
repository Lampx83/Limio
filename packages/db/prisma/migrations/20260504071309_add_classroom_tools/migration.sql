-- CreateTable
CREATE TABLE "ClassroomSession" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomRandomPick" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomRandomPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomPoll" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomPollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordCloud" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordCloud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordCloudSubmission" (
    "id" TEXT NOT NULL,
    "cloudId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordCloudSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupingSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "numGroups" INTEGER NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "groupingId" TEXT NOT NULL,
    "groupNum" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassroomSession_lessonId_startedAt_idx" ON "ClassroomSession"("lessonId", "startedAt");

-- CreateIndex
CREATE INDEX "ClassroomSession_startedAt_idx" ON "ClassroomSession"("startedAt");

-- CreateIndex
CREATE INDEX "ClassroomRandomPick_sessionId_pickedAt_idx" ON "ClassroomRandomPick"("sessionId", "pickedAt");

-- CreateIndex
CREATE INDEX "ClassroomRandomPick_userId_idx" ON "ClassroomRandomPick"("userId");

-- CreateIndex
CREATE INDEX "ClassroomPoll_sessionId_createdAt_idx" ON "ClassroomPoll"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassroomPollVote_pollId_idx" ON "ClassroomPollVote"("pollId");

-- CreateIndex
CREATE INDEX "ClassroomPollVote_userId_idx" ON "ClassroomPollVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomPollVote_pollId_userId_key" ON "ClassroomPollVote"("pollId", "userId");

-- CreateIndex
CREATE INDEX "WordCloud_sessionId_idx" ON "WordCloud"("sessionId");

-- CreateIndex
CREATE INDEX "WordCloudSubmission_cloudId_idx" ON "WordCloudSubmission"("cloudId");

-- CreateIndex
CREATE INDEX "WordCloudSubmission_userId_idx" ON "WordCloudSubmission"("userId");

-- CreateIndex
CREATE INDEX "GroupingSession_sessionId_idx" ON "GroupingSession"("sessionId");

-- CreateIndex
CREATE INDEX "GroupMembership_groupingId_groupNum_idx" ON "GroupMembership"("groupingId", "groupNum");

-- CreateIndex
CREATE INDEX "GroupMembership_userId_idx" ON "GroupMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_groupingId_userId_key" ON "GroupMembership"("groupingId", "userId");

-- AddForeignKey
ALTER TABLE "ClassroomSession" ADD CONSTRAINT "ClassroomSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomRandomPick" ADD CONSTRAINT "ClassroomRandomPick_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomRandomPick" ADD CONSTRAINT "ClassroomRandomPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomPoll" ADD CONSTRAINT "ClassroomPoll_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomPollVote" ADD CONSTRAINT "ClassroomPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ClassroomPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomPollVote" ADD CONSTRAINT "ClassroomPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordCloud" ADD CONSTRAINT "WordCloud_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordCloudSubmission" ADD CONSTRAINT "WordCloudSubmission_cloudId_fkey" FOREIGN KEY ("cloudId") REFERENCES "WordCloud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordCloudSubmission" ADD CONSTRAINT "WordCloudSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupingSession" ADD CONSTRAINT "GroupingSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupingId_fkey" FOREIGN KEY ("groupingId") REFERENCES "GroupingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
