"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Play, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import type { BoardClass, BoardMeeting, OrgBoard, OrgClassTimeline } from "@feedbackme/core-lms";
import { formatDayKey, formatTime } from "@/lib/datetime";
import { shiftDay, weekStart } from "@/lib/weekRange";
import {
  FLAG_LABEL,
  STATE_LABEL,
  axisX,
  blockSpan,
  buildRows,
  concurrencyBuckets,
  dayAxis,
  dayHourSpan,
  rangeAxis,
  vnDayKey,
  vnMidnight,
  weekdayName,
  type Axis,
  type BoardGroup,
  type BoardMode,
  type GroupKey,
} from "./boardModel";

/**
 * Bảng điều phối lịch kiểu lịch phát sóng (CENTER M, docs/CENTER-dashboard-dieu-phoi-AC.md): trục ngang là thời gian, vạch đỏ "bây giờ" chạy dọc,
 * mỗi khối ngang là một buổi (mức Ngày, Tuần) hoặc cả vòng đời một lớp (mức Kỳ). Dữ liệu đã tính trạng thái và cờ ở máy chủ; ở đây chỉ vẽ.
 * Vạch "bây giờ" chạy bằng đồng hồ của trình duyệt, không gọi máy chủ; dữ liệu làm mới khi quay lại tab và mỗi 5 phút.
 */

const LANE_H = 46;
const REFRESH_MS = 5 * 60_000;
const HANG_KEY = "limio:center-board:hang";

interface Props {
  mode: BoardMode;
  /** Ngày neo của khoảng đang xem (YYYY-MM-DD). */
  anchor: string;
  from: string;
  to: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  modeHrefs: Record<BoardMode, string>;
  basePath: string;
  /** Phần `&truong=…` giữ trường đang chọn khi đổi ngày bằng ô chọn ngày. */
  extraQuery: string;
  /** Lọc sẵn theo một loại cảnh báo (từ thẻ ở Tổng quan trung tâm): no_teacher, no_checkin, no_attendance, clash. */
  initialFlag?: string;
  nowIso: string;
  orgName: string;
  board: OrgBoard | null;
  timeline: OrgClassTimeline | null;
}

const STATE_STYLE: Record<string, string> = {
  live: "border-lime-700 bg-lime-300 text-lime-950 shadow-sm dark:bg-lime-700/70 dark:text-lime-50",
  upcoming: "border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-100",
  held: "border-stone-200 bg-stone-100 text-stone-500 dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-400",
  overdue: "border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-900/30 dark:text-amber-100",
  cancelled: "border-dashed border-stone-300 bg-transparent text-stone-400 line-through opacity-70",
};

/** Nút phân đoạn và nút biểu tượng dùng chung một chiều cao (h-9) để thanh điều khiển thẳng hàng. */
const SEG = "inline-flex h-9 max-w-full items-center overflow-x-auto rounded-full border border-token p-0.5 text-sm";
const segItem = (active: boolean) =>
  `inline-flex h-full items-center whitespace-nowrap rounded-full px-3 transition-colors ${active ? "bg-brand-500 font-semibold text-white" : "text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"}`;
const ICON_BTN = "inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]";

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 font-medium text-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
      {label}
      <button type="button" onClick={onRemove} className="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-900/60" aria-label={`Bỏ lọc ${label}`}>
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}

function StateIcon({ state }: { state: string }) {
  const c = "h-3 w-3 shrink-0";
  if (state === "live") return <Play className={c} aria-hidden />;
  if (state === "held") return <Check className={c} aria-hidden />;
  if (state === "overdue") return <Clock className={c} aria-hidden />;
  if (state === "cancelled") return <Ban className={c} aria-hidden />;
  return null;
}

const weekdayShort = weekdayName;

