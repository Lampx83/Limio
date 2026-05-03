-- CreateEnum
CREATE TYPE "FeedbackTemplateScope" AS ENUM ('generic', 'per_misconception', 'per_skill');

-- CreateTable
CREATE TABLE "LearnerSkillState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "masteryProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerSkillState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MisconceptionFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "misconceptionId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MisconceptionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackTemplate" (
    "id" TEXT NOT NULL,
    "scope" "FeedbackTemplateScope" NOT NULL,
    "misconceptionId" TEXT,
    "skillId" TEXT,
    "body" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptId" TEXT,
    "questionId" TEXT,
    "templateId" TEXT,
    "body" TEXT NOT NULL,
    "remediationLessonIds" JSONB NOT NULL,
    "rating" INTEGER,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearnerSkillState_userId_masteryProbability_idx" ON "LearnerSkillState"("userId", "masteryProbability");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerSkillState_userId_skillId_key" ON "LearnerSkillState"("userId", "skillId");

-- CreateIndex
CREATE INDEX "MisconceptionFlag_userId_resolved_idx" ON "MisconceptionFlag"("userId", "resolved");

-- CreateIndex
CREATE UNIQUE INDEX "MisconceptionFlag_userId_misconceptionId_key" ON "MisconceptionFlag"("userId", "misconceptionId");

-- CreateIndex
CREATE INDEX "FeedbackTemplate_scope_misconceptionId_idx" ON "FeedbackTemplate"("scope", "misconceptionId");

-- CreateIndex
CREATE INDEX "FeedbackTemplate_scope_skillId_idx" ON "FeedbackTemplate"("scope", "skillId");

-- CreateIndex
CREATE INDEX "FeedbackDelivery_userId_deliveredAt_idx" ON "FeedbackDelivery"("userId", "deliveredAt");

-- CreateIndex
CREATE INDEX "FeedbackDelivery_attemptId_idx" ON "FeedbackDelivery"("attemptId");

-- AddForeignKey
ALTER TABLE "LearnerSkillState" ADD CONSTRAINT "LearnerSkillState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerSkillState" ADD CONSTRAINT "LearnerSkillState_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisconceptionFlag" ADD CONSTRAINT "MisconceptionFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisconceptionFlag" ADD CONSTRAINT "MisconceptionFlag_misconceptionId_fkey" FOREIGN KEY ("misconceptionId") REFERENCES "Misconception"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackTemplate" ADD CONSTRAINT "FeedbackTemplate_misconceptionId_fkey" FOREIGN KEY ("misconceptionId") REFERENCES "Misconception"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackTemplate" ADD CONSTRAINT "FeedbackTemplate_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackDelivery" ADD CONSTRAINT "FeedbackDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackDelivery" ADD CONSTRAINT "FeedbackDelivery_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FeedbackTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
