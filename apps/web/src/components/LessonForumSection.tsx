"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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

// 8 màu pastel xoay vòng — ổn định theo hash thread.id để mỗi câu hỏi
// luôn cùng màu, không nhảy random giữa các render.
const PALETTE = [
  { bg: "bg-amber-50 dark:bg-amber-950/30", ring: "ring-amber-200/70 dark:ring-amber-800/40", tape: "bg-amber-300/70" },
  { bg: "bg-rose-50 dark:bg-rose-950/30", ring: "ring-rose-200/70 dark:ring-rose-800/40", tape: "bg-rose-300/70" },
  { bg: "bg-sky-50 dark:bg-sky-950/30", ring: "ring-sky-200/70 dark:ring-sky-800/40", tape: "bg-sky-300/70" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", ring: "ring-emerald-200/70 dark:ring-emerald-800/40", tape: "bg-emerald-300/70" },
  { bg: "bg-violet-50 dark:bg-violet-950/30", ring: "ring-violet-200/70 dark:ring-violet-800/40", tape: "bg-violet-300/70" },
  { bg: "bg-orange-50 dark:bg-orange-950/30", ring: "ring-orange-200/70 dark:ring-orange-800/40", tape: "bg-orange-300/70" },
  { bg: "bg-lime-50 dark:bg-lime-950/30", ring: "ring-lime-200/70 dark:ring-lime-800/40", tape: "bg-lime-300/70" },
  { bg: "bg-pink-50 dark:bg-pink-950/30", ring: "ring-pink-200/70 dark:ring-pink-800/40", tape: "bg-pink-300/70" },
];

// Avatar initial pill — 8 màu match-ish palette để tạo sense of diversity
const AVATAR_PALETTE = [
  "bg-amber-500", "bg-rose-500", "bg-sky-500", "bg-emerald-500",
  "bg-violet-500", "bg-orange-500", "bg-lime-600", "bg-pink-500",
];

function hashIdx(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

function relativeTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} ngày trước`;
  return new Date(d).toLocaleDateString("vi-VN");
}

const PROMPT_SUGGESTIONS = [
  "Mình không hiểu chỗ...",
  "Có ai gặp lỗi tương tự không?",
  "Tại sao lại dùng cách này?",
];

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

  // Distinct authors → social-proof count
  const uniqueAuthors = useMemo(
    () => new Set(threads.map((t) => t.author.displayName)).size,
    [threads],
  );

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

  const openComposer = (prompt?: string) => {
    setOpen(true);
    if (prompt) setTitle(prompt);
  };

  const composerCard = (
    <div className="relative overflow-hidden rounded-2xl border-2 border-brand-300 bg-[rgb(var(--surface))] p-5 shadow-card dark:border-brand-700">
      <div>
        {!open ? (
          <div>
            <p className="text-base font-bold">💬 Đặt câu hỏi cho bài này</p>
            <p className="mt-1 text-sm text-muted">
              Không có câu hỏi ngu đâu — biết đâu bạn hỏi giúp cả lớp hiểu rõ
              hơn ✨
            </p>
            <button
              type="button"
              onClick={() => openComposer()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md hover:-translate-y-0.5"
            >
              + Viết câu hỏi
            </button>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PROMPT_SUGGESTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => openComposer(p)}
                  className="rounded-full border border-token bg-[rgb(var(--surface-muted))] px-3 py-1 text-xs text-muted transition-colors hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
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
              placeholder="Mô tả chi tiết — context, đã thử gì, lỗi gặp phải..."
              className="textarea"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={busy}
                className="btn-primary btn-sm"
              >
                {busy ? "..." : "Đăng câu hỏi"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                  setTitle("");
                  setBody("");
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
      </div>
    </div>
  );

  return (
    <section>
      {/* Header row — social proof */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">💬 Thảo luận</h2>
        {threads.length > 0 && (
          <p className="text-xs text-muted">
            <span className="font-semibold text-[rgb(var(--text))]">
              {threads.length}
            </span>{" "}
            câu hỏi
            {uniqueAuthors > 1 && (
              <>
                {" · "}
                <span className="font-semibold text-[rgb(var(--text))]">
                  {uniqueAuthors}
                </span>{" "}
                học viên đang trao đổi
              </>
            )}
          </p>
        )}
      </div>

      {threads.length === 0 ? (
        // Empty state — colorful invite
        <div className="mt-5">
          {composerCard}
          <div className="mt-6 rounded-2xl border-2 border-dashed border-token bg-gradient-to-br from-amber-50/50 via-rose-50/30 to-violet-50/50 p-10 text-center dark:from-amber-950/20 dark:via-rose-950/20 dark:to-violet-950/20">
            <div className="text-5xl">🎉</div>
            <p className="mt-4 text-base font-semibold">
              Chưa có câu hỏi nào ở bài này
            </p>
            <p className="mt-1 text-sm text-muted">
              Hãy là người đầu tiên khơi mào — câu hỏi của bạn có thể giúp
              hàng chục bạn khác sau này.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Composer luôn ở grid cell đầu */}
          <div>{composerCard}</div>

          {threads.map((t) => {
            const c = PALETTE[hashIdx(t.id, PALETTE.length)]!;
            const av = AVATAR_PALETTE[hashIdx(t.author.displayName, AVATAR_PALETTE.length)]!;
            const initial =
              t.author.displayName?.trim().charAt(0).toUpperCase() || "?";
            return (
              <Link
                key={t.id}
                href={`/learn/${courseSlug}/threads/${t.id}`}
                className={`group relative block rounded-2xl ${c.bg} p-5 shadow-sm ring-1 ${c.ring} transition-all hover:-translate-y-1 hover:shadow-lg hover:rotate-[-0.4deg]`}
              >
                {/* "Tape" trang trí trên đầu — giống sticky note Padlet */}
                <span
                  aria-hidden
                  className={`absolute left-1/2 top-0 h-3 w-12 -translate-x-1/2 -translate-y-1/2 rounded-sm ${c.tape} opacity-80 shadow-sm`}
                />

                {t.resolvedPostId && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                    ✓ Đã giải
                  </span>
                )}

                <p className="line-clamp-2 pr-12 text-[15px] font-bold leading-snug text-[rgb(var(--text))]">
                  {t.title}
                </p>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[rgb(var(--text-muted))]">
                  {t.body}
                </p>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${av}`}
                    >
                      {initial}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[rgb(var(--text))]">
                        {t.author.displayName}
                      </p>
                      <p className="text-[11px] text-faint">
                        {relativeTime(t.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-[rgb(var(--text))] shadow-sm backdrop-blur dark:bg-black/30">
                    💬 {t._count.posts}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
