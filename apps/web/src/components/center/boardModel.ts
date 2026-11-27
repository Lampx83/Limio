/**
 * Mô hình hiển thị của Bảng điều phối (CENTER M): trục thời gian chia thành các đoạn, gom hàng, nhãn. Thuần (không React, không core-lms),
 * có test ở boardModel.test.ts. Nghiệp vụ (trạng thái, cờ) đã tính sẵn ở máy chủ (core-lms/centerBoardCalc).
 */
import { assignLanes } from "@/lib/boardLayout";

export type BoardMode = "ngay" | "tuan" | "ky";
export type BoardGroup = "trinh-do" | "phong" | "giao-vien" | "lop";

const VN_OFFSET_MS = 7 * 3600_000;
const DAY_MS = 86_400_000;

/** 00:00 giờ Việt Nam của ngày YYYY-MM-DD. */
export function vnMidnight(day: string): Date {
  return new Date(`${day}T00:00:00+07:00`);
}

/** Số phút trong ngày (giờ VN) của một thời điểm. */
export function vnMinuteOfDay(t: Date): number {
  return Math.floor((((t.getTime() + VN_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS / 60_000);
}

/** Ngày YYYY-MM-DD (giờ VN) của một thời điểm. */
export function vnDayKey(t: Date): string {
  return new Date(t.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

const WEEKDAY_NAMES = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

/** Tên thứ của một ngày YYYY-MM-DD. Bảng cố định, KHÔNG dùng Intl: ICU của máy chủ và trình duyệt viết khác nhau ("Th 6" / "Thứ 6") làm vỡ hydration. */
export function weekdayName(day: string): string {
  return WEEKDAY_NAMES[new Date(`${day}T00:00:00Z`).getUTCDay()]!;
}

export interface AxisSegment {
  from: Date;
  to: Date;
  label: string;
  dayKey: string;
}

export interface Axis {
  segments: AxisSegment[];
}

/** Khoảng giờ hiển thị trong ngày (M1.1): 06:00–22:00, mở rộng khi có buổi nằm ngoài. */
export function dayHourSpan(items: ReadonlyArray<{ startsAt: Date; endsAt: Date }>): { startHour: number; endHour: number } {
  let startHour = 6;
  let endHour = 22;
  for (const m of items) {
    startHour = Math.min(startHour, Math.floor(vnMinuteOfDay(m.startsAt) / 60));
    const endMin = vnDayKey(m.endsAt) === vnDayKey(m.startsAt) ? vnMinuteOfDay(m.endsAt) : 24 * 60;
    endHour = Math.max(endHour, Math.ceil(endMin / 60));
  }
  return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
}

export function dayAxis(dayKeys: string[], startHour: number, endHour: number, labelOf: (day: string) => string): Axis {
  return {
    segments: dayKeys.map((d) => ({
      dayKey: d,
      label: labelOf(d),
      from: new Date(vnMidnight(d).getTime() + startHour * 3600_000),
      to: new Date(vnMidnight(d).getTime() + endHour * 3600_000),
    })),
  };
}

export function rangeAxis(fromDay: string, toDay: string): Axis {
  const from = vnMidnight(fromDay);
  const to = new Date(vnMidnight(toDay).getTime() + DAY_MS);
  return { segments: [{ from, to, label: "", dayKey: fromDay }] };
}

/** Vị trí (phần trăm theo chiều ngang toàn trục) của một thời điểm; null nếu thời điểm nằm ngoài mọi đoạn. */
export function axisX(axis: Axis, t: Date): number | null {
  const n = axis.segments.length;
  for (let i = 0; i < n; i++) {
    const s = axis.segments[i]!;
    if (t.getTime() >= s.from.getTime() && t.getTime() <= s.to.getTime()) {
      return ((i + (t.getTime() - s.from.getTime()) / (s.to.getTime() - s.from.getTime())) / n) * 100;
    }
  }
  return null;
}

/** Khối [startsAt, endsAt] trên trục: left/width theo phần trăm; null nếu không giao với đoạn nào. Mức Tuần: khối nằm trong đoạn ngày của giờ bắt đầu. */
export function blockSpan(axis: Axis, startsAt: Date, endsAt: Date): { left: number; width: number } | null {
  const n = axis.segments.length;
  let idx = axis.segments.findIndex((s) => s.dayKey === vnDayKey(startsAt) && n > 1);
  if (idx === -1) idx = axis.segments.findIndex((s) => startsAt.getTime() < s.to.getTime() && endsAt.getTime() > s.from.getTime());
  if (idx === -1) return null;
  const s = axis.segments[idx]!;
  const len = s.to.getTime() - s.from.getTime();
  const a = Math.max(startsAt.getTime(), s.from.getTime());
  const b = Math.min(endsAt.getTime(), s.to.getTime());
  if (b <= a) return null;
  return { left: ((idx + (a - s.from.getTime()) / len) / n) * 100, width: Math.max(((b - a) / len / n) * 100, 0.6) };
}

export interface RowItem {
  id: string;
  startsAt: Date;
  endsAt: Date;
}

export interface BoardRow<T extends RowItem> {
  key: string;
  label: string;
  /** Hàng đặc biệt (chưa xếp phòng, chưa có giáo viên): nền cảnh báo, luôn ở đầu. */
  pinned: boolean;
  /** Hàng "không rõ" (vd chưa rõ trình độ): luôn ở cuối. */
  last: boolean;
  items: Array<T & { lane: number }>;
  laneCount: number;
}

export interface GroupKey {
  key: string;
  label: string;
  pinned: boolean;
  /** Đặt hàng này ở cuối bảng. */
  last?: boolean;
}

/** Gom các khối vào hàng theo `keyOf` rồi xếp làn trong từng hàng (M1.4, M1.5). Hàng ghim lên đầu, còn lại theo nhãn tiếng Việt. */
export function buildRows<T extends RowItem>(items: readonly T[], keyOf: (item: T) => GroupKey): Array<BoardRow<T>> {
  const map = new Map<string, { g: GroupKey; items: T[] }>();
  for (const it of items) {
    const g = keyOf(it);
    const cur = map.get(g.key);
    if (cur) cur.items.push(it);
    else map.set(g.key, { g, items: [it] });
  }
  const rows = [...map.values()].map(({ g, items: its }) => {
    const { lanes, laneCount } = assignLanes(its);
    return { key: g.key, label: g.label, pinned: g.pinned, last: !!g.last, items: its.map((it, i) => ({ ...it, lane: lanes[i]! })), laneCount };
  });
  // So sánh có số ("HSK 2" trước "HSK 10"); hàng ghim lên đầu, hàng "không rõ" xuống cuối.
  return rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(a.last) - Number(b.last) || a.label.localeCompare(b.label, "vi", { numeric: true }));
}

/** Nhãn cờ cần chú ý (đồng bộ với BoardFlag của core-lms). */
export const FLAG_LABEL: Record<string, string> = {
  no_teacher: "Chưa có giáo viên",
  no_checkin: "Giáo viên chưa bắt đầu buổi",
  late: "Giáo viên vào trễ",
  substitute: "Dạy thay",
  no_attendance: "Chưa điểm danh",
  room_clash: "Trùng phòng",
  teacher_clash: "Trùng giáo viên",
};

export const STATE_LABEL: Record<string, string> = {
  cancelled: "Đã huỷ",
  held: "Đã dạy",
  live: "Đang diễn ra",
  overdue: "Quá giờ, chưa kết thúc buổi",
  upcoming: "Sắp tới",
};

/**
 * Số lớp chạy SONG SONG theo từng ô 30 phút của một đoạn trục (cao điểm buổi tối có thể hàng chục lớp cùng giờ). Một buổi tính vào mọi ô mà nó giao
 * với (ô nửa mở). Trả về mảng đếm theo ô và ô cao nhất.
 */
export function concurrencyBuckets(
  items: ReadonlyArray<{ startsAt: Date; endsAt: Date }>,
  segment: { from: Date; to: Date },
  bucketMs = 30 * 60_000,
): { counts: number[]; peak: number; peakIndex: number } {
  const n = Math.max(0, Math.round((segment.to.getTime() - segment.from.getTime()) / bucketMs));
  const counts = new Array<number>(n).fill(0);
  for (const it of items) {
    const a = Math.max(it.startsAt.getTime(), segment.from.getTime());
    const b = Math.min(it.endsAt.getTime(), segment.to.getTime());
    if (b <= a) continue;
    const first = Math.floor((a - segment.from.getTime()) / bucketMs);
    const last = Math.ceil((b - segment.from.getTime()) / bucketMs) - 1;
    for (let i = first; i <= last && i < n; i++) counts[i]!++;
  }
  let peak = 0;
  let peakIndex = -1;
  counts.forEach((c, i) => {
    if (c > peak) {
      peak = c;
      peakIndex = i;
    }
  });
  return { counts, peak, peakIndex };
}
