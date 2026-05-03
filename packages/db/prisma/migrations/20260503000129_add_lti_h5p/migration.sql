-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContentType" ADD VALUE 'lti';
ALTER TYPE "ContentType" ADD VALUE 'h5p';

-- CreateTable
CREATE TABLE "LtiTool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "toolUrl" TEXT NOT NULL,
    "loginInitUrl" TEXT NOT NULL,
    "jwksUrl" TEXT,
    "clientId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL DEFAULT '1',
    "privateKey" TEXT NOT NULL,
    "publicKeyKid" TEXT NOT NULL,
    "publicKeyPem" TEXT NOT NULL,
    "registeredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LtiTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LtiLaunch" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "lessonId" TEXT,
    "resourceLinkId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiLaunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "H5pPackage" (
    "id" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "mainLibrary" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "H5pPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "H5pAttempt" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "lessonId" TEXT,
    "scoreRaw" DOUBLE PRECISION,
    "scoreMax" DOUBLE PRECISION,
    "lastVerb" TEXT,
    "success" BOOLEAN,
    "state" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "H5pAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LtiTool_clientId_key" ON "LtiTool"("clientId");

-- CreateIndex
CREATE INDEX "LtiTool_clientId_idx" ON "LtiTool"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "LtiLaunch_nonce_key" ON "LtiLaunch"("nonce");

-- CreateIndex
CREATE INDEX "LtiLaunch_toolId_userId_issuedAt_idx" ON "LtiLaunch"("toolId", "userId", "issuedAt");

-- CreateIndex
CREATE INDEX "H5pPackage_uploaderId_uploadedAt_idx" ON "H5pPackage"("uploaderId", "uploadedAt");

-- CreateIndex
CREATE INDEX "H5pAttempt_userId_updatedAt_idx" ON "H5pAttempt"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "H5pAttempt_packageId_userId_key" ON "H5pAttempt"("packageId", "userId");

-- AddForeignKey
ALTER TABLE "LtiTool" ADD CONSTRAINT "LtiTool_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LtiLaunch" ADD CONSTRAINT "LtiLaunch_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "LtiTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LtiLaunch" ADD CONSTRAINT "LtiLaunch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "H5pPackage" ADD CONSTRAINT "H5pPackage_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "H5pAttempt" ADD CONSTRAINT "H5pAttempt_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "H5pPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "H5pAttempt" ADD CONSTRAINT "H5pAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
