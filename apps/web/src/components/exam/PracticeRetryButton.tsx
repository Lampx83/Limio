"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

/** LANG G5e.7 — "Làm lại câu sai": mở buổi luyện mới chỉ gồm các câu sai của buổi này. */
export default function PracticeRetryButton({ slug, examId, sessionId }: { slug: string; examId: string; sessionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/exams/${examId}/practice`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ retryOfSessionId: sessionId }),
      });
      const j = (await res.json().catch(() => null)) as { sessionId?: string } | null;
      if (!res.ok || !j?.sessionId) {
        setError("Không mở được buổi luyện mới. Có thể bạn đang có một buổi dở — hãy tiếp tục hoặc bỏ buổi đó trước.");
        setBusy(false);
        return;
      }
      router.push(`/learn/${slug}/exams/${examId}/practice/${j.sessionId}`);
    } catch {
      setError("Không mở được buổi luyện mới.");
      setBusy(false);
    }
  }
  return (
    <span>
      <button type="button" onClick={() => void go()} disabled={busy} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        {busy ? "Đang mở…" : "Làm lại câu sai"}
      </button>
      {error && <span role="alert" className="ml-3 text-sm text-red-700">{error}</span>}
    </span>
  );
}
