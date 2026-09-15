-- AlterTable
ALTER TABLE "InteractiveBoard" ADD COLUMN     "columns" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "BoardNote" ADD COLUMN     "column" TEXT;

