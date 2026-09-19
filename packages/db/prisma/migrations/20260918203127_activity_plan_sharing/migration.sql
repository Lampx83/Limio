-- AlterTable
ALTER TABLE "TeachingActivityPlan" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareCode" TEXT;

-- CreateTable
CREATE TABLE "TeachingActivityPlanCollaborator" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingActivityPlanCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingActivityPlanSave" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingActivityPlanSave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingActivityPlanLike" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingActivityPlanLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeachingActivityPlanCollaborator_userId_idx" ON "TeachingActivityPlanCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingActivityPlanCollaborator_planId_userId_key" ON "TeachingActivityPlanCollaborator"("planId", "userId");

-- CreateIndex
CREATE INDEX "TeachingActivityPlanSave_userId_idx" ON "TeachingActivityPlanSave"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingActivityPlanSave_planId_userId_key" ON "TeachingActivityPlanSave"("planId", "userId");

-- CreateIndex
CREATE INDEX "TeachingActivityPlanLike_userId_idx" ON "TeachingActivityPlanLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingActivityPlanLike_planId_userId_key" ON "TeachingActivityPlanLike"("planId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingActivityPlan_shareCode_key" ON "TeachingActivityPlan"("shareCode");

-- CreateIndex
CREATE INDEX "TeachingActivityPlan_isPublic_idx" ON "TeachingActivityPlan"("isPublic");

-- AddForeignKey
ALTER TABLE "TeachingActivityPlanCollaborator" ADD CONSTRAINT "TeachingActivityPlanCollaborator_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TeachingActivityPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingActivityPlanCollaborator" ADD CONSTRAINT "TeachingActivityPlanCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingActivityPlanSave" ADD CONSTRAINT "TeachingActivityPlanSave_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TeachingActivityPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingActivityPlanSave" ADD CONSTRAINT "TeachingActivityPlanSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingActivityPlanLike" ADD CONSTRAINT "TeachingActivityPlanLike_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TeachingActivityPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingActivityPlanLike" ADD CONSTRAINT "TeachingActivityPlanLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

