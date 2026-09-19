-- CreateEnum
CREATE TYPE "ClassroomToolType" AS ENUM ('random_picker', 'quick_poll', 'word_cloud', 'grouping_tool', 'countdown_timer', 'whiteboard');

-- CreateTable
CREATE TABLE "TeachingActivityPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingActivityPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingActivityPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "toolType" "ClassroomToolType" NOT NULL,
    "label" TEXT NOT NULL,
    "config" JSONB,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingActivityPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeachingActivityPlan_userId_idx" ON "TeachingActivityPlan"("userId");

-- CreateIndex
CREATE INDEX "TeachingActivityPlanItem_planId_orderIndex_idx" ON "TeachingActivityPlanItem"("planId", "orderIndex");

-- AddForeignKey
ALTER TABLE "TeachingActivityPlan" ADD CONSTRAINT "TeachingActivityPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingActivityPlanItem" ADD CONSTRAINT "TeachingActivityPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TeachingActivityPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

