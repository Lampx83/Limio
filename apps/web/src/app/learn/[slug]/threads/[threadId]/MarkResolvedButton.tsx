"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MarkResolvedButton({
  threadId,
  postId,
}: {
  threadId: string;
  postId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const res = await fetch(`/api/forum-threads/${threadId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded border border-emerald-400 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
    >
      ✓ Đánh dấu là câu trả lời
    </button>
  );
}
