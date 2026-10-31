import { formatClock } from "@/lib/audioClock";

/**
 * Phần thuần của giao diện Nghe giảng / Podcast phía học viên (docs/tieu-chi/nghe-giang-podcast.md, AC3–AC4):
 * chọn đoạn theo thời điểm đang phát, nhảy mục trước/sau, ánh xạ `anchor` của lời giảng với tiêu đề mục của bài,
 * nhớ vị trí nghe dở. Tách khỏi component để kiểm thử không cần trình duyệt.
 */

export type NarrationKind = "lecture" | "podcast";

export const NARRATION_SPEEDS = [0.75, 1, 1.25, 1.5] as const;
export type NarrationSpeed = (typeof NARRATION_SPEEDS)[number];

/** 0.75 → "0,75×", 1 → "1×". Tiếng Việt dùng dấu phẩy thập phân. */
export const speedLabel = (s: number): string => `${String(s).replace(".", ",")}×`;

export const isNarrationSpeed = (n: unknown): n is NarrationSpeed =>
  typeof n === "number" && (NARRATION_SPEEDS as readonly number[]).includes(n);

/** 314 s → "5 phút". Bài rất ngắn vẫn là "1 phút", không bao giờ "0 phút". */
export const minutesLabel = (durationSec: number): string =>
  `${Math.max(1, Math.round((Number.isFinite(durationSec) ? durationSec : 0) / 60))} phút`;

export { formatClock };

/** "6:12 trên 8:30" — giá trị đọc được của thanh tua cho trình đọc màn hình. */
export const clockText = (current: number, total: number): string => `${formatClock(current)} trên ${formatClock(total)}`;

// ── Chọn đoạn theo thời điểm ──────────────────────────────────────────────────

export interface TimedItem {
  startSec: number;
  endSec: number;
}

/**
 * Sai số khi so mốc. Tua tới `startSec` rồi đọc lại `currentTime` có thể lệch vài mili giây về phía trước đoạn,
 * và đoạn đầu tiên sẽ bị coi là chưa bắt đầu; dung sai này giữ cho "tua tới đầu mục" luôn rơi đúng mục đó.
 */
export const SEGMENT_EPS = 0.05;

/**
 * Chỉ số đoạn đang phát tại thời điểm `t`: đoạn cuối cùng đã bắt đầu. Trong khoảng lặng giữa hai đoạn vẫn thuộc
 * đoạn trước (giữ nguyên tô sáng, không nhấp nháy); trước đoạn đầu tiên trả -1.
 */
export function segmentIndexAt(items: readonly TimedItem[], t: number): number {
  let found = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i]!.startSec <= t + SEGMENT_EPS) found = i;
    else break;
  }
  return found;
}

/** Quá chừng này giây vào mục thì "Mục trước" chỉ quay về đầu mục đang nghe, giống nút bài trước của trình nghe nhạc. */
export const RESTART_WITHIN_SEC = 3;

export function previousStart(items: readonly TimedItem[], t: number): number {
  const i = segmentIndexAt(items, t);
  if (i < 0) return 0;
  if (t - items[i]!.startSec > RESTART_WITHIN_SEC) return items[i]!.startSec;
  return i > 0 ? items[i - 1]!.startSec : 0;
}

/** Đầu đoạn kế tiếp, hoặc null khi đang ở đoạn cuối. */
export function nextStart(items: readonly TimedItem[], t: number): number | null {
  return items[segmentIndexAt(items, t) + 1]?.startSec ?? null;
}

// ── Theo dõi trong một mục ────────────────────────────────────────────────────

/**
 * Khối con nào của mục đang được giảng, khi đã đi được `fraction` (0–1) thời lượng của mục. Chia theo độ dài chữ
 * của từng khối: lời giảng không trùng từng chữ với bài viết nên đây chỉ là ước lượng, nhưng đủ để tô sáng và trang
 * cuộn theo thay vì đứng ở đầu một mục dài. Không có khối nào thì trả -1.
 */
export function weightedIndexAt(weights: readonly number[], fraction: number): number {
  if (weights.length === 0) return -1;
  const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 1));
  const total = w.reduce((a, b) => a + b, 0);
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0)) * total;
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i]!;
    if (f < acc) return i;
  }
  return w.length - 1;
}

/** Phần thời lượng đã đi của một đoạn tại thời điểm `t`, kẹp 0–1 (trong khoảng lặng cuối đoạn vẫn là 1). */
export function fractionWithin(item: TimedItem, t: number): number {
  const span = item.endSec - item.startSec;
  if (!(span > 0)) return 0;
  return Math.min(1, Math.max(0, (t - item.startSec) / span));
}

// ── Ánh xạ anchor ↔ tiêu đề mục ───────────────────────────────────────────────

/** Hai neo đặc biệt của lời giảng; khớp `LECTURE_INTRO_ANCHOR` / `LECTURE_OUTRO_ANCHOR` ở core-lms. */
export const ANCHOR_INTRO = "mo-dau";
export const ANCHOR_OUTRO = "tong-ket";

