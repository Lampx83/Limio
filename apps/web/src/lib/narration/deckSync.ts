/**
 * Nối Nghe giảng với khung slide tương tác (`/decks/<id>`, xem docs/tieu-chi/trinh-chieu-giang-vien.md).
 * Khung là một iframe riêng; hai bên nói chuyện bằng postMessage theo giao thức của khung (khungSlideHtml.js).
 * Chỉ có hàm thuần để kiểm được không cần trình duyệt.
 */

/** Anchor lời giảng của bài deck: `s<slide>b<bước>`, cả hai đánh số từ 0. */
const DECK_ANCHOR = /^s(\d{1,3})b(\d{1,2})$/;

export const deckAnchor = (slide: number, step: number): string => `s${slide}b${step}`;

export function parseDeckAnchor(anchor: string): { slide: number; step: number } | null {
  const m = DECK_ANCHOR.exec(anchor.trim());
  return m ? { slide: Number(m[1]), step: Number(m[2]) } : null;
}

/** Đoạn giảng của (slide, bước); không có đúng bước đó thì lấy bước gần nhất không vượt quá trong cùng slide. */
export function segmentForDeckPos(anchors: readonly string[], slide: number, step: number): number {
  let best = -1;
  let bestStep = -1;
  anchors.forEach((a, i) => {
    const p = parseDeckAnchor(a);
    if (p && p.slide === slide && p.step <= step && p.step > bestStep) {
      best = i;
      bestStep = p.step;
    }
  });
  return best;
}

/** Đoạn giảng đầu tiên của một slide; -1 nếu slide không có lời giảng. */
export function firstSegmentOfDeckSlide(anchors: readonly string[], slide: number): number {
  return segmentForDeckPos(anchors, slide, 0) >= 0 ? segmentForDeckPos(anchors, slide, 0) : anchors.findIndex((a) => parseDeckAnchor(a)?.slide === slide);
}

/** Bài này là bài deck? (mọi anchor đều dạng `s<i>b<b>`) — dùng để biết nên điều khiển khung hay dò mục trong trang. */
export function isDeckLecture(anchors: readonly string[]): boolean {
  return anchors.length > 0 && anchors.every((a) => parseDeckAnchor(a) !== null);
}

/** Lệnh gửi xuống khung: tới slide `i`, bước `b`. */
export const toDeck = (i: number, b: number) => ({ smartdocDieuKhien: true, lenh: "toi", i, b });
export const deckCmd = (lenh: "tien" | "lui") => ({ smartdocDieuKhien: true, lenh });

export type DeckEvent = { loai: "san-sang" | "trang" | "buoc" | "diem" | "nut" | "toan-man" | "thoat"; i?: number; n?: number; b?: number; nb?: number };

/** Tin từ khung gửi lên, nếu đúng giao thức; khác thì null (tin của trang khác không được tin). */
export function parseDeckMessage(data: unknown): DeckEvent | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.smartdocSlide !== true || typeof d.loai !== "string") return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  return { loai: d.loai as DeckEvent["loai"], i: num(d.i), n: num(d.n), b: num(d.b), nb: num(d.nb) };
}
