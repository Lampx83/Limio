"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export default function LessonHeader({
  lessonId,
  title,
  description,
  orderIndex,
  previewable: initialPreviewable,
  isHidden: initialIsHidden,
}: {
  lessonId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  previewable: boolean;
  isHidden: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(title);
  const [d, setD] = useState(description ?? "");
  const [oi, setOi] = useState(orderIndex);
  const [previewable, setPreviewable] = useState(initialPreviewable);
  const [isHidden, setIsHidden] = useState(initialIsHidden);
  const [busy, setBusy] = useState(false);

  async function togglePreviewable() {
    const next = !previewable;
    setPreviewable(next);
    await fetch(apiUrl(`/api/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previewable: next }),
    });
    router.refresh();
  }

  async function toggleHidden() {
    const next = !isHidden;
    setIsHidden(next);
    await fetch(apiUrl(`/api/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: next }),
    });
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        description: d.trim() === "" ? null : d,
        orderIndex: oi,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm(`Xóa lesson "${title}"? Cascade content + quiz + skill tags + notes.`)) return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <form onSubmit={save} className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block flex-1">
            <span className="text-xs font-medium uppercase tracking-wide text-faint">
              Title
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
        </div>
        <textarea
          value={d}
          onChange={(e) => setD(e.target.value)}
          rows={2}
          placeholder="Mô tả ngắn"
          className="textarea"
        />
        <div className="flex gap-2">
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
        </div>
      </form>
    );
  }

  return (
    <div className="group/lh flex items-start justify-between gap-3">
      <div className="flex-1">
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer" title={isHidden ? "Bài học bị ẩn khỏi học viên" : "Bài học hiển thị với học viên"}>
          <input
            type="checkbox"
            checked={isHidden}
            onChange={toggleHidden}
            className="w-5 h-5 rounded border-token cursor-pointer accent-danger-600"
          />
          <span className="text-xs font-medium text-muted">Ẩn</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer" title={previewable ? "Học viên chưa mua có thể xem preview bài này" : "Chỉ học viên đã mua/đăng ký mới có thể xem"}>
          <input
            type="checkbox"
            checked={previewable}
            onChange={togglePreviewable}
            className="w-5 h-5 rounded border-token cursor-pointer accent-brand-600"
          />
          <span className="text-xs font-medium text-muted">Preview</span>
        </label>
        <button
          onClick={() => setEditing(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-faint opacity-0 transition-all hover:bg-brand-soft hover:text-brand-600 group-hover/lh:opacity-100"
          title="Sửa lesson"
          aria-label="Sửa"
        >
          ✎
        </button>
        <button
          onClick={remove}
          disabled={busy}
          title="Xóa lesson"
          aria-label="Xóa"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-faint opacity-0 transition-all hover:bg-danger-50 hover:text-danger-600 group-hover/lh:opacity-100 disabled:opacity-50"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
