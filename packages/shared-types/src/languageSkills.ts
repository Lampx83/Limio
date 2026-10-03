/**
 * LANG G3 — bốn kỹ năng ngôn ngữ.
 *
 * Đặt ở đây vì core-lms (ghi nhãn lên bài/Skill) lẫn core-feedback (gộp hồ sơ) cùng
 * cần mà hai module không được import nhau (§4.3). Thứ tự mảng là thứ tự hiển thị
 * và là thứ tự các trục của radar: Nghe (trên), Nói (phải), Đọc (dưới), Viết (trái).
 *
 * Khớp enum `LanguageSkill` trong packages/db/prisma/schema.prisma.
 */
export const LANGUAGE_SKILLS = ["listening", "speaking", "reading", "writing"] as const;

export type LanguageSkill = (typeof LANGUAGE_SKILLS)[number];

export const LANGUAGE_SKILL_LABEL: Record<LanguageSkill, string> = {
  listening: "Nghe",
  speaking: "Nói",
  reading: "Đọc",
  writing: "Viết",
};

export function isLanguageSkill(v: unknown): v is LanguageSkill {
  return typeof v === "string" && (LANGUAGE_SKILLS as readonly string[]).includes(v);
}
