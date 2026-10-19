// Trang dàn ý theo bản mẫu docs/mockup/dan-y-hoc-gamma.html (tiêu chí O1–O6): các hàm thuần cho thẻ slide, mạch bài, gợi ý giao diện
// và trạng thái các ô khi đang tạo. Tách khỏi giao diện để test được.
import { SLIDE_THEMES } from "@/app/instructor/limio-live/slideThemes";
import type { Outline, OutlineSlide } from "./limioLiveOutline";

/** Số ý hiện sẵn trên thẻ; nhiều hơn thì "và n ý nữa". */
export const CARD_POINTS_SHOWN = 4;

/** Các ý hiện sẵn trên thẻ slide (O1). Slide tương tác không có ý: câu hỏi nằm ở tiêu đề. */
export function cardPoints(s: Pick<OutlineSlide, "kind" | "points">): { shown: string[]; more: number } {
  if (s.kind !== "content") return { shown: [], more: 0 };
  const pts = s.points.map((p) => p.trim()).filter(Boolean);
  return { shown: pts.slice(0, CARD_POINTS_SHOWN), more: Math.max(0, pts.length - CARD_POINTS_SHOWN) };
}

/** Mạch bài (O4): ghép từ dàn ý, không gọi AI. */
export function outlineStory(outline: Outline, o: { imported: number }): string {
  const names = outline.parts.filter((p) => p.role === "content" && p.name.trim()).map((p) => p.name.trim());
  const interactive = outline.slides.filter((s) => s.kind !== "content").length;
  const bits: string[] = [];
  if (o.imported > 0) bits.push(`Giữ đúng thứ tự ${o.imported} slide gốc.`);
  if (names.length) bits.push(`Bài gồm ${names.length} phần: ${names.join(", ")}.`);
  else if (!bits.length) bits.push(`Bài có ${outline.slides.length} slide.`);
  if (interactive > 0) bits.push(`Có ${interactive} slide tương tác.`);
  return bits.join(" ");
}

/** Giao diện sáng để gợi ý (nền tối chỉ áp cho slide nội dung nên không đưa vào gợi ý nhanh). */
const SUGGESTABLE = SLIDE_THEMES.filter((t) => !t.dark).map((t) => t.id as string);

/** Giao diện gợi ý kế tiếp (O3): sáng, khác giao diện hiện tại, chưa xem; hết thì vòng lại. */
export function nextThemeSuggestion(current: string, seen: string[]): string {
  const taken = new Set([current, ...seen]);
  const fresh = SUGGESTABLE.find((id) => !taken.has(id));
  if (fresh) return fresh;
  const at = SUGGESTABLE.indexOf(current);
  return SUGGESTABLE[(at + 1) % SUGGESTABLE.length] ?? SUGGESTABLE[0]!;
}

export type TileState = "done" | "now" | "wait";
/** Số slide viết cùng lúc (số lô chạy song song của máy chủ). */
export const GEN_CONCURRENCY = 2;

/**
 * Trạng thái từng ô của lưới "đang tạo" (O6), theo thứ tự dàn ý. `writing` là tập slide sẽ viết (null = tất cả); slide ngoài tập đó
 * (cập nhật một phần) coi như xong. Tối đa GEN_CONCURRENCY slide chưa xong đầu tiên là "đang viết".
 */
export function generationTiles(ids: string[], done: Set<string>, writing: Set<string> | null): TileState[] {
  let now = 0;
  return ids.map((id) => {
    if (done.has(id) || (writing && !writing.has(id))) return "done";
    if (now < GEN_CONCURRENCY) {
      now += 1;
      return "now";
    }
    return "wait";
  });
}
