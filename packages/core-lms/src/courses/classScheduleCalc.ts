/**
 * Tính ngày giờ cho lịch lớp (CENTER C1) — hàm thuần, không đụng DB.
 *
 * Mọi giờ theo múi giờ Việt Nam (UTC+7, không có giờ mùa hè). Ngày được xử lý dưới dạng chuỗi
 * "YYYY-MM-DD" chứ không qua Date cục bộ, để buổi 06:00 sáng hay 23:30 tối rơi đúng ngày dù máy
 * chủ chạy ở múi giờ nào.
 */

const VN_OFFSET = "+07:00";
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Trần số ngày dò khi sinh buổi, để dữ liệu xấu không làm vòng lặp chạy mãi. */
const MAX_SCAN_DAYS = 800;

export interface SlotInput {
  /** ISO: 1 = thứ hai … 7 = chủ nhật. */
  weekday: number;
  /** "HH:mm" giờ Việt Nam. */
  startTime: string;
  durationMin: number;
  room?: string | null;
  plannedTeacherId?: string | null;
}

export interface PlannedMeeting {
  startsAt: Date;
  endsAt: Date;
  room: string | null;
  plannedTeacherId: string | null;
}

/** Thứ trong tuần của một ngày lịch: 1 = thứ hai … 7 = chủ nhật. */
export function isoWeekday(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00Z`).getUTCDay() || 7;
}

export function addDays(dayKey: string, n: number): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Ngày "YYYY-MM-DD" + giờ "HH:mm" giờ Việt Nam → thời điểm tuyệt đối. */
export function vnDateTime(dayKey: string, hhmm: string): Date {
  return new Date(`${dayKey}T${hhmm}:00${VN_OFFSET}`);
}

/** Ngày lịch Việt Nam của một thời điểm. */
export function vnDayKey(d: Date): string {
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export function overlaps(
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

export interface GenerateInput {
  /** Ngày sớm nhất của kế hoạch. */
  startDay: string;
  /** Không sinh buổi trước ngày này (dùng khi áp lại kế hoạch giữa chừng). */
  notBefore?: string;
  /** Số buổi cần sinh thêm. */
  need: number;
  slots: readonly SlotInput[];
  /** Thời điểm (ms) đã có buổi chiếm chỗ — bỏ qua, sinh bù ở cuối. */
  occupied?: ReadonlySet<number>;
}

/** Sinh `need` buổi tiếp theo theo các khung hằng tuần, sắp theo thời gian. */
export function generateMeetings(input: GenerateInput): PlannedMeeting[] {
  const { slots, need } = input;
  if (need <= 0 || slots.length === 0) return [];
  const begin = input.notBefore && input.notBefore > input.startDay ? input.notBefore : input.startDay;
  const occupied = input.occupied ?? new Set<number>();
  const byWeekday = new Map<number, SlotInput[]>();
  for (const s of slots) {
    const list = byWeekday.get(s.weekday) ?? [];
    list.push(s);
    byWeekday.set(s.weekday, list);
  }
  for (const list of byWeekday.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const out: PlannedMeeting[] = [];
  for (let i = 0; i < MAX_SCAN_DAYS && out.length < need; i++) {
    const day = addDays(begin, i);
    const daySlots = byWeekday.get(isoWeekday(day));
    if (!daySlots) continue;
    for (const s of daySlots) {
      const startsAt = vnDateTime(day, s.startTime);
      if (occupied.has(startsAt.getTime())) continue;
      out.push({
        startsAt,
        endsAt: new Date(startsAt.getTime() + s.durationMin * 60_000),
        room: s.room ?? null,
        plannedTeacherId: s.plannedTeacherId ?? null,
      });
      if (out.length >= need) break;
    }
  }
  return out;
}
