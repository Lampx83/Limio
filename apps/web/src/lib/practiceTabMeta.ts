import type { PracticeEmbed } from "@feedbackme/core-lms";
import { splitPassageInstruction, type PassageDoc } from "./passageInstruction";

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

/** Khu bài luyện báo đã kiểm hết (done: true) hay chưa (false): nút "Tiếp" của thanh đáy đổi mức nhấn theo (docs/tieu-chi/limio-language-ux-dieu-huong-bai.md, H4). */
export const PRACTICE_COMPLETE_EVENT = "limio:practice-complete";
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

/** Chữ của đoạn văn đầu tiên trong tài liệu (khi cả đoạn chỉ có một câu yêu cầu thì splitPassageInstruction coi đó là nội dung chứ không phải đề bài). */
function firstParagraphText(doc: unknown): string {
  const first = (doc as { content?: Array<{ type?: string; content?: Array<{ text?: string }> }> } | null)?.content?.[0];
  if (!first || first.type !== "paragraph") return "";
  return (first.content ?? []).map((n) => n.text ?? "").join("");
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

/** Mở đầu chung chung của câu yêu cầu ("Work in pairs.") không đủ để gọi tên bài tập: bỏ qua, lấy câu kế tiếp. */
const GENERIC_OPENER = /^(?:work (?:in|with)\b|in (?:pairs|groups)\b|then\b|now\b|and\b)/i;
const MAX_TITLE_WORDS = 8;
/** Từ không được đứng cuối một tên bị cắt ("…about their", "…how the words are"): lùi lại cho tới khi gặp từ có nghĩa. */
const DANGLING = new Set(
  "a an the of to in on at for with about by from into onto over as and or but so that than if when while why how what which who whose where it its this these those their his her our your my you we they them are is was were be been do does did can could will would should have has had not no each any more most both either being".split(" "),
);
/** Chỗ ngắt mệnh đề tự nhiên: cắt tại đây thì tên vẫn trọn ý ("Listen to the radio programme and answer the questions" → "Listen to the radio programme"). */
const CLAUSE_BREAK = /,|\s(?:and|then|so that|because|using|including|before|after)\s/i;

/**
 * Tên ngắn cho bài tập sách không đặt tên: câu đầu có nghĩa của câu yêu cầu ("Which word has the main stress? Listen and check." → "Which word has the main stress?").
 * Câu quá dài thì cắt ở chỗ ngắt mệnh đề; không có thì cắt theo từ rồi lùi bỏ các từ nối/giới từ treo ở cuối, rồi mới thêm "…". Không có câu nào → rỗng.
 */
export function titleFromInstruction(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const sentences = flat.split(/(?<=[.?!:])\s+/).map((x) => x.trim()).filter(Boolean);
  const pick = sentences.find((x) => !GENERIC_OPENER.test(x)) ?? sentences[0] ?? "";
  const clean = pick.replace(/[.:]+$/, "");
  const words = clean.split(" ");
  if (words.length <= MAX_TITLE_WORDS) return clean;
  // 1) cắt tại chỗ ngắt mệnh đề đầu tiên nằm trong khoảng 3–8 từ
  const m = CLAUSE_BREAK.exec(clean);
  if (m) {
    const head = clean.slice(0, m.index).replace(/[,\s]+$/, "");
    const n = head.split(" ").length;
    if (n >= 3 && n <= MAX_TITLE_WORDS) return head;
  }
  // 2) cắt theo từ, lùi bỏ từ treo ở cuối (và "Exercise" mất số bài)
  let cut = words.slice(0, MAX_TITLE_WORDS);
  while (cut.length > 3 && (DANGLING.has(cut[cut.length - 1]!.toLowerCase().replace(/[^a-z']/g, "")) || /^exercises?$/i.test(cut[cut.length - 1]!))) cut = cut.slice(0, -1);
  return `${cut.join(" ").replace(/[,;]+$/, "")}…`;
}

/**
 * Tiêu đề thẻ đề bài của một đoạn: đoạn đã có tên ("3D · More examples in the article") giữ nguyên; đoạn chỉ có mã bài ("4A", "5") thì thêm tên rút từ câu
 * yêu cầu ("5 · Complete the second sentence so that it…"), để mọi bài tập đều có tiêu đề đậm giống nhau.
 */
export function headingTitleOf(title: string, contentJson: unknown): string {
  const t = title.trim();
  if (!CODE.test(t)) return title;
  const instruction = splitPassageInstruction(contentJson as PassageDoc).instruction ?? firstParagraphText(contentJson);
  const name = titleFromInstruction(instruction);
  return name ? `${t} · ${name}` : title;
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
  const first = embed.passages[0];
  const instruction = first ? splitPassageInstruction(first.contentJson as PassageDoc).instruction : null;
  return {
    title: practiceTabTitle(embed.passages.map((p) => p.title), blockTitle) || titleFromInstruction(instruction ?? firstParagraphText(first?.contentJson)) || undefined,
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
