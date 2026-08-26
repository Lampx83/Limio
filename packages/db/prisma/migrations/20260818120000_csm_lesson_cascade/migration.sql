-- B1.5 — lesson-as-tag.
--
-- csm_lesson_fk defaulted to ON DELETE RESTRICT, which blocked deleting any
-- lesson (and, by cascade, any module or course) that carried a skill tag.
-- Harmless while tagging was rare; fatal once every lesson gets an auto tag.
-- A mapping has no meaning without its lesson, so it should follow it out.
ALTER TABLE "ContentSkillMapping" DROP CONSTRAINT "csm_lesson_fk";

ALTER TABLE "ContentSkillMapping"
  ADD CONSTRAINT "csm_lesson_fk"
  FOREIGN KEY ("contentId") REFERENCES "Lesson"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
