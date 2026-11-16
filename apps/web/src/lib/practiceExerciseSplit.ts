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
 * Nhóm theo THỨ TỰ ĐOẠN của đề: đoạn có nhãn mở nhóm mới (đoạn liên tiếp cùng nhãn dồn một nhóm; đoạn không có câu hỏi, vd bài nghe
 * chỉ có audio, vẫn là một nhóm); đoạn không có nhãn và câu không thuộc đoạn nào đi cùng nhóm đứng trước. Mỗi nhóm giữ nguyên đề, buổi luyện và cấu hình; chỉ chia câu, đoạn và đáp án.
 * Chỉ một nhóm → trả mảng rỗng (không cần tách).
 */
export function splitEmbedByExercise(embed: PracticeEmbed): ExerciseGroup[] {
  const questionPassage = new Map(embed.questions.map((q) => [q.id, q.passageId]));
  type G = { label: string | null; passageIds: Set<string>; questionIds: Set<string> };
  const groups: G[] = [];
  const groupOfPassage = new Map<string, G>();
  // Theo thứ tự đoạn của đề: kể cả đoạn KHÔNG có câu hỏi (bài nghe chỉ có audio, vd 5A) vẫn là một exercise.
  for (const p of embed.passages) {
    const label = exerciseLabels([p.title]);
    const last = groups[groups.length - 1];
    if (last && (label === null || last.label === label)) {
      last.passageIds.add(p.id);
      groupOfPassage.set(p.id, last);
    } else {
      const g: G = { label, passageIds: new Set([p.id]), questionIds: new Set() };
      groups.push(g);
      groupOfPassage.set(p.id, g);
    }
  }
  // Câu hỏi về nhóm của đoạn của nó; câu không thuộc đoạn nào (hoặc đoạn lạ) đi cùng nhóm đứng trước, nhóm đầu nếu chưa có.
  let prev: G | undefined;
  for (const q of embed.questions) {
    const pid = questionPassage.get(q.id);
    const g = (pid ? groupOfPassage.get(pid) : undefined) ?? prev ?? groups[0];
    if (!g) {
      groups.push((prev = { label: null, passageIds: new Set(), questionIds: new Set([q.id]) }));
      continue;
    }
    g.questionIds.add(q.id);
    prev = g;
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

/**
 * Một exercise có nhiều đoạn (vd 5A gồm Agreeing / Disagreeing / Giving your opinion; 1A gồm hai bộ ảnh) → mỗi đoạn một khối riêng, xếp nối nhau
 * trong CÙNG tab bài tập, để không có tab nằm trong tab. Mỗi khối giữ tên đoạn làm tiêu đề và đánh số câu từ 1 như khi là tab con.
 *
 * Câu không thuộc đoạn nào (hoặc đoạn lạ) đi cùng đoạn đứng trước, đoạn đầu nếu chưa có. Dưới hai đoạn → mảng rỗng (không cần tách).
 */
export function splitEmbedByPassage(embed: PracticeEmbed): PracticeEmbed[] {
  if (embed.passages.length < 2) return [];
  const known = new Set(embed.passages.map((p) => p.id));
  const owner = new Map<string, string>();
  let prev = embed.passages[0]!.id;
  for (const q of embed.questions) {
    const own = q.passageId && known.has(q.passageId) ? q.passageId : prev;
    owner.set(q.id, own);
    prev = own;
  }
  return embed.passages.map((p) => ({
    ...embed,
    passages: [p],
    questions: embed.questions.filter((q) => owner.get(q.id) === p.id),
    answers: embed.answers.filter((a) => owner.get(a.questionId) === p.id),
  }));
}
