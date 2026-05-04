-- CreateTable
CREATE TABLE "HiddenLesson" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiddenLesson_userId_idx" ON "HiddenLesson"("userId");

-- CreateIndex
CREATE INDEX "HiddenLesson_lessonId_idx" ON "HiddenLesson"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "HiddenLesson_userId_lessonId_key" ON "HiddenLesson"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "HiddenLesson" ADD CONSTRAINT "HiddenLesson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenLesson" ADD CONSTRAINT "HiddenLesson_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
