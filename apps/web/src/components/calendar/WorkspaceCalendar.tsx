"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDaysToKey,
  resolveAcademicPosition,
  termFirstDay,
  weekLabelForDay,
  weekdayIndexMon0,
  type AcademicTermLike,
} from "@feedbackme/shared-types";
import { addMonthsToKey, monthGrid, weekDays } from "@/lib/calendarGrid";
import { formatDayKey } from "@/lib/datetime";

/**
 * Học viên: overdue/todo/submitted/graded (theo bài nộp của chính họ).
 * Giáo viên: upcoming/closed (theo hạn nộp; số bài nộp/chờ chấm nằm ở `detail`).
 */
export type CalendarItemState = "overdue" | "todo" | "submitted" | "graded" | "upcoming" | "closed";

/** Một bài tập có hạn nộp. `dueDay`/`dueTime` do server tính theo giờ VN. */
export interface CalendarAssignment {
  id: string;
  title: string;
  courseTitle: string;
  /** YYYY-MM-DD, giờ VN */
  dueDay: string;
  /** HH:mm, giờ VN */
  dueTime: string;
  state: CalendarItemState;
  /** Ví dụ "8/10" khi đã chấm. */
  scoreLabel?: string;
  /** Dòng phụ dưới tên khoá, ví dụ "12 bài nộp · 3 chờ chấm" (giáo viên). */
  detail?: string;
  /** Loại việc cần làm; mặc định bài tập. Quiz hiện thêm nhãn "Quiz". */
  kind?: "assignment" | "quiz";
  /** Ghi đè nhãn trạng thái mặc định, ví dụ "Chưa làm" / "Đang làm" cho quiz. */
  stateLabel?: string;
  href: string;
}

type View = "week" | "month";

const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const WEEKDAY_LONG = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

// `rank` nhỏ = đáng chú ý hơn: ngày có nhiều bài thì chấm dưới số lấy màu của bài gấp nhất.
const STATE_META: Record<CalendarItemState, { label: string; chip: string; dot: string; rank: number }> = {
  overdue: { label: "Quá hạn", chip: "chip-danger", dot: "bg-danger-500", rank: 0 },
  todo: { label: "Chưa nộp", chip: "chip-accent", dot: "bg-accent-500", rank: 1 },
  submitted: { label: "Đã nộp", chip: "chip-brand", dot: "bg-brand-500", rank: 2 },
  graded: { label: "Đã chấm", chip: "chip-success", dot: "bg-success-500", rank: 3 },
  upcoming: { label: "Sắp đến hạn", chip: "chip-accent", dot: "bg-accent-500", rank: 1 },
  closed: { label: "Đã hết hạn", chip: "chip", dot: "bg-slate-400", rank: 4 },
};

function dayNumber(key: string): number {
  return Number(key.slice(8, 10));
}

/** "28/9" — gọn, dùng cho khoảng tuần. */
function shortDay(key: string): string {
  return `${dayNumber(key)}/${Number(key.slice(5, 7))}`;
}

function weekRangeText(days: string[]): string {
  return `${shortDay(days[0]!)} – ${shortDay(days[6]!)}/${days[6]!.slice(0, 4)}`;
}

/**
 * Lịch cho workspace giáo viên và dashboard học viên.
 *
 * - `organizationName` có (tài khoản thuộc trường) → tiêu đề "Tuần N/M" của hôm nay +
 *   "<kỳ> · <trường>", và cột số tuần ở lịch; null (tài khoản tự do) → lịch trơn,
 *   không nhãn kỳ học, không cột tuần.
 * - `assignments` có → chấm dưới ngày có hạn nộp; danh sách bên dưới là hạn nộp của
 *   NGÀY ĐANG CHỌN (mặc định hôm nay).
 *
 * Mọi ngày là khoá `YYYY-MM-DD` giờ VN do server đưa xuống (kể cả `todayKey`), nên
 * kết quả không phụ thuộc múi giờ hay đồng hồ máy người xem.
 */
