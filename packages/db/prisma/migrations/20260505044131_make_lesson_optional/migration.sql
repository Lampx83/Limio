-- AlterTable
ALTER TABLE "ClassroomSession" DROP CONSTRAINT "ClassroomSession_lessonId_fkey",
ALTER COLUMN "lessonId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ClassroomSession" ADD CONSTRAINT "ClassroomSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
