-- Course-level personalization toggle.
-- false (default) → standard LMS, publish skips skill-tag gate, no Feedback Engine.
-- true            → AI feedback active, publish requires every lesson to have ≥1 skill tag.
-- Backfill: every existing course (including published ones) gets false to match new default.
ALTER TABLE "Course" ADD COLUMN "personalizationEnabled" BOOLEAN NOT NULL DEFAULT false;
