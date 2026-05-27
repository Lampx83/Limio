-- Topic-only blueprint mode
-- Adds `mode` (skill_matrix | topic_only) and `bankIds[]` (explicit bank scope, reserved
-- for future explicit-pick UX — currently auto-resolved).
-- Existing rows default to "skill_matrix" so legacy blueprints keep working.

ALTER TABLE "ExamBlueprint"
    ADD COLUMN "mode"    TEXT   NOT NULL DEFAULT 'skill_matrix',
    ADD COLUMN "bankIds" TEXT[] NOT NULL DEFAULT '{}';
