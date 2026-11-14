/**
 * LANG đợt 3b — phần thuần của khối "Bài luyện" nhúng trong bài học: chia bước theo đoạn văn, đếm tiến độ, tóm tắt.
 * Tách khỏi React để thử được không cần dựng giao diện.
 */

export interface PQ {
  id: string;
  passageId: string | null;
}

export interface PracticeStep {
  key: string;
  passageId: string | null;
  questionIds: string[];
}

/** Câu liền nhau cùng một đoạn văn gộp thành một bước; câu không có đoạn văn mỗi câu một bước. */
export function buildSteps(questions: PQ[]): PracticeStep[] {
  const out: PracticeStep[] = [];
  for (const q of questions) {
    const last = out[out.length - 1];
    if (q.passageId && last && last.passageId === q.passageId) last.questionIds.push(q.id);
    else out.push({ key: `${q.passageId ?? "q"}:${q.id}`, passageId: q.passageId, questionIds: [q.id] });
  }
  return out;
}

/**
 * Phiếu bài tập: câu liền nhau cùng một đoạn văn gộp thành một bước, và các câu LIỀN NHAU KHÔNG CÓ đoạn văn cũng gộp thành một bước
 * (khác `buildSteps`, nơi mỗi câu không đoạn văn là một bước riêng — phiếu không được thành nhiều tab một câu).
 */
export function buildSheetSteps(questions: PQ[], passageIds: string[] = []): PracticeStep[] {
  const out: PracticeStep[] = [];
  for (const q of questions) {
    const last = out[out.length - 1];
    if (last && last.passageId === q.passageId) last.questionIds.push(q.id);
    else out.push({ key: `${q.passageId ?? "q"}:${q.id}`, passageId: q.passageId, questionIds: [q.id] });
  }
  // Đoạn văn không có câu hỏi nào (bài nghe/đọc để nghe và lặp lại) vẫn là một bài tập: chèn bước rỗng theo thứ tự đoạn văn của đề.
  const have = new Set(out.map((s) => s.passageId).filter(Boolean));
  const order = new Map(passageIds.map((id, i) => [id, i]));
  for (const id of passageIds) {
    if (have.has(id)) continue;
    const at = order.get(id)!;
    const i = out.findIndex((s) => s.passageId !== null && (order.get(s.passageId) ?? -1) > at);
    const empty: PracticeStep = { key: `${id}:empty`, passageId: id, questionIds: [] };
    if (i >= 0) out.splice(i, 0, empty);
    else out.push(empty);
  }
  return out;
}

export interface PracticeCounts {
  checked: number;
  chosen: number;
  unanswered: number;
  total: number;
}

/** "x đã kiểm tra · y đã chọn · z chưa trả lời": mỗi câu thuộc đúng một nhóm. */
export function countProgress(ids: string[], answered: (id: string) => boolean, checked: (id: string) => boolean): PracticeCounts {
  let c = 0;
  let a = 0;
  for (const id of ids) {
    if (checked(id)) c++;
    else if (answered(id)) a++;
  }
  return { checked: c, chosen: a, unanswered: ids.length - c - a, total: ids.length };
}

export function progressLabel(c: PracticeCounts): string {
  return `${c.checked} đã kiểm tra · ${c.chosen} đã chọn · ${c.unanswered} chưa trả lời`;
}

/** Bước chứa câu `id`; -1 nếu không có. */
export function stepIndexOf(steps: PracticeStep[], id: string): number {
  return steps.findIndex((s) => s.questionIds.includes(id));
}

export const SKILL_TEXT: Record<string, string> = { listening: "Nghe", speaking: "Nói", reading: "Đọc", writing: "Viết", other: "Khác" };

export interface SummaryRow {
  skill: string;
  label: string;
  correct: number;
  total: number;
}

/** Dòng tóm tắt theo kỹ năng; câu tự luận (chấm tay) không tính đúng/sai nên không vào mẫu số. */
export function summaryRows(bySkill: Array<{ skill: string; correct: number; total: number; manual: number }>): SummaryRow[] {
  return bySkill.map((s) => ({ skill: s.skill, label: SKILL_TEXT[s.skill] ?? s.skill, correct: s.correct, total: Math.max(0, s.total - s.manual) }));
}

