-- CreateEnum
CREATE TYPE "PlanScope" AS ENUM ('individual', 'organization');

-- CreateEnum
CREATE TYPE "PlanPeriod" AS ENUM ('month', 'year');

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('trial', 'purchase', 'contract', 'admin');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "planPriceId" TEXT;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "PlanScope" NOT NULL,
    "entitlements" JSONB NOT NULL DEFAULT '{}',
    "referencePlanKey" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPrice" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "period" "PlanPeriod" NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "source" "SubscriptionSource" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,
    "grantedById" TEXT,
    "note" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPrice_planId_period_key" ON "PlanPrice"("planId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_orderId_key" ON "Subscription"("orderId");

-- CreateIndex
CREATE INDEX "Subscription_userId_endsAt_idx" ON "Subscription"("userId", "endsAt");

-- CreateIndex
CREATE INDEX "Subscription_organizationId_endsAt_idx" ON "Subscription"("organizationId", "endsAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_planPriceId_fkey" FOREIGN KEY ("planPriceId") REFERENCES "PlanPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPrice" ADD CONSTRAINT "PlanPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Đúng một chủ thể: người dùng hoặc tổ chức.
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_one_subject_chk"
  CHECK (num_nonnulls("userId", "organizationId") = 1);
