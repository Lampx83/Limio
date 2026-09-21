-- CreateEnum
CREATE TYPE "LiveIdentityMode" AS ENUM ('anonymous', 'login');

-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "identityMode" "LiveIdentityMode" NOT NULL DEFAULT 'anonymous',
ADD COLUMN     "joinCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_joinCode_key" ON "LiveSession"("joinCode");
