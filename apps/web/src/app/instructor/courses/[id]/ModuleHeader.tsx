"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Pencil, Trash2, Lock, LockOpen } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

export default function ModuleHeader({
  moduleId,
  title,
  order,
  orderIndex,
  isHidden: initialIsHidden,
  isLocked: initialIsLocked,
  lessonCount,
}: {
  moduleId: string;
  title: string;
  order: number;
  orderIndex: number;
  isHidden: boolean;
  isLocked: boolean;
  lessonCount?: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(title);
  const [oi, setOi] = useState(orderIndex);
  const [isHidden, setIsHidden] = useState(initialIsHidden);
  const [isLocked, setIsLocked] = useState(initialIsLocked);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(apiUrl(`/api/modules/${moduleId}`), {
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
    await fetch(apiUrl(`/api/modules/${moduleId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: next }),
    });
    router.refresh();
  }

  async function toggleLocked() {
    const next = !isLocked;
    setIsLocked(next);
    await fetch(apiUrl(`/api/modules/${moduleId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: next }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Xóa module "${title}"? Cascade delete tất cả lesson + content + quiz bên trong.`))
      return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/modules/${moduleId}`), { method: "DELETE" });
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
    <div className="group flex items-center justify-between gap-3 py-2 pr-3">
      <h3 className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
            isHidden ? "bg-danger-50 text-danger-700" : "bg-brand-soft text-brand-700"
          }`}
        >
          {order}
        </span>
        <span className="truncate text-base font-semibold">{title}</span>
        {isHidden && <span className="chip-danger shrink-0 text-xs">Đang ẩn</span>}
        {typeof lessonCount === "number" && (
          <span className="shrink-0 text-xs font-normal text-muted">{lessonCount} bài</span>
        )}
      </h3>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100">
        <button
          type="button"
          onClick={toggleHidden}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            isHidden
              ? "bg-danger-50 text-danger-600 hover:bg-danger-100"
              : "text-faint hover:bg-brand-soft hover:text-brand-600"
          }`}
          title={isHidden ? "Đang ẩn — bấm để hiện" : "Đang hiện — bấm để ẩn"}
          aria-label={isHidden ? "Hiện module" : "Ẩn module"}
          aria-pressed={isHidden}
        >
          {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={toggleLocked}
          disabled={isHidden}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
            isLocked
              ? "bg-accent-50 text-accent-700 hover:bg-accent-100"
              : "text-faint hover:bg-brand-soft hover:text-brand-600"
          }`}
          title={
            isHidden
              ? "Module đang ẩn — học viên không thấy gì, nên khoá không còn ý nghĩa"
              : isLocked
                ? "Đang khoá — học viên thấy tên bài kèm ổ khoá nhưng không mở được. Bấm để mở"
                : "Đang mở — bấm để khoá (học viên vẫn thấy tên bài, nhưng không xem được nội dung)"
          }
          aria-label={isLocked ? "Mở khoá module" : "Khoá module"}
          aria-pressed={isLocked}
        >
          {isLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-brand-soft hover:text-brand-600"
          title="Sửa module"
          aria-label="Sửa"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          title="Xóa module"
          aria-label="Xóa"
          className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
