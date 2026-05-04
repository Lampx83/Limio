/*
  Warnings:

  - You are about to drop the `HiddenLesson` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "HiddenLesson" DROP CONSTRAINT "HiddenLesson_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "HiddenLesson" DROP CONSTRAINT "HiddenLesson_userId_fkey";

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "HiddenLesson";
