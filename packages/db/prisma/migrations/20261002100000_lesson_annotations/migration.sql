-- CreateEnum
CREATE TYPE "AnnotationVisibility" AS ENUM ('private', 'published');

-- CreateTable
CREATE TABLE "LessonAnnotation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "suffix" TEXT NOT NULL DEFAULT '',
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "AnnotationVisibility" NOT NULL DEFAULT 'private',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonAnnotationReply" (
    "id" TEXT NOT NULL,
    "annotationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonAnnotationReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonAnnotation_lessonId_visibility_idx" ON "LessonAnnotation"("lessonId", "visibility");

-- CreateIndex
CREATE INDEX "LessonAnnotation_userId_lessonId_idx" ON "LessonAnnotation"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "LessonAnnotationReply_annotationId_createdAt_idx" ON "LessonAnnotationReply"("annotationId", "createdAt");

-- AddForeignKey
ALTER TABLE "LessonAnnotation" ADD CONSTRAINT "LessonAnnotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAnnotation" ADD CONSTRAINT "LessonAnnotation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAnnotation" ADD CONSTRAINT "LessonAnnotation_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAnnotationReply" ADD CONSTRAINT "LessonAnnotationReply_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "LessonAnnotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAnnotationReply" ADD CONSTRAINT "LessonAnnotationReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

