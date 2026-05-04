"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ModuleHeader({
  moduleId,
  title,
  order,
  orderIndex,
  isHidden: initialIsHidden,
}: {
  moduleId: string;
  title: string;
  order: number;
  orderIndex: number;
  isHidden: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(title);
  const [oi, setOi] = useState(orderIndex);
  const [isHidden, setIsHidden] = useState(initialIsHidden);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/modules/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, orderIndex: oi }),
    });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function toggleHidden() {
    const next = !isHidden;
    setIsHidden(next);
    await fetch(`/api/modules/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: next }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Xóa module "${title}"? Cascade delete tất cả lesson + content + quiz bên trong.`))
      return;
    setBusy(true);
    const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-end gap-2 p-4">
        <label className="block flex-1">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            Tên module
          </span>
          <input
            value={t}
            onChange={(e) => setT(e.target.value)}
            required
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            Order
          </span>
          <input
            type="number"
            min={0}
            value={oi}
            onChange={(e) => setOi(Number(e.target.value))}
            className="input mt-1 w-20"
          />
        </label>
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          Lưu
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="btn-secondary btn-sm"
        >
          Hủy
        </button>
      </form>
    );
  }

  return (
    <div className="group flex items-center justify-between gap-3 p-4">
      <h3 className="flex items-baseline gap-3">
        <span className="rounded-md bg-brand-soft px-2 py-0.5 text-sm font-bold text-brand-700">
          Module {order}
        </span>
        <span className="text-lg font-bold">{title}</span>
      </h3>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer" title={isHidden ? "Module bị ẩn khỏi học viên" : "Module hiển thị với học viên"}>
          <input
            type="checkbox"
            checked={isHidden}
            onChange={toggleHidden}
            className="w-5 h-5 rounded border-token cursor-pointer accent-brand-600"
          />
          <span className="text-xs font-medium text-muted">Ẩn</span>
        </label>
        <button
          onClick={() => setEditing(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-faint opacity-0 transition-all hover:bg-brand-soft hover:text-brand-600 group-hover:opacity-100"
          title="Sửa module"
          aria-label="Sửa"
        >
          ✎
        </button>
        <button
          onClick={remove}
          disabled={busy}
          title="Xóa module"
          aria-label="Xóa"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-faint opacity-0 transition-all hover:bg-danger-50 hover:text-danger-600 group-hover:opacity-100 disabled:opacity-50"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
