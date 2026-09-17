-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'expired';

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "accessExpiresAt" TIMESTAMP(3),
ADD COLUMN     "accessExpiryReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "accessPlanId" TEXT;

-- CreateTable
CREATE TABLE "CourseAccessPlan" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "durationMonths" INTEGER,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseAccessPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseAccessPlan_courseId_isActive_idx" ON "CourseAccessPlan"("courseId", "isActive");

-- CreateIndex
CREATE INDEX "Enrollment_status_accessExpiresAt_idx" ON "Enrollment"("status", "accessExpiresAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_accessPlanId_fkey" FOREIGN KEY ("accessPlanId") REFERENCES "CourseAccessPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccessPlan" ADD CONSTRAINT "CourseAccessPlan_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