export default function WorkspaceCalendar({
  todayKey,
  organizationName,
  terms,
  assignments,
  defaultView = "week",
  initialDay,
}: {
  todayKey: string;
  organizationName: string | null;
  terms: AcademicTermLike[];
  assignments?: CalendarAssignment[];
  /** Mặc định "week" (1 hàng) cho gọn; "month" mở sẵn cả tháng. */
  defaultView?: View;
  /** Ngày chọn sẵn (mặc định hôm nay). Chủ yếu để test lịch ở tuần không phải tuần hiện tại. */
  initialDay?: string;
}) {
  const [view, setView] = useState<View>(defaultView);
  // Ngày đang chọn đồng thời là mỏ neo: lịch tháng hiển thị tháng chứa nó, lịch tuần hiển thị tuần chứa nó.
  const [selected, setSelected] = useState(initialDay ?? todayKey);
  const [open, setOpen] = useState(true);

  const inOrg = organizationName !== null;
  const showWeekColumn = inOrg && terms.length > 0;
  const showList = assignments !== undefined;

  const rows = useMemo(() => (view === "month" ? monthGrid(selected) : [weekDays(selected)]), [view, selected]);
  const viewedMonth = selected.slice(0, 7);
  const currentWeekStart = weekDays(todayKey)[0]!;

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarAssignment[]>();
    for (const a of assignments ?? []) {
      const list = map.get(a.dueDay);
      if (list) list.push(a);
      else map.set(a.dueDay, [a]);
    }
    for (const list of map.values()) list.sort((x, y) => x.dueTime.localeCompare(y.dueTime));
    return map;
  }, [assignments]);

  /** Sang tháng khác: về "hôm nay" nếu tháng đó chứa hôm nay, không thì mùng 1. */
  function goToMonth(firstOfMonth: string) {
    setSelected(firstOfMonth.slice(0, 7) === todayKey.slice(0, 7) ? todayKey : firstOfMonth);
  }

  function move(direction: -1 | 1) {
    if (view === "month") goToMonth(addMonthsToKey(selected, direction));
    else setSelected(addDaysToKey(selected, 7 * direction));
  }

  const todayYear = Number(todayKey.slice(0, 4));
  const viewedYear = Number(viewedMonth.slice(0, 4));
  const years = Array.from(
    new Set([...Array.from({ length: 7 }, (_, i) => todayYear - 3 + i), viewedYear]),
  ).sort((a, b) => a - b);

  // Tiêu đề bám theo ngày/tuần ĐANG XEM (lật tuần thì số tuần đổi theo); "Hôm nay" đưa về tuần hiện tại.
  const position = inOrg ? resolveAcademicPosition(selected, terms) : null;
  const weekDaysOfSelected = weekDays(selected);
  const viewedWeek = showWeekColumn ? weekLabelForDay(selected, terms) : null;

  const dayItems = byDay.get(selected) ?? [];
  const nextDueDay = useMemo(
    () => [...byDay.keys()].filter((d) => d > selected).sort()[0] ?? null,
    [byDay, selected],
  );

  return (
    <section className="card p-3 sm:p-4" aria-label="Lịch">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 grow basis-36">
          {position && organizationName ? (
            <>
              <h2 className="flex items-center gap-1.5 text-base font-bold leading-tight">
                <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                {position.kind === "in_term" ? (
                  <span className="whitespace-nowrap">
                    Tuần {position.week}
                    <span className="font-medium text-muted">/{position.weekCount}</span>
                  </span>
                ) : position.kind === "before_term" ? (
                  <span>Chưa vào kỳ</span>
                ) : (
                  <span>Ngoài kỳ học</span>
                )}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {position.kind === "in_term" && <>{position.term.name} · </>}
                {position.kind === "before_term" && (
                  <>
                    {position.term.name} bắt đầu{" "}
                    {selected === todayKey
                      ? `sau ${position.daysUntilStart} ngày`
                      : formatDayKey(termFirstDay(position.term))}{" "}
                    ·{" "}
                  </>
                )}
                <span className="font-medium text-token">{organizationName}</span>
              </p>
            </>
          ) : (
            <>
              <h2 className="flex items-center gap-1.5 text-base font-bold leading-tight">
                <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                Lịch
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Hôm nay, {WEEKDAY_LONG[weekdayIndexMon0(todayKey)]?.toLowerCase()} {formatDayKey(todayKey)}
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div role="group" aria-label="Chế độ xem" className="inline-flex rounded-lg border border-token p-0.5 text-xs">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                  view === v ? "bg-brand-600 text-white" : "text-muted hover:text-token"
                }`}
              >
                {v === "week" ? "Tuần" : "Tháng"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Thu gọn lịch" : "Mở rộng lịch"}
            className="btn-ghost btn-sm px-2"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </header>

      {open && (
        <>
          {/* Điều hướng đối xứng: Trước (trái) — khoảng đang xem (giữa) — Sau (phải). Nút to, có viền và chữ để khỏi bấm nhầm. */}
          <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label={view === "month" ? "Tháng trước" : "Tuần trước"}
              className="btn-secondary btn-sm gap-0.5 pl-1.5 pr-2.5"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Trước
            </button>

            <div className="flex min-w-0 flex-col items-center gap-0.5">
              {view === "month" ? (
                <div className="flex items-center gap-1">
                  <select
                    aria-label="Tháng"
                    value={Number(viewedMonth.slice(5, 7))}
                    onChange={(e) => goToMonth(`${viewedYear}-${String(e.target.value).padStart(2, "0")}-01`)}
                    className="rounded-full border border-token bg-[rgb(var(--surface))] px-2 py-0.5 text-xs font-semibold"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        Tháng {i + 1}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Năm"
                    value={viewedYear}
                    onChange={(e) => goToMonth(`${e.target.value}-${viewedMonth.slice(5, 7)}-01`)}
                    className="rounded-full border border-token bg-[rgb(var(--surface))] px-2 py-0.5 text-xs font-semibold"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="whitespace-nowrap text-center text-sm font-semibold tabular-nums">
                  {weekRangeText(weekDaysOfSelected)}
                </p>
              )}
              {/* Chỉ hiện khi đang xem chỗ khác hôm nay — ở hôm nay thì không cần, đỡ rối. */}
              {selected !== todayKey && (
                <button type="button" onClick={() => setSelected(todayKey)} className="link text-xs">
                  Về hôm nay
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => move(1)}
              aria-label={view === "month" ? "Tháng sau" : "Tuần sau"}
              className="btn-secondary btn-sm gap-0.5 pl-2.5 pr-1.5"
            >
              Sau
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Lưới không viền: số ngày trong vòng tròn, chấm nhỏ dưới ngày có hạn nộp. */}
          <div
            className={`mt-1.5 grid items-center ${
              showWeekColumn
                ? "grid-cols-[1.75rem_repeat(7,minmax(0,1fr))]"
                : "grid-cols-7"
            }`}
          >
            {showWeekColumn && (
              <div className="pb-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-faint">Tuần</div>
            )}
            {WEEKDAY_SHORT.map((d, i) => (
              <div
                key={d}
                className={`pb-0.5 text-center text-[11px] font-semibold ${i >= 5 ? "text-faint" : "text-muted"}`}
              >
                {d}
              </div>
            ))}

            {rows.map((row) => {
              const weekInfo = showWeekColumn ? weekLabelForDay(row[0]!, terms) : null;
              const isCurrentWeek = row[0] === currentWeekStart;
              return (
                <Row
                  key={row[0]}
                  row={row}
                  weekLabel={showWeekColumn ? (weekInfo ? String(weekInfo.week) : "") : null}
                  isCurrentWeek={showWeekColumn && isCurrentWeek}
                  viewedMonth={view === "month" ? viewedMonth : null}
                  todayKey={todayKey}
                  selected={selected}
                  byDay={byDay}
                  onSelect={setSelected}
                />
              );
            })}
          </div>

          {showList && (
            <div className="mt-2 border-t border-token pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold">
                  Ngày {String(dayNumber(selected)).padStart(2, "0")} tháng {selected.slice(5, 7)}
                  <span className="ml-1.5 font-normal text-muted">
                    · {WEEKDAY_LONG[weekdayIndexMon0(selected)]}
                  </span>
                </h3>
                <span className="flex items-center gap-1.5">
                  {selected === todayKey && <span className="chip text-[11px]">Hôm nay</span>}
                  {viewedWeek && <span className="chip-brand text-[11px]">Tuần {viewedWeek.week}</span>}
                </span>
              </div>

              {dayItems.length === 0 ? (
                <div className="mt-1.5 text-xs text-muted">
                  <p>Không có hạn nộp ngày này.</p>
                  {nextDueDay && (
                    <button
                      type="button"
                      onClick={() => setSelected(nextDueDay)}
                      className="link mt-0.5 text-left text-xs"
                    >
                      Hạn nộp tiếp theo: {WEEKDAY_LONG[weekdayIndexMon0(nextDueDay)]} {shortDay(nextDueDay)} →
                    </button>
                  )}
                </div>
              ) : (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {dayItems.map((a) => {
                    const meta = STATE_META[a.state];
                    return (
                      <li key={a.id}>
                        <Link
                          href={a.href}
                          prefetch={false}
                          className="flex items-center gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] px-2 py-1.5 transition-colors hover:border-brand-300"
                        >
                          <span className="w-10 shrink-0 text-center text-xs font-bold tabular-nums">{a.dueTime}</span>
                          <span className={`w-0.5 shrink-0 self-stretch rounded-full ${meta.dot}`} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold leading-snug">{a.title}</span>
                            <span className="block truncate text-[11px] text-muted">
                              {a.kind === "quiz" && <span className="font-semibold text-brand-700">Quiz · </span>}
                              {a.courseTitle}
                              {a.detail && ` · ${a.detail}`}
                            </span>
                          </span>
                          <span className={`${meta.chip} shrink-0 text-[10px]`}>
                            {a.state === "graded" && a.scoreLabel ? `✓ ${a.scoreLabel}` : (a.stateLabel ?? meta.label)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Row({
  row,
  weekLabel,
  isCurrentWeek,
  viewedMonth,
  todayKey,
  selected,
  byDay,
  onSelect,
}: {
  row: string[];
  /** null = ẩn cột Tuần; "" = có cột nhưng hàng này ngoài kỳ. */
  weekLabel: string | null;
  isCurrentWeek: boolean;
  /** null ở chế độ tuần (không có ngày "ngoài tháng"). */
  viewedMonth: string | null;
  todayKey: string;
  selected: string;
  byDay: Map<string, CalendarAssignment[]>;
  onSelect: (day: string) => void;
}) {
  return (
    <>
      {weekLabel !== null && (
        <div
          className={`flex items-center justify-center self-stretch rounded-l-lg text-[11px] font-semibold tabular-nums ${
            isCurrentWeek ? "bg-brand-50" : ""
          } ${weekLabel ? "text-brand-700" : "text-faint"}`}
        >
          {weekLabel || "–"}
        </div>
      )}
      {row.map((day, i) => {
        const items = byDay.get(day) ?? [];
        const worst = items.length
          ? items.reduce((w, a) => (STATE_META[a.state].rank < STATE_META[w.state].rank ? a : w)).state
          : null;
        const outside = viewedMonth !== null && !day.startsWith(viewedMonth);
        const isToday = day === todayKey;
        const isSelected = day === selected;
        const label = `${dayNumber(day)}/${day.slice(5, 7)}${
          items.length ? `, ${items.length} việc đến hạn` : ""
        }${isToday ? ", hôm nay" : ""}`;
        // Ngày đang chọn: tô đặc. Hôm nay (chưa chọn): viền tròn. Ngoài tháng: mờ.
        const circle = isSelected
          ? "bg-brand-600 font-bold text-white"
          : isToday
            ? "font-bold ring-2 ring-inset ring-brand-500 hover:bg-brand-100"
            : `${outside ? "text-faint" : i >= 5 ? "text-muted" : "font-medium"} hover:bg-brand-100`;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            aria-pressed={isSelected}
            aria-label={label}
            className={`flex flex-col items-center py-px ${isCurrentWeek ? "bg-brand-50" : ""} ${
              i === 6 ? "rounded-r-lg" : ""
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs tabular-nums transition-colors sm:h-8 sm:w-8 sm:text-sm ${circle}`}
            >
              {dayNumber(day)}
            </span>
            {/* Luôn giữ chỗ cho chấm để hàng không nhảy chiều cao. */}
            <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
              {worst && (
                <>
                  <span className={`h-1 w-1 rounded-full ${STATE_META[worst].dot}`} />
                  {items.length > 1 && (
                    <span className="text-[9px] font-semibold leading-none text-muted">{items.length}</span>
                  )}
                </>
              )}
            </span>
          </button>
        );
      })}
    </>
  );
}
