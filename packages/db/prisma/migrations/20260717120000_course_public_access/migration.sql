-- Course-level public access toggle.
-- false (default) → lessons require sign-in; unchanged behaviour.
-- true            → logged-out visitors may read lessons (content + video) in the
--                   read-only preview mode, without enrolling. Account-only features
--                   (progress, completion, notes, AI tutor, forum, quizzes) stay hidden.
--                   Gated on `status = published` at read time — a draft course is never
--                   public even with this flag on.
-- Backfill: every existing course gets false, so no course becomes public by this migration.
ALTER TABLE "Course" ADD COLUMN "publicAccess" BOOLEAN NOT NULL DEFAULT false;
