-- CreateEnum
CREATE TYPE "InstructorApplicationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "InstructorApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "InstructorApplicationStatus" NOT NULL DEFAULT 'pending',
    "institution" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "motivation" TEXT,
    "verificationUrl" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstructorApplication_status_createdAt_idx" ON "InstructorApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InstructorApplication_userId_status_idx" ON "InstructorApplication"("userId", "status");

-- AddForeignKey
ALTER TABLE "InstructorApplication" ADD CONSTRAINT "InstructorApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorApplication" ADD CONSTRAINT "InstructorApplication_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
