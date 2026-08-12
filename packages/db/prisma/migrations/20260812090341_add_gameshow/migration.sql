-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'lobby',
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "currentQuestionStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "avatarKey" TEXT NOT NULL,
    "participantToken" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "doublePointsUsed" BOOLEAN NOT NULL DEFAULT false,
    "immunityUsed" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "chosenOptionId" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "powerUpUsed" TEXT,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_code_key" ON "GameSession"("code");

-- CreateIndex
CREATE INDEX "GameSession_hostId_createdAt_idx" ON "GameSession"("hostId", "createdAt");

-- CreateIndex
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_participantToken_key" ON "GameParticipant"("participantToken");

-- CreateIndex
CREATE INDEX "GameParticipant_sessionId_totalScore_idx" ON "GameParticipant"("sessionId", "totalScore");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_sessionId_displayName_key" ON "GameParticipant"("sessionId", "displayName");

-- CreateIndex
CREATE INDEX "GameAnswer_sessionId_questionIndex_idx" ON "GameAnswer"("sessionId", "questionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "GameAnswer_participantId_questionIndex_key" ON "GameAnswer"("participantId", "questionIndex");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAnswer" ADD CONSTRAINT "GameAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAnswer" ADD CONSTRAINT "GameAnswer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

