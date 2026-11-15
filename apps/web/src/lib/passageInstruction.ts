export interface PassageDoc {
  type: "doc";
  content: unknown[];
}

const MAX_INSTRUCTION_CHARS = 300;
/** Phiếu "Talk with a virtual partner" chỉ có một câu mời; chỉ câu mở đầu như vậy mới được coi là đề bài khi không còn nội dung nào khác. */
const VIRTUAL_PARTNER_LEAD = /^No (?:partner|group)\?/i;

/**
 * Tách đề bài (rubric của bài tập: "Find the ten multi-word verbs in the texts…") khỏi nội dung đoạn để Bài luyện nhúng hiện nó
 * trong khối riêng (docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md, AC2).
 *
 * Đề bài = đoạn văn ĐẦU, gồm đúng một nút chữ không có định dạng (không đậm/nghiêng/ô trống), 1–300 ký tự. Đoạn chỉ có một
 * câu như vậy là nội dung (bài đọc ngắn), trừ khi mở đầu bằng "No partner?" / "No group?". Không đổi tài liệu gốc.
 */
export function splitPassageInstruction(doc: PassageDoc): { instruction: string | null; rest: PassageDoc } {
  const first = doc.content?.[0] as { type?: string; content?: Array<{ type?: string; text?: string; marks?: unknown[] }> } | undefined;
  const unchanged = { instruction: null, rest: doc };
  if (!first || first.type !== "paragraph" || first.content?.length !== 1) return unchanged;
  const node = first.content[0]!;
  if (node.type !== "text" || (node.marks && node.marks.length > 0)) return unchanged;
  const text = (node.text ?? "").trim();
  if (text.length === 0 || text.length > MAX_INSTRUCTION_CHARS) return unchanged;
  const rest = doc.content.slice(1);
  if (rest.length === 0 && !VIRTUAL_PARTNER_LEAD.test(text)) return unchanged;
  return { instruction: text, rest: { type: "doc", content: rest } };
}
