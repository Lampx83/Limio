-- CreateTable
CREATE TABLE "ExamAudioPlay" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "audioKey" TEXT NOT NULL,
    "playId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamAudioPlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamAudioPlay_attemptId_passageId_audioKey_idx" ON "ExamAudioPlay"("attemptId", "passageId", "audioKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAudioPlay_attemptId_playId_key" ON "ExamAudioPlay"("attemptId", "playId");

-- AddForeignKey
ALTER TABLE "ExamAudioPlay" ADD CONSTRAINT "ExamAudioPlay_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

