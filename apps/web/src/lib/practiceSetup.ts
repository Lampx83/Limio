/**
 * LANG G5e — dựng yêu cầu bắt đầu buổi luyện từ lựa chọn của học viên, và đếm số câu sẽ vào buổi
 * luyện (hiện trên nút). Thuần, để thử không cần giao diện.
 */
export type PracticeFilter = "all" | "unanswered" | "wrong";

export interface PracticeSectionInfo {
  id: string;
  title: string;
  languageSkill: string | null;
  questionCount: number;
  unansweredCount: number;
  wrongCount: number;
}

export interface PracticeSelection {
  skills: string[];
  sectionIds: string[];
  all: boolean;
  filter: PracticeFilter;
}

export interface PracticeRequest {
  skills?: string[];
  sectionIds?: string[];
  all?: boolean;
  filter: PracticeFilter;
  timed: boolean;
  checkEnabled: boolean;
}

export function buildPracticeRequest(
  s: PracticeSelection & { timed: boolean; checkEnabled: boolean },
): PracticeRequest | null {
  const base = { filter: s.filter, timed: s.timed, checkEnabled: s.checkEnabled };
  if (s.all) return { all: true, ...base };
  if (s.skills.length === 0 && s.sectionIds.length === 0) return null;
  return {
    ...(s.skills.length > 0 ? { skills: s.skills } : {}),
    ...(s.sectionIds.length > 0 ? { sectionIds: s.sectionIds } : {}),
    ...base,
  };
}

export function countInScope(sections: PracticeSectionInfo[], s: PracticeSelection): number {
  let n = 0;
  for (const sec of sections) {
    const picked = s.all || s.sectionIds.includes(sec.id) || (sec.languageSkill !== null && s.skills.includes(sec.languageSkill));
    if (!picked) continue;
    n += s.filter === "unanswered" ? sec.unansweredCount : s.filter === "wrong" ? sec.wrongCount : sec.questionCount;
  }
  return n;
}
