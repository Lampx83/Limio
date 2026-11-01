import { fractionWithin, weightedIndexAt } from "./learner";

/**
 * Chế độ trình chiếu của Nghe giảng (docs/tieu-chi/trinh-chieu-giang-vien.md): chia nội dung bài đã dựng thành các slide
 * và chọn phụ đề theo giọng. Chỉ có hàm thuần trên DOM / chữ — chưa gắn vào React để dễ kiểm.
 */

const SUMMARY = 'section[aria-label="Tổng kết bài học"]';
const SECTION = ".lesson-section";

/** Phần tử cấp cao nhất của bài: mỗi khối nội dung, và hộp tổng kết nếu nó đứng ngoài mọi khối. */
function topLevel(root: HTMLElement): HTMLElement[] {
  const sel = `[data-item-id], ${SUMMARY}`;
  return [...root.querySelectorAll<HTMLElement>(sel)].filter((e) => !e.parentElement?.closest(sel));
}

/**
 * Chia bài thành các slide; mỗi slide là danh sách phần tử DOM đi cùng nhau:
 * - khối nhiều mục (`.lesson-section`) → mỗi mục một slide;
 * - khối có tiêu đề → một slide (bài viết liền một khối nhiều h2 vẫn là một slide: không xẻ DOM của React);
 * - khối không có tiêu đề (đồ thị nhúng, thẻ ghi nhớ) → đi theo slide đứng trước; chưa có slide nào thì là bìa;
 * - hộp tổng kết → slide riêng.
 */
export function buildSlideUnits(root: HTMLElement): HTMLElement[][] {
  const units: HTMLElement[][] = [];
  for (const c of topLevel(root)) {
    if (c.matches(SUMMARY) || c.querySelector(SUMMARY)) {
      units.push([c]);
      continue;
    }
    const sections = [...c.querySelectorAll<HTMLElement>(SECTION)].filter((s) => !s.parentElement?.closest(SECTION));
    if (sections.length > 0) {
      for (const s of sections) units.push([s]);
    } else if (c.querySelector("h2")) {
      units.push([c]);
    } else if (units.length > 0) {
      units[units.length - 1]!.push(c);
    } else {
      units.push([c]);
    }
  }
  return units;
}

/** Slide chứa phần tử `el` (hoặc chính nó); -1 nếu không thuộc slide nào. */
export function unitIndexOf(units: readonly (readonly HTMLElement[])[], el: Element | null): number {
  if (!el) return -1;
  return units.findIndex((u) => u.some((e) => e === el || e.contains(el)));
}

/**
 * Đoạn giảng đầu tiên của từng slide, để bấm «Sau» thì giọng nhảy đúng chỗ. `segmentUnit[i]` = slide của đoạn i (-1 = chưa rõ).
 * Slide không có đoạn giảng nào dùng lại đoạn của slide trước nó.
 */
export function firstSegmentPerUnit(segmentUnit: readonly number[], unitCount: number): number[] {
  const out: number[] = [];
  for (let u = 0; u < unitCount; u++) {
    const i = segmentUnit.indexOf(u);
    out.push(i >= 0 ? i : u > 0 ? out[u - 1]! : 0);
  }
  return out;
}

/**
 * Đánh dấu DOM: mọi phần tử của slide có `data-slide="n"`, riêng slide hiện tại thêm `data-slide-on`. CSS ẩn phần còn lại.
 * Trả true nếu có gì đổi — để bộ theo dõi DOM không lặp vô hạn trên chính thay đổi của mình.
 */
export function markSlides(root: HTMLElement, units: readonly (readonly HTMLElement[])[], current: number): boolean {
  let changed = false;
  const keep = new Set<HTMLElement>();
  units.forEach((u, i) => {
    for (const el of u) {
      keep.add(el);
      if (el.getAttribute("data-slide") !== String(i)) {
        el.setAttribute("data-slide", String(i));
        changed = true;
      }
      const on = i === current;
      if (el.hasAttribute("data-slide-on") !== on) {
        if (on) el.setAttribute("data-slide-on", "");
        else el.removeAttribute("data-slide-on");
        changed = true;
      }
    }
  });
  for (const stale of root.querySelectorAll<HTMLElement>("[data-slide]")) {
    if (keep.has(stale)) continue;
    stale.removeAttribute("data-slide");
    stale.removeAttribute("data-slide-on");
    changed = true;
  }
  return changed;
}

/** Gỡ mọi dấu slide (khi thoát trình chiếu). */
export function clearSlides(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-slide]").forEach((e) => {
    e.removeAttribute("data-slide");
    e.removeAttribute("data-slide-on");
  });
}

// ── Phụ đề ────────────────────────────────────────────────────────────────────

/** Phụ đề dài hơn mức này thì cắt tiếp ở dấu phẩy / khoảng trắng cho vừa màn hình. */
const MAX_SUBTITLE = 140;

function cutWords(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (cur && cur.length + 1 + w.length > MAX_SUBTITLE) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

function wrapLong(sentence: string): string[] {
  if (sentence.length <= MAX_SUBTITLE) return [sentence];
  const out: string[] = [];
  let cur = "";
  for (const piece of sentence.split(/(?<=,)\s+/)) {
    for (const w of piece.length > MAX_SUBTITLE ? cutWords(piece) : [piece]) {
      if (cur && cur.length + 1 + w.length > MAX_SUBTITLE) {
        out.push(cur);
        cur = w;
      } else cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Tách lời giảng thành các phụ đề: theo câu (. ! ? …), câu quá dài cắt thêm. Dấu chấm trong số thập phân không tách. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap(wrapLong);
}

/**
 * Phụ đề tại thời điểm `t` của một đoạn giảng. Thời gian chia theo số ký tự mỗi câu: ước lượng, không khớp từng chữ
 * (giọng đọc không trả mốc thời gian từng câu).
 */
export function subtitleAt(text: string | undefined, seg: { startSec: number; endSec: number }, t: number): string {
  const sentences = splitSentences(text ?? "");
  if (sentences.length === 0) return "";
  const i = weightedIndexAt(
    sentences.map((s) => s.length),
    fractionWithin(seg, t),
  );
  return sentences[Math.max(0, i)] ?? "";
}
