"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

type Status = "pending" | "passed" | "failed" | "disqualified";

export default function MissionGradeForm({
  tournamentId,
  submissionId,
  status,
}: {
  tournamentId: string;
  submissionId: string;
  status: Status;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "pass" | "fail">(null);

  async function grade(passed: boolean) {
    if (busy) return;
    setBusy(passed ? "pass" : "fail");
    try {
      const res = await fetch(
        apiUrl(`/api/instructor/tournaments/${tournamentId}/grade`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId, passed }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "request_failed");
      }
      toast.success(passed ? "Đã chấm: Đạt" : "Đã chấm: Chưa đạt");
      router.refresh();
    } catch {
      toast.error("Chấm thất bại", { description: "Vui lòng thử lại." });
    } finally {
      setBusy(null);
    }
  }

  const graded = status === "passed" || status === "failed";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {graded && (
        <span className="text-faint">
          {status === "passed" ? "Đã chấm: Đạt" : "Đã chấm: Chưa đạt"} · chấm lại:
        </span>
      )}
      <button
        type="button"
        onClick={() => grade(true)}
        disabled={busy !== null}
        className="inline-flex items-center gap-1 rounded-lg bg-success-600 px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-success-700 disabled:opacity-60"
      >
        <CheckCircle2 size={14} />
        {busy === "pass" ? "Đang lưu…" : "Đạt"}
      </button>
      <button
        type="button"
        onClick={() => grade(false)}
        disabled={busy !== null}
        className="inline-flex items-center gap-1 rounded-lg border border-danger-300 bg-white px-3 py-1.5 font-semibold text-danger-700 transition hover:bg-danger-50 disabled:opacity-60 dark:bg-slate-800 dark:hover:bg-danger-950/40"
      >
        <XCircle size={14} />
        {busy === "fail" ? "Đang lưu…" : "Chưa đạt"}
      </button>
    </div>
  );
}
