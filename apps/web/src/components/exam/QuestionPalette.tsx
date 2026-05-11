"use client";

import { useState } from "react";

interface Item {
  questionId: string;
  /** Display number (1-based) as shown in the runtime UI. */
  displayNumber: number;
  /** "passage:<id>" or "standalone" grouping label. */
  group: string;
  groupLabel: string;
  answered: boolean;
  active: boolean;
}

interface Props {
  items: Item[];
  onJump: (questionId: string) => void;
}

/**
 * Compact navigation. Green chip = answered, gray = empty, blue ring = current.
 * On screens below `lg` the chip grid collapses behind a toggle button so the
 * sticky header doesn't take half the viewport.
 */
export default function QuestionPalette({ items, onJump }: Props) {
  const answered = items.filter((i) => i.answered).length;
  const [openMobile, setOpenMobile] = useState(false);
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const arr = groups.get(it.group) ?? [];
    arr.push(it);
    groups.set(it.group, arr);
  }

  const grid = (
    <div className="space-y-2">
      {[...groups.entries()].map(([group, list]) => (
        <div key={group} className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 min-w-[5rem] text-xs text-faint">
            {list[0]!.groupLabel}
          </span>
          {list.map((it) => (
            <button
              key={it.questionId}
              type="button"
              onClick={() => {
                onJump(it.questionId);
                setOpenMobile(false);
              }}
              aria-label={`Câu ${it.displayNumber}${it.answered ? " — đã trả lời" : " — chưa trả lời"}`}
              className={[
                "flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors",
                it.answered
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                  : "bg-slate-100 text-slate-600",
                it.active ? "ring-2 ring-blue-500" : "",
              ].join(" ")}
            >
              {it.displayNumber}
            </button>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="rounded border border-default bg-white p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Tiến độ làm bài</span>
        <div className="flex items-center gap-2">
          <span className="text-faint">
            <span className="font-semibold text-emerald-700">{answered}</span>
            {" / "}
            {items.length} câu đã trả lời
          </span>
          <button
            type="button"
            onClick={() => setOpenMobile((o) => !o)}
            className="rounded border border-default px-2 py-0.5 text-[11px] lg:hidden"
            aria-expanded={openMobile}
            aria-controls="palette-grid"
          >
            {openMobile ? "Ẩn ▴" : "Câu hỏi ▾"}
          </button>
        </div>
      </div>
      {/* Desktop: always visible. Mobile: gated by openMobile. */}
      <div
        id="palette-grid"
        className={`mt-2 ${openMobile ? "block" : "hidden"} lg:block`}
      >
        {grid}
        <div className="mt-2 flex gap-3 text-[10px] text-faint">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-300" />{" "}
            Đã trả lời
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-slate-100" /> Chưa
            trả lời
          </span>
        </div>
      </div>
    </div>
  );
}
