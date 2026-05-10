-- C5: MissionTemplate — admin-managed building blocks for tournament missions.
-- Instructors pick a template instead of typing raw conditionType strings.

-- CreateTable
CREATE TABLE "MissionTemplate" (
    "id"                 TEXT NOT NULL,
    "code"               TEXT NOT NULL,
    "name"               TEXT NOT NULL,
    "description"        TEXT NOT NULL,
    "emoji"              TEXT,
    "conditionType"      TEXT NOT NULL,
    "defaultValue"       INTEGER NOT NULL DEFAULT 1,
    "defaultMinScore"    INTEGER,
    "hasMinScore"        BOOLEAN NOT NULL DEFAULT false,
    "requiresSkillGroup" BOOLEAN NOT NULL DEFAULT false,
    "isActive"           BOOLEAN NOT NULL DEFAULT true,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissionTemplate_code_key" ON "MissionTemplate"("code");

-- AlterTable: extend TournamentMission with condition + template fields
ALTER TABLE "TournamentMission"
    ADD COLUMN "templateId"         TEXT,
    ADD COLUMN "conditionType"      TEXT,
    ADD COLUMN "conditionValue"     INTEGER,
    ADD COLUMN "conditionScope"     TEXT DEFAULT 'course',
    ADD COLUMN "conditionMinScore"  INTEGER,
    ADD COLUMN "conditionSkillCode" TEXT;

CREATE INDEX "TournamentMission_templateId_idx" ON "TournamentMission"("templateId");

-- AddForeignKey
ALTER TABLE "TournamentMission"
    ADD CONSTRAINT "TournamentMission_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "MissionTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