export type LayoutPref = "split" | "single";

export function parseLayoutPref(raw: unknown): LayoutPref {
  return raw === "single" ? "single" : "split";
}

export const LAYOUT_STORAGE_KEY = "limio:practice-layout";

/** Đọc lựa chọn bố cục đã nhớ; mọi lỗi (chặn lưu trữ, chế độ riêng tư…) thì dùng mặc định chia đôi. */
export function readLayoutPref(storage: Pick<Storage, "getItem"> | null | undefined): LayoutPref {
  try {
    return parseLayoutPref(storage?.getItem(LAYOUT_STORAGE_KEY));
  } catch {
    return "split";
  }
}

export function writeLayoutPref(storage: Pick<Storage, "setItem"> | null | undefined, pref: LayoutPref): void {
  try {
    storage?.setItem(LAYOUT_STORAGE_KEY, pref);
  } catch {
    /* chỉ là tiện lợi */
  }
}

/** Đoạn văn chỉ là câu yêu cầu nếu không dài hơn thế (ký tự); dài hơn là bài đọc thật. */
export const INSTRUCTION_ONLY_MAX_CHARS = 400;

/**
 * Đoạn văn của Bài luyện chỉ gồm vài câu chữ (không bài đọc dài, audio, ảnh, bảng, danh sách) thì không cần cột riêng: phiếu hiện nó thành
 * câu yêu cầu ở đầu bài tập, một cột. Trả chữ thuần của đoạn (các đoạn cách nhau một dòng trống) hoặc null nếu đoạn có nội dung thật.
 */
export function instructionOnlyText(contentJson: unknown): string | null {
  const doc = contentJson as { type?: unknown; content?: unknown } | null;
  if (!doc || doc.type !== "doc" || !Array.isArray(doc.content) || doc.content.length === 0) return null;
  const paras: string[] = [];
  for (const node of doc.content as Array<{ type?: unknown; content?: unknown }>) {
    if (!node || node.type !== "paragraph") return null; // heading, list, table, image, audio… là nội dung thật
    const inline = Array.isArray(node.content) ? (node.content as Array<{ type?: unknown; text?: unknown }>) : [];
    if (inline.some((n) => n.type !== "text" && n.type !== "hardBreak")) return null;
    paras.push(inline.map((n) => (n.type === "hardBreak" ? "\n" : typeof n.text === "string" ? n.text : "")).join("").trim());
  }
  const text = paras.filter(Boolean).join("\n\n");
  return text && text.length <= INSTRUCTION_ONLY_MAX_CHARS ? text : null;
}

/**
 * Đoạn văn chỉ có vài câu chữ NGẮN kèm trình phát audio (bài nghe: "Listen and complete…"): cũng không cần cột riêng, trình phát hiện ngay trên các câu hỏi.
 * Chỉ nhận đoạn mà mọi khối ở mức trên là đoạn chữ thuần hoặc audio (có ít nhất một audio) và chữ không quá `INSTRUCTION_ONLY_MAX_CHARS`.
 */
export function isShortAudioPassage(contentJson: unknown): boolean {
  const doc = contentJson as { type?: unknown; content?: unknown } | null;
  if (!doc || doc.type !== "doc" || !Array.isArray(doc.content)) return false;
  let audio = 0;
  let chars = 0;
  for (const node of doc.content as Array<{ type?: unknown; content?: unknown }>) {
    if (node?.type === "audio") {
      audio++;
      continue;
    }
    if (node?.type !== "paragraph") return false;
    const inline = Array.isArray(node.content) ? (node.content as Array<{ type?: unknown; text?: unknown }>) : [];
    if (inline.some((n) => n.type !== "text" && n.type !== "hardBreak")) return false;
    chars += inline.reduce((n, x) => n + (typeof x.text === "string" ? x.text.length : 0), 0);
  }
  return audio > 0 && chars <= INSTRUCTION_ONLY_MAX_CHARS;
}
