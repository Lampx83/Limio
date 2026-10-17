-- CreateTable
CREATE TABLE "LessonDraft" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceParas" JSONB NOT NULL,
    "outline" JSONB NOT NULL,
    "look" JSONB,
    "writing" TEXT NOT NULL DEFAULT 'keep',
    "addObjectivesSummary" BOOLEAN NOT NULL DEFAULT true,
    "confirmedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'outline',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonDraft_lessonId_status_idx" ON "LessonDraft"("lessonId", "status");

-- CreateIndex
CREATE INDEX "LessonDraft_userId_idx" ON "LessonDraft"("userId");

-- AddForeignKey
ALTER TABLE "LessonDraft" ADD CONSTRAINT "LessonDraft_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonDraft" ADD CONSTRAINT "LessonDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
