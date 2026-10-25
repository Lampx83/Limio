// Chỉnh dàn ý bằng AI và soạn lại từ đầu (docs/tieu-chi/dan-y-chinh-bang-ai.md, R1–R7, R10): các hàm thuần cho ô ở cột phải trang dàn ý
// và cho đường chỉnh ở máy chủ. Tách khỏi giao diện để test được; không gọi AI ở đây.
import { slideRange, type Outline, type OutlineSlide } from "./limioLiveOutline";

/** Độ dài lời dặn (khớp REVISION_MAX_CHARS của core-feedback; có test đối chiếu). */
export const REVISE_MIN_CHARS = 5;
export const REVISE_MAX_CHARS = 1000;

/** Bốn gợi ý bấm nhanh (R2): chỉ điền vào ô, không gửi. */
export const REVISE_SUGGESTIONS = ["Rút ngắn lại", "Thêm ví dụ thực tế", "Bớt lý thuyết, thêm hoạt động", "Dễ hiểu hơn cho người mới"] as const;

export type InstructionCheck = { ok: true; text: string } | { ok: false; reason: "too_short" | "too_long" };

export function checkInstruction(raw: string): InstructionCheck {
  const text = raw.trim();
  if (text.length < REVISE_MIN_CHARS) return { ok: false, reason: "too_short" };
  if (text.length > REVISE_MAX_CHARS) return { ok: false, reason: "too_long" };
  return { ok: true, text };
}

/** Bấm gợi ý: ô trống thì điền, có chữ thì nối thêm, đã có rồi thì giữ nguyên. */
export function appendSuggestion(current: string, suggestion: string): string {
  const t = current.trim();
  if (!t) return suggestion;
  if (t.toLowerCase().includes(suggestion.toLowerCase())) return t;
  return /[.!?…]$/.test(t) ? `${t} ${suggestion}` : `${t}. ${suggestion}`;
}

/** Hiện hộp chỉ khi bài do AI soạn (không có slide lấy nguyên từ file gốc) và còn văn bản nguồn để AI dựa vào (R1). */
export function canRevise(o: { importedRows: number; sourceChars: number }): boolean {
  return o.importedRows === 0 && o.sourceChars > 0;
}

/** Mức sàn thấp để lời dặn "rút còn 10 slide" làm được; mức trần theo thời lượng như lúc soạn đầu (R5). */
export const REVISE_MIN_SLIDES = 6;
export function reviseRange(minutes: number, selfCheck = false): { min: number; max: number } {
  return { min: REVISE_MIN_SLIDES, max: slideRange(minutes, selfCheck).max };
}

/** Dạng gửi AI: mỗi slide mang vai trò và tên phần của phần chứa nó, không có id nội bộ (R4). */
export function toRevisionInput(outline: Pick<Outline, "title" | "slides" | "parts">) {
  const parts = new Map(outline.parts.map((p) => [p.id, p]));
  return {
    title: outline.title,
    // Dòng "Nguồn tham khảo" do hệ thống dựng từ các trang đã đọc, không đưa cho AI; normalizeOutline dựng lại sau khi chỉnh.
    slides: outline.slides.filter((s) => s.fixed !== "references").map((s) => {
      const part = s.partId ? parts.get(s.partId) : undefined;
      const role = part?.role ?? "content";
      return {
        role,
        section: role === "content" ? (part?.name.trim() || null) : null,
        kind: s.kind,
        layout: s.layout ?? null,
        title: s.title,
        points: s.kind === "content" ? s.points : [],
      };
    }),
  };
}

const norm = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();
const pointsKey = (s: Pick<OutlineSlide, "points">) => s.points.map(norm).join("|");

/**
 * Dàn ý mới do AI trả về mang id mới cho mọi slide. Slide trùng slide cũ giữ id cũ để "Cập nhật slide theo dàn ý" (limioLiveSync) chỉ viết lại
 * slide đổi nội dung chứ không xoá-tạo lại cả bài (R6). Trùng cả loại, tiêu đề và ý trước; rồi trùng loại và tiêu đề. Mỗi id cũ dùng một lần.
 */
export function carryOutlineIds(prev: Pick<Outline, "slides">, next: Outline): Outline {
  const free = new Set(prev.slides.map((s) => s.id));
  const take = (match: (p: OutlineSlide) => boolean): string | null => {
    const hit = prev.slides.find((p) => free.has(p.id) && match(p));
    if (!hit) return null;
    free.delete(hit.id);
    return hit.id;
  };
  // Dòng hệ thống dựng (Nguồn tham khảo) mỗi bài chỉ một: khớp theo loại dòng, không theo chữ.
  const exact = next.slides.map((s) =>
    s.fixed ? take((p) => p.fixed === s.fixed) : take((p) => p.kind === s.kind && norm(p.title) === norm(s.title) && pointsKey(p) === pointsKey(s)),
  );
  const slides = next.slides.map((s, i) => {
    const id = exact[i] ?? (s.fixed ? null : take((p) => !p.fixed && p.kind === s.kind && norm(p.title) === norm(s.title)));
    return id ? { ...s, id } : s;
  });
  return { ...next, slides };
}

/** Ước tính token một lần chỉnh: nguồn (tối đa 24.000 ký tự) và dàn ý đi vào, dàn ý mới đi ra. */
export function estimateReviseTokens(o: { sourceChars: number; slideCount: number }): { input: number; output: number; total: number } {
  const input = 1500 + Math.round(Math.min(o.sourceChars, 24_000) / 2.4) + o.slideCount * 90;
  const output = 200 + o.slideCount * 130;
  return { input, output, total: input + output };
}

/** Lời dặn rút thành một dòng ngắn cho thanh "Đã chỉnh theo" (R7). */
export function shortInstruction(text: string, max = 60): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max).trimEnd()}…` : one;
}
