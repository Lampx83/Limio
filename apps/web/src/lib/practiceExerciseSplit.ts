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
 * Một bài luyện có nhiều phần (vd 5A gồm Agreeing / Disagreeing / Giving your opinion; hoặc một hình kèm vài câu nối/kéo thả rời) → mỗi phần một khối riêng,
 * xếp nối nhau trong CÙNG trang, để không có tab nằm trong tab. Mỗi khối giữ tên đoạn làm tiêu đề và đánh số câu từ 1 như khi là tab con.
 *
 * Phần là: mỗi đoạn (kèm câu của nó), và mỗi dải câu LIỀN NHAU không thuộc đoạn nào (khối không đoạn, không tiêu đề), theo thứ tự soạn của câu hỏi. Đoạn không có
 * câu hỏi (chỉ audio) vẫn là một khối, chèn theo thứ tự đoạn của đề. Dưới hai phần → mảng rỗng (không cần tách).
 */
export function splitEmbedByPassage(embed: PracticeEmbed): PracticeEmbed[] {
  const known = new Set(embed.passages.map((p) => p.id));
  type Seg = { passageId: string | null; questionIds: Set<string> };
  const segs: Seg[] = [];
  const byPassage = new Map<string, Seg>();
  for (const q of embed.questions) {
    if (q.passageId && known.has(q.passageId)) {
      let seg = byPassage.get(q.passageId);
      if (!seg) {
        seg = { passageId: q.passageId, questionIds: new Set() };
        byPassage.set(q.passageId, seg);
        segs.push(seg);
      }
      seg.questionIds.add(q.id);
    } else {
      const last = segs[segs.length - 1];
      if (last && last.passageId === null) last.questionIds.add(q.id);
      else segs.push({ passageId: null, questionIds: new Set([q.id]) });
    }
  }
  // Đoạn không có câu hỏi: chèn trước phần của đoạn đứng sau nó trong đề, không có thì xuống cuối.
  const order = new Map(embed.passages.map((p, i) => [p.id, i]));
  for (const p of embed.passages) {
    if (byPassage.has(p.id)) continue;
    const seg: Seg = { passageId: p.id, questionIds: new Set() };
    byPassage.set(p.id, seg);
    const at = order.get(p.id)!;
    const i = segs.findIndex((x) => x.passageId !== null && (order.get(x.passageId) ?? -1) > at);
    if (i >= 0) segs.splice(i, 0, seg);
    else segs.push(seg);
  }
  if (segs.length < 2) return [];
  return segs.map((seg) => ({
    ...embed,
    passages: seg.passageId ? embed.passages.filter((p) => p.id === seg.passageId) : [],
    questions: embed.questions.filter((q) => seg.questionIds.has(q.id)),
    answers: embed.answers.filter((a) => seg.questionIds.has(a.questionId)),
  }));
}
