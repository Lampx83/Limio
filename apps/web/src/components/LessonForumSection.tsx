"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

interface Thread {
  id: string;
  title: string;
  body: string;
  resolvedPostId: string | null;
  createdAt: Date;
  author: { displayName: string };
  _count: { posts: number };
}

export default function LessonForumSection({
  lessonId,
  courseSlug,
  threads,
}: {
  lessonId: string;
  courseSlug: string;
  threads: Thread[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}/forum-threads`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    setBusy(false);
    if (res.ok) {
      setTitle("");
      setBody("");
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "create_failed");
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Thảo luận</h2>
        {!open && (
          <button onClick={() => setOpen(true)} className="link text-sm">
            + Đặt câu hỏi
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={onSubmit}
          className="mt-4 space-y-3 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="Tiêu đề câu hỏi"
            className="input"
            autoFocus
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            placeholder="Mô tả chi tiết — context, lỗi gặp phải, đã thử gì..."
            className="textarea"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy} className="btn-primary btn-sm">
              {busy ? "..." : "Đăng câu hỏi"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="btn-secondary btn-sm"
            >
              Hủy
            </button>
            {error && (
              <span className="text-xs text-danger-600">Lỗi: {error}</span>
            )}
          </div>
        </form>
      )}

      {threads.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-token p-8 text-center text-sm text-faint">
          Chưa có câu hỏi nào. Đặt câu hỏi đầu tiên!
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                href={`/learn/${courseSlug}/threads/${t.id}`}
                className="card-hover group block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {t.resolvedPostId && (
                      <span className="mt-0.5 chip-success">✓</span>
                    )}
                    <p className="font-semibold transition-colors group-hover:text-brand-600">
                      {t.title}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-faint">
                    {t._count.posts} trả lời
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{t.body}</p>
                <p className="mt-2 text-xs text-faint">
                  <span className="font-medium">{t.author.displayName}</span>
                  <span className="mx-1.5">·</span>
                  {new Date(t.createdAt).toLocaleString("vi-VN")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
