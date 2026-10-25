// Ít nhất 5 slide tương tác ở mọi cách tạo bài giảng (docs/tieu-chi/tao-bai-giang-mot-o.md, M14–M18): mức tối thiểu theo
// thời lượng, phần còn thiếu, chèn slide tương tác AI đề xuất đúng luật và giới hạn bảng trắng. Hàm thuần.
import { finalizeParts, newOutlineId, type Outline, type OutlineKind, type OutlineSlide } from "./limioLiveOutline";

export const INTERACTIVE_KINDS = ["quiz", "poll", "word_cloud", "collaborate_board", "draw_it", "whiteboard"] as const;
type InteractiveKind = (typeof INTERACTIVE_KINDS)[number];
const isInteractiveKind = (k: unknown): k is InteractiveKind => typeof k === "string" && (INTERACTIVE_KINDS as readonly string[]).includes(k);

/** Mức tối thiểu (M14): 15/30/45 phút 5 slide, 3 loại; 90 phút 10 slide, 4 loại. Bảng trắng tối đa 1 (M15). */
export function interactionTarget(minutes: number): { min: number; kinds: number; whiteboardMax: number } {
  return minutes >= 90 ? { min: 10, kinds: 4, whiteboardMax: 1 } : { min: 5, kinds: 3, whiteboardMax: 1 };
}

/**
 * Bài giảng sinh cho BÀI HỌC (docs/tieu-chi/nghe-giang-slide.md, AC3): học viên tự nghe nên chỉ có câu trắc nghiệm tự kiểm tra
 * (có đáp án ngay), không bình chọn, đám mây từ, bảng cộng tác hay bảng trắng. Mức tối thiểu 3 câu, 1 loại.
 */
export const SELF_CHECK_TARGET = { min: 3, kinds: 1, whiteboardMax: 0 } as const;

/** Mọi slide tương tác khác trắc nghiệm đổi thành trắc nghiệm (giữ vị trí và tiêu đề); AI viết lại thành câu có đáp án đúng. */
export function quizOnly<T extends Pick<Outline, "slides">>(outline: T): T {
  return { ...outline, slides: outline.slides.map((s) => (s.kind === "content" || s.kind === "quiz" ? s : { ...s, kind: "quiz" as OutlineKind })) };
}

/** Số slide tương tác đang có, các loại đã dùng và phần còn thiếu. `need` đủ để vừa đủ số vừa đủ loại. */
export function interactionGap(
  outline: Pick<Outline, "slides">,
  minutes: number,
  override?: { min: number; kinds: number },
): { count: number; kinds: string[]; need: number; needKinds: number } {
  const t = override ?? interactionTarget(minutes);
  const inter = outline.slides.filter((s) => s.kind !== "content");
  const kinds = [...new Set(inter.map((s) => s.kind))];
  const needKinds = Math.max(0, t.kinds - kinds.length);
  return { count: inter.length, kinds, need: Math.max(t.min - inter.length, needKinds), needKinds };
}

/** Bảng trắng thứ hai trở đi đổi thành bảng cộng tác (giữ câu đề bài) (M15). */
export function capWhiteboards<T extends Pick<Outline, "slides">>(outline: T): T {
  let seen = 0;
  const slides = outline.slides.map((s) => {
    if (s.kind !== "whiteboard") return s;
    seen += 1;
    return seen > 1 ? { ...s, kind: "collaborate_board" as OutlineKind } : s;
  });
  return { ...outline, slides };
}

/** Có được chèn slide tương tác ngay sau slide thứ `i` không (M16). */
function canInsertAfter(slides: OutlineSlide[], i: number): boolean {
  const s = slides[i];
  const next = slides[i + 1];
  if (!s || !next) return false; // không chèn sau slide cuối
  if (s.kind !== "content" || next.kind !== "content") return false; // không liền slide tương tác khác
  if (s.fixed || next.fixed) return false; // không sát dòng Nguồn tham khảo
  if (s.layout === "cover" || s.layout === "section") return false; // không ngay sau bìa hay slide mở phần
  return true;
}

export interface TopUpRow {
  afterIndex: number;
  kind: string;
  title: string;
}

/**
 * Chèn các slide tương tác AI đề xuất (M17). `afterIndex` tính theo dàn ý gốc; vị trí sai luật thì dời tới chỗ hợp lệ gần
 * nhất, không có chỗ thì bỏ. Loại lạ hay câu hỏi rỗng bị bỏ; bảng trắng chỉ giữ một.
 */
export function insertInteractions(outline: Outline, rows: TopUpRow[]): { outline: Outline; added: number } {
  const slides = [...outline.slides];
  const anchors = outline.slides.map((s) => s.id);
  let added = 0;
  for (const r of rows) {
    const title = typeof r.title === "string" ? r.title.trim() : "";
    if (!isInteractiveKind(r.kind) || !title || !Number.isInteger(r.afterIndex)) continue;
    const anchorId = anchors[Math.min(Math.max(r.afterIndex, 0), anchors.length - 1)];
    const at = slides.findIndex((s) => s.id === anchorId);
    if (at < 0) continue;
    let pos = -1;
    for (let d = 0; d < slides.length && pos < 0; d++) {
      if (canInsertAfter(slides, at + d)) pos = at + d;
      else if (d > 0 && canInsertAfter(slides, at - d)) pos = at - d;
    }
    if (pos < 0) continue;
    slides.splice(pos + 1, 0, { id: newOutlineId(), partId: slides[pos]!.partId, kind: r.kind, layout: null, title: title.slice(0, 200), points: [] });
    added += 1;
  }
  const capped = capWhiteboards({ ...outline, slides });
  return { outline: added ? finalizeParts(capped) : capped, added };
}

/** Dàn ý rút gọn gửi cho AI khi bổ sung tương tác: chỉ số, loại, bố cục, tiêu đề, tên phần. */
export function topUpSummary(outline: Outline): Array<{ index: number; kind: string; layout: string | null; title: string; part: string }> {
  const name = new Map(outline.parts.map((p) => [p.id, p.name]));
  return outline.slides.map((s, index) => ({ index, kind: s.kind, layout: s.layout, title: s.title, part: (s.partId && name.get(s.partId)) || "" }));
}
