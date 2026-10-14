/**
 * LANG K2 — mốc thời gian của từng lượt hội thoại trong AUDIO CẢ ĐOẠN. Toàn hàm thuần.
 *
 * `startSec` = giây mà lượt bắt đầu; thiếu = lượt chưa có mốc. Các mốc phải tăng dần theo thứ tự lượt
 * (lượt không mốc ở giữa không cản). Tô sáng chỉ áp cho lượt CÓ mốc.
 */

export interface Marked {
  startSec?: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const isMark = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
const marked = (t: Marked) => isMark(t.startSec);

export const hasMarks = (turns: readonly Marked[]) => turns.some(marked);

/** Lượt đang đọc ở thời điểm `time` (giây): lượt có mốc lớn nhất ≤ time. Trước mốc đầu → null; sau cuối giữ lượt cuối. */
export function activeTurnIndex(turns: readonly Marked[], time: number): number | null {
  if (!Number.isFinite(time) || time < 0) return null;
  let best: { idx: number; sec: number } | null = null;
  turns.forEach((t, i) => {
    if (isMark(t.startSec) && t.startSec <= time && (!best || t.startSec > best.sec)) best = { idx: i, sec: t.startSec };
  });
  return best ? (best as { idx: number }).idx : null;
}

export function nextUnmarkedIndex(turns: readonly Marked[]): number | null {
  const i = turns.findIndex((t) => !marked(t));
  return i < 0 ? null : i;
}

/** Mốc của lượt gần nhất (khác `idx`) về một phía có mốc. */
function neighbour(turns: readonly Marked[], idx: number, dir: -1 | 1): { idx: number; sec: number } | null {
  for (let i = idx + dir; i >= 0 && i < turns.length; i += dir) {
    const sec = turns[i]!.startSec;
    if (isMark(sec)) return { idx: i, sec };
  }
  return null;
}

export type MarkResult<T> = { ok: true; turns: T[]; index: number } | { ok: false; reason: string };

function place<T extends Marked>(turns: readonly T[], idx: number, rawSec: number): MarkResult<T> {
  if (!isMark(rawSec)) return { ok: false, reason: "Mốc thời gian phải là số giây từ 0 trở lên." };
  const sec = round1(rawSec);
  const left = neighbour(turns, idx, -1);
  if (left && sec <= left.sec) {
    return { ok: false, reason: `Mốc phải lớn hơn mốc của lượt ${left.idx + 1} (${formatMark(left.sec)}).` };
  }
  const right = neighbour(turns, idx, 1);
  if (right && sec >= right.sec) {
    return { ok: false, reason: `Mốc phải nhỏ hơn mốc của lượt ${right.idx + 1} (${formatMark(right.sec)}).` };
  }
  return { ok: true, index: idx, turns: turns.map((t, i) => (i === idx ? { ...t, startSec: sec } : t)) };
}

/** Nút "Đánh dấu lượt kế": ghi `time` làm mốc cho lượt chưa có mốc đầu tiên. */
export function markNext<T extends Marked>(turns: readonly T[], time: number): MarkResult<T> {
  const idx = nextUnmarkedIndex(turns);
  if (idx === null) return { ok: false, reason: "Đã đánh dấu hết các lượt." };
  return place(turns, idx, time);
}

/** Sửa tay mốc của một lượt (`null` = xoá mốc). */
export function setMark<T extends Marked>(turns: readonly T[], idx: number, sec: number | null): MarkResult<T> {
  if (sec === null) {
    return { ok: true, index: idx, turns: turns.map((t, i) => (i === idx ? ({ ...t, startSec: undefined } as T) : t)) };
  }
  return place(turns, idx, sec);
}

/** Hoàn tác: bỏ mốc của lượt có mốc ở vị trí SAU CÙNG. */
export function undoLastMark<T extends Marked>(turns: readonly T[]): T[] {
  let last = -1;
  turns.forEach((t, i) => {
    if (marked(t)) last = i;
  });
  return turns.map((t, i) => (i === last ? ({ ...t, startSec: undefined } as T) : t));
}

/** Cùng luật với schema ở máy chủ (K2a.2): các lượt có mốc phải tăng dần. */
export function validateMarks(turns: readonly Marked[]): string[] {
  const errors: string[] = [];
  let prev: { idx: number; sec: number } | null = null;
  turns.forEach((t, i) => {
    if (!isMark(t.startSec)) return;
    if (prev && t.startSec <= prev.sec) {
      errors.push(
        `Lượt ${i + 1} bắt đầu ${t.startSec === prev.sec ? "cùng lúc với" : "trước"} lượt ${prev.idx + 1}: mốc thời gian phải tăng dần theo thứ tự lượt.`,
      );
    }
    prev = { idx: i, sec: t.startSec };
  });
  return errors;
}

/** 65.34 → "1:05,3". */
export function formatMark(sec: number): string {
  const v = Math.max(0, round1(sec));
  const whole = Math.floor(v);
  const d = Math.round((v - whole) * 10);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")},${d}`;
}

/** "1:05,3" · "65.3" · "65,3" → giây; rỗng/lạ/âm → null. */
export function parseMark(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const m = /^(\d+):(\d{1,2})(?:\.(\d+))?$/.exec(t);
  if (m) {
    const sec = Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0);
    return round1(sec);
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return round1(Number(t));
}

export type TurnClickAction = "seek_whole" | "sequence_jump" | "play_own" | "none";

/**
 * Bấm vào khung một lượt (K2b.2):
 *  - đang nghe audio cả đoạn và lượt có mốc → tua tới mốc (kể cả khi lượt có audio riêng);
 *  - đang chạy chuỗi "Nghe cả đoạn" của K1 → nhảy tới lượt đó trong chuỗi;
 *  - rảnh và lượt có audio riêng → nghe riêng (K1.4);
 *  - lượt chỉ có mốc (không audio riêng) và có audio cả đoạn → tua và phát;
 *  - còn lại không bấm được.
 */
export function turnClickAction(o: {
  hasOwnAudio: boolean;
  hasMark: boolean;
  hasWholeAudio: boolean;
  wholePlaying: boolean;
  sequenceOn: boolean;
}): TurnClickAction {
  const canSeek = o.hasWholeAudio && o.hasMark;
  if (canSeek && o.wholePlaying) return "seek_whole";
  if (o.sequenceOn && o.hasOwnAudio) return "sequence_jump";
  if (o.hasOwnAudio) return "play_own";
  if (canSeek) return "seek_whole";
  return "none";
}
