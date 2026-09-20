-- CreateEnum
CREATE TYPE "LiveDeckGroupKind" AS ENUM ('course', 'event', 'other');

-- AlterTable
ALTER TABLE "LiveDeck" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "LiveDeckGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LiveDeckGroupKind" NOT NULL DEFAULT 'other',
    "courseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveDeckGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveDeckGroup_userId_idx" ON "LiveDeckGroup"("userId");

-- CreateIndex
CREATE INDEX "LiveDeckGroup_courseId_idx" ON "LiveDeckGroup"("courseId");

-- CreateIndex
CREATE INDEX "LiveDeck_groupId_idx" ON "LiveDeck"("groupId");

-- AddForeignKey
ALTER TABLE "LiveDeck" ADD CONSTRAINT "LiveDeck_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LiveDeckGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveDeckGroup" ADD CONSTRAINT "LiveDeckGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveDeckGroup" ADD CONSTRAINT "LiveDeckGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
