import { tFor } from "@/lib/i18n/tFor";
import type { UiLang } from "@/lib/i18n/core";
import { isDeckLecture, parseDeckAnchor } from "./deckSync";
import { segmentIndexAt, type KeyValueStore } from "./learner";

/**
 * Phần thuần của màn hình bìa bài slide tương tác (docs/tieu-chi/bai-slide-man-hinh-bia.md): khi nào hiện bìa, chữ trên nút,
 * và đã nghe được bao nhiêu lời giảng. Tách khỏi component để kiểm thử không cần trình duyệt.
 */

const DECK_URL = /^\/decks\/([a-z0-9-]{1,60})$/;

/** Mã bộ slide của một địa chỉ nhúng; không phải khung slide thì null. */
export function deckIdOfUrl(url: unknown): string | null {
  return typeof url === "string" ? DECK_URL.exec(url)?.[1] ?? null : null;
}

interface ItemLike {
  type: string;
  payload: unknown;
}

const deckIdOfItem = (item: ItemLike): string | null => (item.type === "embed" ? deckIdOfUrl((item.payload as { url?: unknown } | null)?.url) : null);

/**
 * Bài này dùng màn hình bìa? Cần đủ: có khung slide, lời giảng bám theo slide, và khoá có giảng viên ảo.
 * Thiếu một điều thì khung slide trong trang vẫn là cách học duy nhất, phải giữ nguyên.
 * Trả về mã bộ slide để trang đếm số slide.
 */
export function deckCoverId(items: readonly ItemLike[], anchors: readonly string[] | null, hasLecturer: boolean): string | null {
  if (!hasLecturer || !anchors || !isDeckLecture(anchors)) return null;
  for (const item of items) {
    const id = deckIdOfItem(item);
    if (id) return id;
  }
  return null;
}

/** Bỏ phần đứng trước khung slide: đó là lời giới thiệu mà màn hình bìa đã thay chỗ. Phần sau khung và ghi chú giảng viên giữ nguyên. */
export function withoutDeckIntro<T extends ItemLike>(items: readonly T[]): T[] {
  const at = items.findIndex((item) => deckIdOfItem(item) !== null);
  return at < 0 ? [...items] : items.filter((item, i) => i >= at || item.type === "teacher_note");
}

/** Slide (đếm từ 1) ứng với vị trí đang nghe dở; không xác định được thì null. */
export function resumeSlideNumber(segments: ReadonlyArray<{ anchor: string; startSec: number; endSec: number }>, resumeSec: number | null): number | null {
  if (resumeSec === null) return null;
  const seg = segments[segmentIndexAt(segments, resumeSec)];
  const pos = seg ? parseDeckAnchor(seg.anchor) : null;
  return pos ? pos.slide + 1 : null;
}

export function deckCoverLabel(
  opts: { resumeSlide: number | null; completed: boolean; heard: number; thresholdPct: number },
  lang: UiLang = "vi",
): string {
  const t = tFor(lang);
  if (opts.resumeSlide !== null) return t("reader.nar.cover.resume", { n: opts.resumeSlide });
  if (opts.completed || heardEnough(opts.heard, opts.thresholdPct)) return t("reader.nar.cover.again");
  return t("reader.nar.cover.start");
}

// ── Phần lời giảng đã nghe ───────────────────────────────────────────────────

/** Các khoảng [từ giây, tới giây] đã nghe thật, tăng dần và không chồng nhau. Tính theo giờ của tệp giọng nên tốc độ nghe không ảnh hưởng. */
export type HeardRanges = Array<[number, number]>;

/** Hai nhịp cập nhật liên tiếp cách nhau hơn mức này thì coi là nhảy chỗ, không phải đang nghe. Tab nền cập nhật khoảng 1 giây một lần, nhân tốc độ tối đa 1,5×. */
const MAX_TICK_SEC = 2;

export function addHeard(ranges: HeardRanges, from: number, to: number): HeardRanges {
  if (!(to > from)) return ranges;
  const out: HeardRanges = [];
  let start = from;
  let end = to;
  let placed = false;
  for (const r of ranges) {
    if (r[1] < start) out.push(r);
    else if (r[0] > end) {
      if (!placed) {
        out.push([start, end]);
        placed = true;
      }
      out.push(r);
    } else {
      start = Math.min(start, r[0]);
      end = Math.max(end, r[1]);
    }
  }
  if (!placed) out.push([start, end]);
  return out;
}

/** Một nhịp phát: chỉ cộng khi giọng chạy tới một đoạn ngắn. Tua hay lật slide tạo bước nhảy lớn nên không được cộng. */
export function stepHeard(ranges: HeardRanges, prev: number | null, now: number): HeardRanges {
  if (prev === null || now <= prev || now - prev > MAX_TICK_SEC) return ranges;
  return addHeard(ranges, prev, now);
}

/** Phần đã nghe, từ 0 tới 1. */
export function heardFraction(ranges: HeardRanges, durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  const total = ranges.reduce((sum, r) => sum + (r[1] - r[0]), 0);
  return Math.min(1, total / durationSec);
}

/** Phần trăm hiển thị và phần trăm để xét đủ phải là một số: tránh cảnh hiện 80% mà chưa được tính. */
export const heardPercent = (heard: number): number => Math.floor(heard * 100);
export const heardEnough = (heard: number, thresholdPct: number): boolean => heardPercent(heard) >= thresholdPct;

export const heardKey = (lessonId: string): string => `limio:narration:${lessonId}:lecture:heard`;

/** Đọc phần đã nghe. Giọng được tạo lại (đổi `version`) thì phần cũ không còn đúng mốc, tính lại từ đầu. */
export function readHeard(store: KeyValueStore | null, lessonId: string, version: number): HeardRanges {
  try {
    const raw = store?.getItem(heardKey(lessonId));
    if (!raw) return [];
    const data = JSON.parse(raw) as { v?: unknown; r?: unknown };
    if (data.v !== version || !Array.isArray(data.r)) return [];
    let out: HeardRanges = [];
    for (const r of data.r) {
      if (Array.isArray(r) && typeof r[0] === "number" && typeof r[1] === "number") out = addHeard(out, r[0], r[1]);
    }
    return out;
  } catch {
    return [];
  }
}

export function writeHeard(store: KeyValueStore | null, lessonId: string, version: number, ranges: HeardRanges): void {
  try {
    store?.setItem(heardKey(lessonId), JSON.stringify({ v: version, r: ranges.map((r) => [Math.round(r[0] * 10) / 10, Math.round(r[1] * 10) / 10]) }));
  } catch {
    /* bỏ qua */
  }
}
