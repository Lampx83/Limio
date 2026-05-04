-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;
