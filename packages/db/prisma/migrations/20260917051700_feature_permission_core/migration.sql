-- CreateEnum
CREATE TYPE "FeatureGroup" AS ENUM ('teaching_tools', 'lms', 'assessment', 'ai_oral', 'ai_tutor', 'tournament');

-- CreateEnum
CREATE TYPE "FeatureValueType" AS ENUM ('boolean', 'int', 'string_array');

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "group" "FeatureGroup" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "valueType" "FeatureValueType" NOT NULL,
    "defaultValue" JSONB NOT NULL,
    "sellable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleFeatureOverride" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleFeatureOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFeatureOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFeatureOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_group_idx" ON "FeatureFlag"("group");

-- CreateIndex
CREATE UNIQUE INDEX "RoleFeatureOverride_roleId_featureKey_key" ON "RoleFeatureOverride"("roleId", "featureKey");

-- CreateIndex
CREATE INDEX "UserFeatureOverride_userId_idx" ON "UserFeatureOverride"("userId");

-- CreateIndex
CREATE INDEX "UserFeatureOverride_expiresAt_idx" ON "UserFeatureOverride"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserFeatureOverride_userId_featureKey_key" ON "UserFeatureOverride"("userId", "featureKey");

-- AddForeignKey
ALTER TABLE "RoleFeatureOverride" ADD CONSTRAINT "RoleFeatureOverride_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleFeatureOverride" ADD CONSTRAINT "RoleFeatureOverride_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "FeatureFlag"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeatureOverride" ADD CONSTRAINT "UserFeatureOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeatureOverride" ADD CONSTRAINT "UserFeatureOverride_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "FeatureFlag"("key") ON DELETE CASCADE ON UPDATE CASCADE;
