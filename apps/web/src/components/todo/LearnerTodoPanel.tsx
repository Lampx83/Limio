"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { daysBetweenKeys } from "@feedbackme/shared-types";
import {
  TODO_AUTO_HIDE_AFTER_DAYS,
  TODO_URGENT_DAYS,
  buildTodoPlan,
  describeDue,
  isAutoHidden,
  paginate,
  type TodoItem,
} from "@/lib/learnerTodoPlan";

const PAGE_SIZE = 8;
const NO_DUE_PREVIEW = 3;

type Tone = "overdue" | "urgent" | "later" | "none";

function toneOf(item: TodoItem, todayKey: string): Tone {
  if (item.dueDay === null) return "none";
  if (item.overdue) return "overdue";
  return daysBetweenKeys(todayKey, item.dueDay) <= TODO_URGENT_DAYS ? "urgent" : "later";
}

const TONE: Record<Tone, { bar: string; chip: string }> = {
  overdue: { bar: "bg-danger-500", chip: "chip-danger" },
  urgent: { bar: "bg-accent-500", chip: "chip-accent" },
  later: { bar: "bg-brand-500", chip: "chip-brand" },
  none: { bar: "bg-slate-300", chip: "chip" },
};

/**
 * Khu "Việc cần làm" của học viên: top 5 việc có hạn (gần hạn nhất trước), số liệu tổng quan,
 * khu riêng cho việc không có hạn, mở rộng xem đủ có phân trang. Việc quá hạn hơn 1 tuần tự rời
 * khỏi top (không có nút ẩn thủ công) nhưng vẫn xem được ở danh sách đầy đủ.
 */
export default function LearnerTodoPanel({
  todayKey,
  items,
}: {
  todayKey: string;
  items: TodoItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);

  const plan = useMemo(() => buildTodoPlan(items, todayKey), [items, todayKey]);
  const { stats } = plan;
  const paged = paginate(plan.all, page, PAGE_SIZE);

  const tiles: Array<{ label: string; value: number; cls: string }> = [
    { label: "Quá hạn", value: stats.overdue, cls: stats.overdue > 0 ? "text-danger-600" : "text-faint" },
    { label: `≤ ${TODO_URGENT_DAYS} ngày`, value: stats.urgent, cls: stats.urgent > 0 ? "text-accent-600" : "text-faint" },
    { label: "Còn hạn", value: stats.later, cls: stats.later > 0 ? "text-brand-600" : "text-faint" },
    { label: "Không hạn", value: stats.noDue, cls: "text-muted" },
  ];

  return (
    <section className="card" aria-label="Việc cần làm">
      <header className="flex items-baseline justify-between border-b border-token pb-3">
        <h2 className="text-base font-semibold">Việc cần làm</h2>
        <span className="text-xs text-faint">{stats.total} chưa nộp</span>
      </header>

      {stats.total === 0 ? (
        <p className="mt-4 text-sm text-muted">Bạn đã hoàn thành hết bài tập và quiz. 🎉</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-4 gap-2">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-lg bg-[rgb(var(--surface-muted))] px-2 py-1.5 text-center">
                <dd className={`text-lg font-bold leading-none tabular-nums ${t.cls}`}>{t.value}</dd>
                <dt className="mt-1 text-[10px] leading-tight text-muted">{t.label}</dt>
              </div>
            ))}
          </dl>

          {!expanded ? (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">
                Ưu tiên · hạn gần nhất
              </h3>
              {plan.top.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Không có việc có hạn nào cần làm ngay.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {plan.top.map((i) => (
                    <Row key={i.id} item={i} todayKey={todayKey} />
                  ))}
                </ul>
              )}
              {stats.autoHidden > 0 && (
                <p className="mt-2 text-xs text-muted">
                  {stats.autoHidden} việc quá hạn trên {TODO_AUTO_HIDE_AFTER_DAYS / 7} tuần đã tự ẩn khỏi danh sách ưu
                  tiên.
                </p>
              )}

              {plan.noDue.length > 0 && (
                <>
                  <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">
                    Không có thời hạn · {plan.noDue.length}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {plan.noDue.slice(0, NO_DUE_PREVIEW).map((i) => (
                      <Row key={i.id} item={i} todayKey={todayKey} />
                    ))}
                  </ul>
                  {plan.noDue.length > NO_DUE_PREVIEW && (
                    <p className="mt-1.5 text-xs text-muted">+{plan.noDue.length - NO_DUE_PREVIEW} việc nữa</p>
                  )}
                </>
              )}

              {(stats.total > plan.top.length + Math.min(plan.noDue.length, NO_DUE_PREVIEW) || stats.autoHidden > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(true);
                    setPage(1);
                  }}
                  className="btn-secondary btn-sm mt-3 w-full"
                >
                  Xem tất cả ({stats.total})
                </button>
              )}
            </>
          ) : (
            <>
              <div className="mt-4 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Tất cả · {stats.total}</h3>
                <button type="button" onClick={() => setExpanded(false)} className="link text-xs">
                  Thu gọn
                </button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {paged.rows.map((i) => (
                  <Row key={i.id} item={i} todayKey={todayKey} dimmed={isAutoHidden(i, todayKey)} />
                ))}
              </ul>
              {paged.pages > 1 && (
                <nav className="mt-3 flex items-center justify-between gap-2" aria-label="Phân trang">
                  <button
                    type="button"
                    onClick={() => setPage(paged.page - 1)}
                    disabled={paged.page <= 1}
                    className="btn-secondary btn-sm gap-0.5 pl-1.5 pr-2.5 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Trước
                  </button>
                  <span className="text-xs tabular-nums text-muted">
                    Trang {paged.page}/{paged.pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(paged.page + 1)}
                    disabled={paged.page >= paged.pages}
                    className="btn-secondary btn-sm gap-0.5 pl-2.5 pr-1.5 disabled:opacity-40"
                  >
                    Sau
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Row({
  item,
  todayKey,
  dimmed,
}: {
  item: TodoItem;
  todayKey: string;
  /** Việc đã tự ẩn khỏi top (quá hạn > 1 tuần): vẫn liệt kê nhưng mờ đi. */
  dimmed?: boolean;
}) {
  const tone = TONE[toneOf(item, todayKey)];
  return (
    <li className={`flex items-stretch gap-1.5 ${dimmed ? "opacity-55" : ""}`}>
      <Link
        href={item.href}
        prefetch={false}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] px-2 py-1.5 transition-colors hover:border-brand-300"
      >
        <span className={`w-0.5 shrink-0 self-stretch rounded-full ${tone.bar}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-snug">{item.title}</span>
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted">
            <span className="font-semibold text-brand-700">{item.kind === "quiz" ? "Quiz" : "Bài tập"}</span>{" "}
            {/* Tên môn học (= khoá học) dạng chip */}
            <span className="chip-brand max-w-full truncate text-[10px]" title={item.courseTitle}>
              {item.courseTitle}
            </span>
            {item.inProgress && <span>Đang làm</span>}
          </span>
        </span>
        <span className={`${tone.chip} shrink-0 text-[10px]`}>{describeDue(item, todayKey)}</span>
      </Link>
    </li>
  );
}
