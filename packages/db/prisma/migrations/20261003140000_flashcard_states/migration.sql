-- CreateEnum
CREATE TYPE "FlashcardRating" AS ENUM ('again', 'hard', 'good', 'easy');

-- CreateTable
CREATE TABLE "FlashcardState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "introducedAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL,
    "lastRating" "FlashcardRating" NOT NULL,
    "lastReviewId" TEXT,

    CONSTRAINT "FlashcardState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlashcardState_userId_courseId_dueAt_idx" ON "FlashcardState"("userId", "courseId", "dueAt");

-- CreateIndex
CREATE INDEX "FlashcardState_contentItemId_idx" ON "FlashcardState"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardState_userId_itemId_key" ON "FlashcardState"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "FlashcardState" ADD CONSTRAINT "FlashcardState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardState" ADD CONSTRAINT "FlashcardState_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardState" ADD CONSTRAINT "FlashcardState_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

