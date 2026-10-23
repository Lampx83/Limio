import Link from "next/link";
import { addDays, isoWeekday, vnDayKey } from "@feedbackme/core-lms";
import { formatDayKey, formatTime, toDayKey } from "@/lib/datetime";

export interface WeekMeeting {
  id: string;
  sectionId: string;
  sectionName: string;
  courseId: string;
  seq: number | null;
  startsAt: string;
  endsAt: string;
  room: string | null;
  plannedTeacherName: string | null;
  status: "planned" | "held" | "cancelled";
  cancelReason: string | null;
  makeupOfId: string | null;
}

const DAY_NAMES = ["", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"];

/** Thứ hai của tuần chứa `dayKey`. */
export function weekStartOf(dayKey: string): string {
  return addDays(dayKey, 1 - isoWeekday(dayKey));
}

export function todayKey(): string {
  return vnDayKey(new Date());
}

/**
 * Lịch một tuần, nhóm theo ngày. Dùng chung cho giảng viên và học viên; `hrefFor` quyết định
 * buổi có bấm vào được không (học viên chưa có trang chi tiết buổi nên không truyền).
 */
export default function ScheduleWeek({
  weekStart,
  meetings,
  basePath,
  hrefFor,
  showSection = true,
}: {
  weekStart: string;
  meetings: WeekMeeting[];
  basePath: string;
  hrefFor?: (m: WeekMeeting) => string | null;
  showSection?: boolean;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = new Map<string, WeekMeeting[]>();
  for (const m of meetings) {
    const k = toDayKey(m.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), m]);
  }
  const today = todayKey();
  const prev = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  const isThisWeek = weekStart === weekStartOf(today);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3">
          Tuần {formatDayKey(weekStart).slice(0, 5)} – {formatDayKey(days[6]!).slice(0, 5)}
        </h2>
        <nav className="flex gap-2" aria-label="Chuyển tuần">
          <Link className="btn-secondary btn-sm" href={`${basePath}?tuan=${prev}`}>
            ← Tuần trước
          </Link>
          {!isThisWeek && (
            <Link className="btn-secondary btn-sm" href={basePath}>
              Tuần này
            </Link>
          )}
          <Link className="btn-secondary btn-sm" href={`${basePath}?tuan=${next}`}>
            Tuần sau →
          </Link>
        </nav>
      </div>

      <div className="mt-4 space-y-3">
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          return (
            <section
              key={day}
              className={`rounded-2xl border bg-[rgb(var(--surface))] ${day === today ? "border-brand-500" : "border-token"}`}
            >
              <h3 className="flex items-center gap-2 border-b border-token px-4 py-2 text-sm font-semibold">
                {DAY_NAMES[isoWeekday(day)]} · {formatDayKey(day).slice(0, 5)}
                {day === today && <span className="chip-brand text-xs">Hôm nay</span>}
              </h3>
              {list.length === 0 ? (
                <p className="px-4 py-3 text-caption text-muted">Không có buổi nào.</p>
              ) : (
                <ul className="divide-y divide-token">
                  {list.map((m) => {
                    const href = hrefFor?.(m) ?? null;
                    const cancelled = m.status === "cancelled";
                    const inner = (
                      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm ${cancelled ? "opacity-70" : ""}`}>
                        <span className={`font-medium ${cancelled ? "line-through" : ""}`}>
                          {formatTime(m.startsAt)}–{formatTime(m.endsAt)}
                        </span>
                        {showSection && <span>{m.sectionName}</span>}
                        {m.seq && <span className="text-muted">Buổi {m.seq}</span>}
                        {m.room && <span className="text-muted">Phòng {m.room}</span>}
                        {m.plannedTeacherName && <span className="text-muted">{m.plannedTeacherName}</span>}
                        {cancelled && <span className="chip-danger text-xs">Đã huỷ</span>}
                        {m.status === "held" && <span className="chip-success text-xs">Đã dạy</span>}
                        {m.makeupOfId && <span className="chip-accent text-xs">Dạy bù</span>}
                        {cancelled && m.cancelReason && (
                          <span className="basis-full text-caption text-muted">Lý do: {m.cancelReason}</span>
                        )}
                      </div>
                    );
                    return (
                      <li key={m.id}>
                        {href ? (
                          <Link href={href} className="block hover:bg-[rgb(var(--surface-muted))/0.4]">
                            {inner}
                          </Link>
                        ) : (
                          inner
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
