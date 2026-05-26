"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Trigger an on-demand recompute of ExamQuestionStats for the currently
 * selected exam. The nightly cron is the source of truth; this button lets
 * the instructor skip the wait when they want immediate feedback (e.g. right
 * after a 100+ student session).
 *
 * POSTs to /api/exams/[examId]/analytics/run — same endpoint as the
 * exam-detail Analytics panel. router.refresh() picks up the new stats.
 */
export default function RecomputeButton({ examId }: { examId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<{
    questionsScanned: number;
    statsWritten: number;
  } | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch(apiUrl(`/api/exams/${examId}/analytics/run`), {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${res.status}`);
        return;
      }
      const j = (await res.json()) as {
        questionsScanned: number;
        statsWritten: number;
      };
      setOk(j);
      router.refresh();
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-md border border-brand-300 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
      >
        {busy ? "Đang tính..." : "⟳ Tính lại ngay"}
      </button>
      {ok && (
        <span className="text-xs text-success-700">
          ✓ Đã tính lại {ok.statsWritten}/{ok.questionsScanned} câu
        </span>
      )}
      {err && <span className="text-xs text-danger-700">Lỗi: {err}</span>}
    </div>
  );
}
