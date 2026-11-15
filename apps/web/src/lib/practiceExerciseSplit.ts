import type { PracticeEmbed } from "@feedbackme/core-lms";
import { exerciseLabels } from "./lessonSections";

export interface ExerciseGroup {
  /** Nhãn exercise ("3A", "7B", "2A–2C", "5"); null = nhóm đầu không có nhãn (nơi gọi đặt tên dự phòng). */
  label: string | null;
  embed: PracticeEmbed;
}

/**
 * Tách một khối Bài luyện gom nhiều exercise (vd Grammar: 3A, 3B, 3C, 5) thành từng exercise — mỗi cái là một tab
 * (docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md, AC5).
 *
 * Nhóm theo THỨ TỰ CÂU: đoạn có nhãn mở nhóm mới (đoạn liên tiếp cùng nhãn dồn một nhóm); đoạn không có nhãn và câu không thuộc
 * đoạn nào đi cùng nhóm đứng trước. Mỗi nhóm giữ nguyên đề, buổi luyện và cấu hình; chỉ chia câu, đoạn và đáp án.
 * Chỉ một nhóm → trả mảng rỗng (không cần tách).
 */
export function splitEmbedByExercise(embed: PracticeEmbed): ExerciseGroup[] {
  const passageById = new Map(embed.passages.map((p) => [p.id, p]));
  const groups: { label: string | null; passageIds: Set<string>; questionIds: Set<string> }[] = [];
  for (const q of embed.questions) {
    const p = q.passageId ? passageById.get(q.passageId) : undefined;
    const label = p ? exerciseLabels([p.title]) : null;
    const last = groups[groups.length - 1];
    if (last && (label === null || last.label === label)) {
      last.questionIds.add(q.id);
      if (p) last.passageIds.add(p.id);
    } else {
      groups.push({ label, passageIds: new Set(p ? [p.id] : []), questionIds: new Set([q.id]) });
    }
  }
  if (groups.length < 2) return [];
  return groups.map((g) => ({
    label: g.label,
    embed: {
      ...embed,
      questions: embed.questions.filter((q) => g.questionIds.has(q.id)),
      passages: embed.passages.filter((p) => g.passageIds.has(p.id)),
      answers: embed.answers.filter((a) => g.questionIds.has(a.questionId)),
    },
  }));
}
