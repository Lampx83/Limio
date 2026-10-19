"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export interface CollectionRow {
  id: string;
  title: string;
  examCount: number;
}

/**
 * LANG L6.7 — bộ / Part / chủ đề: tạo, đổi tên, đổi thứ tự (lên/xuống), xoá. Xoá bộ KHÔNG xoá đề — đề về
 * "chưa thuộc bộ nào".
 */
export default function CollectionsPanel({
  courseId,
  collections,
  onChanged,
}: {
  courseId: string;
  collections: CollectionRow[];
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(url), { ...init, headers: { "content-type": "application/json" } });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error === "validation_failed" ? "Tên bộ không hợp lệ (1–200 ký tự)." : "Không lưu được. Vui lòng thử lại.");
        return false;
      }
      onChanged();
      return true;
    } finally {
      setBusy(false);
    }
  }

  const move = (i: number, d: -1 | 1) => {
    const ids = collections.map((c) => c.id);
    [ids[i], ids[i + d]] = [ids[i + d]!, ids[i]!];
    void call(`/api/courses/${courseId}/exam-collections/reorder`, { method: "POST", body: JSON.stringify({ orderedIds: ids }) });
  };

  return (
    <section className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4" aria-label="Quản lý bộ đề" data-testid="collections-panel">
      <h2 className="text-h3">Bộ / Part / chủ đề</h2>
      <p className="text-meta mt-1">Thư mục để học viên chọn luyện theo Part. Xoá bộ không xoá đề — đề về “Khác”.</p>
      <ul className="mt-3 space-y-1.5">
        {collections.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
            <input
              aria-label={`Tên bộ ${i + 1}`}
              defaultValue={c.title}
              className="input h-8 min-w-[10rem] flex-1"
              maxLength={200}
              disabled={busy}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.title) void call(`/api/exam-collections/${c.id}`, { method: "PATCH", body: JSON.stringify({ title: v }) });
              }}
            />
            <span className="w-16 text-right text-muted tabular-nums">{c.examCount} đề</span>
            <button type="button" className="btn-ghost btn-sm" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Đưa bộ ${c.title} lên`}>↑</button>
            <button type="button" className="btn-ghost btn-sm" disabled={busy || i === collections.length - 1} onClick={() => move(i, 1)} aria-label={`Đưa bộ ${c.title} xuống`}>↓</button>
            <button
              type="button"
              className="btn-ghost btn-sm text-danger-700"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Xoá bộ “${c.title}”? ${c.examCount} đề trong bộ sẽ về “Khác”, không bị xoá.`)) void call(`/api/exam-collections/${c.id}`, { method: "DELETE" });
              }}
            >
              Xoá
            </button>
          </li>
        ))}
        {collections.length === 0 && <li className="text-meta">Chưa có bộ nào.</li>}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          if (await call(`/api/courses/${courseId}/exam-collections`, { method: "POST", body: JSON.stringify({ title }) })) setTitle("");
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input h-9 flex-1" placeholder="Tên bộ mới, ví dụ Part 1" maxLength={200} aria-label="Tên bộ mới" />
        <button type="submit" className="btn-secondary btn-sm" disabled={busy || !title.trim()}>Thêm bộ</button>
      </form>
      {error && <p role="alert" className="banner-danger mt-2 text-sm">{error}</p>}
    </section>
  );
}
