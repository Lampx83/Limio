/**
 * B1.5 — lesson-as-tag convention.
 *
 * A Skill whose `code` starts with this prefix was derived automatically from a
 * Lesson rather than authored by an instructor. Both core-lms (which writes the
 * rows) and core-feedback (which reads them) need to recognise the convention,
 * and the two modules must not import each other — so it lives here.
 *
 * Format: `lesson.<lessonId>`
 */
export const AUTO_LESSON_SKILL_PREFIX = "lesson.";

export function lessonSkillCode(lessonId: string): string {
  return `${AUTO_LESSON_SKILL_PREFIX}${lessonId}`;
}

export function isAutoLessonSkillCode(code: string): boolean {
  return code.startsWith(AUTO_LESSON_SKILL_PREFIX);
}

/** Recover the lesson id from an auto tag code. Null for authored skills. */
export function lessonIdFromSkillCode(code: string): string | null {
  return isAutoLessonSkillCode(code)
    ? code.slice(AUTO_LESSON_SKILL_PREFIX.length)
    : null;
}
