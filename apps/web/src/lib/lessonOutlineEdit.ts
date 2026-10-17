import type { LessonLayoutKey, LessonOutline, OutlineLesson, OutlineSection } from "@feedbackme/shared-types";
import { newOutlineId, pruneEmptyLessons } from "./lessonOutline";

/**
 * Các thao tác sửa dàn ý ở màn "Dàn ý" — hàm thuần, trả dàn ý mới, không sửa
 * dàn ý cũ (React so sánh theo tham chiếu). Mọi thao tác giữ bất biến: mỗi đoạn
 * tài liệu thuộc tối đa một mục hoặc nằm trong danh sách bỏ qua.
 */

export interface SectionPos {
  lesson: number;
  section: number;
}

export function findSection(outline: LessonOutline, id: string): SectionPos | null {
  for (let l = 0; l < outline.lessons.length; l++) {
    const s = outline.lessons[l]!.sections.findIndex((x) => x.id === id);
    if (s >= 0) return { lesson: l, section: s };
  }
  return null;
}

function mapLesson(outline: LessonOutline, li: number, fn: (l: OutlineLesson) => OutlineLesson): LessonOutline {
  return { ...outline, lessons: outline.lessons.map((l, i) => (i === li ? fn(l) : l)) };
}

export function updateSection(outline: LessonOutline, id: string, patch: Partial<Omit<OutlineSection, "id">>): LessonOutline {
  return {
    ...outline,
    lessons: outline.lessons.map((l) => ({
      ...l,
      sections: l.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),
  };
}

export function updateLesson(outline: LessonOutline, li: number, patch: Partial<Omit<OutlineLesson, "id" | "sections">>): LessonOutline {
  return mapLesson(outline, li, (l) => ({ ...l, ...patch }));
}

/**
 * Kéo mục `activeId` tới chỗ của mục `overId` (có thể ở bài khác). Cùng bài:
 * đổi chỗ như danh sách thường. Khác bài: kéo xuống thì đứng trước mục đích,
 * kéo lên thì đứng sau — đúng chỗ vạch thả hiện ra.
 */
export function moveSection(outline: LessonOutline, activeId: string, overId: string): LessonOutline {
  if (activeId === overId) return outline;
  const from = findSection(outline, activeId);
  const to = findSection(outline, overId);
  if (!from || !to) return outline;
  const lessons = outline.lessons.map((l) => ({ ...l, sections: [...l.sections] }));
  const [item] = lessons[from.lesson]!.sections.splice(from.section, 1);
  if (!item) return outline;
  if (from.lesson === to.lesson) {
    lessons[to.lesson]!.sections.splice(to.section, 0, item);
  } else {
    const down = from.lesson < to.lesson;
    lessons[to.lesson]!.sections.splice(down ? to.section : to.section + 1, 0, item);
  }
  return pruneEmptyLessons({ ...outline, lessons });
}

/** Tách bài `li` thành hai từ mục thứ `si` (mục đó thành mục đầu của bài mới). */
export function splitLessonAt(outline: LessonOutline, li: number, si: number): LessonOutline {
  const lesson = outline.lessons[li];
  if (!lesson || si <= 0 || si >= lesson.sections.length) return outline;
  const head: OutlineLesson = { ...lesson, sections: lesson.sections.slice(0, si) };
  const tailSections = lesson.sections.slice(si);
  const tail: OutlineLesson = {
    id: newOutlineId(),
    title: tailSections[0]?.title ?? "Bài mới",
    objectives: [],
    sections: tailSections,
  };
  const lessons = [...outline.lessons];
  lessons.splice(li, 1, head, tail);
  return { ...outline, lessons };
}

/** Gộp bài `li` vào bài ngay trên. Mục tiêu của hai bài được gộp, bỏ trùng. */
export function mergeLessonUp(outline: LessonOutline, li: number): LessonOutline {
  if (li <= 0 || li >= outline.lessons.length) return outline;
  const up = outline.lessons[li - 1]!;
  const cur = outline.lessons[li]!;
  const merged: OutlineLesson = {
    ...up,
    objectives: [...new Set([...up.objectives, ...cur.objectives])].slice(0, 5),
    sections: [...up.sections, ...cur.sections],
  };
  const lessons = [...outline.lessons];
  lessons.splice(li - 1, 2, merged);
  return { ...outline, lessons };
}

export function addSection(outline: LessonOutline, li: number, layout: LessonLayoutKey = "text"): { outline: LessonOutline; id: string } {
  const id = newOutlineId();
  const section: OutlineSection = { id, title: "Mục mới", layout, points: [], boxes: [], paras: [] };
  return { outline: mapLesson(outline, li, (l) => ({ ...l, sections: [...l.sections, section] })), id };
}

/** Xoá mục: các đoạn tài liệu của mục trở thành "chưa thuộc mục nào" để giảng viên quyết. */
export function removeSection(outline: LessonOutline, id: string): LessonOutline {
  const next = {
    ...outline,
    lessons: outline.lessons.map((l) => ({ ...l, sections: l.sections.filter((s) => s.id !== id) })),
  };
  return pruneEmptyLessons(next);
}

/** Gán đoạn `para` vào mục `id` (gỡ khỏi mục cũ hoặc khỏi danh sách bỏ qua). */
export function assignPara(outline: LessonOutline, para: number, id: string): LessonOutline {
  return {
    ignoredParas: outline.ignoredParas.filter((n) => n !== para),
    lessons: outline.lessons.map((l) => ({
      ...l,
      sections: l.sections.map((s) => {
        const without = s.paras.filter((n) => n !== para);
        return s.id === id ? { ...s, paras: [...without, para].sort((a, b) => a - b) } : { ...s, paras: without };
      }),
    })),
  };
}

/** Bỏ qua các đoạn (không đưa vào bài), gỡ khỏi mục đang chứa nếu có. */
export function ignoreParas(outline: LessonOutline, paras: number[]): LessonOutline {
  const set = new Set(paras);
  return {
    ignoredParas: [...new Set([...outline.ignoredParas, ...paras])].sort((a, b) => a - b),
    lessons: outline.lessons.map((l) => ({
      ...l,
      sections: l.sections.map((s) => ({ ...s, paras: s.paras.filter((n) => !set.has(n)) })),
    })),
  };
}

/** "Đoạn 3–7, 9" — nhãn ngắn cho danh sách đoạn (đánh số từ 1 như giảng viên thấy). */
export function paraRangeLabel(paras: number[]): string {
  if (paras.length === 0) return "Chưa có đoạn";
  const sorted = [...paras].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0]!;
  let prev = start;
  for (const n of [...sorted.slice(1), Number.NaN]) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? `${start + 1}` : `${start + 1}–${prev + 1}`);
    start = n;
    prev = n;
  }
  return `Đoạn ${parts.join(", ")}`;
}
