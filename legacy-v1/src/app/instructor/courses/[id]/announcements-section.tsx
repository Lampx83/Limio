"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface Announcement {
  id: number;
  title: string;
  body: string;
  pinned: number;
  created_at: string;
}

export default function AnnouncementsSection({
  courseId,
  items,
}: {
  courseId: number;
  items: Announcement[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/instructor/courses/${courseId}/announcements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body, pinned }),
        },
      );
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Lưu thất bại");
        return;
      }
      setTitle("");
      setBody("");
      setPinned(false);
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-lg font-semibold">📢 Thông báo ({items.length})</h2>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn-primary text-sm">
            + Đăng thông báo
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="card p-3 sm:p-4 space-y-2 mb-3">
          <input
            className="input text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề thông báo"
            required
            minLength={3}
          />
          <textarea
            className="input text-sm min-h-[80px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Nội dung..."
            required
            minLength={10}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Ghim lên đầu
          </label>
          {error && <div className="text-xs text-rose-600">{error}</div>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary text-sm"
            >
              Huỷ
            </button>
            <button disabled={submitting} className="btn-primary text-sm">
              {submitting ? "..." : "Đăng"}
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="card p-4 text-sm text-slate-500 italic text-center">
            Chưa có thông báo nào.
          </li>
        )}
        {items.map((a) => (
          <li key={a.id} className="card p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {a.pinned === 1 && <span className="badge-amber text-xs">📌 Ghim</span>}
              <p className="font-medium">{a.title}</p>
              <span className="text-xs text-slate-400 ml-auto">{a.created_at}</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
              {a.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
