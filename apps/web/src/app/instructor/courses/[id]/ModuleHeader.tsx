"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ModuleHeader({
  moduleId,
  title,
  order,
  orderIndex,
}: {
  moduleId: string;
  title: string;
  order: number;
  orderIndex: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(title);
  const [oi, setOi] = useState(orderIndex);
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
      <form onSubmit={save} className="flex items-end gap-2 p-4">
        <label className="flex-1 block">
          <span className="text-xs font-medium uppercase text-slate-500">Tên module</span>
          <input
            value={t}
            onChange={(e) => setT(e.target.value)}
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase text-slate-500">Order</span>
          <input
            type="number"
            min={0}
            value={oi}
            onChange={(e) => setOi(Number(e.target.value))}
            className="mt-1 w-20 rounded border border-slate-300 px-2 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          Lưu
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
        >
          Hủy
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <h3 className="text-base font-semibold">
        Module {order}: {title}
      </h3>
      <div className="flex gap-1">
        <button
          onClick={() => setEditing(true)}
          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          Sửa
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Xóa
        </button>
      </div>
    </div>
  );
}
