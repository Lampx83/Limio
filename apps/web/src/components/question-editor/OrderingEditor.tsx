"use client";

import type { OrderingDraft, OrderingItem } from "./types";

let seq = 0;
function newId(): string {
  seq += 1;
  return `oi${Date.now().toString(36)}${seq}`;
}

/**
 * Đợt 6 — editor DÙNG CHUNG cho loại "Sắp xếp thứ tự" (canonical
 * OrderingDraft: { items: [{id,label}] }). Thứ tự phần tử trong mảng CHÍNH
 * LÀ thứ tự đúng (khớp comment ở packages/core-lms/src/exam/schemas.ts
 * OrderingConfig) — không có field "đúng thứ tự" riêng.
 */
export default function OrderingEditor({
  value,
  onChange,
}: {
  value: OrderingDraft;
  onChange: (next: OrderingDraft) => void;
}) {
  const items = value.items;

  function setLabel(i: number, label: string) {
    onChange({ items: items.map((it, idx) => (idx === i ? { ...it, label } : it)) });
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange({ items: next });
  }
  function add() {
    onChange({ items: [...items, { id: newId(), label: "" }] });
  }
  function remove(i: number) {
    onChange({ items: items.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-600">
        Các bước theo đúng thứ tự ({items.length})
      </div>
      <p className="-mt-1 mb-1 text-xs text-faint">
        Thứ tự bạn nhập ở đây = thứ tự đúng. Học viên nhìn thấy các bước bị xáo trộn.
      </p>
      <ul className="space-y-1.5">
        {items.map((it: OrderingItem, i) => (
          <li key={it.id} className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
              {i + 1}
            </span>
            <input
              type="text"
              value={it.label}
              onChange={(e) => setLabel(i, e.target.value)}
              placeholder={`Bước ${i + 1}`}
              className="flex-1 rounded border border-default px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="Lên"
              className="flex h-7 w-7 items-center justify-center rounded border border-default text-xs disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === items.length - 1}
              aria-label="Xuống"
              className="flex h-7 w-7 items-center justify-center rounded border border-default text-xs disabled:opacity-30"
            >
              ↓
            </button>
            {items.length > 2 && (
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Xoá"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-danger-100 text-xs text-danger-600 hover:bg-danger-50"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={add} className="link mt-1 text-xs">
        + Thêm bước
      </button>
    </div>
  );
}
