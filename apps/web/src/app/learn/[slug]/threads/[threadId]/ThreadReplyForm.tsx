"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { useT } from "@/lib/i18n/client";

export default function ThreadReplyForm({ threadId }: { threadId: string }) {
  const router = useRouter();
  const t = useT();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/forum-threads/${threadId}/posts`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setBusy(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "post_failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-2">
      <h3 className="text-sm font-medium">{t("learn.thread.replyTitle")}</h3>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={4}
        placeholder={t("learn.thread.replyPlaceholder")}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-700"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "..." : t("learn.thread.replySubmit")}
        </button>
        {error && <span className="text-xs text-red-600">{t("learn.thread.errorPrefix", { error })}</span>}
      </div>
    </form>
  );
}
