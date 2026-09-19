-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classroomSessionId" TEXT,
    "slideRuntimeRefs" JSONB NOT NULL DEFAULT '{}',
    "currentSlideId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveSession_deckId_userId_endedAt_idx" ON "LiveSession"("deckId", "userId", "endedAt");

-- CreateIndex
CREATE INDEX "LiveSession_userId_idx" ON "LiveSession"("userId");

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "LiveDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_classroomSessionId_fkey" FOREIGN KEY ("classroomSessionId") REFERENCES "ClassroomSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

