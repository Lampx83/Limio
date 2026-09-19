-- CreateEnum
CREATE TYPE "LiveSlideType" AS ENUM ('content', 'quiz', 'poll', 'word_cloud', 'collaborate_board');

-- CreateTable
CREATE TABLE "LiveDeck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSlide" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "type" "LiveSlideType" NOT NULL,
    "config" JSONB NOT NULL,
    "timerSeconds" INTEGER,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveDeck_userId_idx" ON "LiveDeck"("userId");

-- CreateIndex
CREATE INDEX "LiveSlide_deckId_orderIndex_idx" ON "LiveSlide"("deckId", "orderIndex");

-- AddForeignKey
ALTER TABLE "LiveDeck" ADD CONSTRAINT "LiveDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSlide" ADD CONSTRAINT "LiveSlide_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "LiveDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

