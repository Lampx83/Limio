/**
 * Tóm tắt lịch một lớp thành MỘT dòng cho thẻ lớp ở tab "Lớp học":
 * "24 buổi, thứ ba và thứ năm 18:30, buổi tới 27/10" hoặc "Chưa có lịch, đặt lịch ngay".
 *
 * Để giảng viên nhìn thẻ là biết lớp đã có lịch chưa mà không phải mở từng lớp. Số buổi không tính buổi đã huỷ;
 * "buổi tới" là buổi chưa huỷ gần nhất kể từ lúc gọi. Thứ trong tuần theo ISO (1 = thứ hai … 7 = chủ nhật).
 */
import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { assertCanGradeCourse } from "./authz";
import { vnDayKey } from "./classScheduleCalc";

const WEEKDAY_NAME: Record<number, string> = {
  1: "thứ hai",
  2: "thứ ba",
  3: "thứ tư",
  4: "thứ năm",
  5: "thứ sáu",
  6: "thứ bảy",
  7: "chủ nhật",
};

export const NO_SCHEDULE_TEXT = "Chưa có lịch, đặt lịch ngay";

/** "thứ ba, thứ năm và chủ nhật" từ danh sách tên. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} và ${names[names.length - 1]}`;
}

/** "18:30" cho cả nhóm khi mọi khung cùng giờ; không thì ghi giờ cho từng thứ. */
function slotsText(slots: Array<{ weekday: number; startTime: string }>): string {
  const seen = new Set<string>();
  const unique = slots
    .filter((s) => WEEKDAY_NAME[s.weekday] && !seen.has(`${s.weekday}|${s.startTime}`) && seen.add(`${s.weekday}|${s.startTime}`))
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
  if (unique.length === 0) return "";
  if (new Set(unique.map((s) => s.startTime)).size === 1) {
    return `${joinNames([...new Set(unique.map((s) => WEEKDAY_NAME[s.weekday]!))])} ${unique[0]!.startTime}`;
  }
  return joinNames(unique.map((s) => `${WEEKDAY_NAME[s.weekday]} ${s.startTime}`));
}

/** dd/MM theo giờ Việt Nam. */
function dayMonth(d: Date): string {
  const key = vnDayKey(d); // YYYY-MM-DD
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

export function summarizeSchedule(input: {
  meetings: number;
  slots: Array<{ weekday: number; startTime: string }>;
  nextStartsAt: Date | null;
}): string {
  if (input.meetings <= 0) return NO_SCHEDULE_TEXT;
  const parts = [`${input.meetings} buổi`];
  const slots = slotsText(input.slots);
  if (slots) parts.push(slots);
  parts.push(input.nextStartsAt ? `buổi tới ${dayMonth(input.nextStartsAt)}` : "không còn buổi sắp tới");
  return parts.join(", ");
}

export interface SectionScheduleSummary {
  hasSchedule: boolean;
  /** Số buổi chưa huỷ. */
  meetings: number;
  text: string;
}

/** sectionId → tóm tắt, cho mọi lớp thật (không tính lớp mặc định) của khoá. Người xem được các lớp của khoá mới gọi được. */
export async function getSectionScheduleSummaries(
  actorUserId: string,
  courseId: string,
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<Record<string, SectionScheduleSummary>> {
  await assertCanGradeCourse(actorUserId, courseId, db);
  const sections = await db.courseSection.findMany({
    where: { courseId, isDefault: false },
    select: { id: true, classSchedule: { select: { slots: { select: { weekday: true, startTime: true } } } } },
  });
  const ids = sections.map((s) => s.id);
  const meetings = ids.length
    ? await db.classMeeting.findMany({
        where: { sectionId: { in: ids }, status: { not: "cancelled" } },
        select: { sectionId: true, startsAt: true },
      })
    : [];

  const out: Record<string, SectionScheduleSummary> = {};
  for (const s of sections) {
    const mine = meetings.filter((m) => m.sectionId === s.id);
    const upcoming = mine.filter((m) => m.startsAt.getTime() >= now.getTime()).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    out[s.id] = {
      hasSchedule: mine.length > 0,
      meetings: mine.length,
      text: summarizeSchedule({ meetings: mine.length, slots: s.classSchedule?.slots ?? [], nextStartsAt: upcoming[0]?.startsAt ?? null }),
    };
  }
  return out;
}