export type AnchorTarget =
  | { type: "intro" }
  | { type: "outro" }
  | { type: "heading"; index: number; /** Bước thứ n (từ 1) của lời giải từng bước trong mục; không có = cả mục. */ step?: number }
  | { type: "none" };

/** Bỏ dấu câu, dấu nháy, khoảng trắng thừa và hoa/thường — chữ trong `anchor` và trong HTML đã đi qua hai bộ chuẩn hoá khác nhau. */
export const normalizeHeading = (s: string): string =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Tìm mục của bài cho từng đoạn lời giảng. `headings[i]` là các cách đọc chữ của tiêu đề thứ i (chữ đầy đủ, và chữ
 * bỏ số thứ tự trong huy hiệu) — khớp một trong số đó là đủ. Anchor không khớp mục nào (vd bài đã sửa tiêu đề) cho
 * `none`: lúc nghe không tô sáng gì, thay vì tô sai chỗ.
 */
export function resolveAnchors(anchors: readonly string[], headings: readonly (readonly string[])[]): AnchorTarget[] {
  const normalized = headings.map((cands) => new Set(cands.map(normalizeHeading).filter(Boolean)));
  return anchors.map((anchor): AnchorTarget => {
    if (anchor === ANCHOR_INTRO) return { type: "intro" };
    if (anchor === ANCHOR_OUTRO) return { type: "outro" };
    // "Tiêu đề mục #2": đoạn giảng riêng cho bước 2 của mục đó (lời giải hiện từng bước).
    const stepMatch = /^(.*?)\s*#(\d{1,2})$/.exec(anchor.trim());
    const want = normalizeHeading(stepMatch ? stepMatch[1]! : anchor);
    if (!want) return { type: "none" };
    const index = normalized.findIndex((set) => set.has(want));
    if (index < 0) return { type: "none" };
    const step = stepMatch ? Number(stepMatch[2]) : 0;
    return step >= 1 ? { type: "heading", index, step } : { type: "heading", index };
  });
}

/** Chữ hiển thị trên thanh phát cho một anchor. */
export function anchorLabel(anchor: string): string {
  if (anchor === ANCHOR_INTRO) return "Mở đầu";
  if (anchor === ANCHOR_OUTRO) return "Tổng kết";
  const m = /^(.*?)\s*#(\d{1,2})$/.exec(anchor.trim());
  return m ? `${m[1]} · bước ${m[2]}` : anchor;
}

// ── Nhớ vị trí nghe dở ───────────────────────────────────────────────────────

/** Dưới ngưỡng này thì không đáng đề nghị nghe tiếp. */
export const RESUME_MIN_SEC = 10;
/** Còn chưa tới chừng này giây là hết thì coi như đã nghe xong. */
export const RESUME_TAIL_SEC = 10;

export const resumeKey = (lessonId: string, kind: NarrationKind): string => `limio:narration:${lessonId}:${kind}`;
export const SPEED_KEY = "limio:narration:speed";

export const serializeResume = (version: number, sec: number): string => JSON.stringify({ v: version, t: Math.floor(sec) });

/**
 * Vị trí nghe dở hợp lệ, hoặc null. Phiên bản giọng đổi (quản trị tạo lại) thì vị trí cũ không còn khớp với tệp mới
 * nên bỏ; gần đầu hay gần cuối tệp cũng không đáng đề nghị.
 */
export function parseResume(raw: string | null | undefined, version: number, durationSec: number): number | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { v?: unknown; t?: unknown };
    if (v.v !== version || typeof v.t !== "number" || !Number.isFinite(v.t)) return null;
    if (v.t < RESUME_MIN_SEC || v.t > durationSec - RESUME_TAIL_SEC) return null;
    return Math.floor(v.t);
  } catch {
    return null;
  }
}

/** Kho lưu trữ tối thiểu — `localStorage` hoặc bản giả khi kiểm thử. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** `localStorage` có thể ném lỗi (cửa sổ riêng tư, bị chặn): mọi thao tác nuốt lỗi, giao diện vẫn chạy không cần nó. */
export function safeStorage(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readResume(store: KeyValueStore | null, lessonId: string, kind: NarrationKind, version: number, durationSec: number): number | null {
  try {
    return parseResume(store?.getItem(resumeKey(lessonId, kind)), version, durationSec);
  } catch {
    return null;
  }
}

export function writeResume(store: KeyValueStore | null, lessonId: string, kind: NarrationKind, version: number, sec: number): void {
  try {
    store?.setItem(resumeKey(lessonId, kind), serializeResume(version, sec));
  } catch {
    /* bỏ qua */
  }
}

export function clearResume(store: KeyValueStore | null, lessonId: string, kind: NarrationKind): void {
  try {
    store?.removeItem(resumeKey(lessonId, kind));
  } catch {
    /* bỏ qua */
  }
}

/** Phần trăm đã nghe tới, kẹp 0–100, làm tròn. */
export function listenedPercent(maxPositionSec: number, durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((maxPositionSec / durationSec) * 100)));
}
