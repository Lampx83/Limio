"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
    const res = await fetch(`/api/lessons/${lessonId}/forum-threads`, {
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
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">💬 Thảo luận</h2>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="text-sm text-slate-600 underline hover:text-slate-800 dark:text-slate-400"
          >
            + Đặt câu hỏi
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={onSubmit}
          className="mt-3 space-y-2 rounded border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="Tiêu đề câu hỏi"
            className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            placeholder="Mô tả chi tiết..."
            className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              {busy ? "..." : "Đăng"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
            >
              Hủy
            </button>
            {error && <span className="text-xs text-red-600">Lỗi: {error}</span>}
          </div>
        </form>
      )}

      {threads.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Chưa có câu hỏi nào. Đặt câu hỏi đầu tiên!
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {threads.map((t) => (
            <li
              key={t.id}
              className="rounded border border-slate-200 p-3 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
            >
              <Link
                href={`/learn/${courseSlug}/threads/${t.id}`}
                className="block"
              >
                <div className="flex items-baseline justify-between">
                  <p className="font-medium">
                    {t.resolvedPostId && (
                      <span className="mr-1 text-emerald-600">✓</span>
                    )}
                    {t.title}
                  </p>
                  <span className="text-xs text-slate-500">
                    {t._count.posts} câu trả lời
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                  {t.body}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t.author.displayName} ·{" "}
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
