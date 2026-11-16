import type { PracticeEmbed } from "@feedbackme/core-lms";

/**
 * Thông tin hiện trên thẻ của mỗi tab bài tập (loại bài, tên bài, tiến độ), để học viên biết một tab là một bài tập và đang ở trạng thái nào.
 */
export type PracticeKind = "speak" | "listen" | "choose" | "write" | "match" | "read";

export const PRACTICE_KIND_LABEL: Record<PracticeKind, string> = {
  speak: "Nói với bạn ảo",
  listen: "Nghe",
  choose: "Chọn đáp án",
  write: "Điền / viết",
  match: "Ghép, sắp xếp",
  read: "Đọc",
};

/** Sự kiện do khối luyện phát mỗi khi đáp án hoặc kết quả kiểm tra đổi, để thẻ tab cập nhật tiến độ mà không phải đưa trạng thái lên cao. */
export const PRACTICE_PROGRESS_EVENT = "limio:practice-progress";
export interface PracticeProgressDetail {
  ids: string[];
  answered: string[];
  checked: string[];
}

export interface PracticeTabMeta {
  title?: string;
  kind?: PracticeKind;
  /** Mọi câu của tab; rỗng với tab chỉ có nội dung để nghe hoặc đọc. */
  ids?: string[];
  /** Câu đã có đáp án và câu đã kiểm tra khi mở trang (cập nhật tiếp theo sự kiện của khối luyện). */
  answered?: string[];
  checked?: string[];
}

const CODE = /^\d+[A-E]?(?:[–-]\d*[A-E])?(?:,\s*\d+[A-E]?)*$/;

function hasAudio(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: unknown; content?: unknown };
  if (n.type === "audio") return true;
  return Array.isArray(n.content) && n.content.some(hasAudio);
}

const isAnsweredJson = (v: unknown) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);

/** Phần tên bài của tiêu đề đoạn ("5A · Complete the phrases · Agreeing" → "Complete the phrases"); các đoạn khác nhau hoàn toàn → rỗng. */
export function practiceTabTitle(passageTitles: readonly string[], blockTitle?: string): string {
  const heads = passageTitles
    .map((t) => t.split(" · ").map((x) => x.trim()).filter(Boolean))
    .map((parts) => (parts.length > 0 && CODE.test(parts[0]!) ? parts.slice(1) : parts))
    .map((parts) => parts[0] ?? "");
  const first = heads[0] ?? "";
  if (first && heads.every((h) => h === first)) return first;
  const block = (blockTitle ?? "").replace(/\s*·\s*Practice\s*$/i, "").trim();
  return block;
}

export function practiceKindOf(embed: PracticeEmbed, virtualPartner: boolean): PracticeKind {
  if (virtualPartner) return "speak";
  if (embed.passages.some((p) => hasAudio(p.contentJson))) return "listen";
  const count = (types: string[]) => embed.questions.filter((q) => types.includes(q.type)).length;
  if (embed.questions.length === 0) return "read";
  const choose = count(["mcq", "multi", "true_false_notgiven"]);
  const match = count(["matching", "ordering", "drag_drop_fill"]);
  const write = embed.questions.length - choose - match;
  if (choose >= match && choose >= write) return "choose";
  if (match >= write) return "match";
  return "write";
}

export function practiceTabMeta(embed: PracticeEmbed, virtualPartner: boolean, blockTitle?: string): PracticeTabMeta {
  const ids = embed.questions.map((q) => q.id);
  const own = new Set(ids);
  return {
    title: practiceTabTitle(embed.passages.map((p) => p.title), blockTitle) || undefined,
    kind: practiceKindOf(embed, virtualPartner),
    ids,
    answered: embed.answers.filter((a) => own.has(a.questionId) && isAnsweredJson(a.answerJson)).map((a) => a.questionId),
    checked: embed.answers.filter((a) => own.has(a.questionId) && a.checked).map((a) => a.questionId),
  };
}

/** Gộp thông tin của các tab cùng nhãn (một exercise một tab). */
export function mergePracticeMeta(metas: readonly (PracticeTabMeta | undefined)[]): PracticeTabMeta | undefined {
  const list = metas.filter((m): m is PracticeTabMeta => !!m);
  if (list.length === 0) return undefined;
  if (list.length === 1) return list[0];
  const uniq = (f: (m: PracticeTabMeta) => string[] | undefined) => [...new Set(list.flatMap((m) => f(m) ?? []))];
  return {
    title: list.find((m) => m.title)?.title,
    kind: list.find((m) => m.kind && m.kind !== "read")?.kind ?? list[0]!.kind,
    ids: uniq((m) => m.ids),
    answered: uniq((m) => m.answered),
    checked: uniq((m) => m.checked),
  };
}