export default function CenterBoard(props: Props) {
  const { mode, from, to, board, timeline } = props;
  const router = useRouter();
  const [now, setNow] = useState(() => new Date(props.nowIso));
  const [hang, setHang] = useState<BoardGroup>("trinh-do");
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [hideCancelled, setHideCancelled] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [flagFilter, setFlagFilter] = useState(props.initialFlag ?? "");
  const [query, setQuery] = useState("");
  // Chế độ gọn: buổi tối có thể có hàng chục lớp chạy song song nên mỗi buổi chỉ một dòng. null = tự bật khi có hàng chồng quá 5 làn.
  const [denseChoice, setDenseChoice] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<BoardMeeting | null>(null);
  const [selectedClass, setSelectedClass] = useState<BoardClass | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBox = useRef<HTMLDivElement>(null);

  // Popover bộ lọc: bấm ra ngoài hoặc Esc thì đóng.
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent) => {
      if (filterBox.current && !filterBox.current.contains(e.target as Node)) setFilterOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFilterOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  // Đồng hồ: vạch "bây giờ" dịch chuyển mỗi 60 giây, không gọi máy chủ (M1.2).
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Làm mới dữ liệu khi quay lại tab và tối đa mỗi 5 phút (M1.3).
  useEffect(() => {
    const refresh = () => router.refresh();
    const id = window.setInterval(refresh, REFRESH_MS);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);

  // Nhớ cách gom hàng theo trình duyệt (M1.4); lựa chọn không hợp với mức đang xem thì dùng mặc định.
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(HANG_KEY) as BoardGroup | null;
      if (v === "trinh-do" || v === "phong" || v === "giao-vien" || v === "lop") setHang(mode === "ky" && v === "phong" ? "lop" : v);
    } catch {
      /* chặn lưu trữ: dùng mặc định */
    }
  }, [mode]);
  const chooseHang = (h: BoardGroup) => {
    setHang(h);
    try {
      window.localStorage.setItem(HANG_KEY, h);
    } catch {
      /* bỏ qua */
    }
  };

  const meetings = useMemo(
    () =>
      (board?.meetings ?? []).map((m) => ({ ...m, startsAt: new Date(m.startsAt), endsAt: new Date(m.endsAt), startIso: m.startsAt, endIso: m.endsAt })),
    [board],
  );
  const rawOf = (id: string) => board?.meetings.find((x) => x.id === id) ?? null;
  const filtered = useMemo(
    () =>
      meetings.filter(
        (m) =>
          (!classFilter || m.sectionId === classFilter) &&
          (!query.trim() || m.sectionName.toLowerCase().includes(query.trim().toLowerCase())) &&
          (!teacherFilter || m.teacher?.id === teacherFilter) &&
          !(hideCancelled && m.state === "cancelled") &&
          !(onlyFlagged && m.flags.length === 0) &&
          (!flagFilter || (flagFilter === "clash" ? m.flags.some((f) => f === "room_clash" || f === "teacher_clash") : m.flags.some((f) => f === flagFilter))),
      ),
    [meetings, classFilter, teacherFilter, hideCancelled, onlyFlagged, query, flagFilter],
  );

  const axis: Axis = useMemo(() => {
    if (mode === "ky") return rangeAxis(from, to);
    const span = dayHourSpan(meetings);
    const days = mode === "ngay" ? [from] : Array.from({ length: 7 }, (_, i) => shiftDay(from, i));
    return dayAxis(days, span.startHour, span.endHour, (d) => `${weekdayShort(d)} ${formatDayKey(d).slice(0, 5)}`);
  }, [mode, from, to, meetings]);

  const hours = mode !== "ky" ? Math.round((axis.segments[0]!.to.getTime() - axis.segments[0]!.from.getTime()) / 3600_000) : 0;
  const days = mode === "ky" ? Math.round((axis.segments[0]!.to.getTime() - axis.segments[0]!.from.getTime()) / 86_400_000) : 0;
  const trackMinPx = mode === "ngay" ? hours * 100 : mode === "tuan" ? 7 * 190 : Math.max(900, days * 11);
  const nowX = axisX(axis, now);

  // Tự cuộn để vạch "bây giờ" nằm khoảng 1/3 chiều rộng nhìn thấy (M1.1).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const track = el.querySelector<HTMLElement>("[data-track]");
    if (!track) return;
    // Hôm nay: vạch "bây giờ" ở khoảng 1/3 chiều rộng nhìn thấy. Ngày khác: cuộn tới buổi đầu tiên của ngày.
    const firstStart = mode === "ngay" && meetings.length ? new Date(Math.min(...meetings.map((m) => m.startsAt.getTime()))) : null;
    const anchorX = nowX ?? (firstStart ? axisX(axis, firstStart) : null);
    if (anchorX === null) return;
    const x = (anchorX / 100) * track.offsetWidth;
    el.scrollLeft = Math.max(0, x - (nowX !== null ? el.clientWidth / 3 : 24));
    // chỉ khi đổi khoảng xem: giữ nguyên vị trí cuộn của người dùng ở các lần làm mới
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, from]);

  // Nhảy tới một giờ trong ngày (nút "Đang phát", "Buổi sáng"…) và cuộn ngang theo bước (mũi tên), như bảng giờ phát sóng truyền hình.
  const scrollToHour = (hour: number) => {
    const el = scroller.current;
    const seg = axis.segments[0];
    if (!el || !seg || mode !== "ngay") return;
    const at = new Date(vnMidnight(from).getTime() + hour * 3600_000);
    const pct = axisX(axis, at);
    const track = el.querySelector<HTMLElement>("[data-track]");
    if (pct === null || !track) return;
    el.scrollTo({ left: Math.max(0, (pct / 100) * track.offsetWidth - 8), behavior: "smooth" });
  };
  const scrollToNow = () => {
    const el = scroller.current;
    const track = el?.querySelector<HTMLElement>("[data-track]");
    if (!el || !track || nowX === null) return;
    el.scrollTo({ left: Math.max(0, (nowX / 100) * track.offsetWidth - el.clientWidth / 3), behavior: "smooth" });
  };
  const SESSIONS: Array<[string, number]> = [["Buổi sáng", 6], ["Buổi chiều", 12], ["Buổi tối", 18], ["Buổi đêm", 22]];
  const axisStartHour = mode === "ngay" ? Math.round((axis.segments[0]!.from.getTime() - vnMidnight(from).getTime()) / 3600_000) : 0;
  const axisEndHour = axisStartHour + hours;

  // Hàng của mức Ngày và Tuần.
  const meetingRows = useMemo(() => {
    const keyOf = (m: (typeof filtered)[number]): GroupKey =>
      hang === "trinh-do"
        ? m.level
          ? { key: m.level, label: m.level, pinned: false }
          : { key: "_none", label: "Chưa rõ trình độ", pinned: false, last: true }
        : hang === "giao-vien"
        ? m.teacher
          ? { key: m.teacher.id, label: m.teacher.name, pinned: false }
          : { key: "_none", label: "Chưa có giáo viên", pinned: true }
        : hang === "lop"
          ? { key: m.sectionId, label: m.sectionName, pinned: false }
          : m.roomKey
            ? { key: m.roomKey, label: m.room!.trim(), pinned: false }
            : { key: "_none", label: "Chưa xếp phòng", pinned: true };
    return buildRows(filtered, keyOf);
  }, [filtered, hang]);

  // Hàng của mức Kỳ.
  const classRows = useMemo(() => {
    const list = (timeline?.classes ?? [])
      .filter((c) => c.lifecycle.status !== "no_schedule")
      .filter((c) => !teacherFilter || c.teacher?.id === teacherFilter)
      .filter((c) => !query.trim() || c.name.toLowerCase().includes(query.trim().toLowerCase()))
      .map((c) => ({ ...c, id: c.sectionId, startsAt: new Date(c.lifecycle.start!), endsAt: new Date(c.lifecycle.end!) }));
    const keyOf = (c: (typeof list)[number]): GroupKey =>
      hang === "trinh-do"
        ? c.level
          ? { key: c.level, label: c.level, pinned: false }
          : { key: "_none", label: "Chưa rõ trình độ", pinned: false, last: true }
        : hang === "giao-vien"
        ? c.teacher
          ? { key: c.teacher.id, label: c.teacher.name, pinned: false }
          : { key: "_none", label: "Chưa có giáo viên", pinned: true }
        : hang === "lop"
          ? { key: c.sectionId, label: c.name, pinned: false }
          : { key: c.courseId, label: c.courseTitle, pinned: false };
    return buildRows(list, keyOf);
  }, [timeline, hang, teacherFilter, query]);
  const maxLanes = Math.max(1, ...(mode === "ky" ? classRows : meetingRows).map((r) => r.laneCount));
  const dense = denseChoice ?? maxLanes > 5;
  const laneH = dense ? 26 : LANE_H;
  // Số lớp song song theo ô 30 phút (mức Ngày) và cao điểm trong ngày (mức Tuần).
  const parallel = useMemo(() => {
    const live = filtered.filter((m) => m.state !== "cancelled");
    if (mode === "ngay") return { day: concurrencyBuckets(live, axis.segments[0]!), perDay: null };
    if (mode === "tuan") return { day: null, perDay: axis.segments.map((sg) => concurrencyBuckets(live, sg).peak) };
    return { day: null, perDay: null };
  }, [filtered, axis, mode]);
  const unscheduled = (timeline?.classes ?? []).filter((c) => c.lifecycle.status === "no_schedule");

  const counts = useMemo(() => {
    const live = meetings.filter((m) => m.state === "live").length;
    const upcoming = meetings.filter((m) => m.state === "upcoming").length;
    const flagged = meetings.filter((m) => m.flags.length > 0).length;
    return { live, upcoming, flagged };
  }, [meetings]);
  const classOptions = useMemo(() => [...new Map(meetings.map((m) => [m.sectionId, m.sectionName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "vi")), [meetings]);
  const teacherOptions = useMemo(() => {
    const src = mode === "ky" ? (timeline?.classes ?? []).map((c) => c.teacher) : meetings.map((m) => m.teacher);
    return [...new Map(src.filter((t): t is { id: string; name: string } => !!t).map((t) => [t.id, t.name])).entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [meetings, timeline, mode]);

  // Esc đóng ngăn chi tiết.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setSelectedClass(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hangOptions: Array<[BoardGroup, string]> = mode === "ky" ? [["trinh-do", "Trình độ"], ["lop", "Lớp"], ["giao-vien", "Giáo viên"], ["phong", "Khoá"]] : [["trinh-do", "Trình độ"], ["phong", "Phòng"], ["giao-vien", "Giáo viên"], ["lop", "Lớp"]];
  const hangValid = hangOptions.some(([v]) => v === hang) ? hang : hangOptions[0]![0];
  const rangeLabel = mode === "ngay" ? `${weekdayShort(from)}, ${formatDayKey(from)}` : `${formatDayKey(from)} – ${formatDayKey(to)}`;
  const empty = mode === "ky" ? classRows.length === 0 : filtered.length === 0;

  const todayKey = vnDayKey(now);
  const isCurrent = mode === "ngay" ? props.anchor === todayKey : weekStart(props.anchor) === weekStart(todayKey);
  const activeFilters = (teacherFilter ? 1 : 0) + (mode !== "ky" ? (classFilter ? 1 : 0) + (hideCancelled ? 1 : 0) + (onlyFlagged ? 1 : 0) + (flagFilter ? 1 : 0) : 0);
  const clearFilters = () => {
    setTeacherFilter("");
    setClassFilter("");
    setHideCancelled(false);
    setOnlyFlagged(false);
    setFlagFilter("");
  };

  const header = (
    <div className="flex">
      <div className="sticky left-0 z-20 w-36 shrink-0 border-b border-r border-brand-900 bg-brand-900 px-3 py-2 text-xs font-semibold text-white">
        {mode === "ky" ? "Lớp" : hangOptions.find(([v]) => v === hangValid)?.[1]}
      </div>
      <div data-track className="relative flex border-b border-brand-900 bg-brand-900 text-white" style={{ minWidth: trackMinPx, flex: 1 }}>
        {mode === "ngay" &&
          Array.from({ length: hours * 2 }, (_, i) => {
            const h = new Date(axis.segments[0]!.from.getTime() + i * 1800_000);
            return (
              <div key={i} className={`flex-1 border-l px-1 py-2 text-xs tabular-nums ${i % 2 === 0 ? "border-white/30 text-white" : "border-white/10 text-white/60"}`}>
                {formatTime(h)}
              </div>
            );
          })}
        {mode === "tuan" &&
          axis.segments.map((s) => (
            <div key={s.dayKey} className={`flex-1 border-l border-white/20 px-2 py-2 text-xs font-semibold ${s.dayKey === vnDayKey(now) ? "text-pink-300" : "text-white"}`}>
              {s.label}
              {parallel.perDay && (parallel.perDay[axis.segments.indexOf(s)] ?? 0) > 0 && (
                <span className="block text-[10px] font-normal opacity-80">đồng thời tối đa {parallel.perDay[axis.segments.indexOf(s)]} lớp</span>
              )}
            </div>
          ))}
        {mode === "ky" &&
          Array.from({ length: Math.ceil(days / 7) }, (_, i) => {
            const d = shiftDay(from, i * 7);
            return (
              <div key={d} className="border-l border-white/20 px-1 py-2 text-xs tabular-nums text-white" style={{ width: `${(7 / days) * 100}%` }}>
                {formatDayKey(d).slice(0, 5)}
              </div>
            );
          })}
        {nowX !== null && (
          <span className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-pink-500" style={{ left: `${nowX}%` }}>
            {mode !== "tuan" && <span className="absolute -top-0 -translate-x-1/2 rounded bg-pink-600 px-1.5 text-xs font-bold text-white">{formatTime(now)}</span>}
          </span>
        )}
      </div>
    </div>
  );

  // Dải "lớp song song" (mức Ngày): số lớp chạy cùng lúc theo ô 30 phút, đậm dần theo số lớp; để thấy ngay giờ cao điểm buổi tối.
  const parallelStrip =
    mode === "ngay" && parallel.day && parallel.day.counts.length > 0 ? (
      <div className="flex border-b border-token" aria-label="Số lớp chạy song song">
        <div className="sticky left-0 z-20 w-36 shrink-0 border-r border-token bg-brand-50 px-3 py-1 text-xs font-semibold leading-tight text-brand-900 dark:bg-brand-950">
          Lớp song song
          {parallel.day.peak > 1 && (
            <span className="block text-[10px] font-normal opacity-80">
              Cao điểm {formatTime(new Date(axis.segments[0]!.from.getTime() + parallel.day.peakIndex * 1800_000))}: {parallel.day.peak} lớp
            </span>
          )}
        </div>
        <div data-track className="relative flex" style={{ minWidth: trackMinPx, flex: 1 }}>
          {parallel.day.counts.map((c, i) => (
            <div
              key={i}
              className="flex-1 border-l border-token/60 py-1 text-center text-[11px] font-semibold tabular-nums"
              style={{ backgroundColor: c > 0 ? `rgba(132, 204, 22, ${0.12 + 0.55 * (c / Math.max(1, parallel.day!.peak))})` : undefined }}
              title={`${formatTime(new Date(axis.segments[0]!.from.getTime() + i * 1800_000))}: ${c} lớp`}
            >
              {c > 0 ? c : ""}
            </div>
          ))}
        </div>
      </div>
    ) : null;

  const renderTrack = (children: React.ReactNode, laneCount: number, pinned: boolean) => (
    <div data-track className={`relative flex-1 ${pinned ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`} style={{ minWidth: trackMinPx, height: laneCount * laneH + 6 }}>
      {nowX !== null && <span className="pointer-events-none absolute inset-y-0 z-10 w-px bg-pink-500/70" style={{ left: `${nowX}%` }} />}
      {children}
    </div>
  );

  return (
    <div className="space-y-3" data-testid="center-board">
      {/* Thanh điều khiển: một thẻ, hai tầng. Tầng trên: ở đâu trong thời gian + tình hình hiện tại. Tầng dưới: nhìn thế nào (nhóm, tìm, lọc, nhảy giờ). */}
      <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div role="tablist" aria-label="Mức xem" className={SEG}>
            {(["ngay", "tuan", "ky"] as BoardMode[]).map((m) => (
              <Link key={m} role="tab" aria-selected={mode === m} href={props.modeHrefs[m]} className={segItem(mode === m)}>
                {m === "ngay" ? "Ngày" : m === "tuan" ? "Tuần" : "Kỳ"}
              </Link>
            ))}
          </div>

          <div className="inline-flex items-center gap-0.5">
            <Link href={props.prevHref} className={ICON_BTN} aria-label="Khoảng trước" title="Khoảng trước">
              <ChevronLeft size={18} aria-hidden />
            </Link>
            <div className="relative">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold hover:bg-[rgb(var(--surface-muted))]"
                aria-label={`Đang xem ${rangeLabel}. Bấm để chọn ngày khác`}
                onClick={() => {
                  const el = dateRef.current;
                  try {
                    el?.showPicker();
                  } catch {
                    el?.focus();
                    el?.click();
                  }
                }}
              >
                <CalendarDays size={16} className="text-brand-600" aria-hidden />
                <span className="tabular-nums">{rangeLabel}</span>
              </button>
              <input
                ref={dateRef}
                type="date"
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                value={props.anchor}
                onChange={(e) => e.target.value && router.push(`${props.basePath}?che_do=${mode}&ngay=${e.target.value}${props.extraQuery}`)}
              />
            </div>
            <Link href={props.nextHref} className={ICON_BTN} aria-label="Khoảng sau" title="Khoảng sau">
              <ChevronRight size={18} aria-hidden />
            </Link>
          </div>

          <Link
            href={props.todayHref}
            aria-current={isCurrent ? "date" : undefined}
            className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors ${isCurrent ? "border-transparent bg-[rgb(var(--surface-muted))] text-muted" : "border-brand-400 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"}`}
          >
            {mode === "ngay" ? "Hôm nay" : "Tuần này"}
          </Link>

          <button type="button" className={ICON_BTN} onClick={() => router.refresh()} aria-label={`Làm mới dữ liệu. Cập nhật lúc ${formatTime(new Date(props.nowIso))}`} title={`Cập nhật lúc ${formatTime(new Date(props.nowIso))}. Bấm để làm mới`}>
              <RefreshCw size={15} aria-hidden />
            </button>

          <div className="flex w-full sm:ml-auto sm:w-auto flex-wrap items-center gap-1.5 text-sm">
            {mode !== "ky" && (
              <div role="group" aria-label="Tình hình" aria-live="polite" className="flex flex-wrap items-center gap-1.5">
                <span className={`inline-flex h-8 items-center gap-1.5 px-1.5 text-xs sm:h-9 sm:text-sm ${counts.live > 0 ? "font-medium text-lime-800 dark:text-lime-300" : "text-muted"}`}>
                  <span className={`h-2 w-2 rounded-full ${counts.live > 0 ? "animate-pulse bg-lime-600" : "bg-stone-400"}`} aria-hidden />
                  <strong className="tabular-nums">{counts.live}</strong> đang học
                </span>
                <span className="inline-flex h-8 items-center gap-1.5 px-1.5 text-xs text-muted sm:h-9 sm:text-sm">
                  <strong className="tabular-nums text-[rgb(var(--text))]">{counts.upcoming}</strong> sắp tới
                </span>
                <button
                  type="button"
                  aria-pressed={onlyFlagged}
                  onClick={() => setOnlyFlagged((v) => !v)}
                  title={onlyFlagged ? "Bỏ lọc, hiện lại mọi buổi" : "Chỉ hiện các buổi cần chú ý"}
                  className={`inline-flex h-8 items-center gap-2 rounded-full px-2.5 text-xs transition-colors sm:h-9 sm:px-3 sm:text-sm ${
                    onlyFlagged
                      ? "bg-amber-500 font-semibold text-white"
                      : counts.flagged > 0
                        ? "bg-amber-100 font-semibold text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100"
                        : "bg-[rgb(var(--surface-muted))] text-muted"
                  }`}
                >
                  <AlertTriangle size={14} aria-hidden />
                  <span className="tabular-nums">{counts.flagged}</span> cần chú ý
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-token pt-3">
          <div role="group" aria-label="Gom hàng theo" className="inline-flex items-center gap-2 text-sm">
            <span className="text-muted max-2xl:hidden">Nhóm theo</span>
            <div className={SEG}>
              {hangOptions.map(([v, label]) => (
                <button key={v} type="button" aria-pressed={hangValid === v} onClick={() => chooseHang(v)} className={segItem(hangValid === v)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="relative block min-w-0 flex-1 sm:w-44 sm:flex-none xl:w-52">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" className="input h-9 rounded-full py-0 pl-9" placeholder="Tìm lớp…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Tìm lớp theo tên" />
          </label>

          <div className="relative" ref={filterBox}>
            <button
              type="button"
              aria-expanded={filterOpen}
              aria-haspopup="dialog"
              onClick={() => setFilterOpen((v) => !v)}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors ${activeFilters > 0 ? "border-brand-400 bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200" : "border-token text-muted hover:bg-[rgb(var(--surface-muted))]"}`}
            >
              <SlidersHorizontal size={15} aria-hidden /> Bộ lọc
              {activeFilters > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-xs font-semibold text-white">{activeFilters}</span>}
            </button>
            {filterOpen && (
              <div role="dialog" aria-label="Bộ lọc và hiển thị" className="absolute left-0 top-11 z-30 w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-xl">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Giáo viên</span>
                  <select className="input h-9 py-0" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
                    <option value="">Mọi giáo viên</option>
                    {teacherOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {mode !== "ky" && (
                  <>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Lớp</span>
                      <select className="input h-9 py-0" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                        <option value="">Mọi lớp</option>
                        {classOptions.map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="space-y-1.5 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={hideCancelled} onChange={(e) => setHideCancelled(e.target.checked)} /> Ẩn buổi đã huỷ
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Chỉ buổi cần chú ý
                      </label>
                    </div>
                  </>
                )}
                <div className="border-t border-token pt-3 text-sm">
                  <span className="mb-1 block font-medium">Mật độ hiển thị</span>
                  <div role="group" aria-label="Mật độ" className={SEG}>
                    {([[false, "Đủ"], [true, "Gọn"]] as const).map(([v, label]) => (
                      <button key={label} type="button" aria-pressed={dense === v} onClick={() => setDenseChoice(v)} className={segItem(dense === v)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted">Gọn: mỗi buổi một dòng, hợp với giờ cao điểm có nhiều lớp song song.</p>
                </div>
                {activeFilters > 0 && (
                  <button type="button" className="text-sm font-medium text-brand-700 underline dark:text-brand-300" onClick={clearFilters}>
                    Xoá bộ lọc
                  </button>
                )}
              </div>
            )}
          </div>

          {mode === "ngay" && (
            <div role="group" aria-label="Nhảy tới giờ" className="ml-auto inline-flex items-center gap-1 text-sm max-lg:hidden">
              <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-token px-3 font-medium hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40" onClick={scrollToNow} disabled={nowX === null} title="Cuộn tới vạch bây giờ">
                <span className="h-2 w-2 rounded-full bg-pink-500" aria-hidden /> Bây giờ
              </button>
              {SESSIONS.filter(([, h]) => h >= axisStartHour && h < axisEndHour).map(([label, h]) => (
                <button key={label} type="button" className="inline-flex h-9 items-center rounded-full px-3 text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]" onClick={() => scrollToHour(h)}>
                  {label.replace("Buổi ", "")}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeFilters > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs" aria-label="Bộ lọc đang bật">
            {teacherFilter && <FilterChip label={`Giáo viên: ${teacherOptions.find(([id]) => id === teacherFilter)?.[1] ?? "…"}`} onRemove={() => setTeacherFilter("")} />}
            {classFilter && <FilterChip label={`Lớp: ${classOptions.find(([id]) => id === classFilter)?.[1] ?? "…"}`} onRemove={() => setClassFilter("")} />}
            {hideCancelled && <FilterChip label="Ẩn buổi đã huỷ" onRemove={() => setHideCancelled(false)} />}
            {onlyFlagged && <FilterChip label="Chỉ buổi cần chú ý" onRemove={() => setOnlyFlagged(false)} />}
            {flagFilter && <FilterChip label={`Chỉ buổi: ${flagFilter === "clash" ? "trùng phòng hoặc giáo viên" : (FLAG_LABEL[flagFilter as keyof typeof FLAG_LABEL] ?? flagFilter).toLowerCase()}`} onRemove={() => setFlagFilter("")} />}
            <button type="button" className="px-1 text-muted underline hover:text-[rgb(var(--text))]" onClick={clearFilters}>
              Xoá hết
            </button>
          </div>
        )}
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-token p-8 text-center text-sm text-muted">
          {mode === "ky" ? "Chưa có lớp nào có lịch trong khoảng này." : "Chưa có buổi nào trong khoảng này."}
        </div>
      ) : (
        <>
          {/* Điện thoại, mức Ngày: danh sách dọc theo giờ (M4.2) */}
          {mode === "ngay" && (
            <ol className="space-y-2 lg:hidden" aria-label="Các buổi trong ngày">
              {[...filtered].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => setSelected(rawOf(m.id))} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${STATE_STYLE[m.state]}`}>
                    <span className="flex items-center gap-1.5 font-semibold">
                      <StateIcon state={m.state} />
                      {formatTime(m.startsAt)}–{formatTime(m.endsAt)} · {m.sectionName}
                      {m.flags.length > 0 && <AlertTriangle className="ml-auto h-4 w-4 text-amber-600" aria-label={`${m.flags.length} cần chú ý`} />}
                    </span>
                    <span className="block text-xs opacity-80">{m.teacher?.name ?? "Chưa có giáo viên"} · {m.room?.trim() || "Chưa xếp phòng"} · {STATE_LABEL[m.state]}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}

          <div ref={scroller} className={`overflow-x-auto rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card ${mode === "ngay" ? "max-lg:hidden" : ""}`}>
            <div style={{ minWidth: 144 + trackMinPx }}>
              {header}
              {parallelStrip}
              {mode === "tuan" &&
                meetingRows.map((row) => (
                  <div key={row.key} className="flex border-b border-token last:border-b-0" data-testid="board-row">
                    <div className={`sticky left-0 z-20 w-36 shrink-0 border-r border-token px-3 py-2 text-sm font-medium ${row.pinned ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "bg-[rgb(var(--surface))]"}`}>
                      <span className="line-clamp-2">{row.label}</span>
                      <span className="block text-[11px] font-normal text-muted">{row.items.length} buổi</span>
                    </div>
                    <div data-track className="relative grid flex-1" style={{ minWidth: trackMinPx, gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
                      {axis.segments.map((seg, i) => {
                        const cell = row.items.filter((m) => vnDayKey(m.startsAt) === seg.dayKey).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
                        return (
                          <div key={seg.dayKey} className={`min-h-[3.5rem] space-y-1 p-1 ${i > 0 ? "border-l border-token" : ""} ${seg.dayKey === vnDayKey(now) ? "bg-brand-50 dark:bg-brand-950/30" : ""} ${row.pinned ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
                            {cell.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setSelected(rawOf(m.id))}
                                data-state={m.state}
                                title={`${m.sectionName}${m.seq ? ` · buổi ${m.seq}` : ""} · ${STATE_LABEL[m.state]}${m.flags.length ? " · " + m.flags.map((f) => FLAG_LABEL[f]).join(", ") : ""}`}
                                className={`block w-full overflow-hidden rounded-lg border px-1.5 py-0.5 text-left text-[11px] leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${STATE_STYLE[m.state]}`}
                              >
                                <span className="flex items-center gap-1 font-semibold">
                                  <StateIcon state={m.state} />
                                  <span className="sr-only">{STATE_LABEL[m.state]}. </span>
                                  <span className="tabular-nums">{formatTime(m.startsAt)}–{formatTime(m.endsAt)}</span>
                                  {m.flags.length > 0 && <AlertTriangle className="ml-auto h-3 w-3 shrink-0 text-amber-600" aria-label={m.flags.map((f) => FLAG_LABEL[f]).join(", ")} />}
                                </span>
                                <span className={`block truncate ${dense ? "hidden" : ""}`}>{m.sectionName}{m.seq ? ` · B${m.seq}` : ""}</span>
                                {dense && <span className="block truncate">{m.sectionName}</span>}
                                <span className={`block truncate opacity-80 ${dense ? "hidden" : ""}`}>{hangValid === "giao-vien" ? m.room?.trim() || "—" : hangValid === "trinh-do" ? `${m.teacher?.name ?? "Chưa có GV"}${m.room?.trim() ? ` · ${m.room.trim()}` : ""}` : m.teacher?.name ?? "Chưa có GV"}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                      {nowX !== null && <span className="pointer-events-none absolute inset-y-0 z-10 w-px bg-pink-500/70" style={{ left: `${nowX}%` }} />}
                    </div>
                  </div>
                ))}

              {mode === "ngay" &&
                meetingRows.map((row) => (
                  <div key={row.key} className="flex border-b border-token last:border-b-0" data-testid="board-row">
                    <div className={`sticky left-0 z-20 w-36 shrink-0 border-r border-token px-3 py-2 text-sm font-medium ${row.pinned ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "bg-[rgb(var(--surface))]"}`}>
                      <span className="line-clamp-2">{row.label}</span>
                      <span className="block text-[11px] font-normal text-muted">{row.items.length} buổi</span>
                    </div>
                    {renderTrack(
                      row.items.map((m) => {
                        const span = blockSpan(axis, m.startsAt, m.endsAt);
                        if (!span) return null;
                        const elapsed = m.state === "live" ? Math.min(100, Math.max(0, ((now.getTime() - m.startsAt.getTime()) / (m.endsAt.getTime() - m.startsAt.getTime())) * 100)) : 0;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelected(rawOf(m.id))}
                            title={`${m.sectionName}${m.seq ? ` · buổi ${m.seq}` : ""} · ${formatTime(m.startsAt)}–${formatTime(m.endsAt)} · ${STATE_LABEL[m.state]}${m.flags.length ? " · " + m.flags.map((f) => FLAG_LABEL[f]).join(", ") : ""}`}
                            className={`absolute overflow-hidden rounded-lg border px-1.5 py-0.5 text-left text-[11px] leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${STATE_STYLE[m.state]}`}
                            style={{ left: `${span.left}%`, width: `${span.width}%`, top: m.lane * laneH + 3, height: laneH - 5 }}
                            data-state={m.state}
                          >
                            {m.state === "live" && <span className="absolute inset-y-0 left-0 bg-lime-600/30" style={{ width: `${elapsed}%` }} aria-hidden />}
                            <span className="relative flex items-center gap-1 font-semibold">
                              <StateIcon state={m.state} />
                              <span className="sr-only">{STATE_LABEL[m.state]}. </span>
                              <span className="truncate">{m.sectionName}{m.seq ? ` · B${m.seq}` : ""}</span>
                              {dense && <span className="ml-1 hidden shrink-0 font-normal opacity-75 sm:inline">{formatTime(m.startsAt)}</span>}
                              {m.flags.length > 0 && <AlertTriangle className="ml-auto h-3 w-3 shrink-0 text-amber-600" aria-label={m.flags.map((f) => FLAG_LABEL[f]).join(", ")} />}
                            </span>
                            <span className={`relative block truncate opacity-80 ${dense ? "hidden" : ""}`}>
                              {formatTime(m.startsAt)}–{formatTime(m.endsAt)} · {hangValid === "giao-vien" ? m.room?.trim() || "—" : hangValid === "trinh-do" ? `${m.teacher?.name ?? "Chưa có GV"}${m.room?.trim() ? ` · ${m.room.trim()}` : ""}` : m.teacher?.name ?? "Chưa có GV"}
                            </span>
                          </button>
                        );
                      }),
                      row.laneCount,
                      row.pinned,
                    )}
                  </div>
                ))}

              {mode === "ky" &&
                classRows.map((row) => (
                  <div key={row.key} className="flex border-b border-token last:border-b-0" data-testid="board-row">
                    <div className="sticky left-0 z-20 w-36 shrink-0 border-r border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium">
                      <span className="line-clamp-2">{row.label}</span>
                      <span className="block text-[11px] font-normal text-muted">{row.items.length} lớp</span>
                    </div>
                    {renderTrack(
                      row.items.map((c) => {
                        const span = blockSpan(axis, c.startsAt, c.endsAt);
                        if (!span) return null;
                        const pct = c.lifecycle.total ? (c.lifecycle.held / c.lifecycle.total) * 100 : 0;
                        const st = c.lifecycle.status;
                        return (
                          <button
                            key={c.sectionId}
                            type="button"
                            onClick={() => setSelectedClass(c)}
                            title={`${c.name} · ${formatDayKey(vnDayKey(new Date(c.lifecycle.start!)))} – ${formatDayKey(vnDayKey(new Date(c.lifecycle.end!)))} · đã dạy ${c.lifecycle.held}/${c.lifecycle.total}`}
                            className={`absolute overflow-hidden rounded-lg border px-1.5 py-0.5 text-left text-[11px] leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${st === "finished" ? STATE_STYLE.held : st === "planned" ? "border-dashed border-sky-400 bg-sky-50 text-sky-950 dark:bg-sky-900/30 dark:text-sky-100" : STATE_STYLE.live}`}
                            style={{ left: `${span.left}%`, width: `${span.width}%`, top: c.lane * laneH + 3, height: laneH - 5 }}
                          >
                            <span className="absolute inset-y-0 left-0 bg-black/10 dark:bg-white/10" style={{ width: `${pct}%` }} aria-hidden />
                            <span className="relative block truncate font-semibold">{c.name}</span>
                            <span className="relative block truncate opacity-80">
                              Đã dạy {c.lifecycle.held}/{c.lifecycle.total} · {c.teacher?.name ?? "Chưa có GV"}
                            </span>
                          </button>
                        );
                      }),
                      row.laneCount,
                      row.pinned,
                    )}
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {mode === "ky" && unscheduled.length > 0 && (
        <section className="rounded-2xl border border-token p-4">
          <h2 className="text-sm font-semibold">Chưa đặt lịch ({unscheduled.length})</h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {unscheduled.map((c) => (
              <li key={c.sectionId}>
                {c.canManage ? (
                  <Link href={`/instructor/courses/${c.courseId}/sections/${c.sectionId}`} className="btn-pill">
                    {c.name} · Đặt lịch
                  </Link>
                ) : (
                  <span className="btn-pill cursor-default opacity-70">{c.name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Chú giải màu (có chữ kèm theo, không chỉ dựa vào màu) */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Chú giải">
        {(["live", "upcoming", "held", "overdue", "cancelled"] as const).map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-5 rounded border ${STATE_STYLE[s]}`} aria-hidden /> {STATE_LABEL[s]}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-px bg-pink-500" aria-hidden /> Bây giờ</li>
        <li className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-amber-600" aria-hidden /> Cần chú ý</li>
      </ul>

      {(selected || selectedClass) && (
        <div className="fixed inset-0 z-40" role="presentation">
          <button type="button" aria-label="Đóng chi tiết" className="absolute inset-0 bg-black/30" onClick={() => { setSelected(null); setSelectedClass(null); }} />
          <aside role="dialog" aria-label="Chi tiết" className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-xl lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-96 lg:rounded-none lg:rounded-l-2xl">
            <button type="button" onClick={() => { setSelected(null); setSelectedClass(null); }} className="absolute right-3 top-3 rounded-full p-1 hover:bg-[rgb(var(--surface-muted))]" aria-label="Đóng">
              <X size={18} />
            </button>
            {selected && <MeetingDetail m={selected} />}
            {selectedClass && <ClassDetail c={selectedClass} />}
          </aside>
        </div>
      )}
      <p className="text-xs text-muted">Trường {props.orgName}. Giờ theo múi giờ Việt Nam.</p>
    </div>
  );
}

function MeetingDetail({ m }: { m: BoardMeeting }) {
  const base = `/instructor/courses/${m.courseId}/sections/${m.sectionId}`;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted">{m.courseTitle}</p>
        <h2 className="text-lg font-bold">{m.sectionName}{m.seq ? ` · buổi ${m.seq}` : ""}</h2>
        <p className="text-sm">{STATE_LABEL[m.state]}</p>
      </div>
      <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
        <dt className="text-muted">Giờ</dt>
        <dd>{formatDayKey(vnDayKey(new Date(m.startsAt)))} · {formatTime(m.startsAt)}–{formatTime(m.endsAt)}</dd>
        <dt className="text-muted">Phòng</dt>
        <dd>{m.room?.trim() || "Chưa xếp phòng"}</dd>
        <dt className="text-muted">Giáo viên</dt>
        <dd>{m.teacher?.name ?? "Chưa có giáo viên"}</dd>
        {m.actualTeacher && (
          <>
            <dt className="text-muted">Bắt đầu buổi</dt>
            <dd>{m.actualTeacher.name}{m.actualTeacher.id !== m.teacher?.id ? " (dạy thay)" : ""}</dd>
          </>
        )}
      </dl>
      {m.flags.length > 0 && (
        <ul className="space-y-1" aria-label="Cần chú ý">
          {m.flags.map((f) => (
            <li key={f} className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {FLAG_LABEL[f]}
            </li>
          ))}
        </ul>
      )}
      {m.canManage ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={`${base}/meetings/${m.id}`} className="btn-primary btn-sm">
            Mở buổi (điểm danh, huỷ, đổi giờ)
          </Link>
          <Link href={base} className="btn-pill" title="Danh sách học viên, chuyên cần và lịch dạy của cả lớp">
            Xem cả lớp
          </Link>
        </div>
      ) : (
        <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600 dark:bg-stone-800/60 dark:text-stone-300">
          Thầy/cô chỉ xem được buổi này. Điểm danh, huỷ và đổi giờ do chủ khoá hoặc đồng giảng viên của khoá thực hiện.
        </p>
      )}
    </div>
  );
}

function ClassDetail({ c }: { c: BoardClass }) {
  const lc = c.lifecycle;
  const label = lc.status === "finished" ? "Đã kết thúc" : lc.status === "planned" ? "Chưa bắt đầu" : "Đang chạy";
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted">{c.courseTitle}</p>
        <h2 className="text-lg font-bold">{c.name}</h2>
        <p className="text-sm">{label}</p>
      </div>
      <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
        <dt className="text-muted">Thời gian</dt>
        <dd>{lc.start && lc.end ? `${formatDayKey(vnDayKey(new Date(lc.start)))} – ${formatDayKey(vnDayKey(new Date(lc.end)))}` : "—"}</dd>
        <dt className="text-muted">Tiến độ</dt>
        <dd>Đã dạy {lc.held}/{lc.total} buổi</dd>
        <dt className="text-muted">Giáo viên</dt>
        <dd>{c.teacher?.name ?? "Chưa có giáo viên phụ trách"}</dd>
        <dt className="text-muted">Sĩ số</dt>
        <dd>{c.enrolled} học viên</dd>
        <dt className="text-muted">Buổi tới</dt>
        <dd>{c.nextMeetingAt ? `${formatDayKey(vnDayKey(new Date(c.nextMeetingAt)))} · ${formatTime(c.nextMeetingAt)}` : "Không còn buổi nào"}</dd>
      </dl>
      {c.canManage ? (
        <Link href={`/instructor/courses/${c.courseId}/sections/${c.sectionId}`} className="btn-primary btn-sm inline-block">
          Xem cả lớp
        </Link>
      ) : (
        <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600 dark:bg-stone-800/60 dark:text-stone-300">Trang lớp do chủ khoá hoặc đồng giảng viên của khoá quản lý.</p>
      )}
    </div>
  );
}
