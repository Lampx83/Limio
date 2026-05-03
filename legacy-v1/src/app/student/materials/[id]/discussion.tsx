"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface DiscussionPost {
  id: number;
  parent_id: number | null;
  content: string;
  created_at: string;
  author_name: string;
  is_instructor: number;
}

export default function Discussion({
  materialId,
  posts,
  currentUserName,
}: {
  materialId: number;
  posts: DiscussionPost[];
  currentUserName: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");

  async function postNew(parent_id: number | null, text: string) {
    if (text.trim().length < 5) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/materials/${materialId}/discussion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, parent_id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Gửi thất bại");
        return;
      }
      if (parent_id === null) setContent("");
      else {
        setReplyTo(null);
        setReplyContent("");
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const tops = posts.filter((p) => !p.parent_id);

  return (
    <div className="card p-4 sm:p-5">
      <h3 className="font-semibold mb-3">💬 Thảo luận ({posts.length} bài)</h3>

      <div className="border border-slate-200 dark:border-slate-700 rounded p-3 mb-4">
        <p className="text-xs text-slate-500 mb-2">Đăng bài (tối thiểu 5 ký tự)</p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="input text-sm min-h-[80px] mb-2"
          placeholder={`${currentUserName}, chia sẻ ý kiến của bạn...`}
        />
        {error && <div className="text-xs text-rose-600 mb-2">{error}</div>}
        <div className="flex justify-end">
          <button
            onClick={() => postNew(null, content)}
            disabled={submitting || content.trim().length < 5}
            className="btn-primary text-sm"
          >
            {submitting ? "..." : "Đăng bài"}
          </button>
        </div>
      </div>

      <ul className="space-y-3">
        {tops.length === 0 && (
          <li className="text-sm text-slate-500 italic text-center py-4">
            Chưa có bài thảo luận. Hãy là người đầu tiên!
          </li>
        )}
        {tops.map((p) => (
          <li key={p.id} className="border-l-2 border-brand-300 pl-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <strong className="text-slate-700 dark:text-slate-200">{p.author_name}</strong>
              {p.is_instructor === 1 && (
                <span className="badge-amber text-[10px]">GV</span>
              )}
              <span>·</span>
              <span>{p.created_at}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{p.content}</p>
            <button
              onClick={() => setReplyTo(replyTo === p.id ? null : p.id)}
              className="text-xs text-brand-600 hover:underline mt-1"
            >
              {replyTo === p.id ? "Huỷ" : "↩ Trả lời"}
            </button>
            {replyTo === p.id && (
              <div className="mt-2 ml-3">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="input text-xs min-h-[60px] mb-1"
                  placeholder="Trả lời..."
                />
                <button
                  onClick={() => postNew(p.id, replyContent)}
                  disabled={submitting || replyContent.trim().length < 5}
                  className="btn-primary text-xs py-1 px-2"
                >
                  Gửi trả lời
                </button>
              </div>
            )}
            {/* Replies */}
            <ul className="mt-2 ml-4 space-y-2">
              {posts
                .filter((c) => c.parent_id === p.id)
                .map((c) => (
                  <li key={c.id} className="border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
                      <strong className="text-slate-700 dark:text-slate-200">{c.author_name}</strong>
                      {c.is_instructor === 1 && (
                        <span className="badge-amber text-[10px]">GV</span>
                      )}
                      <span>· {c.created_at}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
